# DEPLOY265: Tri-Model Adversarial Reasoning Engine v5.0.0 — Proof Engine Architecture

## What This Does
Adds a Tri-Model Adversarial Reasoning Engine with **Superbrain v5 Proof Engine Architecture** — three AI models that THINK from physics first principles, ARGUE adversarially, PROVE every conclusion with traceable evidence chains, and produce regulator-defensible engineering decisions.

**v5 transforms the system from "expert-level inferred truth" to "component-level provable truth."**

No conclusion without proof lineage. No threshold without derivation basis. No repair credit without evidence. No final decision if the proof chain is broken.

**Pipeline:**
INPUT → Model A (GPT-4o: Physics + Proof Chains) → Model B (Claude: Engineering + Standards Authority + Assumptions) → Model C (GPT-4o: Adversarial + Proof Break Detection) → Resolution (Claude: Decision Proof + Regulatory Defensibility + Governance Lock v3) → OUTPUT

## What Changed (v3.0.0 → v5.0.0)

### Before (Superbrain v4 — Absolute Dominance)
- Expert-level reasoning with adversarial challenge
- 7 gap-closure engines (threshold, method truth, unknown-as-constraint, repair credibility, temporal, constraint dominance, live standards)
- Governance Lock v2

### After (Superbrain v5 — Proof Engine)
- **13 PROOF MODULES** added across all 4 model prompts
- Every conclusion must survive a formal proof chain
- Component-level granularity (not system-level claims)
- Traceable calculations with input quality tracking
- Standards traced to authority/body/edition/status
- Assumption dependency mapping
- Disproof paths for every major claim
- Computed confidence (weighted, not intuitive)
- Proof break detection (narrative looks strong but proof is broken)
- Regulatory defensibility testing
- Decision proof (status is a proof result, not a judgment)
- Governance Lock v3 (12 conditions, all must pass for FINAL)

## 13 Proof Modules

| # | Module | Assigned To | Purpose |
|---|--------|-------------|---------|
| 1 | CLAIM_GRAPH_ENGINE_V1 | Model A | Structured claim graph, not narrative |
| 2 | COMPONENT_LEVEL_PROOF_CHAIN_ENGINE_V1 | Model A | Force conclusions to component level |
| 3 | CASE_DERIVED_CALCULATION_ENGINE_V1 | Model A | Traceable calculations with input quality |
| 4 | METHOD_OBSERVABILITY_PROOF_ENGINE_V1 | Model A | Prove method can observe the damage mode |
| 5 | STANDARDS_SOURCE_AUTHORITY_ENGINE_V1 | Model B | Trace to authority/body/edition/status |
| 6 | ASSUMPTION_DEPENDENCY_ENGINE_V1 | Model B | Map conclusions to carrying assumptions |
| 7 | DISPROOF_PATH_ENGINE_V1 | Model C | Explicit falsification paths |
| 8 | CONFIDENCE_COMPUTATION_ENGINE_V1 | Model C | Weighted, traceable confidence |
| 9 | PROOF_BREAK_DETECTION_ENGINE_V1 | Model C | Find where narrative is strong but proof is broken |
| 10 | REGULATORY_DEFENSIBILITY_ENGINE_V1 | Resolution | Survive regulator/litigation/peer review |
| 11 | GLOBAL_REPAIR_CREDIBILITY_ENGINE_V2 | Model B | Proof-level repair validation |
| 12 | DECISION_PROOF_ENGINE_V1 | Resolution | Final status is a proof result |
| 13 | SUPERBRAIN_GOVERNANCE_LOCK_V3 | Resolution | 12 conditions must pass for FINAL |

## Architecture

### The Three Models + Resolution
1. **Model A — Physics + Proof Chain Engine (GPT-4o)**: Reality topology v3, claim graph construction, component-level proof chains, case-derived calculations with input quality, method observability proofs, inverse reasoning, inference from absence, sensory fusion, evidence quality weighting.
2. **Model B — Engineering + Standards + Assumption Engine (Claude)**: Standards source authority, assumption dependency mapping, repair proof validation, unknown-as-constraint, failure boundaries, hard decision boundaries, burden of proof inversion, constraint dominance, casualty topology, temporal simulation, cascading asset graph, live standards check.
3. **Model C — Adversarial + Proof Attack Engine (GPT-4o)**: Proof break detection (10 types), disproof path generation, confidence computation (8 weighted factors), assumption exposure, disconfirming evidence, multi-hypothesis persistence, contradiction matrix, phantom scenario injection, evidence decay, consensus fragility.
4. **Resolution — Decision Proof + Governance (Claude)**: Decision proof engine, regulatory defensibility testing (6 dimensions), Governance Lock v3 (12 conditions), absolute decision dominance, constraint hierarchy, temporal parallel reality synthesis, traceability, uncertainty discipline.

### Governance Lock v3 — 12 Conditions for FINAL
1. Claim graph intact
2. Component-level proof sufficient in critical zones
3. Calculations defensible
4. Standards source authority verified
5. Method observability sufficient
6. Critical assumptions confirmed or bounded
7. Disproof paths weaker than proof paths
8. No critical proof breaks
9. Regulatory defensibility passes
10. Contradiction matrix below blocking threshold
11. Consensus fragility not EXTREMELY_FRAGILE
12. Repair credit validated where structural/pressure credit taken

## Tables Created (unchanged from v3)
1. **reasoning_sessions** — full pipeline audit trail
2. **learning_records** — corrections, confirmations, patterns
3. **hypothesis_tracking** — competing hypotheses lifecycle
4. **calibration_scores** — confidence calibration metrics
5. **adversarial_challenges** — reasoning failures library

## Environment Variables Required
- `OPENAI_API_KEY` — for Model A (physics) and Model C (adversarial)
- `ANTHROPIC_API_KEY` — for Model B (engineering) and Resolution
- `SUPABASE_URL` — existing
- `SUPABASE_SERVICE_ROLE_KEY` — existing

## Deploy Steps

### Step 1: SQL Migration (ALREADY DONE — skip if tables exist)
Run in Supabase SQL Editor:
- File: `supabase/migrations/DEPLOY265_tri_model_reasoning.sql`
- Creates 5 tables with RLS policies
- If already deployed from v3, NO SQL CHANGES NEEDED

### Step 2: Tri-Model Reasoning Engine (UPDATED)
Paste updated file to GitHub:
- File: `netlify/functions/tri-model-reasoning.ts`
- Now v5.0.0 (1,287 lines) — up from v3.0.0 (1,020 lines)
- 13 proof modules encoded in system prompts
- max_tokens increased to 8000 per model (proof chains are larger)

### Step 3: Decision Spine (NO CHANGE)
- File: `netlify/functions/decision-spine.ts`
- Already lightweight and non-blocking from v3 deployment

### Step 4: Health Registry (NO CHANGE)
- File: `netlify/functions/health.ts`
- Already shows 58 engines

### Step 5: System Check (NO CHANGE)
- File: `public/system-check.html`
- Already tests 58 endpoints

## Test After Deploy
1. Visit: https://4dndt.netlify.app/system-check.html — Expected: **58 PASS** (Ctrl+Shift+R)
2. **Registry test**: POST `/api/tri-model-reasoning` with `{ "action": "get_registry" }` — verify version shows `tri-model-reasoning/5.0.0` and architecture shows `superbrain-v5-proof-engine`
3. **Proof chain test**: POST a case and verify the output includes `claim_graph_integrity`, `component_proof_summary`, `derived_calculations_verified`, `decision_proof`, and `regulatory_defensibility` fields
4. **Governance Lock v3 test**: Verify that high-uncertainty cases produce `governance_lock.final_allowed: false` with specific `blocked_by` reasons

## API Usage

### With Case ID (fetches from DB)
```
POST /api/tri-model-reasoning
{ "case_id": "uuid-here" }
```

### Direct Input (no case needed)
```
POST /api/tri-model-reasoning
{
  "action": "reason",
  "input": {
    "component": "24-inch carbon steel pipe",
    "material": "carbon_steel",
    "findings": "40% wall loss at 6 o'clock, external pitting",
    "conditions": "Buried, cathodic protection, 15 years service",
    "question": "What is the remaining life and recommended action?"
  }
}
```

### System Check Compatibility
```
POST /api/tri-model-reasoning
{ "action": "get_registry" }
```

## Core Principle
The smartest platform in the world is not the one that sounds the most advanced. It is the one that can survive: physics, field conditions, missing data, regulator review, expert challenge, incident investigation, and litigation scrutiny.

Superbrain v5 exists so every major conclusion is no longer merely intelligent. It is **provable**.
