# Antigravity Local Validation Procedure

Status: non-normative test procedure.

## Purpose

Validate the minimum ATCP round trip between a parent Architect and a local Antigravity CLI Team Lead endpoint before ATCP v1 is treated as operationally proven.

## Preconditions

- `agy --help` succeeds locally.
- The local Antigravity CLI account is authenticated.
- The repository/branch containing this document and the ATCP v1 schemas is available locally.
- No production or project files need to be modified for this test.

## Permission-model findings

Do not assume that Antigravity Desktop/IDE project Security Presets and Antigravity CLI Tool Permission are the same configuration surface.

Observed locally:

- Antigravity Desktop 2.5.0 exposed project-level `Security Preset` values `Default`, `Full machine`, `Turbo mode`, and `Custom`.
- Under `Custom`, the Desktop UI exposed `Terminal Command Auto Execution` separately from other file/network/tooling controls.
- The operator's Desktop project was already using `Turbo Mode`; inspecting Custom showed terminal auto execution as `Always Proceed`.
- Despite that Desktop configuration, `agy` 1.1.11 headless `--print` still denied a required Bash/tool confirmation.

Official Antigravity CLI documentation describes a separate CLI `Tool Permission` setting stored with CLI configuration and reachable through CLI `/config` or `/settings`:

- `request-review`: prompt before permission-requiring actions;
- `proceed-in-sandbox`: automatically execute terminal commands in the CLI sandbox;
- `always-proceed`: automatically execute with host permissions;
- `strict`: automatically permit only read tools and prompt for non-read tools.

The CLI also exposes `--sandbox`, which enables terminal restrictions, but observed `--sandbox --print` did not itself eliminate the headless approval blocker.

Therefore:

1. ATOS MUST NOT infer CLI Tool Permission from Desktop/IDE Security Preset.
2. ATOS MUST NOT treat CLI `--sandbox` as equivalent to `proceed-in-sandbox`.
3. Desktop Security Preset changes are not part of this CLI validation procedure.
4. `always-proceed` and `--dangerously-skip-permissions` MUST NOT be introduced merely to make the reference validation pass.
5. A future CLI Tool Permission test should change the CLI configuration surface itself (`agy` `/config` or `/settings`, or a documented CLI configuration mechanism), not the Desktop project Security Preset.

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

Any CLI Tool Permission mutation is security-relevant and requires explicit operator approval. Record the pre-test CLI value and restore it after testing unless the operator explicitly adopts the new value.

## Test record

Record only bounded evidence:

```yaml
transport: antigravity-cli
agy_version: <version>
model: <reported model>
cli_sandbox: true | false
cli_tool_permission: request-review | proceed-in-sandbox | always-proceed | strict | unknown
desktop_security_preset: <observed value, if relevant>
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