# ADR-0004 — ATOS Is a Reference Standard, Not a Project Template

## Status

Accepted foundation decision.

## Context

ATOS defines shared governance, role boundaries, handoff rules, evidence principles, and communication contracts for AI engineering teams. These standards need to evolve independently from any specific framework, language, CI stack, or project structure.

Using the ATOS repository itself as a GitHub template would copy governance documents into every generated project. Those copies would immediately become independent and could drift from the canonical standard as ATOS evolves.

Project scaffolding has different change drivers from team-governance standards. Unity, React, Python, libraries, services, and other project types may require different templates while still following the same ATOS operating model.

## Decision

ATOS is maintained as a canonical reference repository.

Adopting projects reference ATOS and retain only project-local policy, architecture, safety constraints, handoff state, and implementation details.

Reusable development templates are maintained separately from ATOS. Templates may contain lightweight pointers to ATOS but must not duplicate ATOS normative governance by default.

## Consequences

- ATOS can evolve without requiring synchronized copies across every project.
- Technology-specific templates can evolve independently.
- Projects maintain a clear distinction between common operating standards and local domain rules.
- Offline, regulatory, or immutable-build environments may intentionally vendor a versioned ATOS snapshot, but that is an explicit exception and must record the referenced ATOS version or commit.
