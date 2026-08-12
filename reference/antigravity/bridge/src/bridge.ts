import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats = require("ajv-formats");

type JsonObject = Record<string, unknown>;
export type TerminalOutcome = "RESULT" | "ERROR";

export interface DispatchConfig {
  agyPath: string;
  workspace: string;
  taskSchemaPath: string;
  responseSchemaPath: string;
  timeoutMs?: number;
  model?: string;
  agent?: string;
  effort?: "low" | "medium" | "high";
  spawnProcess?: typeof spawn;
  beforeTerminalSpawn?: (lifecycle: ParentLifecycle) => Promise<void> | void;
  onLifecycleCreated?: (lifecycle: ParentLifecycle) => void;
}

export interface DispatchEvidence {
  transport: "antigravity-cli";
  outputFormat: "stream-json";
  eventTypes: string[];
  exitCode: number;
  timedOut: boolean;
  stderrPresent: boolean;
}

export interface DispatchResult {
  payload: JsonObject;
  evidence: DispatchEvidence;
}

export interface LifecycleRecord {
  task: JsonObject;
  taskDigest: string;
  taskId: string;
  conversationId: string;
  expectedFrom: string;
  expectedTo: string;
  authority: JsonObject;
}

export interface LifecycleDispatchResult {
  record: LifecycleRecord;
  ack: DispatchResult;
  terminalOutcome: TerminalOutcome;
  terminal: DispatchResult;
}

export type ParentLifecycleState = "PENDING_ACK" | "ACK_ACCEPTED" | "TERMINAL_ACTIVE" | "CANCELLED" | "TERMINAL_COMMITTED";

export interface CancelResult {
  state: ParentLifecycleState;
  idempotent: boolean;
  localChildTermination: "NOT_APPLICABLE" | "TERMINATED";
}

export class BridgeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "BridgeError";
  }
}

export async function loadJsonObject(filePath: string): Promise<JsonObject> {
  const parsed = JSON.parse(await readFile(filePath, "utf8"));
  if (!isObject(parsed)) throw new BridgeError("INVALID_JSON_OBJECT", `${filePath} must contain a JSON object`);
  return parsed;
}

export async function validateAgainstSchema(payload: unknown, schemaPath: string): Promise<void> {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  (addFormats as unknown as (instance: Ajv2020) => void)(ajv);
  const validate = ajv.compile(schema);
  if (!validate(payload)) {
    throw new BridgeError("SCHEMA_VALIDATION_FAILED", ajv.errorsText(validate.errors, { separator: "; " }));
  }
}

export function enforceCorrelation(request: JsonObject, response: JsonObject): void {
  for (const key of ["task_id", "conversation_id"] as const) {
    if (typeof request[key] !== "string" || typeof response[key] !== "string" || request[key] !== response[key]) {
      throw new BridgeError("CORRELATION_MISMATCH", `${key} does not match pending request`);
    }
  }
}

export function enforceResponseIdentity(request: JsonObject, response: JsonObject): void {
  enforceCorrelation(request, response);
  if (typeof request.to !== "string" || typeof request.from !== "string" || response.from !== request.to || response.to !== request.from) {
    throw new BridgeError("PEER_MISMATCH", "response sender/recipient does not match the pending request");
  }
}

export function enforceAcceptedAck(response: JsonObject): void {
  if (response.accepted !== true || response.state !== "ACCEPTED") {
    throw new BridgeError("ACK_NOT_ACCEPTED", "RESULT dispatch requires an accepted ACK in ACCEPTED state");
  }
}

export function enforceCancelIdentity(task: JsonObject, cancel: JsonObject): void {
  enforceCorrelation(task, cancel);
  if (typeof task.from !== "string" || typeof task.to !== "string" || cancel.from !== task.from || cancel.to !== task.to) {
    throw new BridgeError("PEER_MISMATCH", "CANCEL sender/recipient does not match the parent-authorized task boundary");
  }
}

/** Parent-owned coordination only. It never represents external-team acknowledgement. */
export class ParentLifecycle {
  private state: ParentLifecycleState = "PENDING_ACK";
  private activeChild: ChildProcess | undefined;

  constructor(public readonly record: LifecycleRecord) {}

  getState(): ParentLifecycleState { return this.state; }

  recordAcceptedAck(ack: JsonObject): void {
    if (this.state === "CANCELLED") throw new BridgeError("CANCELLATION_COMMITTED", "CANCEL prevents ACK/terminal progression");
    if (this.state !== "PENDING_ACK") throw new BridgeError("INVALID_LIFECYCLE_STATE", "ACK is not legal in the current lifecycle state");
    enforceResponseIdentity(this.record.task, ack);
    enforceAcceptedAck(ack);
    this.state = "ACK_ACCEPTED";
  }

  beginTerminal(child?: ChildProcess): void {
    if (this.state === "CANCELLED") throw new BridgeError("CANCELLATION_COMMITTED", "CANCEL prevents terminal child spawn");
    if (this.state !== "ACK_ACCEPTED") throw new BridgeError("INVALID_LIFECYCLE_STATE", "terminal dispatch requires an accepted ACK");
    this.activeChild = child;
    this.state = "TERMINAL_ACTIVE";
  }

  registerTerminalChild(child: ChildProcess): void {
    if (this.state === "CANCELLED") {
      if (!child.kill()) throw new BridgeError("LOCAL_TERMINATION_FAILED", "parent could not terminate a child spawned after CANCEL");
      throw new BridgeError("CANCELLATION_COMMITTED", "CANCEL prevents terminal child ownership");
    }
    if (this.state !== "TERMINAL_ACTIVE") throw new BridgeError("INVALID_LIFECYCLE_STATE", "terminal child is not legal in the current lifecycle state");
    this.activeChild = child;
  }

  commitTerminal(): void {
    if (this.state === "CANCELLED") throw new BridgeError("CANCELLATION_COMMITTED", "CANCEL owns this lifecycle");
    if (this.state !== "TERMINAL_ACTIVE") throw new BridgeError("INVALID_LIFECYCLE_STATE", "terminal completion is not legal in the current lifecycle state");
    this.activeChild = undefined;
    this.state = "TERMINAL_COMMITTED";
  }

  async requestCancel(cancel: JsonObject, cancelSchemaPath: string): Promise<CancelResult> {
    await validateAgainstSchema(cancel, cancelSchemaPath);
    enforceCancelIdentity(this.record.task, cancel);
    if (this.state === "TERMINAL_COMMITTED") throw new BridgeError("STALE_CANCEL", "CANCEL cannot replace a committed terminal outcome");
    if (this.state === "CANCELLED") return { state: this.state, idempotent: true, localChildTermination: "NOT_APPLICABLE" };

    const child = this.activeChild;
    this.activeChild = undefined;
    this.state = "CANCELLED";
    if (!child) return { state: this.state, idempotent: false, localChildTermination: "NOT_APPLICABLE" };
    if (!child.kill()) throw new BridgeError("LOCAL_TERMINATION_FAILED", "parent could not terminate its exact active child handle");
    return { state: this.state, idempotent: false, localChildTermination: "TERMINATED" };
  }
}

export async function createLifecycleRecord(task: JsonObject, taskSchemaPath: string): Promise<LifecycleRecord> {
  await validateAgainstSchema(task, taskSchemaPath);
  const taskCopy = JSON.parse(JSON.stringify(task)) as JsonObject;
  const required = ["task_id", "conversation_id", "from", "to"] as const;
  if (required.some((key) => typeof taskCopy[key] !== "string") || !isObject(taskCopy.authority)) {
    throw new BridgeError("INVALID_LIFECYCLE_RECORD", "validated TASK_ASSIGN is missing lifecycle identity or authority");
  }
  const immutableTask = deepFreezeJson(taskCopy);
  if (!isObject(immutableTask.authority)) {
    throw new BridgeError("INVALID_LIFECYCLE_RECORD", "immutable TASK_ASSIGN is missing authority");
  }
  return Object.freeze({
    task: immutableTask,
    taskDigest: createHash("sha256").update(JSON.stringify(taskCopy)).digest("hex"),
    taskId: taskCopy.task_id as string,
    conversationId: taskCopy.conversation_id as string,
    expectedFrom: taskCopy.to as string,
    expectedTo: taskCopy.from as string,
    authority: immutableTask.authority,
  });
}

export function extractStructuredOutput(lines: string[]): { payload: JsonObject; eventTypes: string[] } {
  const eventTypes: string[] = [];
  let structured: JsonObject | undefined;
  let sawResult = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      throw new BridgeError("INVALID_STREAM_JSON", "agy stdout contained a non-JSON stream line");
    }
    if (sawResult) {
      if (isObject(event) && event.event === "result") {
        throw new BridgeError("DUPLICATE_RESULT", "agy stream contained multiple result events");
      }
      throw new BridgeError("EVENT_AFTER_RESULT", "agy stream contained an event after the terminal result");
    }
    if (!isObject(event)) continue;
    if (typeof event.event === "string") eventTypes.push(event.event);
    if (event.event === "result") {
      if (!isObject(event.result) || !isObject(event.result.structured_output)) {
        throw new BridgeError("MISSING_STRUCTURED_OUTPUT", "agy result did not contain $.result.structured_output as an object");
      }
      sawResult = true;
      structured = event.result.structured_output;
    }
  }

  if (!sawResult || !structured) {
    throw new BridgeError("MISSING_STRUCTURED_OUTPUT", "agy stream did not contain $.result.structured_output as an object");
  }
  return { payload: structured, eventTypes };
}

export function buildTlPrompt(task: JsonObject, messageType: "ACK" | TerminalOutcome = "ACK"): string {
  const phaseInstruction = messageType === "ACK"
    ? "ACK-only: do not start implementation work."
    : messageType === "RESULT"
      ? "RESULT-only: report bounded completion for the supplied task context; do not invent authority beyond it."
      : "ERROR-only: report a bounded external task failure for the supplied task context; do not invent authority beyond it.";
  return [
    "You are the public Technical Lead boundary of an independent Antigravity software team.",
    "Return only the schema-conforming ATCP response requested by this invocation.",
    "Do not invent authority beyond the TASK_ASSIGN payload.",
    phaseInstruction,
    "Do not use tools or modify files in this reference validation slice.",
    `Return an ATCP ${messageType} message only.`,
    "Preserve task_id and conversation_id exactly.",
    "TASK_ASSIGN:",
    JSON.stringify(task),
  ].join("\n");
}

async function dispatchResponse(task: JsonObject, config: DispatchConfig, messageType: "ACK" | TerminalOutcome, onChildSpawned?: (child: ChildProcess) => void): Promise<DispatchResult> {

  const args = ["--output-format", "stream-json", "--json-schema", path.resolve(config.responseSchemaPath)];
  if (config.model) args.push("--model", config.model);
  if (config.agent) args.push("--agent", config.agent);
  if (config.effort) args.push("--effort", config.effort);
  args.push("--print", buildTlPrompt(task, messageType));

  const env = { ...process.env };
  for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy"]) {
    delete env[key];
  }

  const timeoutMs = config.timeoutMs ?? 300_000;
  const child = (config.spawnProcess ?? spawn)(config.agyPath, args, {
    cwd: config.workspace,
    env,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  onChildSpawned?.(child);

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, timeoutMs);

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? -1));
  }).finally(() => clearTimeout(timer));

  if (timedOut) throw new BridgeError("TIMEOUT", `agy exceeded ${timeoutMs} ms`);
  if (exitCode !== 0) throw new BridgeError("AGY_FAILED", `agy exited with code ${exitCode}; stderr_present=${stderr.trim().length > 0}`);

  const { payload, eventTypes } = extractStructuredOutput(stdout.split(/\r?\n/));
  await validateAgainstSchema(payload, config.responseSchemaPath);
  enforceResponseIdentity(task, payload);

  return {
    payload,
    evidence: {
      transport: "antigravity-cli",
      outputFormat: "stream-json",
      eventTypes,
      exitCode,
      timedOut: false,
      stderrPresent: stderr.trim().length > 0,
    },
  };
}

export async function dispatchAck(task: JsonObject, config: DispatchConfig): Promise<DispatchResult> {
  await validateAgainstSchema(task, config.taskSchemaPath);
  return dispatchResponse(task, config, "ACK");
}

export async function dispatchResult(record: LifecycleRecord, config: DispatchConfig): Promise<DispatchResult> {
  return dispatchResponse(record.task, config, "RESULT");
}

export async function dispatchError(record: LifecycleRecord, config: DispatchConfig): Promise<DispatchResult> {
  return dispatchResponse(record.task, config, "ERROR");
}

export async function dispatchLifecycle(task: JsonObject, config: DispatchConfig, terminalSchemaPath: string, terminalOutcome: TerminalOutcome = "RESULT"): Promise<LifecycleDispatchResult> {
  const record = await createLifecycleRecord(task, config.taskSchemaPath);
  const lifecycle = new ParentLifecycle(record);
  config.onLifecycleCreated?.(lifecycle);
  const ack = await dispatchResponse(record.task, config, "ACK");
  lifecycle.recordAcceptedAck(ack.payload);
  await config.beforeTerminalSpawn?.(lifecycle);
  lifecycle.beginTerminal();
  const terminalConfig = { ...config, responseSchemaPath: terminalSchemaPath };
  let terminal: DispatchResult;
  try {
    terminal = terminalOutcome === "RESULT"
      ? await dispatchResponse(record.task, terminalConfig, "RESULT", (child) => lifecycle.registerTerminalChild(child))
      : await dispatchResponse(record.task, terminalConfig, "ERROR", (child) => lifecycle.registerTerminalChild(child));
  } catch (error) {
    if (lifecycle.getState() === "CANCELLED") throw new BridgeError("CANCELLATION_COMMITTED", "CANCEL owns this lifecycle");
    throw error;
  }
  lifecycle.commitTerminal();
  return { record, ack, terminalOutcome, terminal };
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreezeJson(value: JsonObject): JsonObject {
  for (const [key, child] of Object.entries(value)) value[key] = deepFreezeValue(child);
  return Object.freeze(value);
}

function deepFreezeValue(value: unknown): unknown {
  if (isObject(value)) return deepFreezeJson(value);
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreezeValue));
  return value;
}
