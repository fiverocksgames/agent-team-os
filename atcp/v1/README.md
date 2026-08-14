# ATCP v1

Status: Draft.

ATCP (Agent Team Communication Protocol) defines the structured boundary between independent AI teams or orchestration layers.

## Lifecycle

```text
TASK_ASSIGN -> ACK -> STATUS (0..n) -> RESULT | ERROR
                      
CANCEL may be sent before terminal completion.
```

## Standalone JSON Schemas

- `schemas/task-assign.schema.json`
- `schemas/ack.schema.json`
- `schemas/status.schema.json`
- `schemas/result.schema.json`
- `schemas/error.schema.json`
- `schemas/cancel.schema.json`

The schemas are intentionally standalone for simple CLI/API validation without requiring a resolver for shared `$ref` files.

## Transport independence

ATCP semantics are independent of transport. A transport can be:

- CLI/stdout;
- API;
- MCP;
- message queue;
- file exchange;
- GitHub artifact/comment;
- another explicitly defined mechanism.

Transport metadata may be added outside the ATCP payload but must not redefine message semantics.

## Team opacity

The sender addresses the receiving team's public lead/boundary. The sender does not orchestrate the receiving team's internal Developer, QA, Designer, or other sub-agents.

## Human-readable vs machine-readable

Human-readable Markdown can describe or render a message, but automation should exchange schema-validated structured payloads when possible.

## Acceptance is more than schema validation

A receiver MUST NOT accept a message merely because it matches a JSON Schema.

The parent/orchestrator must also verify correlation identity for the pending exchange, including at minimum the expected `task_id` and `conversation_id` where those fields are part of the message type.

A schema-valid response with mismatched correlation identity must be rejected.

## Reference validation status

The Antigravity CLI reference integration has empirically demonstrated the following bounded stateless reference lifecycle with local `agy` 1.1.11 and 1.1.12 evidence:

- schema-constrained structured output was produced;
- the ACK validated against `schemas/ack.schema.json`;
- `protocol == ATCP-1` was verified;
- `message_type == ACK` was verified;
- `task_id` and `conversation_id` preservation were verified;
- a parent-side validator rejected a schema-valid ACK carrying an intentionally incorrect `task_id`;
- after an accepted ACK, one fresh `RESULT` or one fresh `ERROR` terminal invocation validated against its schema and parent correlation boundary;
- parent-owned `CANCEL` coordination blocked a terminal child before spawn and terminated only the exact parent-owned active child handle.
- the Phase 3 parent-owned implementation seam enforced validated authority bits, a clean no-remote isolated workspace, an explicit file allowlist, bounded local writes, and an optional local commit. It did not grant direct repository authority to the transport or external team; see the [bridge boundary](../../reference/antigravity/bridge/README.md).

For that tested transport, `stream-json` emitted the final structured value at `$.result.structured_output`. The reference lifecycle has no persistent/session dependency and does not use `--conversation` or `--continue`.

This path is implementation-specific transport evidence, not a protocol requirement for other transports. Its `CANCEL` behavior is local parent-process coordination only; it is not an acknowledgement that an external Antigravity team stopped work or preserved artifacts. `STATUS` is unsupported in this stateless reference because fresh invocations cannot provide trustworthy live progress observation.

## Versioning

`ATCP-1` is the protocol identifier for this draft family. Breaking semantic/schema changes require a new protocol identifier once compatibility commitments exist.

## Remaining validation before v1 stability

The ACK and correlation requirements are now operationally demonstrated by at least one reference integration. Before ATCP v1 is declared stable, reference integrations still need bounded evidence for at least:

1. trustworthy live `STATUS` behavior where a transport provides an actual progress source;
2. external-team cancellation acknowledgement/effect, if a transport publicly exposes it;
3. authority behavior beyond the bounded, parent-owned implementation seam already evidenced by the reference bridge;
4. any claimed persistent-conversation/session reuse behavior;
5. production deployment, operations, and safety readiness.

A capability that is not yet tested must remain explicitly unproven rather than being inferred from the ACK result.
