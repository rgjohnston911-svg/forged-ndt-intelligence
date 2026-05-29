# 4DNDT Architecture Documentation

## Authoritative documents (read these first)

| Document | Scope | Status |
|---|---|---|
| `FORGED_SA_BUILD_BRIEF.md` | Situational Awareness layer architecture and build sequence. Reconciled spec from GPT + Claude review. | **AUTHORITATIVE** for all SA work. Source of truth. |
| `DECISION_PACKAGE_CONTRACT.md` | DecisionPackage schema, hashing rules, replay verification. Frozen artifact at the boundary of the deterministic core. | **AUTHORITATIVE** for the DecisionPackage. |

## Historical / superseded

| Document | Status |
|---|---|
| `REALITY_VALIDATION_ENGINE_CONTRACT.md` | **SUPERSEDED** by `FORGED_SA_BUILD_BRIEF.md`. Kept for traceability of the architectural reasoning. Three corrections were made by the reconciled brief: (1) DecisionPackage stays byte-for-byte immutable — SA output lives in a separate `SituationalAwarenessPackage` referenced by hash, not as a field on the DecisionPackage; (2) no new HOLD rule in the disposition gate — fresh deterministic run produces a new package, existing gate already HOLDs on unresolved CRITICAL; (3) answer = new evidence → fresh run, not mutation. |
| `SYSTEM_FRAMEWORK_BREAKDOWN.md` | **HISTORICAL.** Used as input to the GPT + Claude reconciliation that produced `FORGED_SA_BUILD_BRIEF.md`. Useful reference for the layer numbering scheme (L0–L11) and patent claim summary, but where this document and the build brief disagree, the build brief wins. |

## Reading order for a new contributor

1. `DECISION_PACKAGE_CONTRACT.md` — understand what's frozen.
2. `FORGED_SA_BUILD_BRIEF.md` — understand what's being added and how.
3. The historical docs — only if you need the reasoning trail behind a design decision.
