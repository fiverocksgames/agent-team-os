# ATOS Project Adoption Pointer

This file is a reference snippet for adopting projects. It is not intended to replace a project's own `AGENTS.md`.

A project can add a short pointer such as:

```markdown
## Agent Team Operating System

This project follows the Agent Team Operating System (ATOS) reference standard maintained in `fiverocksgames/agent-team-os`.

New agents must:

1. read the applicable ATOS `bootstrap/BOOTSTRAP.md`;
2. read the assigned ATOS role contract;
3. read this repository's local governance and precedence rules;
4. read the current machine-readable handoff;
5. read only task-relevant architecture, requirements, and evidence.

Local project safety, legal, security, architecture, and acceptance rules remain authoritative for this repository.
```

## Version pinning

Projects SHOULD declare how they consume ATOS:

- `tracking`: follow the current approved ATOS major version;
- `pinned`: adopt a specific tag/commit and upgrade by explicit project decision.

Long-lived or regulated projects SHOULD prefer a pinned ATOS version for reproducibility.

Projects must not claim conformance to a version they have not reviewed/adopted.

## Local overrides

Local overrides should be minimal and explicit. An override should state:

- which ATOS rule is overridden;
- why the project needs the override;
- which local policy has higher authority;
- compatibility or migration implications.

Do not copy the full ATOS repository into every project merely to customize one rule.
