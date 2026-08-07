# Agent Team Protocol

Agent Team Protocol is a vendor-neutral governance and communication standard for long-running AI engineering teams.

Its purpose is to make autonomous multi-agent work portable across projects and tools without depending on hidden conversation history or a specific model vendor.

## Core principles

1. The repository, not conversation history, owns durable project knowledge.
2. Roles are stable; agents, models, vendors, IDEs, sessions, and execution environments are replaceable.
3. A human Project Lead retains final authority unless explicitly delegated.
4. Implementation and independent verification should be separated whenever practical.
5. Important work must leave enough structured state for another agent to continue immediately.
6. Canonical policy, operational handoff, raw work records, and historical archive are different document classes and must not silently replace one another.
7. AI teams communicate through explicit contracts rather than implicit session memory.
8. External teams are opaque internally: a parent orchestrator assigns work to the team's lead, not directly to that team's internal sub-agents.

## Repository model

```text
agent-team-protocol/
├── governance/
├── handoff/
├── atcp/
├── adr/
└── reference/
```

### governance/
Durable, vendor-neutral team principles and authority boundaries.

### handoff/
Machine-readable continuity and project-state transfer rules.

### atcp/
Agent Team Communication Protocol: structured messages exchanged between independent AI teams or orchestration layers.

### adr/
Architecture Decision Records explaining why the protocol is designed this way.

### reference/
Non-normative integration examples for ChatGPT, Codex, Antigravity, Claude, and future systems.

## Adoption model

A project adopting this standard should keep its own domain-specific governance in the project repository. The project references this repository for common agent-team behavior and defines only its local overrides, architecture, safety constraints, and acceptance rules.

A new agent should conceptually read:

1. the project's bootstrap pointer to this standard;
2. applicable Agent Team Protocol governance;
3. its assigned role contract;
4. the project's local `AGENTS.md` / policy hierarchy;
5. current machine-readable handoff;
6. task-specific architecture, requirements, and evidence.

Do not preload unrelated role or domain documents.

## Design provenance

This foundation generalizes operating patterns already used in `math-defender-source`, `math-defender-archive`, and `investment-manager`, including repository-owned memory, stable roles with replaceable agents, independent QA, structured handoff, source-of-truth boundaries, communication metadata, worklog/canonical-document separation, and explicit human approval authority.
