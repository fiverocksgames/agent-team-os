# Antigravity CLI Reference Integration

Status: non-normative reference implementation.

## Goal

Use a local Antigravity CLI installation as an external team endpoint behind ATCP, with the parent Architect communicating only with the Antigravity Team Lead boundary.

## Assumptions

The local `agy` CLI supports non-interactive execution and structured output options such as:

- `--print`
- `--output-format json`
- `--json-schema <schema-file>`
- `--mode plan|accept-edits`
- `--effort low|medium|high`
- `--conversation <id>` and `--continue` where appropriate

Exact CLI behavior is implementation-specific and must be verified locally.

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

## Minimal ACK test

The first integration test should not modify a project. It should verify that the CLI can produce an ACK that validates against `atcp/v1/schemas/ack.schema.json`.

Conceptual invocation:

```powershell
agy --print `
  --output-format json `
  --json-schema <path-to-ack.schema.json> `
  "Acknowledge task TEST-001 as the Technical Lead of an independent software team. Do not implement anything. Return only the requested structured result."
```

Because CLI versions may restrict schema enforcement to a particular output mode, the local harness MUST follow the actual `agy --help` contract rather than this example literally.

## Execution modes

Suggested parent mapping:

- inspection/planning task -> `--mode plan`
- authorized implementation task -> `--mode accept-edits`
- low-risk/simple classification -> `--effort low`
- ordinary implementation/review -> `--effort medium`
- architectural/high-risk reasoning -> `--effort high`

These are defaults, not protocol semantics.

## Permission safety

Do not use blanket permission bypass by default. `--dangerously-skip-permissions` should only be used in an explicitly trusted, isolated automation environment with project-level authorization.

## Stateless vs persistent execution

ATOS does not require persistent conversation memory. Repository-owned context plus a complete task contract is the portable default.

A transport MAY reuse a conversation when that is verified to be reliable, but important project state must still exist outside that conversation.

## Result handling

The parent Architect should:

1. validate the returned JSON against the expected ATCP schema;
2. reject malformed or mismatched `task_id` / `conversation_id` results;
3. record evidence/artifact references rather than large raw logs;
4. route required decisions back through project governance;
5. never treat a model claim such as "tests passed" as evidence unless the claimed validation is independently traceable.