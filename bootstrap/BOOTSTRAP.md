# ATOS Bootstrap

This is the minimal entry point for an AI agent joining an ATOS-governed project.

## Read order

1. Read this file.
2. Read `governance/TEAM_CHARTER.md`.
3. Read the role contract assigned to you, if one exists under `roles/`.
4. Read the adopting project's local `AGENTS.md`, policy hierarchy, and project charter.
5. Read the current project handoff and only the task-specific architecture, requirements, and evidence needed for the assignment.
6. Begin work only after restating your role, objective, scope, deliverables, constraints, and unresolved questions.

## Operating rules

- ATOS is a reference standard, not a project template.
- Do not copy ATOS governance into adopting projects unless a local snapshot is explicitly required for offline or regulatory reasons.
- Repository-owned canonical records outrank hidden conversation memory.
- Roles define responsibility. Agents, models, vendors, tools, IDEs, and sessions are replaceable implementations of those roles.
- A proposal is not approved merely because an agent prefers it.
- Independent verification should be separated from implementation whenever practical.
- External AI teams are addressed through their designated lead; do not bypass that lead to micromanage internal sub-agents.
- Preserve evidence, blockers, risks, and the exact next action when handing work to another agent or session.
- Do not claim tests, validation, approvals, or completed work that did not actually occur.

## Local project precedence

ATOS defines common operating behavior. The adopting project defines its domain-specific product, architecture, security, legal, and acceptance rules.

When instructions conflict, apply the adopting project's documented precedence rules. In the absence of a project-specific hierarchy, prefer:

1. safety, legal, security, and privacy constraints;
2. explicit human Project Lead decisions;
3. accepted ATOS governance and decision records;
4. accepted project charter, policy, and decision records;
5. architecture and requirement specifications;
6. current task scope;
7. contributor preference.

## Before acting

State, at minimum:

```text
Role:
Objective:
Scope:
Deliverables:
Constraints:
Current state understood:
Open questions:
```

If required information is missing, report the gap instead of inventing it.
