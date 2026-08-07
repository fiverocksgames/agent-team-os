# ATCP v1 Draft

Agent Team Communication Protocol (ATCP) defines structured communication between independent AI orchestration layers or teams.

ATCP does not define the internal implementation of a team. It defines the contract at the boundary between teams.

## Design goals

- explicit task identity;
- deterministic message types;
- machine-readable exchange;
- minimal dependence on conversational memory;
- traceability across agents, vendors, and sessions;
- compatibility with CLI, API, MCP, files, queues, and future transports;
- internal-team opacity.

## Message lifecycle

```text
TASK_ASSIGN
    ↓
ACK
    ↓
STATUS (0..n)
    ↓
RESULT | ERROR

CANCEL may be issued before a terminal result.
```

## Common envelope

All ATCP messages SHOULD contain:

```json
{
  "protocol": "ATCP-1",
  "message_type": "TASK_ASSIGN",
  "message_id": "MSG-...",
  "conversation_id": "CONV-...",
  "task_id": "TASK-...",
  "from": "ChatGPT-Architect",
  "to": "Antigravity-TL",
  "created_at": "RFC3339 timestamp",
  "in_reply_to": null
}
```

The transport may add metadata, but transport-specific fields must not redefine ATCP semantics.

## TASK_ASSIGN

Purpose: assign one coherent outcome to an external team lead.

Required payload concepts:

- objective;
- scope;
- deliverables;
- constraints;
- acceptance criteria;
- references/input artifacts;
- authority boundary;
- requested reporting behavior.

The parent orchestrator assigns the task to the external team's lead. It must not directly assign internal sub-agent work unless that capability is explicitly part of the team's public contract.

## ACK

Purpose: confirm whether the team accepts the assignment and identify immediate interpretation issues.

ACK should report:

- accepted: true/false;
- understood objective;
- interpreted scope;
- blocking missing inputs, if any;
- initial state.

ACK must not claim implementation success.

## STATUS

Purpose: provide a compact operational checkpoint without dumping internal chain-of-thought or large raw logs.

STATUS may include:

- lifecycle state;
- completed milestones;
- active workstreams;
- blockers;
- risks;
- requested decision/input;
- next externally meaningful checkpoint.

Internal reasoning and private chain-of-thought are not protocol payloads.

## RESULT

Purpose: return the completed or partially completed contracted outcome.

RESULT should include:

- final status;
- summary;
- deliverables/artifact references;
- validation performed;
- unverified areas;
- blockers/residual risks;
- changes made;
- recommended next action;
- evidence references.

A RESULT must distinguish observed evidence from inference or recommendation.

## ERROR

Purpose: report failure to execute the contract reliably.

ERROR should identify:

- error class;
- affected task/state;
- whether retry is safe;
- whether external intervention is required;
- preserved work/evidence;
- recommended recovery action.

Do not expose secrets, sensitive data, or unnecessary raw exception payloads.

## CANCEL

Purpose: request termination or cessation of further work on a task.

A receiving team should acknowledge cancellation and return preserved state when practical. Cancellation must not silently delete already-produced evidence or records.

## Authority and decisions

ATCP communicates authority; it does not create authority.

A receiving team may only act within authority explicitly granted by the task contract and its adopted governance. Merge, release, financial, production, destructive, or other high-impact authority remains with the adopting project's policy unless explicitly delegated.

## Structured output

JSON is the preferred machine-to-machine representation for ATCP v1. Human-readable Markdown may wrap or render the same semantic fields, but automation should not depend on prose parsing when structured output is available.

JSON Schemas will be versioned alongside the protocol before v1 is declared stable.
