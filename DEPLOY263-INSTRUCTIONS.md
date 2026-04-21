# DEPLOY263: Repair Pathway Engine v1.0.0

## What This Does
A rejection without a repair plan is incomplete. This engine turns every reject into an actionable repair plan: what to fix, how to fix it, what prerequisites must be met first, and how to verify the repair succeeded. Tracks repair count per location (D1.1 two-repair max rule), enforces code-specific repair requirements, and generates reinspection plans.

## 10 Capabilities
1. **Get Registry** — engine overview
2. **Generate Repair Plan** — full repair pathway: method selection per discontinuity, prerequisites checklist, step-by-step procedure, reinspection plan, difficulty estimate, teaching notes
3. **Get Repair Methods** — all 10 repair methods with filtering by category or discontinuity type
4. **Get Prerequisites** — all 10 prerequisites with verification methods and failure consequences
5. **Check Prerequisites** — verify which prerequisites are met; blocks repair if mandatory ones fail
6. **Get Code Rules** — 12 code-specific repair rules (D1.1 two-repair max, ASME VIII PWHT, API 1104 cut-out rule, etc.)
7. **Record Repair** — log a completed repair with welder, WPS, method, and reinspection result
8. **Get Repair History** — repair history for a location/case with repair count tracking and limit warnings
9. **Get Reinspection Plan** — NDE requirements for verifying the completed repair
10. **Get Repair Stats** — aggregate statistics: success rates, common methods, multi-repair locations

## Coverage

### 10 Repair Methods
- **RM-001** Arc Gouge and Reweld — standard excavation repair for cracks, IF, IP, slag, cluster porosity (85% success)
- **RM-002** Grind and Reweld — shallow surface defects: undercut, overlap, reinforcement, arc strikes (95% success)
- **RM-003** Blend Grinding Only — remove by grinding without reweld when thickness allows (98% success)
- **RM-004** Cut Out and Rerun — complete removal when defects too extensive or repair limit exceeded (90% success)
- **RM-005** Weld Buildup — add metal for underfill, undersized fillets, insufficient throat (92% success)
- **RM-006** Back Gouge and Backweld — root-side repair for IP, root cracks, root porosity (88% success)
- **RM-007** Cosmetic Grinding — spatter, discoloration, surface roughness, arc strikes (99% success)
- **RM-008** PWHT After Repair — post-weld heat treatment for crack repair, hydrogen, hardness (90% success)
- **RM-009** Overlay / Butter Layer — dissimilar metal, corrosion, erosion repair (82% success)
- **RM-010** Peening — fatigue improvement technique for weld toes (95% success)

### 10 Prerequisites
- PRQ-001: Repair WPS Qualified
- PRQ-002: Welder Qualified for Repair Process
- PRQ-003: Complete Defect Removal Verified (MT/PT)
- PRQ-004: Preheat Applied Per WPS
- PRQ-005: Minimum Wall Thickness Maintained
- PRQ-006: Engineering Approval for Third Repair
- PRQ-007: Repair Area Cleaned and Dry
- PRQ-008: Filler Metal Verified
- PRQ-009: PWHT Evaluation
- PRQ-010: Reinspection Plan Established

### 12 Code-Specific Repair Rules
- D1.1: Two-repair maximum (Clause 5.24.1), excavation verification, NDE same as original
- API 1104: Two-repair max then cut-out (9.7.3), repair length limit, reinspection same as original
- ASME VIII: Defect removal verification (UW-40), PWHT after repair, full documentation
- ASME B31.3: Cavity or overlay repair methods (341.4), re-examination same as original
- AWS D1.5: Fracture critical repair requires engineering review and enhanced NDE

## Deploy Steps

### Step 1: SQL Migration
Run in Supabase SQL Editor:
- File: `supabase/migrations/DEPLOY263_repair_pathway_engine.sql`
- Creates 6 tables: repair_method_registry, repair_prerequisites, repair_code_rules, repair_pathway_assessments, repair_history, repair_audit_events
- Seeds 10 repair methods, 10 prerequisites, 12 code rules
- Click "Run and enable RLS"

### Step 2: Netlify Function
Paste into GitHub:
- File: `netlify/functions/repair-pathway-engine.ts`
- 10 actions (see above)

### Step 3: Health Registry
Paste updated file:
- File: `netlify/functions/health.ts`
- Now has 56 engines

### Step 4: System Check
Paste updated file:
- File: `public/system-check.html`
- Now tests 56 endpoints

## Test After Deploy
Visit: https://4dndt.netlify.app/system-check.html
Expected: 56 PASS (Ctrl+Shift+R to hard refresh)

## How the Repair Plan Generator Works

1. **Fetch all repair methods, code rules, and prerequisites** from the database
2. **Check repair history** at the location — how many prior repairs?
3. **Determine disposition**: repair vs cut-out-and-rerun based on defect severity, extent, and repair count
4. **Select best repair method** for each discontinuity using scored matching (discontinuity type + material + process compatibility)
5. **Build prerequisites checklist** — mandatory items must all be met before repair begins
6. **Generate reinspection plan** — which NDE methods verify the completed repair
7. **Estimate difficulty** — straightforward / moderate / complex / requires_specialist
8. **Generate teaching notes** — contextual guidance for the student/inspector
9. **Save everything** — assessment, audit trail, full traceability

## Repair Limit Enforcement

The D1.1 two-repair rule (Clause 5.24.1) is actively enforced:
- Repair #1 and #2: proceed with repair plan
- Repair #3+: disposition automatically changes to "cut_out_and_rerun" with engineering approval required
- Every repair is logged in repair_history with location tracking
- Approaching-limit warnings are generated when repair count hits 2
