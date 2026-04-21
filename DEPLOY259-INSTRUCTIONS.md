# DEPLOY259: Physics Sufficiency Engine v1.0.0

## What This Does
"Can this method physically detect this mechanism?" — the question every Level III should ask but the system now answers deterministically. Maps 15 NDT methods to 19 damage mechanisms with 70+ method-mechanism mappings. Scores inspection sufficiency, identifies physics gaps, and recommends method strategies.

This is the engine GPT called "non-negotiable" — it makes the system smarter than Level III inspectors for method selection.

## 10 Capabilities
1. Check Sufficiency — given a mechanism + methods applied, score physics coverage
2. Recommend Methods — given a mechanism, return ranked method strategy (primary/complementary/screening)
3. Get Method Capability — what can this method detect? (all mechanisms)
4. Get Mechanism Methods — what methods detect this mechanism? (ranked)
5. Assess Case — full multi-mechanism sufficiency assessment for a case
6. Get Physics Gaps — retrieve all gaps and ADD items for a case
7. Get Method Registry — all 15 NDT methods with physics principles
8. Get Mechanism Registry — all 19 damage mechanisms with characteristics
9. Get Technique Requirements — detailed technique parameters per method+mechanism
10. Full Audit Trail

## NDT Methods Seeded (15)
UT Conventional, PAUT, TOFD, RT Film, Digital Radiography, MT, PT, VT, Eddy Current, Acoustic Emission, MFL, PMI, IR Thermography, Guided Wave UT, Hardness Testing

## Damage Mechanisms Seeded (19)
General Corrosion, Pitting, CUI, Erosion, Fatigue Cracking, SCC, Hydrogen Damage (HIC/SOHIC), HTHA, Creep, Caustic Cracking, MIC, Temper Embrittlement, Sigma Phase, Lack of Fusion, Incomplete Penetration, Porosity, Slag Inclusions, Lamination, Coating Failure

## Deploy Steps

### Step 1: SQL Migration
Run in Supabase SQL Editor:
- File: `supabase/migrations/DEPLOY259_physics_sufficiency_engine.sql`
- Creates 6 tables: physics_method_registry, physics_damage_mechanisms, physics_method_mechanism_map, physics_sufficiency_assessments, physics_technique_requirements, physics_audit_events
- Seeds 15 methods, 19 mechanisms, 70+ method-mechanism mappings
- Reference tables have read-only policies (no org_id); assessment tables have org isolation

### Step 2: Netlify Function
Paste into GitHub:
- File: `netlify/functions/physics-sufficiency-engine.ts`
- 10 actions (see above)

### Step 3: Health Registry
Paste updated file:
- File: `netlify/functions/health.ts`
- Now has 52 engines

### Step 4: System Check
Paste updated file:
- File: `public/system-check.html`
- Now tests 52 endpoints

## Test After Deploy
Visit: https://4dndt.netlify.app/system-check.html
Expected: 52 PASS (Ctrl+Shift+R to hard refresh)

## How It Works

### Sufficiency Scoring Algorithm
- Base score = max single-method confidence × 100
- +10 bonus if primary method for this mechanism is used
- +5 bonus if a standalone-sufficient method is used
- +5 per additional complementary method (max +15)
- Capped at 100

### Sufficiency Ratings
- 90–100: Fully Sufficient
- 70–89: Adequate
- 50–69: Marginal
- 30–49: Insufficient
- 0–29: Critically Insufficient

### Case Assessment
When assessing a full case, each mechanism is scored individually and weighted by severity_if_missed (critical=1.5x, high=1.2x, medium=1.0x, low=0.8x). The overall score drives the verdict from SUFFICIENT through CRITICALLY INSUFFICIENT.

### Key Physics Rules Encoded
- HTHA: Conventional UT is INSUFFICIENT — requires PAUT with velocity ratio/backscatter (API 941 / API RP 942)
- Lack of Fusion: RT has limited capability for planar flaws — PAUT or TOFD required
- CUI: IR Thermography and GWUT are screening only — UT after insulation removal is the primary
- Hydrogen Damage: Conventional UT is moderate at best — PAUT/TOFD with C-scan required
- Fatigue: Surface methods (MT/PT) catch surface-breaking only — need PAUT/TOFD for subsurface
- Porosity: RT is primary and excellent — UT is secondary for volumetric defects

### Code References Embedded
API 570, API 510, API 571, API 579, API 581, API 583, API 941, API RP 942, API 934, API 945, API 1104, API 14E, ASME V, ASME VIII, ASME IX, ASME I, AWS D1.1, NACE MR0175, NACE SP0198, NACE SP0403, NACE SP0116, ASTM A578, SSPC-PA 2, BS 7910, ISO 12944
