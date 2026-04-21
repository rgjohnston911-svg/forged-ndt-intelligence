# DEPLOY244-245: Robotics/Automation + Human Intelligence Layer

## Files to Deploy

### New Functions (paste into `netlify/functions/`)
1. **robotics-automation.ts** (DEPLOY244) — 8 platform types, 5 scan plan templates, 10 ADR defect classes, 4-tier ADR confidence framework
2. **human-intelligence.ts** (DEPLOY245) — 10 certification schemes, 14 NDT methods, 7 performance factors, 5-grade competency scale

### Updated Files (replace existing)
3. **health.ts** — ENGINE_REGISTRY now 38 total
4. **public/system-check.html** — 38 test lines

## Deploy Order
1. Add both new function files to `netlify/functions/`
2. Replace `health.ts` and `system-check.html`
3. Push — should show **38 PASS**

## Smoke Tests

```
POST /api/robotics-automation
{ "action": "get_registry" }
→ 8 platforms, 5 scan plans, 10 defect classes

POST /api/human-intelligence
{ "action": "get_registry" }
→ 10 cert schemes, 14 NDT methods, 7 performance factors
```

## DEPLOY244 — Robotics/Automation Engine

**Platform Types (8):**
- Aerial: Visual drone, Thermal drone, Contact UT drone
- Crawler: Magnetic wall crawler, Internal pipe crawler
- Subsea: ROV, AUV
- Fixed: Automated UT/PA scanner

**Scan Plan Templates (5):** Tank shell survey, pipe weld scan, aerial visual, subsea GVI, internal pipe survey

**ADR Framework:** 10 defect classes, 4-tier confidence (high/medium/low/reject), critical defects require 0.92+ for auto-accept

**Actions:** register_platform, create_scan_plan, ingest_sensor_data, evaluate_adr_result, get_platform_registry, get_registry

## DEPLOY245 — Human Intelligence Engine

**Certification Schemes (10):** ASNT SNT-TC-1A, CP-189, ACCP, ISO 9712, NAS 410, API 510/570/653, AWS CWI, CSWIP

**NDT Methods (14):** UT, RT, MT, PT, VT, ET, AE, IR, LT, PAUT, TOFD, GPR, MFL, ACFM

**Performance Factors (7):** Detection rate, false call rate, sizing accuracy, reporting quality, procedure compliance, timeliness, safety compliance — weighted sum to competency score

**Competency Grades:** needs_improvement (<0.6), developing (0.6-0.7), competent (0.7-0.8), proficient (0.8-0.9), expert (0.9+)

**Actions:** get_inspector_profile, evaluate_performance, check_certification, get_training_gaps, recommend_assignment, get_competency_matrix, get_registry

## Full Engine Count After Deploy: 38

Only Medical/Bio vertical remains (last priority per roadmap).
