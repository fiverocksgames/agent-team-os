# Handoff Standard

## Purpose

A handoff is the current operational checkpoint for one designated work item. It must allow a new agent or session to continue without relying on hidden conversation memory.

A handoff is not a repository-wide task list and must not duplicate state owned by external systems when that state can be queried authoritatively.

## Required questions

A valid handoff must answer:

- What work is designated?
- Who currently owns it?
- What objective is being pursued?
- What is complete, in progress, not started, and unverified?
- What validation has actually been performed?
- What exact action should happen next?
- What blockers, risks, assumptions, and constraints must survive the handoff?

## Source-of-truth boundaries

External systems own their own canonical state. Examples include GitHub PR lifecycle state, current PR head, checks, reviewers, and merge state.

The handoff owns project meaning and continuity: role, objective, workflow state, progress, validated state, unverified areas, next action, blockers, risks, assumptions, and execution context.

Do not copy volatile external state into the handoff when it can be queried reliably. Prefer stable identifiers and references.

## Minimal schema

```yaml
schema_version: 1
work_id: <stable identifier>
status: active | blocked | waiting_for_pl | paused | escalated | cancelled | completed
workflow_state: <project-defined state>

assignment:
  role: <responsible role>
  objective: <current objective>

repository:
  repository: <owner/name or equivalent>
  branch: <branch or null>
  issue: <id or null>
  pull_request: <id or null>

progress:
  completed: []
  in_progress: []
  not_started: []

validation:
  tested_revision: <revision/hash or null>
  evidence: []
  unverified: []

continuation:
  next_action: <exact next action>
  blockers: []
  risks: []
  assumptions: []

execution:
  agent: <agent/product>
  model: <model or unknown>
  environment: <execution environment>
```

Projects may extend the schema, but extensions must not change the meaning of required fields silently.

## Update triggers

Update the handoff when:

- designated work changes;
- ownership or execution environment changes materially;
- validation state changes;
- a blocker or significant risk is discovered or resolved;
- work enters or leaves a paused/waiting/escalated state;
- a PR becomes reviewable or is merged;
- work is cancelled;
- responsibility moves to another agent, model, vendor, or session.

## Evidence discipline

Handoff should link to detailed evidence rather than reproduce large logs. Never claim validation that was not actually performed.

When evidence is revision-sensitive, record the tested revision and the evidence identity required by the adopting project's verification policy.

## Incoming-agent acknowledgement

Before changing project state, an incoming agent should be able to restate:

```text
Role:
Objective:
Scope:
Deliverables:
Constraints:
Current state understood:
Open questions:
```

If the handoff cannot support that acknowledgement, it is incomplete.
