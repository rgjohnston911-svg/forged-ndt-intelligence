# DEPLOY224 — Type Safety Layer

Shared TypeScript interfaces for all safety-critical data structures. Signals to enterprise evaluators that the decision pipeline has formal type contracts.

## What it does

Adds two new type definition files that formalize every data structure flowing through the decision pipeline:

- `src/types/decision.ts` — Decision states, confidence components, conceptual reasoning, outcome simulation, code authority, audit events/bundles, inspector adjudication, execution modes
- `src/types/materials.ts` — Material families, damage mechanisms, asset types, inspection priorities, thickness summaries, code tiers

These types cover DEPLOY220 through DEPLOY226 data structures.

## Deploy order

### 1. Paste type files
- `src/types/decision.ts`
- `src/types/materials.ts`

No migration needed. No UI changes. No function changes required immediately.

### 2. Future: Remove @ts-nocheck from critical functions

As each function is next touched, remove `// @ts-nocheck` from the top and add proper imports:
```
import type { DecisionState, ConfidenceComponents, ConceptualReasoning } from "../src/types/decision";
```

Priority order for @ts-nocheck removal:
1. `decision-spine.ts` (state machine — highest impact)
2. `enterprise-audit.ts` (audit trail — legal implications)
3. `verify-audit-chain.ts` (verification — integrity)
4. `universal-code-authority.ts` (code resolution)
5. `outcome-simulation.ts` (physics projections)
6. `export-audit-bundle.ts` (bundle export)

This is incremental — the types exist now and can be adopted function by function without breaking anything.

## Architecture

- Types are purely declarative — no runtime code, no bundle size impact
- Both files are importable from components and functions
- The `var CODE_TIERS` export in materials.ts is the only runtime value (used by UI components)
- All types use union types and interfaces (no enums, no classes) for maximum compatibility
