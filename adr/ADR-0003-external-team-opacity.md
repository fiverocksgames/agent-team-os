# ADR-0003 — External Team Opacity

## Status

Accepted foundation decision.

## Context

A parent orchestrator may coordinate multiple independent AI teams. Some teams expose their own internal TL, Developer, QA, Designer, or specialist hierarchy. Directly controlling those internal agents from the parent creates multiple competing orchestrators and couples the parent to vendor-specific internals.

## Decision

Treat an independent AI team as an opaque execution boundary.

The parent orchestrator communicates with the external team's designated lead through an explicit task/result contract. Internal delegation remains the external lead's responsibility unless the public team contract explicitly exposes deeper controls.

For example:

```text
ChatGPT Architect
      |
      | ATCP task contract
      v
Antigravity TL
   /   |   \
 Dev   QA  Designer
```

The parent does not directly assign the Antigravity Developer, QA, or Designer.

## Consequences

- Each team has one clear internal orchestrator.
- Vendor-specific sub-agent mechanics remain replaceable.
- Parent-level governance can coordinate Codex, Antigravity, humans, and future teams through the same boundary.
- Cross-team communication must preserve task identity, authority, status, evidence, and result semantics.
