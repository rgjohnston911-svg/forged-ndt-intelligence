# DEPLOY266-270: Five New Engines (58 → 63)

**Date:** 2026-04-21
**Engines:** 59-63
**Platform Version:** FORGED-NDT/2.0.0

---

## Overview

| Deploy | Engine # | Name | Purpose |
|--------|----------|------|---------|
| DEPLOY266 | 59 | Inspection Planning Proof | Proof gaps → NDT method selection → workpacks |
| DEPLOY267 | 60 | Corrosion Loop Engine | Mechanism → rate → remaining life → interval |
| DEPLOY268 | 61 | Fatigue & Vibration Proof | S-N curves, VIV screening, vibration severity |
| DEPLOY269 | 62 | Multi-Asset Cascade | Failure propagation modeling across asset graphs |
| DEPLOY270 | 63 | Live Code Authority | Hardcoded current standards editions, fuzzy resolver |

---

## Step 1: Run SQL Migrations in Supabase

Go to **Supabase Dashboard → SQL Editor** and run each migration file in order:

1. `supabase/migrations/DEPLOY266_inspection_planning_proof.sql`
2. `supabase/migrations/DEPLOY267_corrosion_loop.sql`
3. `supabase/migrations/DEPLOY268_fatigue_vibration_proof.sql`
4. `supabase/migrations/DEPLOY269_multi_asset_cascade.sql`
5. `supabase/migrations/DEPLOY270_live_code_authority.sql`

Each creates its own tables and indexes. No dependencies between them — order doesn't matter but sequential is cleaner.

### Tables Created

**DEPLOY266:** `inspection_plans`, `workpack_items`
**DEPLOY267:** `corrosion_loops`, `corrosion_rate_history`
**DEPLOY268:** `fatigue_assessments`, `vibration_assessments`
**DEPLOY269:** `asset_graphs`, `cascade_scenarios`, `asset_interactions`
**DEPLOY270:** `code_authority_registry`, `code_authority_lookups`

---

## Step 2: Push to GitHub & Deploy

```bash
cd "NDT Platform"
git add .
git commit -m "DEPLOY266-270: Add 5 new engines (58 → 63)"
git push origin main
```

Netlify auto-deploys on push. Wait for the deploy to complete.

### New Function Files

- `netlify/functions/inspection-planning-proof.ts` (DEPLOY266)
- `netlify/functions/corrosion-loop-engine.ts` (DEPLOY267)
- `netlify/functions/fatigue-vibration-proof.ts` (DEPLOY268)
- `netlify/functions/multi-asset-cascade.ts` (DEPLOY269)
- `netlify/functions/live-code-authority.ts` (DEPLOY270)

### Updated Files

- `netlify/functions/health.ts` — ENGINE_REGISTRY now has 63 entries, CRITICAL_TABLES has 12 new tables
- `public/system-check.html` — Now tests all 63 endpoints

---

## Step 3: Verify

1. Go to `https://4dndt.netlify.app/system-check.html`
2. Click **Run Full System Check**
3. Confirm 63 endpoints respond (all PASS or expected WARN for empty tables)

### Quick Smoke Tests

Each engine responds to `{ "action": "get_registry" }`:

```
POST /api/inspection-planning-proof   → { "action": "get_registry" }
POST /api/corrosion-loop-engine       → { "action": "get_registry" }
POST /api/fatigue-vibration-proof     → { "action": "get_registry" }
POST /api/multi-asset-cascade         → { "action": "get_registry" }
POST /api/live-code-authority         → { "action": "get_registry" }
```

---

## Engine Details

### DEPLOY266: Inspection Planning Proof Engine (Engine 59)

**Closes the loop from Superbrain v5 proof gaps to executable inspection workpacks.**

- 13 NDT methods in METHOD_MATRIX (UT, PAUT, TOFD, MPI, PT, RT, EC, AE, GWT, CP_SURVEY, ROV_VISUAL, DRONE_VISUAL, DIGITAL_RADIOGRAPHY)
- Each method has: damage_modes it detects, cannot_detect list, proof_value rating, code_basis
- Priority scoring: consequence + proof_gap + governance_weight + human_exposure + urgency
- Workpack generator takes Superbrain v5 output and builds actionable inspection plans
- **Actions:** get_registry, generate_plan, get_method_matrix, get_access_methods, prioritize_workpack, estimate_plan, get_plan, get_plan_history

### DEPLOY267: Corrosion Loop Engine (Engine 60)

**Full corrosion management loop: mechanism → rate → remaining life → interval.**

- 12 corrosion mechanisms from API 571 (general, CUI, CUF, CO2, H2S, erosion-corrosion, MIC, pitting, galvanic, FAC, atmospheric, splash_zone)
- Rate methods ranked by defensibility: DIRECT_TRENDING > SINGLE_POINT_AVERAGE > MECHANISM_LIBRARY_ESTIMATE > CALCULATION_NOT_DEFENSIBLE
- Remaining life per API 579-1 Part 4, Barlow formula for tmin
- Interval: half remaining life or code max, with risk adjustment
- `run_full_loop` chains all four steps automatically
- **Actions:** get_registry, identify_mechanism, calculate_rate, calculate_remaining_life, calculate_interval, run_full_loop, get_loop, get_loop_history, get_rate_history, get_mechanism_library

### DEPLOY268: Fatigue & Vibration Proof Engine (Engine 61)

**S-N curve fatigue, VIV screening, and vibration severity assessment.**

- 17 S-N curves from DNV-RP-C203 (in_air, seawater_with_CP, seawater_free_corrosion)
- 12 joint classifications (B1 through W1 plus T for tubulars)
- Fatigue: S-N lookup, SCF, thickness correction, environment factor, Miner's sum
- VIV: DNV-RP-F105 reduced velocity screening, natural frequency, allowable span
- Vibration: ISO 10816-1 severity zones (GOOD/SATISFACTORY/UNSATISFACTORY/UNACCEPTABLE)
- **Actions:** get_registry, assess_fatigue, assess_viv, assess_vibration, calculate_miner_sum, get_sn_curves, get_assessment, get_assessment_history, get_vibration_history, get_joint_classifications

### DEPLOY269: Multi-Asset Cascade Engine (Engine 62)

**Graph-based failure propagation modeling across connected assets.**

- 11 interaction types (structural_load, vibration_transmission, pressure_coupling, flow_dependency, thermal_coupling, electrical_power, control_signal, corrosion_path, blast_exposure, dropped_object, common_cause)
- 10 barrier types with typical reliability (ESD_valve 0.95, PSV 0.97, fire_detection 0.90, etc.)
- DFS-based cascade path finder with configurable max depth
- SPOF detection, common cause group analysis
- **Actions:** get_registry, create_graph, add_interaction, run_cascade, find_spof, find_common_cause, get_graph, get_scenario

### DEPLOY270: Live Code Authority Engine (Engine 63)

**Hardcoded current standards editions with fuzzy resolver.**

- 30+ standards with current editions: API 510 (11th Ed 2022), API 570 (4th Ed 2016+2021 addendum), API 579-1 (4th Ed 2024), API RP 2A-WSD (23rd Ed 2021), DNV-RP-C203 (2021), DNV-RP-F101 (2019), DNV-RP-F105 (2021), NACE/AMPP rebranding noted, etc.
- Fuzzy resolver for vague references (e.g., "API RP 2A" → exact edition)
- Edition currency checker and supersession chain
- Applicable codes by domain/material/damage mode
- Batch validate_references action
- **Actions:** get_registry, resolve_code, check_currency, get_applicable_codes, validate_references, get_supersession_chain, get_lookup_history, get_full_library
