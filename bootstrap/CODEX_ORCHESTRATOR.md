# Codex Orchestrator Bootstrap Path

Use this path when a Codex agent receives the Architect's first handoff. Codex is the orchestration/transport adapter between the product task and the selected ATOS integration boundary. It preserves the Architect and Project Lead decision boundary; it is not the final implementation or merge authority.

## Read only this path's required graph

1. Read the repository [README](../README.md), the [bootstrap router](BOOTSTRAP.md), and this document.
2. Read [Team Charter](../governance/TEAM_CHARTER.md) and the Architect/Team Lead authority boundaries in [Role Contracts](../roles/ROLE_CONTRACTS.md). This establishes Project Lead authority and external-team opacity.
3. Read the handoff's target product repository policy hierarchy, current handoff, and linked task source of truth. Recover task scope, acceptance criteria, evidence destination, and whether the task is implementation work. Do not begin from prior conversation memory.
4. For implementation work received in the Codex Orchestrator role, default to the validated `ATOS -> agy` route unless the Architect or Project Lead explicitly authorizes direct Codex implementation as an exception in the task source of truth.
5. When using the `ATOS -> agy` route, read [ATCP v1](../atcp/v1/README.md), [TASK_ASSIGN schema](../atcp/v1/schemas/task-assign.schema.json), [ACK schema](../atcp/v1/schemas/ack.schema.json), and exactly one selected terminal schema: [RESULT](../atcp/v1/schemas/result.schema.json) or [ERROR](../atcp/v1/schemas/error.schema.json).
6. For the Antigravity reference route, read [CLI integration](../reference/antigravity/CLI_INTEGRATION.md) and the [bridge README](../reference/antigravity/bridge/README.md). Read [local validation](../reference/antigravity/LOCAL_VALIDATION.md) only when performing its local validation procedure.
7. If implementation effects are requested, read the bridge's bounded implementation-authority section before dispatch. Require the authority/workspace/allowlist references named by the task source of truth; do not manufacture them.

## Operating contract to recover

- Preserve the Architect/Project Lead task scope and authority.
- For implementation work, `ATOS -> agy` is the default execution route. Do not silently implement directly in Codex because delegation wording is absent or incomplete.
- Direct Codex implementation is permitted only when the Architect or Project Lead explicitly authorizes that exception in the task source of truth.
- The execution route answers **who executes**; it does not grant repository authority. Never infer a task authority object, workspace, file allowlist, target peer, correlation identity, or evidence destination.
- If required authority/workspace/allowlist/correlation/evidence inputs are missing, stop and escalate to the Architect/Project Lead. Do not use direct Codex implementation as a fallback.
- Create or validate the immutable `TASK_ASSIGN` context before dispatch. Validate schema plus task, conversation, and peer correlation at every message boundary.
- Dispatch a fresh ACK invocation. Only `accepted === true` and `state === ACCEPTED` permits one fresh terminal invocation. Validate exactly one RESULT or ERROR; reject malformed, ambiguous, duplicate, late, wrong-type, or wrong-identity output.
- Apply implementation effects only through the parent-owned seam and only when the validated authority permits them: a clean no-remote isolated workspace, explicit relative-file allowlist, bounded write, optional local commit, and Git-observable verification. PR and merge are unsupported and fail closed.
- Keep parent-local BridgeError, guardrail, process, timeout, stdout, schema, and correlation failures local. Do not relabel them as external ATCP ERROR.
- Treat CANCEL only as the documented parent-owned local process-coordination boundary. Do not claim an external-team cancellation acknowledgement/effect.
- Report bounded evidence to the destination specified by the task source of truth. Do not expose raw logs, credentials, or unneeded local metadata.

## Stop and escalate when required context is absent

Do not infer a task authority object, workspace, file allowlist, target peer, terminal type, correlation identity, or evidence destination. Do not infer support for live STATUS, persistent sessions, external-team cancellation effect, direct internal sub-agent control, remote push/PR/merge automation, or production orchestration. Report the missing source-of-truth input to the Architect/Project Lead, and do not fall back to direct Codex implementation.
