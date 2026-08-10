import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { BridgeError, enforceCorrelation, extractStructuredOutput, validateAgainstSchema } from "../src/bridge.js";

const bridgeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = path.resolve(bridgeDir, "..", "..", "..");
const taskSchema = path.join(repoRoot, "atcp", "v1", "schemas", "task-assign.schema.json");
const ackSchema = path.join(repoRoot, "atcp", "v1", "schemas", "ack.schema.json");

function invalidDateError(error: unknown): boolean {
  return error instanceof BridgeError && error.code === "SCHEMA_VALIDATION_FAILED";
}

test("extracts result.structured_output from stream-json", () => {
  const lines = [
    JSON.stringify({ event: "init", init: { ok: true } }),
    JSON.stringify({ event: "step_update", step_update: { phase: "thinking" } }),
    JSON.stringify({ event: "result", result: { structured_output: { task_id: "T1", conversation_id: "C1", accepted: true } } }),
  ];
  const result = extractStructuredOutput(lines);
  assert.deepEqual(result.payload, { task_id: "T1", conversation_id: "C1", accepted: true });
  assert.deepEqual(result.eventTypes, ["init", "step_update", "result"]);
});

test("fails closed when structured output is missing", () => {
  assert.throws(
    () => extractStructuredOutput([JSON.stringify({ event: "result", result: {} })]),
    (error: unknown) => error instanceof BridgeError && error.code === "MISSING_STRUCTURED_OUTPUT",
  );
});

test("rejects duplicate terminal results", () => {
  assert.throws(
    () => extractStructuredOutput([
      JSON.stringify({ event: "result", result: { structured_output: { task_id: "T1", conversation_id: "C1" } } }),
      JSON.stringify({ event: "result", result: { structured_output: { task_id: "T2", conversation_id: "C2" } } }),
    ]),
    (error: unknown) => error instanceof BridgeError && error.code === "DUPLICATE_RESULT",
  );
});

test("rejects events after the terminal result", () => {
  assert.throws(
    () => extractStructuredOutput([
      JSON.stringify({ event: "result", result: { structured_output: { task_id: "T1", conversation_id: "C1" } } }),
      JSON.stringify({ event: "step_update", step_update: { phase: "late" } }),
    ]),
    (error: unknown) => error instanceof BridgeError && error.code === "EVENT_AFTER_RESULT",
  );
});

test("rejects an incomplete result even if a later result is complete", () => {
  assert.throws(
    () => extractStructuredOutput([
      JSON.stringify({ event: "result", result: {} }),
      JSON.stringify({ event: "result", result: { structured_output: { task_id: "T1", conversation_id: "C1" } } }),
    ]),
    (error: unknown) => error instanceof BridgeError && error.code === "MISSING_STRUCTURED_OUTPUT",
  );
});

test("fails closed on non-JSON stdout line", () => {
  assert.throws(
    () => extractStructuredOutput(["not-json"]),
    (error: unknown) => error instanceof BridgeError && error.code === "INVALID_STREAM_JSON",
  );
});

test("accepts matching task and conversation identity", () => {
  assert.doesNotThrow(() => enforceCorrelation(
    { task_id: "TASK-1", conversation_id: "CONV-1" },
    { task_id: "TASK-1", conversation_id: "CONV-1" },
  ));
});

test("rejects mismatched task identity", () => {
  assert.throws(
    () => enforceCorrelation(
      { task_id: "TASK-1", conversation_id: "CONV-1" },
      { task_id: "TASK-WRONG", conversation_id: "CONV-1" },
    ),
    (error: unknown) => error instanceof BridgeError && error.code === "CORRELATION_MISMATCH",
  );
});

test("rejects TASK_ASSIGN with an invalid created_at date-time", async () => {
  await assert.rejects(
    validateAgainstSchema({
      protocol: "ATCP-1", message_type: "TASK_ASSIGN", message_id: "M1", conversation_id: "C1", task_id: "T1",
      from: "Architect", to: "TL", created_at: "not-a-date", objective: "ACK only", scope: [], deliverables: [],
      constraints: [], acceptance_criteria: ["ACK"], authority: { may_modify: false, may_commit: false, may_open_pr: false, may_merge: false },
    }, taskSchema),
    invalidDateError,
  );
});

test("rejects ACK with an invalid created_at date-time", async () => {
  await assert.rejects(
    validateAgainstSchema({
      protocol: "ATCP-1", message_type: "ACK", message_id: "M1", conversation_id: "C1", task_id: "T1",
      from: "TL", to: "Architect", created_at: "not-a-date", accepted: true, state: "ACCEPTED", summary: "ACK", missing_inputs: [],
    }, ackSchema),
    invalidDateError,
  );
});
