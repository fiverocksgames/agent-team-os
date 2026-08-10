# Antigravity ATCP Bridge — Reference Vertical Slice

Status: experimental reference implementation for ATOS Phase 2.

This directory contains the smallest executable bridge between a parent ATCP orchestrator and a local Antigravity CLI Team Lead boundary.

## Supported flow

```text
TASK_ASSIGN JSON
    -> parent schema validation
    -> bounded TL prompt
    -> agy --output-format stream-json --json-schema ack.schema.json --print <prompt>
    -> extract $.result.structured_output
    -> ACK schema validation
    -> task_id + conversation_id correlation validation
    -> bounded PASS result
```

Only `TASK_ASSIGN -> ACK` is implemented. `STATUS`, `RESULT`, `ERROR`, `CANCEL`, persistent conversations, implementation authority, and Antigravity internal sub-agent control are intentionally out of scope for this milestone.

## Runtime

- Node.js 20+
- local `agy` available on PATH, or pass `--agy <absolute-path>`
- authenticated Antigravity CLI
- target workspace path supplied explicitly

Install/build:

```powershell
cd reference/antigravity/bridge
npm install
npm test
```

Reference dispatch from the repository root:

```powershell
node .\reference\antigravity\bridge\dist\src\cli.js `
  --task .\atcp\v1\examples\task-assign.example.json `
  --workspace C:\path\to\target-workspace
```

Optional flags:

- `--agy <path>`
- `--timeout-ms <milliseconds>` (default 300000)
- `--model <agy-model>`
- `--agent <agy-agent>`
- `--effort low|medium|high`
- `--task-schema <path>`
- `--response-schema <path>`

## Process and security contract

The adapter:

- uses a fresh `agy` invocation for each dispatch;
- does not pass `--dangerously-skip-permissions`;
- does not require `always-proceed`;
- does not mutate Antigravity Desktop/IDE Security Presets;
- removes proxy environment variables only from the spawned `agy` child environment, matching the validated local workaround;
- invokes `agy` with `shell: false`;
- captures stdout and stderr separately;
- treats stdout as JSONL and fails closed if a non-JSON line appears;
- extracts only the empirically verified `$.result.structured_output` value;
- validates both schema and correlation before returning PASS;
- reports only whether stderr was present, not its raw contents;
- applies a parent-side timeout and kills the child on expiry.

The bridge does not grant project modification authority. The canonical ACK fixture explicitly forbids implementation and tool use.

## Workspace selection

The first milestone selects the Antigravity target by running the CLI with `cwd` set to the explicit `--workspace` path. It does not assume a stable Antigravity project ID contract.

If future testing proves `--project` or persistent conversation IDs are required/reliable, that capability should be added as a separately validated extension rather than changing this baseline silently.

## Output boundary

Successful adapter stdout is one JSON object containing:

- `status: PASS`
- validated `payload`
- bounded `evidence` (event types, exit status, timeout flag, stderr-presence boolean)

Failures exit non-zero and write a bounded JSON error to stderr. Raw Antigravity logs or credentials are not emitted by the adapter.

## Validation

Unit tests cover:

- extraction from the observed `init -> step_update -> result` stream shape;
- missing structured output rejection;
- non-JSON stdout rejection;
- matching correlation acceptance;
- mismatched task identity rejection.

A local integration run must still be performed against the installed `agy` before this vertical slice can be considered complete.
