# Agent Team Operating System (ATOS)

ATOS is a vendor-neutral reference standard for long-running AI engineering teams.

It defines how AI teams are governed, how responsibilities are separated from tools and models, how work is handed off across agents and sessions, and how independent AI teams communicate through explicit contracts.

ATOS is not a project template. Projects reference ATOS for common operating rules and keep project-specific architecture, product policy, safety constraints, and implementation details in their own repositories.

## Core principles

1. The repository, not conversation history, owns durable project knowledge.
2. Roles are stable; agents, models, vendors, IDEs, sessions, and execution environments are replaceable.
3. A human Project Lead retains final authority unless explicitly delegated.
4. Implementation and independent verification should be separated whenever practical.
5. Important work must leave enough structured state for another agent to continue immediately.
6. Canonical policy, operational handoff, raw work records, and historical archive are different document classes and must not silently replace one another.
7. AI teams communicate through explicit contracts rather than implicit session memory.
8. External teams are opaque internally: a parent orchestrator assigns work to the team's lead, not directly to that team's internal sub-agents.
9. Shared operating standards are referenced, not copied into every adopting project.
10. Project-local rules may extend ATOS but should not silently weaken higher-priority safety, authority, or evidence requirements.

## Repository model

```text
agent-team-os/
├── bootstrap/
├── governance/
├── roles/
├── handoff/
├── evidence/
├── atcp/
├── adr/
└── reference/
```

### bootstrap/
Minimal onboarding path that tells a new agent what to read and in what order.

### governance/
Durable, vendor-neutral team principles, authority boundaries, approval rules, and policy precedence.

### roles/
Reusable role contracts such as Architect, Developer, QA, Designer, Reviewer, and Archivist. Roles describe responsibility; they do not bind a role to a specific vendor or model.

### handoff/
Machine-readable continuity and project-state transfer rules.

### evidence/
Rules for validation identity, provenance, reuse, invalidation, and confidence claims.

### atcp/
Agent Team Communication Protocol: structured messages exchanged between independent AI teams or orchestration layers.

### adr/
Architecture Decision Records explaining why ATOS is designed this way.

### reference/
Non-normative integration examples for ChatGPT, Codex, Antigravity, Claude Code, and future systems.

## Adoption model

A project adopting ATOS should keep its own domain-specific governance in the project repository and reference ATOS for common agent-team behavior.

A new project should normally contain only a lightweight bootstrap pointer such as:

```text
This project follows ATOS.
Read the ATOS bootstrap first, then this repository's local AGENTS.md and project documentation.
```

A new agent should conceptually read:

1. the project's bootstrap pointer to ATOS;
2. the applicable ATOS bootstrap and governance documents;
3. its assigned role contract;
4. the project's local `AGENTS.md` / policy hierarchy;
5. current machine-readable handoff;
6. task-specific architecture, requirements, and evidence.

Do not preload unrelated role or domain documents.

## ATCP

ATCP stands for **Agent Team Communication Protocol**. It is a component of ATOS, not the whole system.

ATCP defines structured communication between independent AI teams or orchestration layers, for example:

```text
ChatGPT Lead Architect
        │
        │ ATCP
        ▼
Antigravity Technical Lead
        ├── Developer
        ├── QA
        └── Designer
```

The external orchestrator communicates with the team's lead. Internal sub-agent orchestration remains the responsibility of that team.

## Project templates

Project templates are intentionally maintained separately from ATOS.

A template may provide repository scaffolding, GitHub Actions, issue templates, PR templates, language/framework setup, and a local `AGENTS.md`. It should reference ATOS rather than copying ATOS governance documents into each generated project.

This separation allows ATOS to evolve independently while project templates remain technology-specific.

## Design provenance

This foundation generalizes operating patterns already used in `math-defender-source`, `math-defender-archive`, and `investment-manager`, including repository-owned memory, stable roles with replaceable agents, independent QA, structured handoff, source-of-truth boundaries, communication metadata, worklog/canonical-document separation, and explicit human approval authority.
