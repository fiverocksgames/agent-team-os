# Architect Bootstrap Path

Use this path when the assigned role is Lead Architect / Meta-Orchestrator and the agent must turn a product task into a bounded, relay-ready assignment. The output of this path is a copy-ready first handoff for a Codex orchestrator, not an implementation decision or a repository-wide summary.

## Read only this path's required graph

1. Read the repository [README](../README.md) and the [bootstrap router](BOOTSTRAP.md).
2. Read [Team Charter](../governance/TEAM_CHARTER.md) and the Architect section of [Role Contracts](../roles/ROLE_CONTRACTS.md) to recover Project Lead authority, scope limits, and external-team opacity.
3. Read the target product repository's policy hierarchy, current handoff, and the assigned Issue/task document. The product Issue/task document is the task-specific source of truth; do not substitute remembered conversation state.
4. If the task uses an independent team or structured handoff, read [ATCP v1](../atcp/v1/README.md) and only the message schemas needed for the task. For the validated reference lifecycle, that normally means [TASK_ASSIGN](../atcp/v1/schemas/task-assign.schema.json), [ACK](../atcp/v1/schemas/ack.schema.json), and exactly one terminal schema: [RESULT](../atcp/v1/schemas/result.schema.json) or [ERROR](../atcp/v1/schemas/error.schema.json).
5. If the task is explicitly delegated through Antigravity, read [CLI integration](../reference/antigravity/CLI_INTEGRATION.md) and the [reference bridge boundary](../reference/antigravity/bridge/README.md). Read their implementation details only as needed to define a bounded dispatch; do not infer additional capabilities.
6. When the task could involve implementation effects, read the bridge's bounded-authority section before setting authority, workspace, or allowlist references. The Phase 3 closure record is [Issue #37](https://github.com/fiverocksgames/agent-team-os/issues/37).

## Decisions this path must preserve

- The human Project Lead retains final scope, policy, release, and merge authority. The Architect coordinates and recommends; it does not self-grant Project Lead authority.
- An external team is opaque. Address its Team Lead through ATCP; do not assign or control its internal sub-agents.
- For the validated reference, the lifecycle is stateless: `TASK_ASSIGN -> fresh ACK -> parent validation -> exactly one fresh RESULT or ERROR -> parent validation`. ACK acceptance requires schema validation **and** exact task, conversation, and peer correlation.
- For implementation work handed to a Codex Orchestrator, the default execution route is `Codex -> ATOS -> agy / Antigravity TL`. Direct Codex implementation is an explicit exception and requires Architect or Project Lead authorization in the task source of truth.
- The default route answers **who executes**; it does not grant repository authority. Authority, workspace, allowlist, correlation identity, and evidence requirements must still come from an explicit source of truth and must not be inferred.
- The implementation seam is parent-owned. It can perform only validated, explicit authority/allowlist effects in a clean, no-remote isolated workspace. It does not prove that agy or the external team has direct repository authority.
- Local BridgeError, guardrail, schema, correlation, spawn, timeout, and process failures remain local. They are not external ATCP `ERROR` messages.
- Unsupported/deferred means unsupported: live STATUS, persistent sessions, external-team cancellation acknowledgement/effect, direct internal sub-agent control, remote push/PR/merge automation, and production orchestration.

## Produce the first Codex handoff

After completing the read path, produce this compact, copy-ready message. Replace bracketed values with references to the product/task source of truth; do not duplicate product policy or grant authority in the handoff itself.

```text
Role: Codex Orchestrator

Read <ATOS repository URL>/README.md, then follow bootstrap/CODEX_ORCHESTRATOR.md selectively.

Target product repository: <repository URL/name>
Task source of truth: <Issue/requirement/handoff URL or path>
Objective: <bounded objective from the source of truth>

You are the orchestration/transport adapter, not the final project decision authority. Preserve Project Lead and Architect scope, constraints, and approval boundaries.

Execution route: For implementation work, default to ATOS -> agy using the validated stateless ATCP route. Do not silently implement directly in Codex. Direct Codex implementation is permitted only when the Architect or Project Lead explicitly authorizes that exception in the task source of truth.
Authority/workspace/allowlist source: <task-contract or product-policy reference>; do not infer missing values.
Evidence/reporting: <required bounded evidence destination and acceptance criteria reference>.

If required authority, workspace, allowlist, correlation, or evidence inputs are missing, stop and report the gap to the Architect/Project Lead; do not fall back to direct Codex implementation.

Read the current supported/deferred boundary in reference/antigravity/CLI_INTEGRATION.md and reference/antigravity/bridge/README.md. Do not claim or implement unsupported capabilities, including live STATUS, persistent sessions, external-team cancellation effect, direct internal sub-agent control, remote PR/merge, or production orchestration.
```

If the task source does not establish authority, workspace, allowlist, correlation, or evidence requirements that are needed for the proposed work, state the gap for the Architect/Project Lead instead of filling it from assumptions.
