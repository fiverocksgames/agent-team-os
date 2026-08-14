# Antigravity ATCP Bridge — Reference Vertical Slice

Status: experimental reference implementation through ATOS Phase 3.

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

The reference supports an ACK-only dispatch and the validated stateless lifecycle: `TASK_ASSIGN -> fresh ACK -> parent validation -> exactly one fresh RESULT or ERROR -> parent validation`. The terminal invocation replays the same validated task context; it does not use `--conversation` or `--continue`. `STATUS`, persistent conversations, and Antigravity internal sub-agent control remain out of scope.

`CANCEL` is limited to parent-owned coordination: a correlated parent intent can block a terminal child before spawn or terminate the exact child handle owned by the parent. It does not report or imply an external Antigravity-team acknowledgement, team cancellation effect, or artifact-preservation effect.

## Bounded implementation authority

The optional implementation seam is parent-owned, not model-owned. It derives boolean operation bits from the immutable validated `TASK_ASSIGN.authority`, requires a clean no-remote isolated Git workspace and an explicit relative-file allowlist, then verifies local Git effects. It can apply only allowlisted file writes and an optional local commit. PR creation and merge are not implemented; they remain fail-closed even if a future task requests them. Guardrail/process failures stay local bridge failures and are not emitted as ATCP `ERROR` messages.

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

Stateless ACK → RESULT lifecycle:

```powershell
node .\reference\antigravity\bridge\dist\src\cli.js `
  --phase lifecycle `
  --terminal result `
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
- `--result-schema <path>`
- `--error-schema <path>`
- `--phase ack|lifecycle` (default `ack`)
- `--terminal result|error` (lifecycle only; default `result`)

## Process and security contract

The adapter:

- uses a fresh `agy` invocation for each dispatch;
- validates and records the parent-owned task identity/digest before ACK dispatch, gates exactly one selected RESULT or ERROR terminal invocation on a validated accepted ACK, and replays the same task context to a second fresh process;
- does not pass `--dangerously-skip-permissions`;
- does not require `always-proceed`;
- does not mutate Antigravity Desktop/IDE Security Presets;
- removes proxy environment variables only from the spawned `agy` child environment, matching the validated local workaround;
- invokes `agy` with `shell: false`;
- captures stdout and stderr separately;
- treats stdout as JSONL and fails closed if a non-JSON line appears;
- extracts only the empirically verified `$.result.structured_output` value;
- validates both schema and correlation before returning PASS;
- validates response sender/recipient against the pending TASK_ASSIGN boundary;
- reports only whether stderr was present, not its raw contents;
- applies a parent-side timeout and kills the child on expiry.

## CANCEL scope

The parent can validate and record a correlated `CANCEL` intent, block a terminal child that has not started, and terminate only an exact child process handle it owns. This is local process coordination, not an acknowledgement that Antigravity's team stopped work or preserved external artifacts.

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
