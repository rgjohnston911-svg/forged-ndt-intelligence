# DEPLOY260: Weld Acceptance Authority v1.0.0

## What This Does
CWI-level weld evaluation from a photo. Covers ALL welding forms (17 processes), ALL positions (17 including sheet metal), ALL materials (18 including sheet steel/aluminum/galvanized/cast iron/titanium/nickel/copper/duplex), 20 joint types, 25 discontinuity types, and 8 code families — backed by 4D physics validation. The goal: as accurate as a human CWI without requiring any special equipment.

## 12 Capabilities
1. **Evaluate Weld** — full 11-step CWI assessment pipeline (evidence gate -> code route -> dominance check -> acceptance check -> physics validation -> confidence score -> escalation -> disposition)
2. **Route Code** — auto-determines governing code from application context (bridge->D1.5, pipeline->API 1104, pressure->ASME VIII, aluminum->D1.2, sheet->D1.3, etc.)
3. **Check Acceptance** — looks up code-specific acceptance criteria for each discontinuity
4. **Check Dominance** — ranks discontinuities by dominance tier (cracks always dominate)
5. **Validate Physics** — 4D physics rules (process x position x material x environment)
6. **Check Evidence** — evidence sufficiency scoring with required evidence tracking
7. **Get Process Registry** — all 17 welding processes with details
8. **Get Position Registry** — all 17 positions including 4 sheet metal positions
9. **Get Material Registry** — all 18 materials with properties
10. **Get Joint Registry** — all 20 joint types including sheet metal joints
11. **Get Discontinuity Registry** — all 25 discontinuity types with dominance tiers
12. **Get Registry** — engine overview and capabilities summary

## Coverage

### 17 Welding Processes
SMAW, GMAW, GMAW-P, FCAW-G, FCAW-S, GTAW, SAW, RSW, RSEW, ESW/EGW, PAW, LBW, EBW, FSW, OFW, SW, Brazing

### 17 Positions
1F/1G, 2F/2G, 3F/3G, 4F/4G, 5G, 6G, 6GR + Sheet Metal: Flat, Horizontal, Vertical, Overhead

### 18 Materials
Carbon Steel, Low-Alloy Steel, Stainless Steel (Austenitic), Stainless Steel (Ferritic/Martensitic), Aluminum (1xxx-5xxx), Aluminum (6xxx-7xxx), Chrome-Moly, Nickel Alloys, Copper Alloys, Titanium, Duplex Stainless, Cast Iron, Sheet Steel, Sheet Stainless, Sheet Aluminum, Galvanized Steel, Weathering Steel, High-Strength Low-Alloy

### 20 Joint Types
Butt, V-Groove, Bevel-Groove, U-Groove, J-Groove, Fillet (Tee), Fillet (Lap), Fillet (Corner), Plug, Slot, Edge, Flange, Complete Joint Pen (CJP), Partial Joint Pen (PJP), Sheet Metal Edge Flange, Sheet Metal Flare-V, Sheet Metal Flare-Bevel, Sheet Metal Plug/Slot, Pipe-to-Plate, Branch Connection

### 25 Discontinuity Types (5 Dominance Tiers)
- **Tier 1 (Cracks — always reject):** Longitudinal, Transverse, Crater, Throat, Toe, Root, Underbead, Lamellar Tear
- **Tier 2 (Penetration):** Incomplete Fusion, Incomplete Penetration
- **Tier 3 (Volumetric):** Porosity (scattered/cluster/linear/piping), Slag Inclusion, Tungsten Inclusion
- **Tier 4 (Surface/Geometric):** Undercut, Overlap, Underfill, Excessive Reinforcement, Arc Strike, Spatter, Misalignment/Hi-Lo
- **Tier 5 (Cosmetic):** Surface Roughness, Discoloration

### 8 Code Families
AWS D1.1 (Static + Cyclic), AWS D1.2 (Aluminum), AWS D1.3 (Sheet Steel), AWS D1.5 (Bridge), AWS D1.6 (Stainless), API 1104 (Pipeline), ASME VIII (Pressure Vessels), ASME B31.3 (Process Piping)

### 10 4D Physics Rules
SMAW 3G root LOF, Overhead sagging, FCAW slag trap, GTAW tungsten contamination, GMAW sheet burnthrough, Aluminum porosity, 6G pipe root, SAW centerline crack, Dissimilar metal fusion, Sheet aluminum distortion

## Deploy Steps

### Step 1: SQL Migration
Run in Supabase SQL Editor:
- File: `supabase/migrations/DEPLOY260_weld_acceptance_authority.sql`
- Creates 9 tables: weld_process_registry, weld_position_registry, weld_material_registry, weld_joint_registry, weld_discontinuity_registry, weld_code_acceptance_criteria, weld_4d_physics_rules, weld_assessments, weld_audit_events
- Seeds: 17 processes, 17 positions, 18 materials, 20 joints, 25 discontinuities, code acceptance criteria, 10 physics rules
- Reference tables have read-only policies; assessment tables have org isolation

### Step 2: Netlify Function
Paste into GitHub:
- File: `netlify/functions/weld-acceptance-authority.ts`
- 12 actions (see above)

### Step 3: Health Registry
Paste updated file:
- File: `netlify/functions/health.ts`
- Now has 53 engines

### Step 4: System Check
Paste updated file:
- File: `public/system-check.html`
- Now tests 53 endpoints

## Test After Deploy
Visit: https://4dndt.netlify.app/system-check.html
Expected: 53 PASS (Ctrl+Shift+R to hard refresh)

## CWI Assessment Pipeline (evaluate_weld)

The 11-step pipeline mirrors how a certified welding inspector evaluates a weld:

1. **Parse & Validate Input** — weld spec, findings, mode, calibration status
2. **Evidence Sufficiency Gate** — scores available evidence; refuses to evaluate if insufficient
3. **Code Routing** — auto-determines governing code from application/material/thickness context
4. **Discontinuity Dominance Check** — any Tier 1 (crack) = immediate reject, dominates all other findings
5. **Per-Discontinuity Acceptance Check** — each finding checked against code-specific acceptance criteria
6. **4D Physics Validation** — process x position x material x environment rules
7. **Confidence Scoring** — evidence quality + calibration + measurement completeness + physics results
8. **Escalation Logic** — cracks always escalate; low confidence escalates; production mode escalates
9. **Final Disposition** — accept / reject / provisional_accept / accept_pending_review / provisional_reject / insufficient_evidence
10. **Repair Recommendations** — per-discontinuity repair guidance
11. **Audit Trail** — full assessment logged with all intermediate results

## Operating Modes
- **training** — educational feedback, relaxed escalation
- **instructor** — full CWI-level rigor for review
- **production** — maximum strictness, mandatory escalation on any reject
- **cwi_assist** — CWI decision support tool with full traceability

## Disposition States
- **accept** — all findings within code limits, high confidence
- **reject** — any finding exceeds code limits OR crack detected
- **provisional_accept** — marginal findings, needs CWI review
- **accept_pending_review** — acceptable but flagged for verification
- **provisional_reject** — likely reject but evidence incomplete
- **insufficient_evidence** — cannot evaluate, need more data
