import path from "node:path";
import { dispatchAck, dispatchLifecycle, loadJsonObject } from "./bridge.js";

interface Args {
  task?: string;
  workspace?: string;
  agy?: string;
  taskSchema?: string;
  responseSchema?: string;
  resultSchema?: string;
  phase?: "ack" | "lifecycle";
  timeoutMs?: number;
  model?: string;
  agent?: string;
  effort?: "low" | "medium" | "high";
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`invalid argument near ${key ?? "<end>"}`);
    switch (key) {
      case "--task": out.task = value; break;
      case "--workspace": out.workspace = value; break;
      case "--agy": out.agy = value; break;
      case "--task-schema": out.taskSchema = value; break;
      case "--response-schema": out.responseSchema = value; break;
      case "--result-schema": out.resultSchema = value; break;
      case "--phase":
        if (value !== "ack" && value !== "lifecycle") throw new Error("--phase must be ack|lifecycle");
        out.phase = value;
        break;
      case "--timeout-ms": out.timeoutMs = Number(value); break;
      case "--model": out.model = value; break;
      case "--agent": out.agent = value; break;
      case "--effort":
        if (!(["low", "medium", "high"] as const).includes(value as "low" | "medium" | "high")) throw new Error("--effort must be low|medium|high");
        out.effort = value as "low" | "medium" | "high";
        break;
      default: throw new Error(`unknown argument ${key}`);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.task || !args.workspace) {
    throw new Error("required: --task <task-assign.json> --workspace <path>");
  }

  const bridgeDir = path.resolve(import.meta.dirname, "..", "..");
  const repoRoot = path.resolve(bridgeDir, "..", "..", "..");
  const taskSchema = args.taskSchema ?? path.join(repoRoot, "atcp", "v1", "schemas", "task-assign.schema.json");
  const responseSchema = args.responseSchema ?? path.join(repoRoot, "atcp", "v1", "schemas", "ack.schema.json");
  const resultSchema = args.resultSchema ?? path.join(repoRoot, "atcp", "v1", "schemas", "result.schema.json");

  const task = await loadJsonObject(path.resolve(args.task));
  const config = {
    agyPath: args.agy ?? "agy",
    workspace: path.resolve(args.workspace),
    taskSchemaPath: taskSchema,
    responseSchemaPath: responseSchema,
    timeoutMs: args.timeoutMs,
    model: args.model,
    agent: args.agent,
    effort: args.effort,
  };

  if (args.phase === "lifecycle") {
    const lifecycle = await dispatchLifecycle(task, config, resultSchema);
    const { task: recordTask, authority: recordAuthority, ...recordEvidence } = lifecycle.record;
    process.stdout.write(`${JSON.stringify({
      status: "PASS",
      lifecycle: { record: recordEvidence, ack: lifecycle.ack, result: lifecycle.result },
    })}\n`);
    return;
  }

  const result = await dispatchAck(task, config);

  process.stdout.write(`${JSON.stringify({ status: "PASS", ...result })}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "UNEXPECTED_ERROR";
  process.stderr.write(`${JSON.stringify({ status: "FAIL", code, message })}\n`);
  process.exitCode = 1;
});
