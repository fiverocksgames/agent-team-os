# ADR-0001 — Repository-Owned Memory

## Status

Accepted foundation decision.

## Context

Long-running AI work suffers when important state exists only in conversation history, a single vendor session, or one agent's hidden context. Existing project practice shows better continuity when canonical rules, operational handoff, work facts, and decisions are stored in repositories and remain inspectable by replacement agents.

## Decision

Durable team knowledge belongs in repositories or other explicitly authoritative project systems, not in conversational memory.

Conversation context may accelerate work, but it is never the sole authority for significant decisions, active-work continuity, validation claims, or project policy.

Document classes must remain distinct:

- canonical policy: approved durable rules;
- operational handoff: current actionable state;
- worklog/journal: chronological facts and evidence links;
- ADR/decision: rationale for material choices;
- archive/history: preserved interpretation of completed records, not current authority.

## Consequences

- Agents and vendors can be replaced without losing the project's operating memory.
- New sessions require less reconstruction from chat.
- Important state becomes reviewable and versioned.
- Projects must maintain concise handoff and canonical documents rather than accumulating unstructured prose.
