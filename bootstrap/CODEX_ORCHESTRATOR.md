# Codex Orchestrator Bootstrap Path

Use this path when a Codex agent receives the Architect's first handoff. Codex is the orchestration/transport adapter between the product task and the selected ATOS integration boundary. It preserves the Architect and Project Lead decision boundary; it is not the final implementation or merge authority.

## Read only this path's required graph

1. Read the repository [README](../README.md), the [bootstrap router](BOOTSTRAP.md), and this document.
2. Read [Team Charter](../governance/TEAM_CHARTER.md) and the Architect/Team Lead authority boundaries in [Role Contracts](../roles/ROLE_CONTRACTS.md). This establishes Project Lead authority and external-team opacity.
3. Read the handoff's target product repository policy hierarchy, current handoff, and linked task source of truth. Recover task scope, acceptance criteria, evidence destination, and whether ATOS-to-agy delegation is required. Do not begin from prior conversation memory.
4. If the handoff requires ATOS-to-agy delegation, read [ATCP v1](../atcp/v1/README.md), [TASK_ASSIGN schema](../atcp/v1/schemas/task-assign.schema.json), [ACK schema](../atcp/v1/schemas/ack.schema.json), and exactly one selected terminal schema: [RESULT](../atcp/v1/schemas/result.schema.json) or [ERROR](../atcp/v1/schemas/error.schema.json).
5. For the Antigravity reference route, read [CLI integration](../reference/antigravity/CLI_INTEGRATION.md) and the [bridge README](../reference/antigravity/bridge/README.md). Read [local validation](../reference/antigravity/LOCAL_VALIDATION.md) only when performing its local validation procedure.
6. If implementation effects are requested, read the bridge's bounded implementation-authority section before dispatch. Require the authority/workspace/allowlist references named by the task source of truth; do not manufacture them.

## Operating contract to recover

- Preserve the Architect/Project Lead task scope and authority. Do not silently implement around or bypass agy when the handoff explicitly requires the ATOS-to-agy route.
- Create or validate the immutable `TASK_ASSIGN` context before dispatch. Validate schema plus task, conversation, and peer correlation at every message boundary.
- Dispatch a fresh ACK invocation. Only `accepted === true` and `state === ACCEPTED` permits one fresh terminal invocation. Validate exactly one RESULT or ERROR; reject malformed, ambiguous, duplicate, late, wrong-type, or wrong-identity output.
- Apply implementation effects only through the parent-owned seam and only when the validated authority permits them: a clean no-remote isolated workspace, explicit relative-file allowlist, bounded write, optional local commit, and Git-observable verification. PR and merge are unsupported and fail closed.
- Keep parent-local BridgeError, guardrail, process, timeout, stdout, schema, and correlation failures local. Do not relabel them as external ATCP ERROR.
- Treat CANCEL only as the documented parent-owned local process-coordination boundary. Do not claim an external-team cancellation acknowledgement/effect.
- Report bounded evidence to the destination specified by the task source of truth. Do not expose raw logs, credentials, or unneeded local metadata.

## Stop and escalate when required context is absent

Do not infer a task authority object, workspace, file allowlist, target peer, terminal type, or evidence destination. Do not infer support for live STATUS, persistent sessions, external-team cancellation effect, direct internal sub-agent control, remote push/PR/merge automation, or production orchestration. Report the missing source-of-truth input to the Architect/Project Lead.
