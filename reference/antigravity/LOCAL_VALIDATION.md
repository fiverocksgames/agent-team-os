# Antigravity Local Validation Procedure

Status: non-normative test procedure.

## Purpose

Validate the minimum ATCP round trip between a parent Architect and a local Antigravity CLI Team Lead endpoint before ATCP v1 is treated as operationally proven.

## Preconditions

- `agy --help` succeeds locally.
- The local Antigravity CLI account is authenticated.
- The repository/branch containing this document and the ATCP v1 schemas is available locally.
- No production or project files need to be modified for this test.

## Important permission-model distinction

Antigravity CLI has two separate concepts that must not be conflated:

1. CLI `--sandbox`: starts the CLI with terminal restrictions / sandbox execution enabled.
2. Persistent Tool Permission setting: controls whether tool calls are automatically allowed or require review.

Observed with `agy` 1.1.11: `--sandbox --print` did **not** override the default `request-review` Tool Permission mode. In headless print mode, a required Bash/tool confirmation was automatically denied because no interactive approval channel was available.

Therefore ATOS must not treat `--sandbox` alone as sufficient for unattended execution.

Official Antigravity documentation describes these Tool Permission modes:

- `request-review`: prompts for actions requiring permission;
- `proceed-in-sandbox`: automatically executes terminal commands inside the isolated sandbox;
- `always-proceed`: automatically executes with host permissions;
- `strict`: limits automatic activity to read tools and prompts for non-read tools.

For unattended ATOS reference validation, `proceed-in-sandbox` is the preferred candidate to test. `always-proceed` and `--dangerously-skip-permissions` are not required by this reference validation and must not be used as a shortcut.

Changing Tool Permission is a security-relevant local configuration change and requires explicit operator approval before validation proceeds.

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

### Known environment blocker

A prior validation found process-scoped `HTTP_PROXY`, `HTTPS_PROXY`, and `ALL_PROXY` variables (including lowercase variants) pointing to `http://127.0.0.1:9`. This prevented the CLI from reaching Antigravity services.

For validation only, a fresh child process may clear those variables **at process scope**. Do not modify persistent User/Machine environment variables merely to run this test.

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
9. no host project files were modified.

## Test B — malformed identity rejection

After a successful ACK test, intentionally ask for a response using the wrong task ID and verify that the parent integration rejects it even if the JSON is schema-valid.

ATCP validity requires both schema validity and correlation/identity validity.

## Test C — permission boundary

Verify that a task with all authority flags false is not treated as permission to modify host files or create Git state.

Do not use `--dangerously-skip-permissions` for this validation.

If the operator explicitly approves temporary `proceed-in-sandbox` configuration for this test, record both the pre-test setting and restoration outcome. The validation should restore the previous Tool Permission setting after completion unless the operator explicitly chooses to adopt the new setting.

## Test record

Record only bounded evidence:

```yaml
transport: antigravity-cli
agy_version: <version>
model: <reported model>
cli_sandbox: true | false
tool_permission: request-review | proceed-in-sandbox | always-proceed | strict | unknown
schema: atcp/v1/schemas/ack.schema.json
result: PASS | FAIL | BLOCKED
observed_output_format: <text|json|stream-json>
host_file_modifications: none | <details>
permission_setting_restored: true | false | not_changed
notes: <bounded observations>
```

Do not record account secrets, tokens, raw credentials, or unrelated private CLI state.

## Interpretation

A successful ACK proves only that the installed Antigravity CLI can participate in the minimum structured ATCP acknowledgement flow under the tested configuration. It does not prove STATUS, RESULT, cancellation, persistent-conversation behavior, or production safety.

Observed BLOCKED results are still useful compatibility evidence and must be preserved rather than rewritten as protocol failures.