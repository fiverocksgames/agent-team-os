import assert from "node:assert/strict";
import test from "node:test";
import { BridgeError, enforceCorrelation, extractStructuredOutput } from "../src/bridge.js";

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
