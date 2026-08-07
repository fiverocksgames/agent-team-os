# Antigravity Local Validation Procedure

Status: non-normative test procedure.

## Purpose

Validate the minimum ATCP round trip between a parent Architect and a local Antigravity CLI Team Lead endpoint before ATCP v1 is treated as operationally proven.

## Preconditions

- `agy --help` succeeds locally.
- The local Antigravity CLI account is authenticated.
- The repository/branch containing this document and the ATCP v1 schemas is available locally.
- No production or project files need to be modified for this test.

## Test A — structured ACK

Use the ACK schema:

`atcp/v1/schemas/ack.schema.json`

The prompt should instruct the model to act only as the public Technical Lead boundary and to acknowledge `TASK-TEST-001` without implementation.

Example PowerShell shape:

```powershell
agy --print `
  --output-format json `
  --json-schema .\atcp\v1\schemas\ack.schema.json `
  "You are the Technical Lead boundary of an independent AI development team. Acknowledge TASK-TEST-001 only. Do not modify files, commit, create a PR, or start implementation. Preserve conversation_id CONV-TEST-001 and return an ATCP-1 ACK for ChatGPT-Architect."
```

Important: use the exact options supported by the installed `agy --help`. If the CLI states that schema enforcement only applies to `stream-json`, adapt the output mode accordingly and record that compatibility fact.

## Pass criteria

The test passes only if:

1. the command exits successfully;
2. the final payload is machine-readable JSON;
3. the payload validates against `ack.schema.json`;
4. `protocol == ATCP-1`;
5. `message_type == ACK`;
6. `task_id == TASK-TEST-001`;
7. `conversation_id == CONV-TEST-001`;
8. the response does not claim implementation occurred;
9. no project files were modified.

## Test B — malformed identity rejection

After a successful ACK test, intentionally ask for a response using the wrong task ID and verify that the parent integration rejects it even if the JSON is schema-valid.

ATCP validity requires both schema validity and correlation/identity validity.

## Test C — permission boundary

Verify that a task with all authority flags false is not treated as permission to modify files or create Git state.

Do not use `--dangerously-skip-permissions` for this validation.

## Test record

Record only bounded evidence:

```yaml
transport: antigravity-cli
agy_version: <version>
model: <reported model>
mode: <mode>
effort: <effort>
schema: atcp/v1/schemas/ack.schema.json
result: PASS | FAIL | BLOCKED
observed_output_format: <text|json|stream-json>
file_modifications: none | <details>
notes: <bounded observations>
```

Do not record account secrets, tokens, raw credentials, or unrelated private CLI state.

## Interpretation

A successful ACK proves only that the installed Antigravity CLI can participate in the minimum structured ATCP acknowledgement flow under the tested configuration. It does not prove STATUS, RESULT, cancellation, persistent-conversation behavior, or production safety.