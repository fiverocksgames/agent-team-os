import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

type JsonObject = Record<string, unknown>;

export interface DispatchConfig {
  agyPath: string;
  workspace: string;
  taskSchemaPath: string;
  responseSchemaPath: string;
  timeoutMs?: number;
  model?: string;
  agent?: string;
  effort?: "low" | "medium" | "high";
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

export function extractStructuredOutput(lines: string[]): { payload: JsonObject; eventTypes: string[] } {
  const eventTypes: string[] = [];
  let structured: unknown;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      throw new BridgeError("INVALID_STREAM_JSON", "agy stdout contained a non-JSON stream line");
    }
    if (!isObject(event)) continue;
    if (typeof event.event === "string") eventTypes.push(event.event);
    if (event.event === "result" && isObject(event.result) && "structured_output" in event.result) {
      structured = event.result.structured_output;
    }
  }

  if (!isObject(structured)) {
    throw new BridgeError("MISSING_STRUCTURED_OUTPUT", "agy stream did not contain $.result.structured_output as an object");
  }
  return { payload: structured, eventTypes };
}

export function buildTlPrompt(task: JsonObject): string {
  return [
    "You are the public Technical Lead boundary of an independent Antigravity software team.",
    "Return only the schema-conforming ATCP response requested by this invocation.",
    "Do not invent authority beyond the TASK_ASSIGN payload.",
    "Do not use tools for this ACK-only reference milestone and do not modify files.",
    "Preserve task_id and conversation_id exactly.",
    "TASK_ASSIGN:",
    JSON.stringify(task),
  ].join("\n");
}

export async function dispatchAck(task: JsonObject, config: DispatchConfig): Promise<DispatchResult> {
  await validateAgainstSchema(task, config.taskSchemaPath);

  const args = ["--output-format", "stream-json", "--json-schema", path.resolve(config.responseSchemaPath)];
  if (config.model) args.push("--model", config.model);
  if (config.agent) args.push("--agent", config.agent);
  if (config.effort) args.push("--effort", config.effort);
  args.push("--print", buildTlPrompt(task));

  const env = { ...process.env };
  for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy"]) {
    delete env[key];
  }

  const timeoutMs = config.timeoutMs ?? 300_000;
  const child = spawn(config.agyPath, args, {
    cwd: config.workspace,
    env,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

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
  enforceCorrelation(task, payload);

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

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
