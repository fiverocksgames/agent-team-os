# Antigravity Local Validation Procedure

Status: non-normative test procedure.

## Purpose

Validate the minimum ATCP round trip between a parent Architect and a local Antigravity CLI Team Lead endpoint before ATCP v1 is treated as operationally proven for that transport.

## Verified baseline

The following was validated locally with `agy` 1.1.11:

- correct `--print` argument binding;
- `--output-format json` result-envelope semantics;
- file-path delivery for `--json-schema`;
- `stream-json` event discriminators `init`, `step_update`, `result`;
- final structured payload at `$.result.structured_output`;
- strict minimal schema probe PASS;
- ATCP ACK schema PASS;
- `protocol`, `message_type`, `task_id`, and `conversation_id` checks PASS;
- parent-side rejection of an intentionally mismatched `task_id` PASS.

The validated ACK path required no project file modifications, no persistent proxy changes, no Desktop/IDE security changes, no `--dangerously-skip-permissions`, and no unrestricted CLI permission mode.

## Preconditions

- `agy --help` succeeds locally.
- The local Antigravity CLI account is authenticated.
- The repository/branch containing this document and the ATCP v1 schemas is available locally.
- No production or project files need to be modified for this test.
- CLI-native Tool Permission may remain `request-review` for a no-tool ACK probe.

## Permission-model findings

Do not assume that Antigravity Desktop/IDE project Security Presets and Antigravity CLI Tool Permission are the same configuration surface.

Observed locally:

- Antigravity Desktop 2.5.0 exposed project-level `Security Preset` values `Default`, `Full machine`, `Turbo mode`, and `Custom`.
- Under `Custom`, the Desktop UI exposed `Terminal Command Auto Execution` separately from other file/network/tooling controls.
- The operator's Desktop project was already using `Turbo Mode`; inspecting Custom showed terminal auto execution as `Always Proceed`.
- Despite that Desktop configuration, `agy` 1.1.11 CLI-native Tool Permission initialized as `request-review`.
- Headless tasks that attempted Bash/tool use under `request-review` could not satisfy interactive approval.
- `--sandbox` is an execution-isolation flag; it did not by itself change CLI-native Tool Permission.

Therefore:

1. ATOS MUST NOT infer CLI Tool Permission from Desktop/IDE Security Preset.
2. ATOS MUST NOT treat CLI `--sandbox` as equivalent to a Tool Permission setting.
3. Desktop Security Preset changes are not part of the validated ACK procedure.
4. `always-proceed` and `--dangerously-skip-permissions` MUST NOT be introduced merely to make the reference validation pass.
5. A no-tool structured ACK can be validated while CLI Tool Permission remains `request-review`.
6. Any future validation that actually requires tools must separately define and approve its permission model.

## Invocation contract

For the tested CLI, all options must appear before `--print`, and the prompt must immediately follow `--print`.

Correct conceptual shape:

```text
agy <options> --output-format stream-json --json-schema <schema-path> --print <prompt>
```

Incorrect shape:

```text
agy --print --output-format stream-json ...
```

because `--print` consumes a prompt value.

PowerShell inline JSON Schema quoting proved unreliable. Prefer an absolute schema file path.

## Test A — structured ACK

Use the ACK schema:

`atcp/v1/schemas/ack.schema.json`

The prompt should instruct the model to act only as the public Technical Lead boundary, acknowledge `TASK-TEST-001`, preserve `CONV-TEST-001`, and not use tools or start implementation.

Example PowerShell shape:

```powershell
agy `
  --output-format stream-json `
  --json-schema <absolute-path-to-ack.schema.json> `
  --print "You are the Technical Lead boundary of an independent AI development team. Acknowledge TASK-TEST-001 only. Do not modify files, commit, create a PR, start implementation, or use tools. Preserve conversation_id CONV-TEST-001 and return an ATCP-1 ACK for ChatGPT-Architect."
```

Capture stdout in a bounded temporary file if necessary. Parse JSON lines and find the final `result` event. For `agy` 1.1.11, extract the candidate payload from:

```text
$.result.structured_output
```

Do not publish raw event logs merely to prove the path.

### Known environment blocker pattern

One local validation environment contained process-scoped proxy variables pointing to a non-responsive loopback endpoint. That prevented the CLI from reaching Antigravity services.

If an equivalent local-only blocker is independently confirmed, a fresh child process may clear only the affected variables at process scope for validation. Do not modify persistent User/Machine environment variables merely to run this test.

This workaround is environment-specific and is not an ATCP requirement.

## Pass criteria

The test passes only if:

1. the command reaches the service and completes;
2. `stream-json` contains a final `result` event;
3. `$.result.structured_output` is present;
4. that object validates against `ack.schema.json`;
5. `protocol == ATCP-1`;
6. `message_type == ACK`;
7. `task_id == TASK-TEST-001`;
8. `conversation_id == CONV-TEST-001`;
9. the response does not claim implementation occurred;
10. no host project files were modified.

## Test B — correlation rejection

After a successful ACK test, validate that the parent rejects a schema-valid payload whose `task_id` or `conversation_id` does not match the pending request.

ATCP acceptance requires both:

- schema validity; and
- parent-side correlation/identity validity.

The tested parent-side mismatch rejection passed for an intentionally wrong `task_id`.

## Test C — permission boundary

Verify that a task with all authority flags false is not treated as permission to modify host files or create Git state.

Do not use `--dangerously-skip-permissions` for this validation.

A no-tool ACK probe does not require changing CLI-native Tool Permission from `request-review`.

Any future CLI Tool Permission mutation is security-relevant and requires explicit operator approval. Record the pre-test value and restore it after testing unless the operator explicitly adopts the new value.

## Test record

Record only bounded evidence:

```yaml
transport: antigravity-cli
agy_version: <version>
model: <reported model if needed>
cli_tool_permission: request-review | proceed-in-sandbox | always-proceed | strict | unknown
output_format: stream-json
structured_output_path: $.result.structured_output
schema: atcp/v1/schemas/ack.schema.json
ack_schema_valid: true | false
protocol_valid: true | false
message_type_valid: true | false
task_id_valid: true | false
conversation_id_valid: true | false
correlation_rejection: PASS | FAIL | NOT_RUN
host_file_modifications: none | <details>
temp_files_removed: true | false
notes: <bounded observations>
```

Do not record account secrets, tokens, raw credentials, raw event logs, or unrelated private CLI state.

## Interpretation

A successful ACK plus parent-side identity rejection proves that the tested Antigravity CLI can participate in the minimum structured ATCP acknowledgement flow and that the parent can reject a mismatched response.

It does not prove:

- `STATUS` streaming behavior;
- terminal `RESULT` or `ERROR` round trips;
- cancellation;
- persistent conversation reuse;
- production tool permissions;
- project-level implementation safety.

Those require separate bounded validation before being claimed as supported.