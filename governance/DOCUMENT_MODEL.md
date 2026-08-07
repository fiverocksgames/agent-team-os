# Document Model

## Purpose

Long-running agent teams need clear document authority. This model prevents worklogs, handoffs, archives, chats, and proposals from silently becoming policy.

## Document classes

### Constitution / Policy

Durable approved rules. Changes should be rare and explicitly reviewed.

Examples: project charter, development policy, role authority, safety constraints.

### Specification / Architecture

Approved behavior, contracts, system boundaries, and design decisions that govern implementation.

### Operational Handoff

Current actionable state for one designated work item. Optimized for continuity, not history.

### Worklog / Journal

Chronological facts recorded by the role that performed the work: actions taken, observations, validation, failures, evidence references, unresolved questions.

A worklog is evidence of what happened; it is not automatically a policy change.

### Decision / ADR

Records a material decision, context, alternatives, rationale, and consequences.

### Archive / History

Preserves and connects completed records. It is not an alternative source of current truth and must preserve source meaning.

### Communication Record

Request, proposal, review, discussion, status, or report exchanged between roles/teams. A communication does not become canonical solely because it exists.

## Authority rule

When documents conflict, projects should declare an explicit precedence order. A recommended generic precedence is:

1. safety, legal, and security constraints;
2. approved constitution/policy;
3. accepted decisions/ADRs;
4. approved specifications/architecture;
5. current task contract and acceptance criteria;
6. current operational handoff;
7. worklogs and communication records;
8. contributor preference.

Projects may insert domain-specific policies at the appropriate level.

## Source-of-truth rule

Do not duplicate authoritative external state unnecessarily. GitHub should own GitHub state; CI should own run/check state; a project database may own runtime records. Repository documents should reference those systems and store project meaning rather than manually mirroring volatile values.

## Minimality rule

Documentation exists to reduce future reasoning, not to maximize document volume. Keep canonical rules concise, keep handoff current, and move historical detail to worklogs/archive.
