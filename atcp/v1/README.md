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

## Versioning

`ATCP-1` is the protocol identifier for this draft family. Breaking semantic/schema changes require a new protocol identifier once compatibility commitments exist.

Before ATCP v1 is declared stable, reference integrations must demonstrate at least:

1. schema-valid ACK round trip;
2. task identity preservation;
3. malformed-result rejection;
4. terminal RESULT or ERROR round trip;
5. cancellation behavior or an explicitly documented unsupported capability.