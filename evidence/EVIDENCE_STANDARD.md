# ATOS Evidence Standard

## Purpose

Evidence must be reusable only when its identity and dependencies are explicit. A changed repository HEAD does not automatically invalidate every gate, but evidence reuse must never rely on intuition alone.

## Mandatory provenance

Reusable validation evidence MUST record:

- project/repository identifier;
- base SHA when applicable;
- application/content SHA actually tested;
- harness/test SHA actually used;
- evidence-producing SHA;
- artifact hashes for material generated artifacts;
- environment/platform;
- browser/runtime/tool versions when relevant;
- contract, requirement, or test identifiers;
- generator/tool version;
- verification algorithm or protocol version;
- timestamp;
- result state;
- known limitations and unverified areas.

Evidence missing required provenance is informational only and MUST NOT be reused as an approval gate.

## Evidence identity

Two evidence records are equivalent only when all dependencies relevant to the claimed gate are equivalent.

Examples:
- a documentation-only commit MAY preserve runtime QA evidence when application bytes, harness bytes, runtime configuration, and asserted contract are unchanged;
- a harness assertion change invalidates evidence whose conclusion depends on that assertion even when application bytes are unchanged;
- a browser-version-sensitive UX result cannot be reused across materially different browser/runtime environments without an explicit compatibility rule.

## Gate invalidation

A gate MUST be invalidated when any material dependency of that gate changes.

A gate MUST NOT be invalidated solely because the repository HEAD changed.

The actor reusing evidence MUST record:
- evidence ID;
- gate being reused;
- dependencies checked;
- reason reuse remains valid;
- invalidation triggers that would make it stale.

## Exact-head policies

Projects MAY impose stricter exact-head QA rules. Local project policy overrides ATOS reuse permission.

ATOS does not silently weaken a project's normative QA policy. A project that wants dependency-aware reuse MUST explicitly adopt it and define which gate classes are eligible.

## Recommended gate result states

- PASS
- CONDITIONAL_PASS
- FAIL
- NOT_VERIFIED
- INVALIDATED

## Bounded claims

Evidence proves only what was actually observed. Do not convert one successful run into a permanent availability, compatibility, or correctness guarantee.