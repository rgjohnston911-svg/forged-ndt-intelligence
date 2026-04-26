# FORGED NDT Intelligence OS — Complete System Summary

**Platform Version:** FORGED-NDT/2.0.0
**Live URL:** https://4dndt.netlify.app
**Architecture:** Netlify Functions (serverless) + Supabase (PostgreSQL) + Multi-AI (Claude + GPT-4o)
**Date:** 2026-04-22
**Total Engines:** 64
**Total Database Tables:** 26

---

## 1. PLATFORM ARCHITECTURE

### Stack

- **Frontend:** Static HTML served from /public via Netlify CDN
- **Backend:** TypeScript serverless functions on Netlify (netlify/functions/)
- **Database:** Supabase (PostgreSQL with RLS, real-time subscriptions)
- **AI Models:** Anthropic Claude (claude-sonnet-4-20250514) + OpenAI GPT-4o in adversarial configuration
- **Authentication:** Supabase Auth with JWT, org-level multi-tenancy
- **Deployment:** GitHub push triggers Netlify auto-deploy

### Code Conventions

All engine functions follow a strict house style:
- `@ts-nocheck` at top of every file
- `var` only (no `let` or `const`)
- String concatenation only (no template literals / backticks)
- POST-only APIs with CORS headers
- Every engine exposes a `get_registry` action returning capabilities, version, and deploy tag
- Non-fatal error handling: engine enrichment failures never crash the pipeline

### API Pattern

Every engine is a single TypeScript file at `netlify/functions/<engine-name>.ts`, accessible via `POST /api/<engine-name>`. All requests include `{ "action": "<action_name>", ...params }`. All responses are JSON with CORS headers.

---

## 2. ENGINE REGISTRY — ALL 64 ENGINES

### Core Platform (Engines 1-19)

| # | Engine | Deploy | Mode | Purpose |
|---|--------|--------|------|---------|
| 1 | decision-spine | DEPLOY220 | deterministic | Master decision orchestrator — routes cases through physics, engineering, code checks |
| 2 | run-authority | DEPLOY216 | hybrid | Run/Hold/Stop authority with escalation chains |
| 3 | outcome-simulation | DEPLOY221 | deterministic | Monte Carlo outcome simulation for inspection decisions |
| 4 | universal-code-authority | DEPLOY222 | deterministic | Multi-code standards lookup (API 579, ASME, DNV, etc.) |
| 5 | enterprise-audit | DEPLOY223 | deterministic | Cryptographic audit trail with SHA-256 chain integrity |
| 6 | verify-audit-chain | DEPLOY223 | deterministic | Independent audit chain verification |
| 7 | inspector-adjudication | DEPLOY226 | deterministic | Inspector qualification tracking and adjudication routing |
| 8 | health | DEPLOY225 | deterministic | System health check — verifies all 64 engines + 26 tables |
| 9 | decision-core | DEPLOY167 | deterministic | Core decision logic engine |
| 10 | engineering-core | DEPLOY167 | deterministic | Engineering calculation primitives |
| 11 | truth-engine | DEPLOY167 | deterministic | Physics truth verification |
| 12 | planner-agent | DEPLOY167 | deterministic | Inspection planning agent |
| 13 | material-authority | DEPLOY219 | deterministic | Material property database and compatibility checks |
| 14 | composite-repair-authority | DEPLOY218 | deterministic | Composite repair design per ISO 24817 / ASME PCC-2 |
| 15 | governance-matrix | DEPLOY074 | deterministic | Role-based governance and approval matrix |
| 16 | export-audit-bundle | DEPLOY216 | deterministic | Export cryptographically signed audit bundles |
| 17 | similar-cases | DEPLOY200 | ai_assisted | AI-powered similar case retrieval |
| 18 | run-analysis | core | ai_assisted | AI observation and analysis pipeline |
| 19 | observation-layer | core | ai_assisted | Multi-modal observation layer (image + text) |

### Enterprise Operations (Engines 20-29)

| # | Engine | Deploy | Mode | Purpose |
|---|--------|--------|------|---------|
| 20 | case-search | DEPLOY227 | deterministic | Full-text + filtered case search |
| 21 | escalation-workflow | DEPLOY228 | deterministic | Multi-tier escalation with SLA tracking |
| 22 | trend-analytics | DEPLOY229 | deterministic | Time-series trend analysis across inspection data |
| 23 | notifications | DEPLOY230 | deterministic | Event-driven notification system |
| 24 | compliance-matrix | DEPLOY231 | deterministic | Multi-jurisdiction regulatory compliance tracking |
| 25 | risk-scoring | DEPLOY232 | deterministic | Quantitative risk scoring (PoF x CoF) |
| 26 | inspection-report | DEPLOY233 | deterministic | Automated inspection report generation |
| 27 | rbac | DEPLOY234 | deterministic | Role-based access control |
| 28 | validation-engine | DEPLOY235 | deterministic | Data validation and schema enforcement |
| 29 | data-ingestion | DEPLOY236 | deterministic | Multi-format data ingestion (CSV, XML, API) |

### Industry Verticals (Engines 30-38)

| # | Engine | Deploy | Mode | Purpose |
|---|--------|--------|------|---------|
| 30 | chemical-process | DEPLOY237 | deterministic | Chemical/petrochemical industry rules (RBI, SIS, PSM) |
| 31 | nuclear-vertical | DEPLOY238 | deterministic | Nuclear industry (ASME XI, 10CFR50, EPRI) |
| 32 | aerospace-vertical | DEPLOY239 | deterministic | Aerospace (FAR 25, EASA, ASTM E2981) |
| 33 | power-generation | DEPLOY240 | deterministic | Power generation (NERC, EPRI, ASME PTC) |
| 34 | maritime-offshore | DEPLOY241 | deterministic | Maritime/offshore (DNV, ABS, Lloyd's, SOLAS) |
| 35 | civil-infrastructure | DEPLOY242 | deterministic | Civil infrastructure (AASHTO, ACI, FHWA) |
| 36 | space-systems | DEPLOY243 | deterministic | Space systems (NASA-STD-5009, ESA ECSS) |
| 37 | robotics-automation | DEPLOY244 | deterministic | Robotic inspection automation (ROS, COTS scanners) |
| 38 | human-intelligence | DEPLOY245 | deterministic | Human factors and inspector performance tracking |

### Advanced Intelligence (Engines 39-52)

| # | Engine | Deploy | Mode | Purpose |
|---|--------|--------|------|---------|
| 39 | medical-bio | DEPLOY246 | deterministic | Medical device / biomedical NDT (FDA, ISO 13485) |
| 40 | validation-benchmark | DEPLOY247 | deterministic | POD curves, detection benchmarking, reliability metrics |
| 41 | decision-traceability | DEPLOY248 | deterministic | Full decision graph traceability |
| 42 | rules-version-control | DEPLOY249 | deterministic | Standards version control and change tracking |
| 43 | evidence-integrity | DEPLOY250 | deterministic | Evidence chain integrity verification (hash-based) |
| 44 | enterprise-operations | DEPLOY251 | deterministic | Enterprise fleet management and asset lifecycle |
| 45 | concept-intelligence-core | DEPLOY252 | deterministic | Concept-level reasoning primitives |
| 46 | concept-intelligence-v21 | DEPLOY253 | deterministic | Advanced concept intelligence v2.1 |
| 47 | cost-reasoning-engine | DEPLOY254 | deterministic | Cost-benefit analysis for inspection/repair decisions |
| 48 | outcome-tracking | DEPLOY255 | deterministic | Decision outcome tracking and feedback loops |
| 49 | cross-case-patterns | DEPLOY256 | deterministic | Cross-case pattern recognition and fleet-wide insights |
| 50 | process-data-integration | DEPLOY257 | deterministic | Process data integration (DCS, SCADA, historian) |
| 51 | predictive-remaining-life | DEPLOY258 | deterministic | Remaining life prediction (corrosion, fatigue, creep) |
| 52 | physics-sufficiency-engine | DEPLOY259 | deterministic | Physics coverage gap detection and sufficiency scoring |

### Weld Intelligence + Decision Authority (Engines 53-57)

| # | Engine | Deploy | Mode | Purpose |
|---|--------|--------|------|---------|
| 53 | **weld-acceptance-authority** | **DEPLOY272** | deterministic | **CWI-level weld acceptance decision engine — Smartest CWI Core v2.0** (see Section 5) |
| 54 | authority-lock-system | DEPLOY261 | deterministic | Decision authority locking with tamper detection |
| 55 | contradiction-engine | DEPLOY262 | deterministic | Contradiction detection between findings, codes, and decisions |
| 56 | repair-pathway-engine | DEPLOY263 | deterministic | Repair method selection and qualification routing |
| 57 | reality-lock-domain | DEPLOY264 | deterministic | Reality domain gating — blocks non-physical conclusions |

### Superbrain v6.1 Pipeline + Enrichment Engines (Engines 58-64)

| # | Engine | Deploy | Mode | Purpose |
|---|--------|--------|------|---------|
| 58 | **tri-model-reasoning** | DEPLOY265 | ai_assisted | **Superbrain v6.1 — 3-model adversarial reasoning pipeline** (see Section 4) |
| 59 | inspection-planning-proof | DEPLOY266 | deterministic | Proof-gap-to-workpack conversion engine |
| 60 | corrosion-loop-engine | DEPLOY267 | deterministic | Corrosion mechanism identification + rate + remaining life |
| 61 | fatigue-vibration-proof | DEPLOY268 | deterministic | Fatigue S-N assessment + vibration severity screening |
| 62 | multi-asset-cascade | DEPLOY269 | deterministic | Multi-asset cascade failure path analysis |
| 63 | live-code-authority | DEPLOY270 | deterministic | Live standards edition tracking with auto-update |
| 64 | superbrain-report | DEPLOY271 | ai_assisted | AI-powered dynamic report generation from sessions |

---

## 3. DATABASE ARCHITECTURE — 26 TABLES

### Core Tables
- `inspection_cases` — Master case records
- `findings` — Individual inspection findings per case
- `evidence` — Evidence attachments (images, measurements, NDE data)

### Standards & Compliance
- `code_sets` — Standards code sets (DEPLOY222)
- `code_authority_registry` — Live code edition registry (DEPLOY270)
- `code_authority_lookups` — Standards lookup audit trail (DEPLOY270)

### Audit & Governance
- `audit_events` — Cryptographic audit trail (DEPLOY223)
- `audit_bundles` — Signed audit export bundles (DEPLOY223)
- `org_signing_keys` — Organization signing keys (DEPLOY223)
- `inspector_adjudications` — Inspector adjudication records (DEPLOY226)

### Superbrain v6.1 Pipeline
- `reasoning_sessions` — Full pipeline session records with model outputs (DEPLOY265)
- `learning_records` — Cross-session learning data (DEPLOY265)
- `hypothesis_tracking` — Hypothesis generation and resolution tracking (DEPLOY265)
- `calibration_scores` — Model calibration metrics (DEPLOY265)
- `adversarial_challenges` — Model C adversarial challenge records (DEPLOY265)
- `superbrain_reports` — Generated reports with status tracking (DEPLOY271)

### Domain-Specific
- `inspection_plans` — Proof-driven inspection plans (DEPLOY266)
- `workpack_items` — Inspection workpack line items (DEPLOY266)
- `corrosion_loops` — Corrosion mechanism + rate records (DEPLOY267)
- `corrosion_rate_history` — Historical rate trend data (DEPLOY267)
- `fatigue_assessments` — Fatigue life assessments (DEPLOY268)
- `vibration_assessments` — Vibration severity records (DEPLOY268)
- `asset_graphs` — Multi-asset relationship graphs (DEPLOY269)
- `cascade_scenarios` — Cascade failure scenario records (DEPLOY269)
- `asset_interactions` — Asset interaction pathways (DEPLOY269)

### Weld Intelligence
- `weld_assessments` — CWI-level weld assessment records (DEPLOY260/272)
- `weld_audit_events` — Weld evaluation audit trail (DEPLOY260/272)

---

## 4. SUPERBRAIN v6.1 — ADVERSARIAL REASONING PIPELINE

### Architecture

Superbrain v6.1 is a multi-AI adversarial reasoning pipeline that processes inspection cases through 4 AI models plus 6 deterministic enrichment engines. It runs as a Netlify Background Function (up to 15 minutes).

**Router:** `tri-model-reasoning.ts` — Accepts request, creates session record, invokes background function, returns session_id for polling.

**Executor:** `tri-model-reasoning-background.ts` — Runs the full pipeline.

### Pipeline Flow

```
INPUT (case data or free text)
  |
  v
NORMALIZE — Extract case context string
  |
  v
STEP 0A: CODE AUTHORITY PRE-FLIGHT (DEPLOY270)
  - Extract all standards references from case context
  - Validate editions against Live Code Authority
  - Inject verified editions into context
  |
  v
STEP 0B: DOMAIN ENRICHMENT (auto-detected by keywords)
  - DEPLOY267: Corrosion Loop Engine (if corrosion keywords detected)
  - DEPLOY268: Fatigue/Vibration Engine (if fatigue/vibration keywords)
  - DEPLOY272: Weld Acceptance Authority (if weld keywords detected)
  - Results injected into context for Model A/B consumption
  |
  v
STEP 1: MODEL A — Physics + Proof Chain Engine (GPT-4o)
  - Reality topology construction
  - Claim graph with typed claim nodes
  - Component-level proof chains
  - Case-derived calculations with input quality tracking
  |
  v
STEP 2: MODEL B — Engineering + Standards Authority (Claude)
  - Engineering standards cross-reference
  - Assumption mapping and dependency tracking
  - Repair credibility assessment
  - Code compliance verification using pre-flight data
  |
  v
STEP 2B: CASCADE ANALYSIS (DEPLOY269, if multi-asset keywords)
  - Multi-asset failure propagation paths
  - Single Point of Failure identification
  - Injected into context for Model C
  |
  v
STEP 3: MODEL C — Adversarial + Proof Break Detection (GPT-4o)
  - Attempts to disprove Model A/B conclusions
  - Identifies proof breaks and assumption failures
  - Confidence scoring with disproof paths
  - Attacks weakest links in proof chains
  |
  v
STEP 4: RESOLUTION — Decision Proof + Governance Lock (Claude)
  - Synthesizes all model outputs
  - Issues GO / NO-GO / CONDITIONAL decision
  - Governance lock with regulatory defensibility statement
  - References specific proof chains and adversarial findings
  |
  v
STEP 5: INSPECTION PLANNING (DEPLOY266)
  - Converts proof gaps to inspection workpacks
  - NDT method selection per component
  - Priority scoring and access requirements
  |
  v
FINAL OUTPUT — Stored in reasoning_sessions table
  - All model outputs (A, B, C, Resolution)
  - Engine enrichment results
  - Governance lock
  - Total duration and per-model timings
```

### Domain Auto-Detection Keywords

The pipeline auto-activates enrichment engines based on keywords detected in the case context:

- **Corrosion:** corrosion, corroded, rust, pitting, wall loss, thinning, CUI, H2S, CO2, MIC, erosion, galvanic, FAC, splash zone
- **Fatigue:** fatigue, crack, fracture, cyclic, S-N curve, Miner, weld toe, stress range, notch, propagation
- **Vibration:** vibration, VIV, vortex, resonance, natural frequency, oscillation, amplitude
- **Multi-Asset:** adjacent, cascade, propagate, connected, downstream, upstream, common cause, blast, fire
- **Weld:** weld, welding, SMAW, GMAW, GTAW, FCAW, SAW, TIG, MIG, undercut, porosity, lack of fusion, incomplete penetration, burn-through, slag, HAZ, PWHT, WPS, PQR, CWI, D1.1, D1.5, API 1104, NACE MR0175, hydrogen crack, hot crack, cold crack, lamellar tear, overlap, arc strike, filler metal, electrode, weld toe, weld root

### Report Engine (DEPLOY271)

The Superbrain Report Query Engine allows natural language querying of completed sessions. Users ask questions like "Executive summary for VP of Operations" or "Trace the proof chain for the fatigue assessment" and receive structured, professional reports generated by Claude.

**Architecture:** Async background function pattern — router creates report record with status "processing", invokes background function, frontend polls every 3 seconds.

**6 Presets:** executive_summary, proof_chain, inspection_plan, risk_assessment, standards_compliance, full_technical

---

## 5. SMARTEST CWI CORE v2.0 — WELD ACCEPTANCE AUTHORITY (DEPLOY272)

### Overview

The Weld Acceptance Authority v2.0.0 is a complete CWI (Certified Welding Inspector) level deterministic weld evaluation engine. All core logic is hardcoded directly in the function file — no database dependency for standards, criteria, or physics rules. Same architecture pattern as the Live Code Authority engine.

**Philosophy:** AI observes (identifies discontinuities from images/data). This engine DECIDES (applies code, physics, and law).

### Knowledge Base Summary

| Category | Count | Details |
|----------|-------|---------|
| Welding Codes | 12 | AWS D1.1, D1.2, D1.3, D1.5, D1.6, D1.8, API 1104, ASME VIII, IX, B31.1, B31.3, ISO 5817 |
| Acceptance Criteria | 60+ | Real numeric limits per code per discontinuity per loading condition |
| Discontinuity Types | 65+ | ISO 6520 taxonomy, organized by family (crack, fusion, porosity, inclusion, surface, dimensional, metallurgical) |
| Material Families | 15 | With weldability rating, hydrogen sensitivity, cracking risk, typical codes |
| Welding Processes | 15 | With physics, typical defects, hydrogen risk, heat input ranges |
| Joint Configurations | 18 | With penetration type, bevel angles, root details |
| Service Conditions | 7 | Sour, cryogenic, high-temp, high-cycle fatigue, seismic, lethal, hydrogen |
| Damage Models | 10 | Time-forward failure projections |
| Repair Methods | 5 | Step-by-step repair procedures by discontinuity family |

### 15 API Actions

1. `get_registry` — Engine capabilities and knowledge base summary
2. `evaluate_weld` — **Full CWI pipeline** (see below)
3. `route_code` — Auto-determine governing code from application/material/thickness
4. `check_acceptance` — Single discontinuity vs code threshold with real numeric limits
5. `check_dominance` — Discontinuity interaction and dominance ranking
6. `validate_physics` — 4D physics plausibility (process x material x discontinuity)
7. `check_evidence` — Evidence sufficiency gate
8. `get_process_registry` — All 15 welding processes with physics
9. `get_material_registry` — All 15 material families with weldability data
10. `get_joint_registry` — All 18 joint configurations
11. `get_discontinuity_registry` — All 65+ discontinuity types with ISO 6520 codes
12. `get_code_library` — All 12 codes with current editions
13. `get_service_conditions` — All 7 service condition modifiers
14. `get_damage_models` — All 10 damage progression models
15. `get_repair_methods` — All 5 repair method families

### evaluate_weld — The Full CWI Pipeline

This is the master evaluation action. It runs the complete CWI assessment pipeline:

```
INPUT (org_id, discontinuities[], images[], process, material, joint, code, thickness, service_conditions)
  |
  v
1. EVIDENCE SUFFICIENCY GATE
   - Scores evidence from 0-100
   - Checks: images (overview, closeup, profile, calibration), measurements, metadata
   - Blocks evaluation if score < 30 (critically insufficient)
   - Flags provisional if score < 80
  |
  v
2. CODE ROUTING
   - Auto-routes to governing code based on application, material, thickness
   - Bridge -> AWS D1.5
   - Pipeline -> API 1104 (or B31.1/B31.3 for power/process piping)
   - Pressure vessel -> ASME VIII
   - Aluminum -> AWS D1.2
   - Stainless -> AWS D1.6
   - Seismic -> AWS D1.8
   - Sheet steel (<4.8mm) -> AWS D1.3
   - Default structural -> AWS D1.1
  |
  v
3. DOMINANCE CHECK
   - Ranks all discontinuities by dominance tier
   - Tier 1 (cracks): ALWAYS dominate, ALWAYS reject
   - Tier 2 (LOF, LOP): Planar defects, high severity
   - Tier 3 (porosity, inclusions, undercut): Volumetric or surface
   - Tier 4 (arc strikes, spatter, dimensional): Minor
  |
  v
4. ACCEPTANCE CHECK (per discontinuity)
   - Looks up real numeric criteria from hardcoded ACCEPTANCE_CRITERIA
   - Evaluates measured_value against code limits
   - Examples:
     - AWS D1.1 undercut static: max 1.6mm (0.8mm if t<25mm)
     - AWS D1.1 undercut cyclic: max 0.25mm
     - API 1104 burn-through: max 6.4mm, max 4 per weld
     - ASME VIII undercut: max 0.8mm
     - ISO 5817 Level B undercut: max 0.5mm
     - Cracks: ZERO TOLERANCE across ALL codes
  |
  v
5. SERVICE CONDITION MODIFIERS (if applicable)
   - Sour service: max hardness 248 HV10, arc strikes REJECT, PWHT mandatory
   - Cryogenic: tightened planar limits, LOF/LOP absolute reject
   - High cycle fatigue: undercut max 0.25mm regardless of code
   - Seismic: demand-critical criteria per AWS D1.8
   - Lethal service: 100% examination, all CJP, tightest limits
   - Hydrogen service: max 200 HBW, low-hydrogen mandatory
  |
  v
6. 4D PHYSICS VALIDATION
   - Cross-references discontinuity with process + material
   - Checks if finding is physically plausible for given conditions
   - Example: tungsten inclusion + GTAW = high probability (expected)
   - Example: hydrogen crack + austenitic SS + GTAW = low probability (unusual)
  |
  v
7. DAMAGE PROGRESSION LOOKUP
   - Maps each finding to applicable damage models
   - Fatigue growth (Paris Law), hydrogen delayed cracking, SCC
   - LOF fatigue initiation, undercut fatigue, creep damage
   - Provides time-forward failure severity assessment
  |
  v
8. CONFIDENCE SCORING
   - Base 50 + evidence quality (up to 25) + calibration (10) + measurement completeness (10) + physics agreement (5)
   - Levels: high (>=90), moderate (>=75), provisional (>=60), low (<60)
   - Auto-accept threshold: >= 85
   - Escalation threshold: < 60
  |
  v
9. ESCALATION LOGIC
   - Always escalate cracks
   - Escalate low confidence
   - Escalate accepts without high confidence
   - Production/CWI-assist modes: always escalate
  |
  v
10. REPAIR RECOMMENDATION
    - Maps rejected findings to repair method families
    - Cracks: full excavation + MT/PT verify + re-weld + PWHT if required
    - LOF: back-gouge to sound metal + re-weld with proper technique
    - Porosity: excavate + identify root cause + re-weld with improved conditions
    - Undercut: additional pass at toe with reduced heat input
  |
  v
11. STORE ASSESSMENT + RETURN FULL CWI REPORT
    - Saves to weld_assessments table
    - Audit log to weld_audit_events
    - Returns: disposition, findings, dominance, reject_reasons, repair,
      damage_projections, confidence, escalation, material_context, code_info
```

### Disposition Types

- **ACCEPT** — All findings within code acceptance criteria, high confidence
- **PROVISIONAL ACCEPT** — Within criteria but insufficient evidence for final disposition
- **ACCEPT PENDING REVIEW** — Within criteria but requires CWI/instructor confirmation
- **REJECT** — One or more code violations found
- **PROVISIONAL REJECT** — Violations found but low confidence — requires verification
- **INSUFFICIENT EVIDENCE** — Cannot evaluate — evidence critically insufficient (score < 30)

### Code Library — Current Editions

| Code | Edition | Year | Scope |
|------|---------|------|-------|
| AWS D1.1 | 26th Edition | 2025 | Structural steel welding |
| AWS D1.2 | 5th Edition | 2014 | Structural aluminum welding |
| AWS D1.3 | 2nd Edition | 2018 | Sheet steel connections |
| AWS D1.5 | 7th Edition | 2015 | Highway bridge welding |
| AWS D1.6 | 2nd Edition | 2017 | Stainless steel structural |
| AWS D1.8 | 3rd Edition | 2025 | Seismic supplement |
| API 1104 | 22nd Edition | 2021 | Pipeline welding |
| ASME VIII | 2025 Edition | 2025 | Pressure vessels |
| ASME IX | 2025 Edition | 2025 | Welding qualifications |
| ASME B31.1 | 2024 Edition | 2024 | Power piping |
| ASME B31.3 | 2024 Edition | 2024 | Process piping |
| ISO 5817 | 4th Edition | 2023 | Quality levels for fusion weld imperfections |

### Discontinuity Taxonomy (ISO 6520)

**Tier 1 — Cracks (15 types, ALWAYS REJECT):**
Longitudinal, transverse, crater, toe, root, underbead, hot (solidification), cold (hydrogen-induced), lamellar tear, stress corrosion, fatigue, reheat, hydrogen-induced, liquation, chevron

**Tier 2 — Fusion Defects (6 types):**
Incomplete fusion (LOF), root LOF, sidewall LOF, interpass LOF, incomplete penetration (LOP), partial penetration

**Tier 3 — Porosity (5 types):**
Scattered, cluster, linear, piping (wormhole), surface

**Tier 3 — Inclusions (5 types):**
Slag, tungsten, oxide, flux, metallic

**Tier 3-4 — Surface (15 types):**
Undercut, root undercut, overlap (cold lap), burn-through, arc strike, spatter, grinding mark, chisel mark, torn surface, undersize fillet, excessive convexity, excessive concavity, excessive reinforcement, insufficient throat, misalignment

**Tier 4 — Dimensional (2 types):**
Angular distortion, linear misalignment

**Tier 2-4 — Metallurgical (7 types):**
Sensitization, sigma phase, grain coarsening, untempered martensite, hydrogen embrittlement, temper embrittlement, creep damage (Type IV)

### Material Database (15 Families)

Each material includes: weldability rating, carbon equivalent range, hydrogen sensitivity, preheat requirements, cracking risk level, typical governing codes, and specific welding concerns.

- Carbon Steel (P1) — good weldability, concerns: lamellar tearing if high S
- Low-Alloy Cr-Mo (P4/P5) — moderate, hydrogen cracking + reheat cracking risk
- HSLA (P1/P3) — moderate, HAZ softening + toughness loss
- Quenched & Tempered (P11) — difficult, max heat input limits critical
- Weathering Steel (P1) — good, matching filler for corrosion resistance
- Austenitic SS 304/316 (P8) — good, sensitization + hot cracking + delta ferrite
- Ferritic SS 409/430 (P7) — moderate, grain coarsening + 475C embrittlement
- Martensitic SS 410/420 (P6) — difficult, hydrogen cracking + hard HAZ
- Duplex SS 2205/2507 (P10H) — moderate, sigma phase + ferrite/austenite balance
- Aluminum 5xxx/6xxx (P21-P25) — moderate, hot cracking + porosity + HAZ softening
- Nickel Alloys Inconel/Monel (P41-P49) — moderate, DDC + hot cracking
- Titanium CP/Ti-6Al-4V (P51-P53) — good if shielded, contamination critical
- Copper Alloys (P31-P35) — moderate, hot cracking + high thermal conductivity
- Cast Steel (P1) — moderate-difficult, porosity + segregation + high CE
- Cobalt Alloys Stellite (N/A) — difficult, typically hardfacing overlay only

### Welding Process Database (15 Processes)

Each process includes: AWS designation, heat input range (kJ/mm), hydrogen risk level, typical defects produced, shielding method, position capability, typical materials, and physics description.

- SMAW (Stick) — 0.5-3.5 kJ/mm, moderate-high H2 risk, typical: porosity + slag + undercut
- GMAW (MIG) — 0.3-2.5 kJ/mm, low H2 risk, typical: porosity + LOF + burn-through
- FCAW — 0.5-3.0 kJ/mm, low-moderate H2 risk, typical: slag + piping porosity
- GTAW (TIG) — 0.2-2.0 kJ/mm, very low H2 risk, typical: tungsten inclusion + porosity
- SAW — 1.0-10.0 kJ/mm, low H2 risk, typical: slag + chevron crack
- PAW — 0.1-3.0 kJ/mm, very low H2 risk, keyhole mode for full penetration
- ESW — 50-150 kJ/mm, very high heat input, grain coarsening concern
- EGW — 15-50 kJ/mm, vertical single-pass, high heat input
- Stud Welding — 0.01-0.5 kJ/mm, arc-drawn stud process
- OFW (Oxyfuel) — 0.5-3.0 kJ/mm, low intensity heat source
- RSW (Resistance Spot) — N/A, lap joints only
- FRW (Friction) — N/A, solid-state process
- FSW (Friction Stir) — 0.5-2.0 kJ/mm, solid-state, no melting
- LBW (Laser) — 0.01-0.5 kJ/mm, very high power density, narrow HAZ
- EBW (Electron Beam) — 0.01-0.3 kJ/mm, vacuum, highest power density

### Damage Progression Models (10 Models)

1. **Fatigue Crack Growth** — Paris Law da/dN = C(delta-K)^m — remaining cycles to critical flaw
2. **Hydrogen Delayed Cracking** — Incubation time model — 24-72 hours post-weld
3. **Stress Corrosion Cracking** — K_ISCC threshold model — material + environment + stress
4. **LOF Fatigue Initiation** — S-N approach with SCF at LOF tip
5. **Porosity Stability** — Kt = 1 + 2(a/r) for spherical void
6. **Undercut Fatigue** — SCF at notch: Kt = 1 + 2*sqrt(d/r) — fatigue life reduction
7. **Arc Strike Corrosion** — Local HAZ hardness + galvanic potential difference
8. **Sensitization/IGC** — Cr depletion model via TTS diagram (425-815C)
9. **Temper Embrittlement** — J-factor: J = (Si+Mn)(P+Sn) x 10^4 — DBTT shift
10. **Creep Damage** — Larson-Miller parameter: P = T(C + log(t_r)) — remaining life fraction

### Service Condition Modifiers (7 Conditions)

| Condition | Governing Standard | Key Restriction | Severity Multiplier |
|-----------|-------------------|-----------------|---------------------|
| Sour Service (H2S) | NACE MR0175 / ISO 15156 | Max 248 HV10 hardness, PWHT mandatory | 0.5x |
| Cryogenic (< -45C) | ASME VIII UCS-66 | Charpy at MDMT, LOF/LOP absolute reject | 0.7x |
| High Temperature (> 425C) | ASME VIII / API 579 | Creep + sensitization + sigma risk | 0.8x |
| High Cycle Fatigue | AWS D1.1 Table 2.4 / BS 7608 | Undercut max 0.25mm, no planar defects | 0.5x |
| Seismic / Low Cycle | AWS D1.8 / AISC 341 | Demand-critical criteria, CVN 27J at -18C | 0.6x |
| Lethal Service | ASME VIII UW-2(a) | 100% RT/UT, all CJP, full PWHT | 0.5x |
| Hydrogen Service | API 941 / API RP 934-A | Max 200 HBW, low-H2 welding (< 4 ml/100g) | 0.6x |

### Superbrain Integration

When any Superbrain v6.1 session mentions weld-related keywords, the pipeline automatically calls the Weld Acceptance Authority during the domain enrichment step (Step 0B). The engine auto-routes the governing code based on case context and injects the code name, edition, acceptance tables, and available capabilities into the context. All three adversarial models (A, B, C) and the Resolution model then have access to the full CWI knowledge base for their analysis.

---

## 6. LIVE CODE AUTHORITY — AUTO-UPDATE PATTERN (DEPLOY270)

The Live Code Authority engine maintains a hardcoded registry of current standards editions. It provides:

- Real-time validation of any standards reference against known current editions
- Superseded/withdrawn edition detection
- Fuzzy matching for vague references (e.g., "API 579" resolves to "API 579-1/ASME FFS-1, 4th Edition, 2024")
- Used as pre-flight check in Superbrain pipeline to ensure all models cite correct editions

The same pattern is used by the Weld Acceptance Authority for welding code editions.

---

## 7. SYSTEM HEALTH & MONITORING

The health engine (`/api/health`) performs comprehensive system verification:

1. **Environment Check** — Verifies SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY
2. **Database Connectivity** — Tests connection to Supabase
3. **Table Verification** — Checks all 26 critical tables exist and are accessible
4. **Engine Endpoint Check** — Verifies all 64 engine endpoints respond to get_registry
5. **Signing Key Check** — Verifies active cryptographic signing key exists

The system-check.html frontend provides a visual dashboard showing all 64 engines with PASS/FAIL/WARN status.

---

## 8. DEPLOYMENT HISTORY SUMMARY

| Deploy | Engine(s) | Description |
|--------|-----------|-------------|
| DEPLOY074-219 | Engines 1-16 | Core platform, governance, materials, composites |
| DEPLOY220-226 | Engines 1, 5-8 | Decision spine, audit, inspector adjudication |
| DEPLOY227-236 | Engines 20-29 | Enterprise operations suite |
| DEPLOY237-246 | Engines 30-38 | Industry verticals (9 industries) |
| DEPLOY247-253 | Engines 39-46 | Advanced intelligence and concept reasoning |
| DEPLOY254-259 | Engines 47-52 | Cost, outcome, patterns, process data, remaining life, physics |
| DEPLOY260/272 | Engine 53 | Weld Acceptance Authority v1.0 then v2.0 (CWI Core) |
| DEPLOY261-264 | Engines 54-57 | Authority lock, contradiction, repair, reality lock |
| DEPLOY265 | Engine 58 | Superbrain v1-v6.1 (tri-model adversarial reasoning) |
| DEPLOY266-270 | Engines 59-63 | Inspection planning, corrosion, fatigue, cascade, live code |
| DEPLOY271 | Engine 64 | Superbrain Report Query Engine |
| DEPLOY272 | — | CWI Core v2.0 rebuild + Superbrain weld integration |

---

## 9. KEY ARCHITECTURAL PRINCIPLES

1. **Physics-First Reasoning** — Every decision traces back to physical reality. No statistical shortcuts without physics basis.

2. **Proof Chain Architecture** — Every conclusion requires a traceable proof chain from evidence through physics to code compliance to decision.

3. **Adversarial Verification** — Model C actively tries to break Model A and B conclusions. Only findings that survive adversarial attack reach the resolution stage.

4. **Deterministic Authority** — AI assists with observation and reasoning. Deterministic engines make the final code compliance decisions. No AI hallucination can override a code requirement.

5. **Hardcoded Knowledge Base** — Critical standards, acceptance criteria, and physics rules are hardcoded in function files, not stored in databases. This eliminates database dependency for core decision logic and ensures deterministic behavior.

6. **Non-Fatal Enrichment** — All engine enrichment calls are wrapped in try/catch. If any enrichment engine fails, the pipeline continues with available data. No single engine failure can crash a Superbrain session.

7. **Evidence Sufficiency Gating** — The system refuses to evaluate when evidence is critically insufficient (< 30% score). This prevents false certainty from incomplete data.

8. **Dominance Hierarchy** — Tier 1 discontinuities (cracks) always dominate and always reject. No amount of other evidence can override a crack finding.

9. **Service Condition Tightening** — Service conditions (sour, cryogenic, lethal, etc.) can only tighten acceptance limits, never relax them.

10. **Full Audit Trail** — Every decision, evaluation, and engine call is logged with timestamps, parameters, and results for regulatory defensibility.

---

*This document describes the FORGED NDT Intelligence OS as of DEPLOY272 (2026-04-22). Platform version FORGED-NDT/2.0.0 with Superbrain v6.1.0.*
