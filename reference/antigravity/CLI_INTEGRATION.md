# Antigravity CLI Reference Integration

Status: non-normative reference implementation.

## Goal

Use a local Antigravity CLI installation as an external team endpoint behind ATCP, with the parent Architect communicating only with the Antigravity Team Lead boundary.

## Verified compatibility baseline

The following behavior was empirically validated with local `agy` CLI 1.1.11:

- non-interactive `--print` execution works when all options appear before `--print` and the prompt immediately follows `--print`;
- `--output-format json` is a CLI result envelope, with ordinary model text in its `response` field;
- `--output-format stream-json` accepts a JSON Schema file path through `--json-schema`;
- stream events observed were `init`, `step_update`, and `result`;
- the deterministic final schema-constrained payload is located at `$.result.structured_output`;
- a minimal strict schema probe validated successfully;
- an ATCP ACK validated successfully against `atcp/v1/schemas/ack.schema.json`;
- `protocol`, `message_type`, `task_id`, and `conversation_id` preservation were verified;
- a parent-side validator correctly rejected a schema-valid response with an intentionally mismatched `task_id`.

These observations describe the tested 1.1.11 build and are not assumed to be stable across future CLI versions without revalidation.

## Assumptions

The local `agy` CLI supports non-interactive execution and options such as:

- `--print <prompt>`
- `--output-format text|json|stream-json`
- `--json-schema <schema-file-or-schema>`
- `--mode plan|accept-edits`
- `--effort low|medium|high`
- `--conversation <id>` and `--continue` where appropriate

Exact CLI behavior remains implementation-specific and must be verified locally after upgrades.

## Boundary

```text
ChatGPT / Parent Architect
        |
        | ATCP task contract
        v
local shell -> agy CLI -> Antigravity TL
                         |- Developer
                         |- QA
                         `- Designer
```

The parent Architect MUST NOT attempt to address Antigravity internal sub-agents directly unless Antigravity deliberately exposes that as a public team capability.

## Structured-output invocation contract

For `agy` 1.1.11, option ordering matters. `--print` takes the prompt as its value, so the prompt MUST immediately follow `--print`.

Correct conceptual shape:

```text
agy <other-options> --output-format stream-json --json-schema <schema-path> --print <prompt>
```

Do not use this incorrect shape:

```text
agy --print --output-format stream-json ...
```

because `--output-format` may be interpreted as the prompt value.

PowerShell quoting for inline JSON Schema proved fragile in local validation. A schema file path is the preferred reference approach.

## Minimal ACK test

The minimum integration test should not modify a project. It should verify that the CLI can produce an ACK that validates against `atcp/v1/schemas/ack.schema.json`.

Conceptual PowerShell shape:

```powershell
agy `
  --output-format stream-json `
  --json-schema <absolute-path-to-ack.schema.json> `
  --print "You are the Technical Lead boundary of an independent AI development team. Acknowledge TASK-TEST-001 only. Do not modify files, commit, create a PR, or start implementation. Preserve conversation_id CONV-TEST-001 and return an ATCP-1 ACK for ChatGPT-Architect. Do not use tools."
```

The adapter should parse the `result` event and read:

```text
$.result.structured_output
```

as the final schema-constrained ATCP payload.

The adapter MUST then perform parent-side correlation checks in addition to JSON Schema validation. A schema-valid message with the wrong `task_id` or `conversation_id` MUST be rejected.

## Output formats

### `text`

Useful for simple probes and human-facing diagnostics. It is not sufficient by itself for machine-enforced ATCP payload validation.

### `json`

Observed as a CLI result envelope. Ordinary model text appears in the envelope's `response` field. Do not assume that `--output-format json` alone forces the model response to match an arbitrary application schema.

### `stream-json`

Preferred tested transport for schema-constrained ATCP output. The observed event stream contains lifecycle events and a final `result` event. The tested structured payload location is `$.result.structured_output`.

## Execution modes

Suggested parent mapping:

- inspection/planning task -> `--mode plan`
- authorized implementation task -> `--mode accept-edits`
- low-risk/simple classification -> `--effort low`
- ordinary implementation/review -> `--effort medium`
- architectural/high-risk reasoning -> `--effort high`

These are defaults, not protocol semantics.

## Permission safety

Desktop/IDE Security Presets and CLI-native Tool Permission must not be assumed to be the same configuration surface.

Observed locally, CLI-native Tool Permission initialized as `request-review`. Headless tasks that attempted tool use could not satisfy an interactive approval request. Therefore reference ATCP transport probes should explicitly instruct the receiving agent not to use tools unless tool execution is part of the authorized test.

Do not use blanket permission bypass by default. `--dangerously-skip-permissions` and unrestricted permission modes are not required for the validated ACK transport path.

## Environment isolation

A local environment may contain unrelated proxy variables or other shell configuration. Reference validation SHOULD make the minimum process-scoped adjustment necessary for the test and MUST NOT silently rewrite persistent User/Machine configuration.

Environment-specific workarounds are not ATCP semantics and should not be copied into other projects unless independently required.

## Stateless vs persistent execution

ATOS does not require persistent conversation memory. Repository-owned context plus a complete task contract is the portable default.

A transport MAY reuse a conversation when that is verified to be reliable, but important project state must still exist outside that conversation.

## Result handling

The parent Architect or adapter should:

1. locate the final structured payload at the transport-defined path (`$.result.structured_output` for the tested `agy` 1.1.11 stream contract);
2. validate the returned object against the expected ATCP schema;
3. reject malformed or mismatched `task_id` / `conversation_id` results;
4. record bounded evidence/artifact references rather than large raw logs;
5. route required decisions back through project governance;
6. never treat a model claim such as "tests passed" as evidence unless the claimed validation is independently traceable.

## Validation status

The minimum ACK transport and parent-side identity rejection are operationally proven for the tested local `agy` 1.1.11 environment.

This does **not** yet prove:

- terminal `RESULT` or `ERROR` round trips;
- `STATUS` streaming semantics;
- cancellation behavior;
- persistent conversation/session reuse;
- production implementation permissions or project safety.

Those capabilities require separate bounded validation before they are claimed as supported.