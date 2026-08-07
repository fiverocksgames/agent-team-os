# ADR-0002 — Stable Roles, Replaceable Agents

## Status

Accepted foundation decision.

## Context

Existing projects repeatedly separate enduring responsibilities from the temporary model, vendor, IDE, session, or execution environment that performs them. Binding a role permanently to a product makes governance brittle and complicates cost, quality, availability, and migration decisions.

## Decision

A role defines responsibility and authority. Agent, model, vendor, IDE, session, and execution environment are assignment metadata and may change without redefining the role.

Assignments should therefore express both:

- stable responsibility: role, objective, scope, deliverables, constraints, completion criteria, authority;
- replaceable execution: agent/product, model, environment, branch/session identifiers.

## Consequences

- Codex, Antigravity, Claude, Gemini, GPT, humans, or future agents may fill the same role.
- Governance remains portable across projects and vendors.
- Handoffs can preserve the task contract while replacing the execution environment.
- Model/vendor-specific behaviors belong in reference integrations, not in normative role definitions.
