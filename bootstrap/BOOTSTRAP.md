# ATOS Bootstrap Router

This is the minimal entry point for an AI agent joining an ATOS-governed project. It routes an agent to the smallest role- and task-relevant read set; it is not an instruction to read the entire repository.

## Choose a role path

1. Read this router after the repository [README](../README.md).
2. Identify the assigned durable role. Tool, model, vendor, and session are implementation details, not the role.
3. Follow exactly one applicable role entry:
   - [Architect bootstrap](ARCHITECT.md): planning, authority preservation, task-contract preparation, and the first Codex handoff.
   - [Codex orchestrator bootstrap](CODEX_ORCHESTRATOR.md): transport/orchestration after an Architect handoff, including the bounded `ATOS -> agy` route.
   - For another role, read the relevant section of [role contracts](../roles/ROLE_CONTRACTS.md), then the adopting project's task-specific sources.
4. Read the adopting project's local `AGENTS.md`, policy hierarchy, project charter, current handoff, and task-specific source of truth only when the chosen path directs it.
5. Before acting, restate role, objective, scope, deliverables, constraints, current state, and open questions. Report a material gap instead of inventing it.

## Selective read graph

```text
README -> this router -> role entry
                       -> canonical ATOS documents required for the task
                       -> adopting product repository policy/handoff/task source of truth
```

The product repository owns product architecture, build/test commands, security constraints, and task-specific evidence. ATOS supplies reusable operating knowledge; adoption does not require copying ATOS governance into every product repository.

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
