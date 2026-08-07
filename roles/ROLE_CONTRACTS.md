# ATOS Role Contracts

## Purpose

Roles define durable responsibility. Agents, models, vendors, IDEs, sessions, and execution environments are replaceable implementations of those roles.

A project MAY define additional roles, but it SHOULD preserve these authority boundaries unless a local policy explicitly overrides them.

## Project Lead (PL)

The human Project Lead owns final project authority unless explicitly delegated.

Responsibilities:
- define goals, priorities, scope, and acceptance;
- approve material policy and architecture changes;
- resolve role conflicts;
- approve merge/release decisions when the project requires human approval.

## Lead Architect / Meta-Orchestrator

Purpose: preserve technical and operational coherence across teams.

Responsibilities:
- decompose approved work into contracts;
- choose which team or role receives work;
- preserve scope and constraints;
- manage handoff, evidence, risks, and escalation;
- coordinate external teams through their designated lead;
- never rely on hidden session memory as the sole source of project state.

Authority boundary:
- MAY coordinate teams and recommend decisions;
- MUST NOT silently expand product scope or override the PL;
- MUST NOT directly orchestrate opaque external teams' internal sub-agents.

## Team Lead (TL)

Purpose: operate one implementation team as an opaque execution unit behind a stable team boundary.

Responsibilities:
- accept or reject task contracts;
- plan internal execution;
- coordinate the team's own Developer, QA, Designer, and other internal roles;
- return structured status, blockers, evidence, and results;
- keep internal orchestration details private unless needed for evidence or debugging.

The parent Architect communicates with the TL, not directly with that team's internal sub-agents.

## Developer

Purpose: implement approved work.

Responsibilities:
- change files within scope;
- perform self-review and relevant developer validation;
- report exact modified artifacts and known limitations;
- avoid unrelated refactoring or unapproved feature expansion;
- never claim independent QA approval for its own work.

## QA

Purpose: independently verify behavior against approved requirements.

Responsibilities:
- verify acceptance criteria;
- run relevant tests;
- report PASS, CONDITIONAL_PASS, FAIL, or NOT_VERIFIED with evidence;
- distinguish observed facts from assumptions;
- remain independent from the implementation session whenever practical.

## Designer / UX Reviewer

Purpose: independently validate user-visible quality where applicable.

Responsibilities:
- assess clarity, usability, accessibility, visual consistency, and interaction contracts;
- provide actionable blockers rather than implementation ownership;
- avoid expanding product scope.

## Independent Reviewer

Optional role used when a project requires a separate final evidence-based review.

Responsibilities:
- review requirements, final diff, and evidence packet;
- return PASS, REWORK, or ESCALATE;
- never become a second orchestrator;
- route rework through the responsible Architect/TL rather than directly assigning implementation.

## Archivist

Optional non-decision role.

Responsibilities:
- preserve completed records;
- connect worklogs, ADRs, PRs, and milestones;
- never replace canonical policy;
- never invent facts or make project decisions.

## Assignment Contract

Every substantial assignment SHOULD distinguish responsibility from tooling.

Recommended fields:

```yaml
role: Developer
objective: <approved objective>
inputs: []
deliverables: []
constraints: []
acceptance_criteria: []
agent: <temporary agent/product>
model: <temporary model>
execution_environment: <local/cloud/etc>
branch: <optional>
approval_level: <draft-only/review-ready/etc>
```

The `role` is durable responsibility. The other fields are temporary execution choices.