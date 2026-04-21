# DEPLOY253: Concept Intelligence v2.1 — Validation + Dominance Pack

## What It Adds On Top of v2.0

| Sub-Engine | Purpose |
|-----------|---------|
| Dominance Resolution | 1 governing + 3 supporting, rest suppressed — kills noise |
| Authority Enforcement | Deterministic HOLD/PROVISIONAL/ESCALATE/STABLE — the system has teeth |
| Concept Validation | Inspectors confirm or reject activations — builds reliability data |
| Reliability Scoring | Per-concept reliability from validation history |
| Case Replay | Re-run old cases through current logic, compare to actual outcome |
| Drift Monitoring | Track concept accuracy over time by vertical/method |

## Deployment Steps

### Step 1: Run SQL Migration
Go to Supabase SQL Editor and run:
`supabase/migrations/DEPLOY253_concept_intelligence_v21.sql`

Creates 7 tables + seeds 12 calibration profiles.
**Must run AFTER DEPLOY252 migration** (depends on concept_runs table).

### Step 2: Deploy the engine file
GitHub > `netlify/functions/` > create:
- **concept-intelligence-v21.ts**

### Step 3: Update health.ts
Replace with updated version (46 engines).

### Step 4: Update system-check.html
Replace with updated version (46 test lines).

### Step 5: Verify
Expected: **46 PASS**

## How It Works

### The Flow
1. DEPLOY252 runs `analyze_case` → produces v2.0 Concept Intelligence Pack (all 12 engines fire)
2. DEPLOY253 runs `full_v21_analysis` on that output → applies dominance + authority
3. Result: 1 governing concept, up to 3 supporting, rest suppressed, with a deterministic authority state

### Authority States
- **HOLD** — Physics insufficient, critical contradiction, confidence collapsed, or critical blind spot. Final disposition BLOCKED.
- **ESCALATE** — Engineering review required, historical miss pattern, or critical propagation with scope expansion needed.
- **PROVISIONAL** — Unstable boundary, moderate contradiction, or missing context. Decision is not yet defensible.
- **STABLE** — All clear. No blocking conditions. Final disposition allowed.

### Dominance Formula
```
Score = activation(0.35) + family_weight(0.15) + consequence(0.15) 
      + reliability(0.15) + boundary(0.10) + support(0.10) 
      - contradiction(0.10) - noise(0.10)
```

### Hard Rules (override formula)
- physics_sufficiency always governs if active (unless critical contradiction)
- decision_boundary always visible if unstable
- blind_spot_detection always visible in high-consequence
- contradiction_detection always visible if severity high+
- Max 1 governing + 3 supporting = 4 visible concepts max

## System Totals After Deploy
- **46 engines**
- **18 concept sub-engines** (12 in v2.0 + 6 in v2.1)
- **14 database tables** for concept intelligence (7 from v2.0 + 7 from v2.1)
- **12 calibration profiles** seeded
