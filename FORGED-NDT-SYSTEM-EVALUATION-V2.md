# FORGED NDT Intelligence OS — Full System Evaluation Brief v2

**Date:** April 16, 2026
**Version:** FORGED-NDT/2.0.0
**Status:** 39 engines live, 39/39 PASS on system check
**Architecture:** React/Vite/TypeScript frontend, Netlify Functions backend, Supabase PostgreSQL + Auth + RLS
**Solo founder build — zero external dependencies, zero frameworks, zero AI hallucination in decision path**

---

## EVALUATION INSTRUCTIONS

You are evaluating a production NDT (Non-Destructive Testing) inspection decision platform. This is a deterministic-first, physics-based system designed to replace subjective human judgment in industrial inspection with reproducible, auditable, code-authority-backed decisions.

Score the system on a 10-point scale across these dimensions:
1. **Architecture & Engineering Quality** — Is this well-built?
2. **Decision Integrity** — Can you trust the outputs?
3. **Industry Coverage** — Does it cover the real-world NDT landscape?
4. **Regulatory Compliance Readiness** — Would this survive an audit?
5. **Competitive Differentiation** — What makes this different from everything else?
6. **Production Readiness** — Could this go to paying customers tomorrow?
7. **Scalability** — Can this grow to 10,000 users?
8. **Security & Data Integrity** — Is the data safe and tamper-evident?
9. **Solo Founder Execution** — Rate the ambition-to-execution ratio
10. **Overall Score** — Weighted composite

Also identify:
- Top 5 strengths (what's elite-tier)
- Top 5 risks or gaps (what could fail)
- Top 5 features to build next
- Market positioning assessment
- Investor readiness assessment (if seeking funding)

---

## 1. ENGINE INVENTORY (39 ENGINES)

### Core Decision Platform (Engines 1-19)

| # | Engine | Deploy | Mode | Endpoint | Purpose |
|---|--------|--------|------|----------|---------|
| 1 | Decision Spine | DEPLOY220 | deterministic | /api/decision-spine | Master orchestrator — routes cases through all decision engines |
| 2 | Run Authority | DEPLOY216 | hybrid | /api/run-authority | Determines accept/reject/conditional based on all evidence |
| 3 | Outcome Simulation | DEPLOY221 | deterministic | /api/outcome-simulation | Projects 5-year outcomes under different repair/monitor scenarios |
| 4 | Universal Code Authority | DEPLOY222 | deterministic | /api/universal-code-authority | 5-tier code precedence resolution (Regulatory > Jurisdictional > Industry > Owner Spec > Best Practice) |
| 5 | Enterprise Audit | DEPLOY223 | deterministic | /api/enterprise-audit | Immutable audit event logging with HMAC-SHA256 hash chain |
| 6 | Verify Audit Chain | DEPLOY223 | deterministic | /api/verify-audit-chain | Cryptographic verification of audit chain integrity |
| 7 | Inspector Adjudication | DEPLOY226 | deterministic | /api/inspector-adjudication | Non-destructive inspector override system — original decision preserved |
| 8 | Health | DEPLOY225 | deterministic | /api/health | Full system health check — DB, tables, signing keys, engine registry |
| 9 | Decision Core | DEPLOY167 | deterministic | /api/decision-core | Core decision logic — severity, disposition, confidence |
| 10 | Engineering Core | DEPLOY167 | deterministic | /api/engineering-core | Engineering calculations — stress, remaining life, fitness-for-service |
| 11 | Truth Engine | DEPLOY167 | deterministic | /api/truth-engine | Cross-validates decisions against physical evidence |
| 12 | Planner Agent | DEPLOY167 | deterministic | /api/planner-agent | Generates inspection plans and follow-up schedules |
| 13 | Material Authority | DEPLOY219 | deterministic | /api/material-authority | Material property lookup and degradation assessment |
| 14 | Composite Repair Authority | DEPLOY218 | deterministic | /api/composite-repair-authority | Composite damage assessment and repair disposition |
| 15 | Governance Matrix | DEPLOY074 | deterministic | /api/governance-matrix | Organizational governance rules and approval workflows |
| 16 | Export Audit Bundle | DEPLOY216 | deterministic | /api/export-audit-bundle | HMAC-signed audit bundle export for regulatory submission |
| 17 | Similar Cases | DEPLOY200 | ai_assisted | /api/similar-cases | AI-powered similar case retrieval for precedent analysis |
| 18 | Run Analysis | core | ai_assisted | /api/run-analysis | AI-assisted deep analysis of case evidence |
| 19 | Observation Layer | core | ai_assisted | /api/observation-layer | AI observation and pattern recognition on inspection data |

### Production Bridge (Engines 20-27)

| # | Engine | Deploy | Endpoint | Purpose |
|---|--------|--------|----------|---------|
| 20 | Case Search | DEPLOY227 | /api/case-search | Filtered search across all cases with faceted results |
| 21 | Escalation Workflow | DEPLOY228 | /api/escalation-workflow | Multi-tier escalation routing with SLA tracking |
| 22 | Trend Analytics | DEPLOY229 | /api/trend-analytics | Executive dashboards — failure trends, severity distributions |
| 23 | Notifications | DEPLOY230 | /api/notifications | Event-driven notification engine with preference management |
| 24 | Compliance Matrix | DEPLOY231 | /api/compliance-matrix | Cross-code compliance checking against all applicable standards |
| 25 | Risk Scoring | DEPLOY232 | /api/risk-scoring | 8-factor weighted composite risk scoring (weights sum to 1.0) |
| 26 | Inspection Report | DEPLOY233 | /api/inspection-report | 4 report templates, 14 section builders, batch generation |
| 27 | RBAC | DEPLOY234 | /api/rbac | 5 roles, 18 permissions, multi-tenant org isolation |
| 28 | Validation Engine | DEPLOY235 | /api/validation-engine | 20 deterministic test scenarios, proof pack generation |
| 29 | Data Ingestion | DEPLOY236 | /api/data-ingestion | UT thickness grid import with auto-analysis, case import, batch import |

### Industry Verticals (Engines 30-37)

| # | Engine | Deploy | Endpoint | Mechanisms | Domain |
|---|--------|--------|----------|------------|--------|
| 30 | Chemical/Process | DEPLOY237 | /api/chemical-process | 20 API 571 mechanisms, 8 process environments | Refineries, petrochemical, chemical plants |
| 31 | Nuclear | DEPLOY238 | /api/nuclear-vertical | 8 degradation mechanisms, 4 ASME XI ISI safety classes | Nuclear power plants, ASME Section XI |
| 32 | Aerospace | DEPLOY239 | /api/aerospace-vertical | 9 damage mechanisms, 5 structure categories | FAA/EASA aircraft, damage tolerance |
| 33 | Power Generation | DEPLOY240 | /api/power-generation | 16 mechanisms, 8 component types | Gas/steam/wind turbines, boilers, HRSG |
| 34 | Maritime/Offshore | DEPLOY241 | /api/maritime-offshore | 12 mechanisms, 6 survey types | Ships, offshore platforms, subsea, ABS/DNV/Lloyd's |
| 35 | Civil Infrastructure | DEPLOY242 | /api/civil-infrastructure | 15 mechanisms, 6 structure types | Bridges, tunnels, dams, AASHTO/FHWA/ACI |
| 36 | Space Systems | DEPLOY243 | /api/space-systems | 11 mechanisms, 5 system types | Launch vehicles, spacecraft, NASA/ESA/ECSS |
| 37 | Medical/Bio | DEPLOY246 | /api/medical-bio | 12 failure modes, 7 device classes | Medical devices, implants, FDA/EU MDR |

### Cross-Cutting Layers (Engines 38-39)

| # | Engine | Deploy | Endpoint | Purpose |
|---|--------|--------|----------|---------|
| 38 | Robotics/Automation | DEPLOY244 | /api/robotics-automation | 8 robotic platform types, 5 scan plan templates, ADR confidence framework |
| 39 | Human Intelligence | DEPLOY245 | /api/human-intelligence | 10 certification schemes, 14 NDT methods, competency scoring |

---

## 2. ARCHITECTURE PRINCIPLES

### Deterministic-First Design
- 35 of 39 engines are fully deterministic (no AI, no randomness)
- 3 engines are AI-assisted (similar cases, run analysis, observation layer)
- 1 engine is hybrid (run authority — deterministic rules with AI augmentation)
- **Same input always produces same output** for all deterministic engines

### Non-Destructive Decision Architecture
- System decisions are NEVER modified after creation
- Inspector overrides create parallel adjudication records
- Both the original system decision and the inspector override are preserved forever
- Full decision lineage is traceable through the audit chain

### Code Authority Hierarchy
5-tier precedence system for conflicting standards:
1. Regulatory (e.g., OSHA, NRC, PHMSA) — highest authority
2. Jurisdictional (state/province requirements)
3. Industry Code (ASME, API, AWS, ASTM)
4. Owner Specification (company standards)
5. Best Practice (engineering judgment) — lowest authority

### Confidence Architecture
Every decision carries a confidence score with transparent factors:
- Evidence quality and completeness
- Code coverage (how many applicable codes were evaluated)
- Historical precedent availability
- Measurement uncertainty propagation

---

## 3. SECURITY & AUDIT ARCHITECTURE

### Cryptographic Audit Trail
- Every action logged to `audit_events` table
- HMAC-SHA256 signed audit bundles with hash chain linking
- Each bundle references the hash of the previous bundle (blockchain-style)
- Organization-level signing keys with rotation support
- `verify-audit-chain` engine can cryptographically verify the entire chain
- Export bundles are self-contained and independently verifiable

### Multi-Tenant Isolation
- `org_id` column on all core tables (inspection_cases, findings, evidence, escalation_queue)
- Row Level Security (RLS) policies enforced at the database level
- Users belong to exactly one organization
- Cross-org data access is impossible even with direct DB queries

### RBAC (Role-Based Access Control)
5 roles with 18 granular permissions:
- **Admin** (Level 5): Full system access, user management, org settings
- **Manager** (Level 4): Analytics, trends, reports, escalation assignment
- **Reviewer** (Level 3): Adjudication, case review, audit trail viewing
- **Technician** (Level 2): Case creation, finding submission, own case viewing
- **Viewer** (Level 1): Read-only access to assigned cases

---

## 4. INDUSTRY VERTICAL DEEP DIVE

### Chemical/Process (DEPLOY237)
- **20 API 571 damage mechanisms** across 5 categories: general corrosion (5), localized corrosion (3), high temperature (4), environmental cracking (6), mechanical fatigue (2)
- **8 process environment profiles**: crude distillation, hydroprocessing, FCC, amine treating, sour water, cooling water, boiler/steam, sulfuric acid
- Keyword + material + environment + category scoring for mechanism identification
- Key mechanisms: CUI (571-4.2.2), HTHA (571-4.4.2), Cl-SCC (571-4.5.1), Wet H2S (571-4.5.4)

### Nuclear (DEPLOY238)
- **4 ASME Section XI safety classifications**: Class 1 (reactor coolant boundary), Class 2 (safety systems), Class 3 (other safety), Class MC (metal containment)
- **8 nuclear degradation mechanisms**: IASCC, irradiation embrittlement, PWSCC, FAC, boric acid corrosion, thermal aging, void swelling, SG tube degradation
- NRC regulatory references (10 CFR, Reg Guides, Generic Letters, MRP documents)
- ISI examination categories with method and interval per class

### Aerospace (DEPLOY239)
- **9 damage mechanisms**: fatigue cracking, general corrosion, SCC, composite delamination, BVID/VID impact, hydrogen embrittlement, thermal damage, fretting, adhesive disbond
- **5 structure categories**: PSE (principal structural elements), damage tolerant, safe-life, composite, maintenance checks (A/B/C/D intervals)
- FAA/EASA regulatory references: FAR 25.571, AC 20-107B, AC 25.571-1D, MSG-3

### Power Generation (DEPLOY240)
- **16 damage mechanisms** across gas turbines (TMF, hot corrosion Type I/II, creep, TBC degradation), steam turbines (SCC, SPE, LP blade pitting), wind turbines (blade delamination, leading edge erosion, gearbox fatigue), boiler/HRSG (tube thinning, hydrogen damage, creep, FAC)
- **8 component types** with OEM-aligned inspection intervals (24,000 EOH for gas turbine hot section, 60,000 hours for steam turbine, annual for wind)
- References: EPRI, GE GER, AGMA, IEC 61400, DNV-ST-0376

### Maritime/Offshore (DEPLOY241)
- **12 damage mechanisms** across hull structure, offshore platforms, subsea, coatings, mooring
- **6 survey types**: annual, intermediate, special/class renewal, in-water survey, offshore periodic, subsea inspection (GVI/CVI/NDT)
- Classification body coverage: ABS, DNV, Lloyd's Register, Bureau Veritas, ClassNK, RINA
- IACS unified requirements, IMO PSPC coating standards

### Civil Infrastructure (DEPLOY242)
- **15 deterioration mechanisms** across concrete (chloride corrosion, carbonation, ASR, freeze-thaw, sulfate attack), steel bridges (fatigue at details, section loss, gusset plate distress), prestressed concrete (tendon corrosion, wire break), substructure (scour, settlement), tunnels, dams
- **6 structure types** with regulatory inspection intervals: highway bridges (24-month NBIS), railroad bridges (12-month FRA), tunnels (24-month NTIS), dams (annual FERC)
- NBI condition rating (0-9) built into case assessment
- References: AASHTO, FHWA, ACI, FERC, FEMA, USACE

### Space Systems (DEPLOY243)
- **11 damage mechanisms** across thermal protection (TPS degradation), propulsion (cryogenic embrittlement, HEE, combustion erosion), structural (launch vibration fatigue, COPV stress rupture), on-orbit (MMOD impact, atomic oxygen, radiation, thermal distortion), ground support (launch pad corrosion)
- **5 system types**: launch vehicle, crewed spacecraft, satellite, rocket engine, GSE
- NASA fracture control classification (fracture_critical, mission_critical, standard)
- References: NASA-STD-5009, NASA-STD-5019, ECSS, MIL-STD

### Medical/Bio (DEPLOY246)
- **12 failure modes** across metallic implants (fatigue fracture, corrosion/metal ion release, bearing wear), polymer devices (degradation, delamination), cardiovascular (stent fatigue, heart valve calcification, cardiac lead failure), sterilization (process failure, biocompatibility), surgical instruments, active electronics
- **7 device classifications** covering both FDA (Class I/II/III) and EU MDR (Class I/IIa/IIb/III)
- Regulatory action logic: MDR reporting triggers (21 CFR 803), CAPA requirements (21 CFR 820.90), EU vigilance (Article 87)
- References: ISO 10993, ISO 13485, ISO 14971, 21 CFR 820, EU MDR 2017/745

---

## 5. CROSS-CUTTING CAPABILITIES

### Robotics/Automation Integration (DEPLOY244)
- **8 robotic platform types**: visual drone, thermal drone, contact UT drone, magnetic wall crawler, internal pipe crawler, subsea ROV, AUV, automated UT/PA scanner
- **5 scan plan templates**: tank shell survey, pipe weld scan, aerial visual, subsea GVI, internal pipe survey
- **ADR (Automated Defect Recognition) framework**: 10 defect classes, 4-tier confidence (high ≥0.85 auto-accept, medium ≥0.65 flag for review, low ≥0.40 manual review, reject <0.40 discard)
- Critical defects require 0.92+ confidence for auto-accept (elevated threshold)
- Sensor data ingestion with auto-statistics (min/max/avg/std deviation, anomaly detection)

### Human Intelligence Layer (DEPLOY245)
- **10 certification schemes**: ASNT SNT-TC-1A, CP-189, ACCP, ISO 9712, NAS 410, API 510/570/653, AWS CWI, CSWIP
- **14 NDT methods** tracked: UT, RT, MT, PT, VT, ET, AE, IR, LT, PAUT, TOFD, GPR, MFL, ACFM
- **7 weighted performance factors**: detection rate (0.25), false call rate (0.20), sizing accuracy (0.15), reporting quality (0.15), procedure compliance (0.10), timeliness (0.10), safety compliance (0.05)
- **5 competency grades**: needs_improvement (<0.6), developing (0.6-0.7), competent (0.7-0.8), proficient (0.8-0.9), expert (0.9+)
- Training gap analysis, certification expiry tracking, inspector-to-case assignment recommendations

---

## 6. DATA MODEL

### Core Tables (Supabase PostgreSQL)
- `inspection_cases` — case metadata, component, method, status, org_id
- `findings` — individual findings linked to cases, severity, description
- `evidence` — files, sensor data, images linked to cases
- `code_sets` — applicable code references per case
- `audit_events` — immutable event log with hash chain
- `audit_bundles` — HMAC-signed exportable audit packages
- `org_signing_keys` — organization-level signing keys for audit bundles
- `inspector_adjudications` — non-destructive override records
- `escalation_queue` — escalation workflow with SLA tracking
- `organizations` — multi-tenant org management
- `user_roles` — RBAC role assignments per user per org

### Key Design Decisions
- All tables have `org_id` for multi-tenant isolation
- RLS policies enforce tenant boundaries at the database level
- Audit events are append-only (no updates, no deletes)
- Inspector adjudications are parallel records (original decision never modified)
- Evidence table supports both file references and structured sensor data (JSON metadata)

---

## 7. TECHNICAL SPECIFICATIONS

### Stack
- **Frontend**: React + Vite + TypeScript
- **Backend**: Netlify Functions (serverless TypeScript)
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase Auth
- **Hosting**: Netlify (auto-deploy from GitHub)

### Code Style (House Rules)
- `@ts-nocheck` at top of all function files
- `var` only (no `let`/`const`)
- String concatenation only (no template literals/backticks)
- POST-only APIs with action-based routing
- All engines return JSON with CORS headers

### API Pattern
Every engine follows the same pattern:
```
POST /api/{engine-name}
Content-Type: application/json

{ "action": "verb", ...params }
```
Standard actions: `get_registry` (returns engine metadata), `assess_case` (full case assessment), plus domain-specific actions.

---

## 8. WHAT THIS SYSTEM IS NOT

- **Not an AI chatbot** — decisions are deterministic physics-based calculations, not LLM outputs
- **Not a document manager** — it's a decision engine that happens to generate reports
- **Not a simple CRUD app** — it has cryptographic audit trails, code authority hierarchies, and non-destructive decision architecture
- **Not a single-industry tool** — it spans 8 industries with 113+ damage mechanisms
- **Not a prototype** — 39 engines are live in production, all passing system checks

---

## 9. DAMAGE MECHANISM COVERAGE SUMMARY

| Industry | Mechanisms | Key Standards |
|----------|------------|---------------|
| Chemical/Process | 20 | API 571, API 510/570/653 |
| Nuclear | 8 + 4 ISI classes | ASME XI, 10 CFR, NRC Reg Guides |
| Aerospace | 9 + 5 structure categories | FAR 25.571, MSG-3, AC 20-107B |
| Power Generation | 16 + 8 component types | EPRI, ASME, AGMA, IEC 61400 |
| Maritime/Offshore | 12 + 6 survey types | IACS, DNV, ABS, IMO PSPC |
| Civil Infrastructure | 15 + 6 structure types | AASHTO, FHWA, ACI, FERC |
| Space Systems | 11 + 5 system types | NASA-STD, ECSS, MIL-STD |
| Medical/Bio | 12 + 7 device classes | FDA 21 CFR, EU MDR, ISO 13485 |
| **TOTAL** | **113+ mechanisms** | **50+ referenced standards** |

---

## 10. COMPETITIVE LANDSCAPE CONTEXT

The NDT software market is dominated by:
- **Data collection tools** (Creaform, Eddyfi) — hardware-focused, no decision logic
- **Asset management platforms** (Meridium/APM, Maximo) — ERP-style, not inspection-specific
- **Simple reporting tools** — fill-in-the-blank forms, no intelligence

FORGED NDT is different because:
1. **Deterministic decision engine** — not a form filler, not an AI chatbot
2. **Code authority hierarchy** — resolves conflicting standards automatically
3. **Non-destructive decisions** — inspector overrides don't erase system decisions
4. **Cryptographic audit trail** — HMAC-signed, hash-chain-linked, independently verifiable
5. **8 industry verticals** — no competitor covers this breadth with this depth
6. **113+ damage mechanisms** — each with material/component/keyword matching and severity scoring
7. **Solo founder build** — entire system designed and deployed by one person

---

## EVALUATION REQUEST

Score this system honestly. Identify what's genuinely elite, what's genuinely risky, and what should be built next. Consider this from the perspective of: (a) a technical architect, (b) a potential enterprise customer, (c) a potential investor, and (d) a regulatory auditor.
