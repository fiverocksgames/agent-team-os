import { spawn, type ChildProcess } from "node:child_process";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
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

export interface AuthorityPolicy {
  mayModify: boolean;
  mayCommit: boolean;
  mayOpenPr: boolean;
  mayMerge: boolean;
}

export type ImplementationOperation =
  | { kind: "write_file"; relativePath: string; content: string }
  | { kind: "commit"; message: string }
  | { kind: "open_pr" }
  | { kind: "merge" };

export interface ImplementationConfig {
  /** Parent-supplied allowlist relative to the explicitly selected isolated workspace. */
  allowedRelativePaths: readonly string[];
  /** The implementation contract rejects any workspace with a configured remote. */
  requireNoRemote: true;
}

export interface ImplementationEvidence {
  filesChanged: string[];
  commitCreated: boolean;
  prCreated: false;
  mergeOccurred: false;
}

export interface ImplementationLifecycleDispatchResult extends LifecycleDispatchResult {
  implementation: ImplementationEvidence;
}

export interface ImplementationDispatchConfig extends DispatchConfig {
  implementation: ImplementationConfig;
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

const execFile = promisify(execFileCallback);

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

/**
 * Converts the immutable validated authority payload into the only operation set
 * this reference implementation can perform. PR and merge automation remain
 * explicitly unsupported even if a future task carries those bits.
 */
export function deriveAuthorityPolicy(record: LifecycleRecord): AuthorityPolicy {
  const authority = record.authority;
  const keys = ["may_modify", "may_commit", "may_open_pr", "may_merge"] as const;
  if (keys.some((key) => typeof authority[key] !== "boolean")) {
    throw new BridgeError("INVALID_AUTHORITY", "validated authority must contain boolean operation bits");
  }
  const policy: AuthorityPolicy = {
    mayModify: authority.may_modify as boolean,
    mayCommit: authority.may_commit as boolean,
    mayOpenPr: authority.may_open_pr as boolean,
    mayMerge: authority.may_merge as boolean,
  };
  if (policy.mayCommit && !policy.mayModify) {
    throw new BridgeError("INVALID_AUTHORITY_COMBINATION", "may_commit requires may_modify");
  }
  if (policy.mayOpenPr && !policy.mayCommit) {
    throw new BridgeError("INVALID_AUTHORITY_COMBINATION", "may_open_pr requires may_commit");
  }
  if (policy.mayMerge) {
    throw new BridgeError("UNSUPPORTED_AUTHORITY_COMBINATION", "automatic merge authority is outside this reference contract");
  }
  return Object.freeze(policy);
}

/**
 * Parent-owned implementation seam. It never delegates repository authority to
 * the model: the parent checks an explicit file allowlist, requires a no-remote
 * isolated workspace, executes only supported local operations, and verifies
 * their observable Git effects before terminal dispatch.
 */
export async function executeImplementation(
  record: LifecycleRecord,
  workspace: string,
  config: ImplementationConfig,
  operations: readonly ImplementationOperation[],
): Promise<ImplementationEvidence> {
  const policy = deriveAuthorityPolicy(record);
  const root = path.resolve(workspace);
  const allowed = new Set(config.allowedRelativePaths.map((entry) => normalizeAllowedPath(root, entry)));
  if (allowed.size === 0) throw new BridgeError("EMPTY_IMPLEMENTATION_SCOPE", "implementation requires a non-empty explicit file allowlist");
  if (!config.requireNoRemote) throw new BridgeError("UNSAFE_IMPLEMENTATION_SCOPE", "implementation requires a no-remote isolated workspace");
  if ((await git(root, ["remote"])).trim()) throw new BridgeError("UNSAFE_IMPLEMENTATION_SCOPE", "implementation workspace must not have a Git remote");
  if ((await git(root, ["status", "--porcelain"])).trim()) throw new BridgeError("DIRTY_IMPLEMENTATION_WORKSPACE", "implementation workspace must start clean");

  const beforeHead = (await git(root, ["rev-parse", "HEAD"])).trim();
  const touched = new Set<string>();
  for (const operation of operations) {
    if (operation.kind === "write_file") {
      if (!policy.mayModify) throw new BridgeError("AUTHORITY_DENIED", "may_modify=false forbids repository modification");
      const target = normalizeAllowedPath(root, operation.relativePath);
      if (!allowed.has(target)) throw new BridgeError("FILE_SCOPE_VIOLATION", "requested file is outside the parent allowlist");
      await assertSafeExistingTarget(root, target);
      await writeFile(path.join(root, target), operation.content, "utf8");
      touched.add(target);
      continue;
    }
    if (operation.kind === "commit") {
      if (!policy.mayCommit) throw new BridgeError("AUTHORITY_DENIED", "may_commit=false forbids local commits");
      const changed = await changedPaths(root);
      verifyChangedPaths(changed, allowed);
      if (changed.length === 0) throw new BridgeError("NO_IMPLEMENTATION_CHANGE", "local commit requires an allowed file change");
      await git(root, ["add", "--", ...changed]);
      await git(root, ["commit", "-m", operation.message]);
      continue;
    }
    if (operation.kind === "open_pr") {
      if (!policy.mayOpenPr) throw new BridgeError("AUTHORITY_DENIED", "may_open_pr=false forbids PR creation");
      throw new BridgeError("UNSUPPORTED_AUTHORITY_OPERATION", "PR creation is outside this reference contract");
    }
    if (!policy.mayMerge) throw new BridgeError("AUTHORITY_DENIED", "may_merge=false forbids merge");
    throw new BridgeError("UNSUPPORTED_AUTHORITY_OPERATION", "merge is outside this reference contract");
  }

  const changed = await changedPaths(root);
  verifyChangedPaths(changed, allowed);
  const afterHead = (await git(root, ["rev-parse", "HEAD"])).trim();
  if (afterHead !== beforeHead) verifyChangedPaths(await committedPaths(root), allowed);
  if (touched.size > 0 && changed.length === 0 && afterHead === beforeHead) {
    throw new BridgeError("NO_IMPLEMENTATION_CHANGE", "parent did not observe the requested allowed file change");
  }
  return Object.freeze({
    filesChanged: [...touched],
    commitCreated: afterHead !== beforeHead,
    prCreated: false,
    mergeOccurred: false,
  });
}

async function git(workspace: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFile("git", args, { cwd: workspace, windowsHide: true });
    return stdout;
  } catch {
    throw new BridgeError("LOCAL_GUARDRAIL_PROCESS_FAILED", "parent guardrail could not inspect or apply the isolated Git workspace");
  }
}

function normalizeAllowedPath(workspace: string, relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath)) throw new BridgeError("FILE_SCOPE_VIOLATION", "implementation paths must be non-empty and workspace-relative");
  const normalized = path.normalize(relativePath);
  const resolved = path.resolve(workspace, normalized);
  const relation = path.relative(workspace, resolved);
  if (!relation || relation.startsWith("..") || path.isAbsolute(relation)) {
    throw new BridgeError("FILE_SCOPE_VIOLATION", "implementation path escapes the isolated workspace");
  }
  return relation.split(path.sep).join("/");
}

async function assertSafeExistingTarget(workspace: string, relativePath: string): Promise<void> {
  try {
    const realRoot = await realpath(workspace);
    const realTarget = await realpath(path.join(workspace, relativePath));
    const relation = path.relative(realRoot, realTarget);
    if (!relation || relation.startsWith("..") || path.isAbsolute(relation)) {
      throw new BridgeError("FILE_SCOPE_VIOLATION", "implementation target resolves outside the isolated workspace");
    }
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    throw new BridgeError("FILE_SCOPE_VIOLATION", "implementation target must be an existing non-escaping workspace file");
  }
}

async function changedPaths(workspace: string): Promise<string[]> {
  const status = await git(workspace, ["status", "--porcelain"]);
  return status.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).replace(/\\/g, "/"));
}

async function committedPaths(workspace: string): Promise<string[]> {
  const paths = await git(workspace, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]);
  return paths.split(/\r?\n/).filter(Boolean).map((entry) => entry.replace(/\\/g, "/"));
}

function verifyChangedPaths(paths: string[], allowed: ReadonlySet<string>): void {
  if (paths.some((entry) => !allowed.has(entry))) {
    throw new BridgeError("FILE_SCOPE_VIOLATION", "observed repository change is outside the parent allowlist");
  }
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

/**
 * Runs the same ACK gate and terminal validation as dispatchLifecycle, with
 * parent-owned, allowlisted local effects between them. Guardrail failures
 * reject locally and are never converted into an external ATCP ERROR.
 */
export async function dispatchImplementationLifecycle(
  task: JsonObject,
  config: ImplementationDispatchConfig,
  terminalSchemaPath: string,
  operations: readonly ImplementationOperation[],
  terminalOutcome: TerminalOutcome = "RESULT",
): Promise<ImplementationLifecycleDispatchResult> {
  const record = await createLifecycleRecord(task, config.taskSchemaPath);
  const lifecycle = new ParentLifecycle(record);
  config.onLifecycleCreated?.(lifecycle);
  const ack = await dispatchResponse(record.task, config, "ACK");
  lifecycle.recordAcceptedAck(ack.payload);
  await config.beforeTerminalSpawn?.(lifecycle);
  const implementation = await executeImplementation(record, config.workspace, config.implementation, operations);
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
  return { record, ack, terminalOutcome, terminal, implementation };
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
