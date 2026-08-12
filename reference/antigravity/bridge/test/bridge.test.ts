import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { PassThrough } from "node:stream";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { BridgeError, ParentLifecycle, buildTlPrompt, createLifecycleRecord, deriveAuthorityPolicy, dispatchImplementationLifecycle, dispatchLifecycle, enforceCorrelation, enforceResponseIdentity, executeImplementation, extractStructuredOutput, validateAgainstSchema } from "../src/bridge.js";

const bridgeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = path.resolve(bridgeDir, "..", "..", "..");
const taskSchema = path.join(repoRoot, "atcp", "v1", "schemas", "task-assign.schema.json");
const ackSchema = path.join(repoRoot, "atcp", "v1", "schemas", "ack.schema.json");
const resultSchema = path.join(repoRoot, "atcp", "v1", "schemas", "result.schema.json");
const errorSchema = path.join(repoRoot, "atcp", "v1", "schemas", "error.schema.json");
const cancelSchema = path.join(repoRoot, "atcp", "v1", "schemas", "cancel.schema.json");

function invalidDateError(error: unknown): boolean {
  return error instanceof BridgeError && error.code === "SCHEMA_VALIDATION_FAILED";
}

function lifecycleTask() {
  return {
    protocol: "ATCP-1", message_type: "TASK_ASSIGN", message_id: "M1", conversation_id: "C1", task_id: "T1",
    from: "Architect", to: "Antigravity-TL", created_at: "2026-08-11T00:00:00Z", objective: "bounded lifecycle", scope: [], deliverables: [],
    constraints: [], acceptance_criteria: ["terminal"], authority: { may_modify: false, may_commit: false, may_open_pr: false, may_merge: false },
  };
}

function acceptedAck() {
  return { protocol: "ATCP-1", message_type: "ACK", message_id: "M2", conversation_id: "C1", task_id: "T1", from: "Antigravity-TL", to: "Architect", created_at: "2026-08-11T00:00:00Z", accepted: true, state: "ACCEPTED", summary: "accepted", missing_inputs: [] };
}

function validCancel() {
  return { protocol: "ATCP-1", message_type: "CANCEL", message_id: "M3", conversation_id: "C1", task_id: "T1", from: "Architect", to: "Antigravity-TL", created_at: "2026-08-11T00:00:00Z", reason: "parent withdrawal", preserve_outputs: true };
}

function authorityTask(authority: { may_modify: boolean; may_commit: boolean; may_open_pr: boolean; may_merge: boolean }) {
  return { ...lifecycleTask(), authority };
}

async function isolatedWorkspace(t: test.TestContext): Promise<string> {
  const workspace = await mkdtemp(path.join(tmpdir(), "atos-authority-"));
  await writeFile(path.join(workspace, "fixture.txt"), "seed\n", "utf8");
  execFileSync("git", ["init", "-q"], { cwd: workspace, windowsHide: true });
  execFileSync("git", ["config", "user.email", "authority-probe@example.invalid"], { cwd: workspace, windowsHide: true });
  execFileSync("git", ["config", "user.name", "Authority Probe"], { cwd: workspace, windowsHide: true });
  execFileSync("git", ["add", "fixture.txt"], { cwd: workspace, windowsHide: true });
  execFileSync("git", ["commit", "-qm", "seed fixture"], { cwd: workspace, windowsHide: true });
  t.after(() => rm(workspace, { recursive: true, force: true }));
  return workspace;
}

function implementationConfig() {
  return { allowedRelativePaths: ["fixture.txt"], requireNoRemote: true as const };
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

test("rejects a response with the wrong public peer boundary", () => {
  assert.throws(
    () => enforceResponseIdentity(
      { task_id: "TASK-1", conversation_id: "CONV-1", from: "Architect", to: "Antigravity-TL" },
      { task_id: "TASK-1", conversation_id: "CONV-1", from: "Unexpected", to: "Architect" },
    ),
    (error: unknown) => error instanceof BridgeError && error.code === "PEER_MISMATCH",
  );
});

test("creates an immutable parent lifecycle record from validated TASK_ASSIGN", async () => {
  const task = {
    protocol: "ATCP-1", message_type: "TASK_ASSIGN", message_id: "M1", conversation_id: "C1", task_id: "T1",
    from: "Architect", to: "Antigravity-TL", created_at: "2026-08-11T00:00:00Z", objective: "ACK then RESULT", scope: [], deliverables: [],
    constraints: [], acceptance_criteria: ["RESULT"], authority: { may_modify: false, may_commit: false, may_open_pr: false, may_merge: false },
  };
  const record = await createLifecycleRecord(task, taskSchema);
  assert.equal(record.taskId, "T1");
  assert.equal(record.conversationId, "C1");
  assert.equal(record.expectedFrom, "Antigravity-TL");
  assert.equal(record.expectedTo, "Architect");
  assert.match(record.taskDigest, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.task), true);
  assert.equal(Object.isFrozen(record.authority), true);
});

test("builds a RESULT-only prompt from replayed task context", () => {
  const prompt = buildTlPrompt({ task_id: "T1", conversation_id: "C1" }, "RESULT");
  assert.match(prompt, /RESULT-only/);
  assert.match(prompt, /Do not use tools or modify files/);
  assert.match(prompt, /"task_id":"T1"/);
});

test("may_modify=false rejects a parent write and leaves the isolated fixture unchanged", async (t) => {
  const workspace = await isolatedWorkspace(t);
  const record = await createLifecycleRecord(authorityTask({ may_modify: false, may_commit: false, may_open_pr: false, may_merge: false }), taskSchema);
  await assert.rejects(
    executeImplementation(record, workspace, implementationConfig(), [{ kind: "write_file", relativePath: "fixture.txt", content: "changed\n" }]),
    (error: unknown) => error instanceof BridgeError && error.code === "AUTHORITY_DENIED",
  );
  assert.equal(await readFile(path.join(workspace, "fixture.txt"), "utf8"), "seed\n");
  assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: workspace, encoding: "utf8" }).trim(), "");
});

test("may_modify=true and may_commit=false permits only the allowlisted modification and rejects commit", async (t) => {
  const workspace = await isolatedWorkspace(t);
  const record = await createLifecycleRecord(authorityTask({ may_modify: true, may_commit: false, may_open_pr: false, may_merge: false }), taskSchema);
  const evidence = await executeImplementation(record, workspace, implementationConfig(), [{ kind: "write_file", relativePath: "fixture.txt", content: "modified\n" }]);
  assert.deepEqual(evidence, { filesChanged: ["fixture.txt"], commitCreated: false, prCreated: false, mergeOccurred: false });
  await assert.rejects(
    executeImplementation(record, workspace, implementationConfig(), [{ kind: "commit", message: "forbidden" }]),
    (error: unknown) => error instanceof BridgeError && error.code === "DIRTY_IMPLEMENTATION_WORKSPACE",
  );
  assert.equal(await readFile(path.join(workspace, "fixture.txt"), "utf8"), "modified\n");
  assert.equal(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: workspace, encoding: "utf8" }).trim(), "1");
});

test("may_modify=true and may_commit=true permits an allowlisted local commit only", async (t) => {
  const workspace = await isolatedWorkspace(t);
  const record = await createLifecycleRecord(authorityTask({ may_modify: true, may_commit: true, may_open_pr: false, may_merge: false }), taskSchema);
  const evidence = await executeImplementation(record, workspace, implementationConfig(), [
    { kind: "write_file", relativePath: "fixture.txt", content: "committed\n" },
    { kind: "commit", message: "bounded fixture update" },
  ]);
  assert.deepEqual(evidence, { filesChanged: ["fixture.txt"], commitCreated: true, prCreated: false, mergeOccurred: false });
  assert.equal(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: workspace, encoding: "utf8" }).trim(), "2");
  assert.equal(execFileSync("git", ["remote"], { cwd: workspace, encoding: "utf8" }).trim(), "");
});

test("forbidden commit, PR, merge, unsafe authority combinations, and out-of-scope files fail closed", async (t) => {
  const workspace = await isolatedWorkspace(t);
  const modifyOnly = await createLifecycleRecord(authorityTask({ may_modify: true, may_commit: false, may_open_pr: false, may_merge: false }), taskSchema);
  await assert.rejects(executeImplementation(modifyOnly, workspace, implementationConfig(), [{ kind: "commit", message: "forbidden" }]), (error: unknown) => error instanceof BridgeError && error.code === "AUTHORITY_DENIED");
  await assert.rejects(executeImplementation(modifyOnly, workspace, implementationConfig(), [{ kind: "open_pr" }]), (error: unknown) => error instanceof BridgeError && error.code === "AUTHORITY_DENIED");
  await assert.rejects(executeImplementation(modifyOnly, workspace, implementationConfig(), [{ kind: "merge" }]), (error: unknown) => error instanceof BridgeError && error.code === "AUTHORITY_DENIED");
  await assert.rejects(executeImplementation(modifyOnly, workspace, implementationConfig(), [{ kind: "write_file", relativePath: "outside.txt", content: "no" }]), (error: unknown) => error instanceof BridgeError && error.code === "FILE_SCOPE_VIOLATION");
  const invalid = await createLifecycleRecord(authorityTask({ may_modify: false, may_commit: true, may_open_pr: false, may_merge: false }), taskSchema);
  assert.throws(() => deriveAuthorityPolicy(invalid), (error: unknown) => error instanceof BridgeError && error.code === "INVALID_AUTHORITY_COMBINATION");
  const mergeEscalation = await createLifecycleRecord(authorityTask({ may_modify: true, may_commit: true, may_open_pr: true, may_merge: true }), taskSchema);
  assert.throws(() => deriveAuthorityPolicy(mergeEscalation), (error: unknown) => error instanceof BridgeError && error.code === "UNSUPPORTED_AUTHORITY_COMBINATION");
});

test("implementation effects run after accepted ACK and retain terminal validation", async (t) => {
  const workspace = await isolatedWorkspace(t);
  const task = authorityTask({ may_modify: true, may_commit: false, may_open_pr: false, may_merge: false });
  let spawnCount = 0;
  const spawnProcess = (() => {
    spawnCount += 1;
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: () => boolean };
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => true;
    const payload = spawnCount === 1 ? acceptedAck() : { protocol: "ATCP-1", message_type: "RESULT", message_id: "M3", conversation_id: "C1", task_id: "T1", from: "Antigravity-TL", to: "Architect", created_at: "2026-08-11T00:00:00Z", status: "PASS", summary: "bounded", deliverables: [], changes: ["fixture"], validation: [], evidence: [], unverified: [], risks: [], recommended_next_action: "review" };
    queueMicrotask(() => { child.stdout.end(`${JSON.stringify({ event: "result", result: { structured_output: payload } })}\n`); child.stderr.end(); child.emit("close", 0); });
    return child;
  }) as unknown as typeof spawn;
  const lifecycle = await dispatchImplementationLifecycle(task, {
    agyPath: "agy", workspace, taskSchemaPath: taskSchema, responseSchemaPath: ackSchema, spawnProcess, implementation: implementationConfig(),
  }, resultSchema, [{ kind: "write_file", relativePath: "fixture.txt", content: "lifecycle\n" }]);
  assert.equal(spawnCount, 2);
  assert.deepEqual(lifecycle.implementation.filesChanged, ["fixture.txt"]);
  assert.equal(lifecycle.terminal.payload.message_type, "RESULT");
});

test("a local authority denial stops before terminal dispatch and is not an external ERROR", async (t) => {
  const workspace = await isolatedWorkspace(t);
  const task = authorityTask({ may_modify: false, may_commit: false, may_open_pr: false, may_merge: false });
  let spawnCount = 0;
  const spawnProcess = (() => {
    spawnCount += 1;
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: () => boolean };
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => true;
    queueMicrotask(() => { child.stdout.end(`${JSON.stringify({ event: "result", result: { structured_output: acceptedAck() } })}\n`); child.stderr.end(); child.emit("close", 0); });
    return child;
  }) as unknown as typeof spawn;
  await assert.rejects(
    dispatchImplementationLifecycle(task, {
      agyPath: "agy", workspace, taskSchemaPath: taskSchema, responseSchemaPath: ackSchema, spawnProcess, implementation: implementationConfig(),
    }, resultSchema, [{ kind: "write_file", relativePath: "fixture.txt", content: "forbidden\n" }]),
    (error: unknown) => error instanceof BridgeError && error.code === "AUTHORITY_DENIED",
  );
  assert.equal(spawnCount, 1);
  assert.equal(await readFile(path.join(workspace, "fixture.txt"), "utf8"), "seed\n");
});

test("does not spawn RESULT after a schema-valid blocked ACK", async () => {
  const task = {
    protocol: "ATCP-1", message_type: "TASK_ASSIGN", message_id: "M1", conversation_id: "C1", task_id: "T1",
    from: "Architect", to: "Antigravity-TL", created_at: "2026-08-11T00:00:00Z", objective: "ACK then RESULT", scope: [], deliverables: [],
    constraints: [], acceptance_criteria: ["RESULT"], authority: { may_modify: false, may_commit: false, may_open_pr: false, may_merge: false },
  };
  let spawnCount = 0;
  const spawnProcess = (() => {
    spawnCount += 1;
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: () => boolean };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => true;
    queueMicrotask(() => {
      child.stdout.end(`${JSON.stringify({ event: "result", result: { structured_output: {
        protocol: "ATCP-1", message_type: "ACK", message_id: "M2", conversation_id: "C1", task_id: "T1",
        from: "Antigravity-TL", to: "Architect", created_at: "2026-08-11T00:00:00Z", accepted: false, state: "BLOCKED", summary: "blocked", missing_inputs: [],
      } } })}\n`);
      child.stderr.end();
      child.emit("close", 0);
    });
    return child;
  }) as unknown as typeof spawn;

  await assert.rejects(
    dispatchLifecycle(task, {
      agyPath: "agy", workspace: process.cwd(), taskSchemaPath: taskSchema, responseSchemaPath: ackSchema, spawnProcess,
    }, resultSchema),
    (error: unknown) => error instanceof BridgeError && error.code === "ACK_NOT_ACCEPTED",
  );
  assert.equal(spawnCount, 1);
});

test("dispatches exactly one ERROR terminal after an accepted ACK", async () => {
  const task = {
    protocol: "ATCP-1", message_type: "TASK_ASSIGN", message_id: "M1", conversation_id: "C1", task_id: "T1",
    from: "Architect", to: "Antigravity-TL", created_at: "2026-08-11T00:00:00Z", objective: "ACK then ERROR", scope: [], deliverables: [],
    constraints: [], acceptance_criteria: ["ERROR"], authority: { may_modify: false, may_commit: false, may_open_pr: false, may_merge: false },
  };
  let spawnCount = 0;
  const spawnProcess = (() => {
    spawnCount += 1;
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: () => boolean };
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => true;
    const payload = spawnCount === 1
      ? { protocol: "ATCP-1", message_type: "ACK", message_id: "M2", conversation_id: "C1", task_id: "T1", from: "Antigravity-TL", to: "Architect", created_at: "2026-08-11T00:00:00Z", accepted: true, state: "ACCEPTED", summary: "accepted", missing_inputs: [] }
      : { protocol: "ATCP-1", message_type: "ERROR", message_id: "M3", conversation_id: "C1", task_id: "T1", from: "Antigravity-TL", to: "Architect", created_at: "2026-08-11T00:00:00Z", error_class: "TOOL_FAILURE", summary: "bounded failure", retry_safe: false, intervention_required: true, preserved_state: [], recommended_recovery: "inspect bounded evidence" };
    queueMicrotask(() => { child.stdout.end(`${JSON.stringify({ event: "result", result: { structured_output: payload } })}\n`); child.stderr.end(); child.emit("close", 0); });
    return child;
  }) as unknown as typeof spawn;
  const lifecycle = await dispatchLifecycle(task, { agyPath: "agy", workspace: process.cwd(), taskSchemaPath: taskSchema, responseSchemaPath: ackSchema, spawnProcess }, errorSchema, "ERROR");
  assert.equal(spawnCount, 2);
  assert.equal(lifecycle.terminalOutcome, "ERROR");
  assert.equal(lifecycle.terminal.payload.message_type, "ERROR");
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

test("rejects malformed or non-RESULT payloads against RESULT schema", async () => {
  await assert.rejects(
    validateAgainstSchema({
      protocol: "ATCP-1", message_type: "ACK", message_id: "M1", conversation_id: "C1", task_id: "T1",
      from: "Antigravity-TL", to: "Architect", created_at: "2026-08-11T00:00:00Z", accepted: true, state: "ACCEPTED", summary: "ACK", missing_inputs: [],
    }, resultSchema),
    invalidDateError,
  );
});

test("rejects malformed, non-ERROR, and wrong-peer ERROR payloads", async () => {
  const validError = { protocol: "ATCP-1", message_type: "ERROR", message_id: "M1", conversation_id: "C1", task_id: "T1", from: "Antigravity-TL", to: "Architect", created_at: "2026-08-11T00:00:00Z", error_class: "TOOL_FAILURE", summary: "bounded", retry_safe: false, intervention_required: true, preserved_state: [], recommended_recovery: "recover" };
  await validateAgainstSchema(validError, errorSchema);
  await assert.rejects(validateAgainstSchema({ ...validError, message_type: "RESULT" }, errorSchema), invalidDateError);
  const malformed = { ...validError }; delete (malformed as { summary?: string }).summary;
  await assert.rejects(validateAgainstSchema(malformed, errorSchema), invalidDateError);
  assert.throws(() => enforceResponseIdentity({ task_id: "T1", conversation_id: "C1", from: "Architect", to: "Antigravity-TL" }, { ...validError, from: "Unexpected" }), (error: unknown) => error instanceof BridgeError && error.code === "PEER_MISMATCH");
});

test("rejects a schema-valid ERROR with the wrong task_id at the parent boundary", async () => {
  const request = { task_id: "T1", conversation_id: "C1", from: "Architect", to: "Antigravity-TL" };
  const error = { protocol: "ATCP-1", message_type: "ERROR", message_id: "M1", conversation_id: "C1", task_id: "T-WRONG", from: "Antigravity-TL", to: "Architect", created_at: "2026-08-11T00:00:00Z", error_class: "TOOL_FAILURE", summary: "bounded", retry_safe: false, intervention_required: true, preserved_state: [], recommended_recovery: "recover" };
  await validateAgainstSchema(error, errorSchema);
  assert.throws(() => enforceResponseIdentity(request, error), (caught: unknown) => caught instanceof BridgeError && caught.code === "CORRELATION_MISMATCH");
});

test("rejects a schema-valid ERROR with the wrong conversation_id at the parent boundary", async () => {
  const request = { task_id: "T1", conversation_id: "C1", from: "Architect", to: "Antigravity-TL" };
  const error = { protocol: "ATCP-1", message_type: "ERROR", message_id: "M1", conversation_id: "C-WRONG", task_id: "T1", from: "Antigravity-TL", to: "Architect", created_at: "2026-08-11T00:00:00Z", error_class: "TOOL_FAILURE", summary: "bounded", retry_safe: false, intervention_required: true, preserved_state: [], recommended_recovery: "recover" };
  await validateAgainstSchema(error, errorSchema);
  assert.throws(() => enforceResponseIdentity(request, error), (caught: unknown) => caught instanceof BridgeError && caught.code === "CORRELATION_MISMATCH");
});

test("CANCEL after accepted ACK prevents terminal child spawn and is idempotent", async () => {
  const record = await createLifecycleRecord(lifecycleTask(), taskSchema);
  const lifecycle = new ParentLifecycle(record);
  lifecycle.recordAcceptedAck(acceptedAck());
  const first = await lifecycle.requestCancel(validCancel(), cancelSchema);
  const second = await lifecycle.requestCancel(validCancel(), cancelSchema);
  assert.equal(first.idempotent, false);
  assert.equal(first.localChildTermination, "NOT_APPLICABLE");
  assert.equal(second.idempotent, true);
  assert.throws(() => lifecycle.beginTerminal(), (error: unknown) => error instanceof BridgeError && error.code === "CANCELLATION_COMMITTED");
});

test("CANCEL rejects wrong task, conversation, peer, malformed, and wrong message type", async () => {
  const record = await createLifecycleRecord(lifecycleTask(), taskSchema);
  const probes: Array<[Record<string, unknown>, string]> = [
    [{ ...validCancel(), task_id: "T-WRONG" }, "CORRELATION_MISMATCH"],
    [{ ...validCancel(), conversation_id: "C-WRONG" }, "CORRELATION_MISMATCH"],
    [{ ...validCancel(), from: "Unexpected" }, "PEER_MISMATCH"],
  ];
  for (const [cancel, code] of probes) {
    await assert.rejects(new ParentLifecycle(record).requestCancel(cancel, cancelSchema), (error: unknown) => error instanceof BridgeError && error.code === code);
  }
  const malformed = { ...validCancel() }; delete (malformed as { reason?: string }).reason;
  await assert.rejects(new ParentLifecycle(record).requestCancel(malformed, cancelSchema), invalidDateError);
  await assert.rejects(new ParentLifecycle(record).requestCancel({ ...validCancel(), message_type: "RESULT" }, cancelSchema), invalidDateError);
});

test("CANCEL after terminal ownership is stale and CANCEL wins an active-terminal race", async () => {
  const record = await createLifecycleRecord(lifecycleTask(), taskSchema);
  const completed = new ParentLifecycle(record);
  completed.recordAcceptedAck(acceptedAck()); completed.beginTerminal(); completed.commitTerminal();
  await assert.rejects(completed.requestCancel(validCancel(), cancelSchema), (error: unknown) => error instanceof BridgeError && error.code === "STALE_CANCEL");

  const racing = new ParentLifecycle(record);
  racing.recordAcceptedAck(acceptedAck()); racing.beginTerminal();
  await racing.requestCancel(validCancel(), cancelSchema);
  assert.throws(() => racing.commitTerminal(), (error: unknown) => error instanceof BridgeError && error.code === "CANCELLATION_COMMITTED");
});

test("CANCEL terminates only the exact parent-owned child and kill failure stays local", async () => {
  const record = await createLifecycleRecord(lifecycleTask(), taskSchema);
  let exactKills = 0;
  const child = { kill: () => { exactKills += 1; return true; } } as unknown as ChildProcess;
  const lifecycle = new ParentLifecycle(record);
  lifecycle.recordAcceptedAck(acceptedAck()); lifecycle.beginTerminal(child);
  const result = await lifecycle.requestCancel(validCancel(), cancelSchema);
  assert.equal(result.localChildTermination, "TERMINATED");
  assert.equal(exactKills, 1);

  const failed = new ParentLifecycle(record);
  failed.recordAcceptedAck(acceptedAck()); failed.beginTerminal({ kill: () => false } as unknown as ChildProcess);
  await assert.rejects(failed.requestCancel(validCancel(), cancelSchema), (error: unknown) => error instanceof BridgeError && error.code === "LOCAL_TERMINATION_FAILED");
});

test("CANCEL before terminal spawn prevents a real dispatch seam from spawning its terminal child", async () => {
  let spawnCount = 0;
  const spawnProcess = (() => {
    spawnCount += 1;
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: () => boolean };
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => true;
    queueMicrotask(() => { child.stdout.end(`${JSON.stringify({ event: "result", result: { structured_output: acceptedAck() } })}\n`); child.stderr.end(); child.emit("close", 0); });
    return child;
  }) as unknown as typeof spawn;
  await assert.rejects(
    dispatchLifecycle(lifecycleTask(), {
      agyPath: "agy", workspace: process.cwd(), taskSchemaPath: taskSchema, responseSchemaPath: ackSchema, spawnProcess,
      beforeTerminalSpawn: async (lifecycle) => { await lifecycle.requestCancel(validCancel(), cancelSchema); },
    }, resultSchema),
    (error: unknown) => error instanceof BridgeError && error.code === "CANCELLATION_COMMITTED",
  );
  assert.equal(spawnCount, 1);
});

test("CANCEL during a real terminal dispatch kills its exact child once and commits no success", async () => {
  let spawnCount = 0;
  let killCount = 0;
  let lifecycle: ParentLifecycle | undefined;
  const spawnProcess = (() => {
    spawnCount += 1;
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: () => boolean };
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    if (spawnCount === 1) {
      child.kill = () => true;
      queueMicrotask(() => { child.stdout.end(`${JSON.stringify({ event: "result", result: { structured_output: acceptedAck() } })}\n`); child.stderr.end(); child.emit("close", 0); });
    } else {
      child.kill = () => { killCount += 1; queueMicrotask(() => { child.stdout.end(); child.stderr.end(); child.emit("close", -1); }); return true; };
      queueMicrotask(async () => { await lifecycle!.requestCancel(validCancel(), cancelSchema); });
    }
    return child;
  }) as unknown as typeof spawn;
  await assert.rejects(
    dispatchLifecycle(lifecycleTask(), {
      agyPath: "agy", workspace: process.cwd(), taskSchemaPath: taskSchema, responseSchemaPath: ackSchema, spawnProcess,
      onLifecycleCreated: (created) => { lifecycle = created; },
    }, resultSchema),
    (error: unknown) => error instanceof BridgeError && error.code === "CANCELLATION_COMMITTED",
  );
  assert.equal(spawnCount, 2);
  assert.equal(killCount, 1);
  const repeated = await lifecycle!.requestCancel(validCancel(), cancelSchema);
  assert.equal(repeated.idempotent, true);
  assert.equal(killCount, 1);
});
