# Antigravity Local Validation Procedure

Status: non-normative test procedure.

## Purpose

Validate the minimum ATCP round trip between a parent Architect and a local Antigravity CLI Team Lead endpoint before ATCP v1 is treated as operationally proven.

## Preconditions

- `agy --help` succeeds locally.
- The local Antigravity CLI account is authenticated.
- The repository/branch containing this document and the ATCP v1 schemas is available locally.
- No production or project files need to be modified for this test.
- Proxy/network settings used by the validation process are understood and recorded when relevant.

## Permission model

Antigravity CLI tool permission is part of the transport/execution environment and must not be confused with ATCP task authority.

Observed/default `request-review` behavior can block headless `--print` execution when the agent attempts a tool call because no interactive permission prompt is available.

For unattended validation, prefer a non-persistent sandboxed execution experiment before considering broader permission changes:

1. keep host/persistent permission settings unchanged;
2. use a clean child process with only known invalid process-scoped proxy variables removed when required;
3. test the CLI `--sandbox` flag in combination with `--print`;
4. keep the ATCP task authority non-mutating;
5. do not use `--dangerously-skip-permissions` for ATCP conformance validation.

Google's Antigravity CLI documentation also describes a `proceed-in-sandbox` Tool Permission setting that automatically executes terminal commands only in an isolated sandbox. Changing a persistent CLI permission setting is a separate operational decision and is not required merely to define ATCP.

A headless permission blocker is an execution-mode result (`BLOCKED`), not an ATCP protocol failure, unless the integration claims unsupported unattended capability.

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

If default headless execution is blocked by a tool permission request, repeat the same non-mutating test with the installed CLI's `--sandbox` flag. Record sandbox use explicitly.

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

If a sandbox is used, host project files must remain unchanged and the evidence record must identify the sandboxed execution mode.

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
sandbox: true | false
permission_mode: <observed/configured mode or unknown>
schema: atcp/v1/schemas/ack.schema.json
result: PASS | FAIL | BLOCKED
observed_output_format: <text|json|stream-json>
file_modifications: none | <details>
notes: <bounded observations>
```

Do not record account secrets, tokens, raw credentials, or unrelated private CLI state.

## Interpretation

A successful ACK proves only that the installed Antigravity CLI can participate in the minimum structured ATCP acknowledgement flow under the tested configuration. It does not prove STATUS, RESULT, cancellation, persistent-conversation behavior, or production safety.

A BLOCKED result caused by proxy, permission prompting, sandbox availability, authentication, or other transport/runtime constraints should be recorded separately from schema/protocol validity.