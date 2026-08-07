# Agent Team Charter

## Purpose

This charter defines durable collaboration rules for human and AI contributors across projects.

> Roles are stable. Agents are replaceable. Durable knowledge belongs in repositories.

## Authority

1. The human Project Lead (PL) has final authority over scope, policy, release, merge, and unresolved cross-role conflicts unless authority is explicitly delegated.
2. AI agents operate only within their assigned responsibility and authority boundary.
3. A proposal is not an approved rule until an authoritative project record adopts it.
4. Significant work must leave enough durable context for another agent to continue without hidden session memory.
5. Cost, speed, quality, availability, and risk may justify changing the agent, model, vendor, IDE, session, or execution environment without redefining the role.

## Role and tooling separation

Assignments must distinguish responsibility from tooling.

Recommended assignment fields:

```yaml
role: <stable responsibility>
objective: <task objective>
inputs: []
deliverables: []
constraints: []
completion_criteria: []
agent: <temporary agent/product>
model: <temporary model>
execution_environment: <temporary environment>
approval_level: <authority granted for this assignment>
```

The `role` defines responsibility. Agent/model/execution fields are replaceable implementation choices.

## Core roles

Projects may add domain roles, but these generic responsibilities should remain separable.

### Project Lead

Owns final product/project authority and conflict resolution.

### Orchestrator / Architect

Owns planning, impact analysis, assignment, coordination, dependency-aware validation selection, and escalation. The orchestrator must not silently expand project scope or self-grant PL authority.

### Developer

Implements approved work, performs self-validation, records implementation facts, and reports blockers. Developer does not independently certify final quality when an independent verification role is required.

### Quality Assurance

Independently verifies requirements, behavior, regressions, evidence, and residual risk. Whenever practical, QA uses a different session/agent from the Developer and evaluates requirements, diff/artifacts, and evidence rather than relying only on the Developer's summary.

### Design / Experience Reviewer

Verifies user-facing design concerns when relevant: visual coherence, UX, accessibility, interaction, and presentation. Projects may rename or specialize this role.

### Archivist / Historian

Preserves and connects completed records but does not become an alternative source of truth and does not make product/project decisions.

## Internal-team opacity

Independent agent teams may have their own internal orchestration. A parent orchestrator communicates with the external team's lead through an explicit task contract.

The parent must not directly coordinate that team's internal Developer/QA/Designer roles unless the external team's contract explicitly exposes such control.

This prevents conflicting orchestrators and keeps vendor/team internals replaceable.

## Independence rule

When quality risk justifies independent verification, the implementation role must not silently approve its own result.

Independence may be achieved through a separate agent, session, model, vendor, or human reviewer according to project policy.

## Documentation responsibility

The role that performs material work owns the factual record of that work. Summaries created later must link to those records rather than invent or replace them.

Canonical policy documents contain approved rules. Operational handoffs contain current state. Worklogs contain chronological facts. Archives preserve history. These classes are distinct.
