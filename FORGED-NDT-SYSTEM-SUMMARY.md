# FORGED NDT Intelligence OS — System Summary

**Version:** FORGED-NDT/2.0.0
**Date:** April 19, 2026
**Status:** 51 engines operational, 51/51 PASS
**Live URL:** https://4dndt.netlify.app
**System Check:** https://4dndt.netlify.app/system-check.html

---

## 1. What This System Is

FORGED NDT Intelligence OS is a full-stack inspection intelligence platform for Non-Destructive Testing (NDT). It ingests inspection cases, applies deterministic engineering logic across 51 specialized engines, and produces auditable decisions — from initial case intake through predictive remaining life estimation.

The platform was built by a single developer. There is no team. The system is designed so that one person with this platform has more analytical capability than a traditional team of inspectors, engineers, and analysts working without it.

The architecture is deterministic-first: 48 of 51 engines use zero AI and produce repeatable, auditable outputs from the same inputs every time. The remaining 3 engines (similar-cases, run-analysis, observation-layer) use AI assistance for natural language tasks but are wrapped in deterministic audit trails.

---

## 2. Tech Stack

**Frontend:** React 18 + Vite + TypeScript, single-page application
- 6 pages: Dashboard, Cases, CaseDetail, NewCase, Login, VoiceInspectionPage
- 11 specialized components: DecisionSpineCard, MaterialAuthorityCard, CompositeRepairCard, OutcomeSimulationCard, UniversalCodeAuthorityCard, EnterpriseAuditCard, InspectorAdjudicationCard, PlannerAgentCard, EscalationQueueCard, CaseSearchPanel, SimilarCasesPanel
- Error Boundary wrapping entire app (prevents black screens from runtime errors)
- ~7,000 lines of frontend code

**Backend:** 79 Netlify Functions (serverless), TypeScript
- POST-only REST API, action-based routing: `{ action: "verb", ...params }`
- ~47,700 lines of backend code
- No backtick templates (string concatenation only for deployment compatibility)
- `@ts-nocheck` headers (pragmatic choice for rapid development)
- `var` declarations only (no let/const — deployment stability)

**Database:** Supabase (PostgreSQL)
- Row Level Security (RLS) on every table with org_id isolation
- Policy pattern: `org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid`
- Read-only policies for global config tables without org_id
- Service role key for backend, JWT-based auth for frontend

**Auth:** Supabase Auth with JWT
- Org isolation extracted from `app_metadata.org_id` in JWT
- RBAC engine (DEPLOY234) for fine-grained permissions

**Deployment:** GitHub → Netlify (auto-deploy on push)
- Developer pastes files into GitHub web editor
- Netlify builds and deploys automatically
- SQL migrations run manually in Supabase SQL Editor

**Infrastructure:** Zero-ops
- No Docker, no Kubernetes, no CI/CD pipelines beyond Netlify
- No server management, no scaling configuration
- Netlify handles CDN, SSL, function execution
- Supabase handles database, auth, realtime

---

## 3. Architecture Philosophy

### Deterministic-First
Every decision the system makes can be traced back to explicit rules and data. No black boxes. When the system says "reject this weld," it can show exactly which code clause, what threshold, what measurement, and what rule chain led to that decision.

### Action-Based Routing
Every engine exposes a single POST endpoint. The `action` field in the request body determines what the engine does. This keeps URLs clean and makes it trivial to add capabilities without new endpoints.

Example:
```
POST /api/cost-reasoning-engine
{ "action": "calculate_cost_scenarios", "case_id": "..." }
```

### Org Isolation
Every row in every table belongs to an org. Every query is filtered by org_id. There is no way for one organization's data to leak to another. This is enforced at the database level via RLS, not just application logic.

### Audit Everything
Every engine that mutates data writes to an audit table. The enterprise audit system (DEPLOY223) provides cryptographic chain verification. The decision traceability engine (DEPLOY248) links every decision back to its inputs.

### Self-Describing Engines
Every engine responds to `{ action: "get_registry" }` with its capabilities, version, and status. The health endpoint aggregates all 51 engines into a single registry. The system-check page tests every endpoint automatically.

---

## 4. Complete Engine Registry (51 Engines)

### Core Engines (DEPLOY074–167)
| # | Engine | Deploy | Mode | Purpose |
|---|--------|--------|------|---------|
| 1 | decision-core | DEPLOY167 | deterministic | Central decision logic for case evaluation |
| 2 | engineering-core | DEPLOY167 | deterministic | Engineering calculations and physics models |
| 3 | truth-engine | DEPLOY167 | deterministic | Fact verification and consistency checking |
| 4 | planner-agent | DEPLOY167 | deterministic | Inspection planning and task sequencing |
| 5 | governance-matrix | DEPLOY074 | deterministic | Regulatory compliance governance rules |

### Authority Engines (DEPLOY216–226)
| # | Engine | Deploy | Mode | Purpose |
|---|--------|--------|------|---------|
| 6 | run-authority | DEPLOY216 | hybrid | Master authority for inspection run decisions |
| 7 | export-audit-bundle | DEPLOY216 | deterministic | Packages complete audit trail for export |
| 8 | composite-repair-authority | DEPLOY218 | deterministic | Composite material repair decision logic |
| 9 | material-authority | DEPLOY219 | deterministic | Material specification and selection authority |
| 10 | decision-spine | DEPLOY220 | deterministic | Decision pathway routing and orchestration |
| 11 | outcome-simulation | DEPLOY221 | deterministic | What-if scenario modeling for outcomes |
| 12 | universal-code-authority | DEPLOY222 | deterministic | Multi-standard code lookup (ASME, API, AWS, ISO) |
| 13 | enterprise-audit | DEPLOY223 | deterministic | Immutable audit trail with chain verification |
| 14 | verify-audit-chain | DEPLOY223 | deterministic | Cryptographic audit chain integrity checks |
| 15 | health | DEPLOY225 | deterministic | System health check, engine registry, DB status |
| 16 | inspector-adjudication | DEPLOY226 | deterministic | Inspector disagreement resolution workflow |

### AI-Assisted Engines
| # | Engine | Deploy | Mode | Purpose |
|---|--------|--------|------|---------|
| 17 | similar-cases | DEPLOY200 | ai_assisted | Finds similar historical cases using embeddings |
| 18 | run-analysis | core | ai_assisted | Natural language analysis of inspection data |
| 19 | observation-layer | core | ai_assisted | Observation extraction and classification |

### Enterprise Layer (DEPLOY227–236)
| # | Engine | Deploy | Mode | Purpose |
|---|--------|--------|------|---------|
| 20 | case-search | DEPLOY227 | deterministic | Advanced filtering, sorting, full-text search |
| 21 | escalation-workflow | DEPLOY228 | deterministic | Multi-tier escalation with SLA tracking |
| 22 | trend-analytics | DEPLOY229 | deterministic | Time-series trends, executive summaries |
| 23 | notifications | DEPLOY230 | deterministic | Event-driven notification system |
| 24 | compliance-matrix | DEPLOY231 | deterministic | Multi-standard compliance tracking |
| 25 | risk-scoring | DEPLOY232 | deterministic | Quantitative risk scoring and ranking |
| 26 | inspection-report | DEPLOY233 | deterministic | Automated report generation with templates |
| 27 | rbac | DEPLOY234 | deterministic | Role-based access control and permissions |
| 28 | validation-engine | DEPLOY235 | deterministic | Data validation rules and scenario testing |
| 29 | data-ingestion | DEPLOY236 | deterministic | Field mapping, CSV/bulk import pipeline |

### Industry Verticals (DEPLOY237–246)
| # | Engine | Deploy | Mode | Purpose |
|---|--------|--------|------|---------|
| 30 | chemical-process | DEPLOY237 | deterministic | Chemical/process industry damage mechanisms |
| 31 | nuclear-vertical | DEPLOY238 | deterministic | Nuclear regulatory compliance (10 CFR 50) |
| 32 | aerospace-vertical | DEPLOY239 | deterministic | Aerospace standards (FAA, EASA, AS9100) |
| 33 | power-generation | DEPLOY240 | deterministic | Power plant inspection standards |
| 34 | maritime-offshore | DEPLOY241 | deterministic | Maritime/offshore classification rules |
| 35 | civil-infrastructure | DEPLOY242 | deterministic | Bridges, tunnels, structural inspection |
| 36 | space-systems | DEPLOY243 | deterministic | Space-grade inspection requirements |
| 37 | robotics-automation | DEPLOY244 | deterministic | Automated/robotic inspection integration |
| 38 | human-intelligence | DEPLOY245 | deterministic | Human factors, inspector performance tracking |
| 39 | medical-bio | DEPLOY246 | deterministic | Medical device and biomedical inspection |

### Advanced Intelligence (DEPLOY247–253)
| # | Engine | Deploy | Mode | Purpose |
|---|--------|--------|------|---------|
| 40 | validation-benchmark | DEPLOY247 | deterministic | Benchmarking engine accuracy against known outcomes |
| 41 | decision-traceability | DEPLOY248 | deterministic | Full decision lineage from input to output |
| 42 | rules-version-control | DEPLOY249 | deterministic | Rule versioning, diff, rollback |
| 43 | evidence-integrity | DEPLOY250 | deterministic | Evidence chain of custody and tamper detection |
| 44 | enterprise-operations | DEPLOY251 | deterministic | Multi-site operations dashboard |
| 45 | concept-intelligence-core | DEPLOY252 | deterministic | Concept activation and reliability tracking |
| 46 | concept-intelligence-v21 | DEPLOY253 | deterministic | Enhanced concept engine with calibration |

### "Smarter Than a Team" Stack (DEPLOY254–258)
| # | Engine | Deploy | Mode | Purpose |
|---|--------|--------|------|---------|
| 47 | cost-reasoning-engine | DEPLOY254 | deterministic | Cost/benefit analysis, ROI, value-of-information |
| 48 | outcome-tracking | DEPLOY255 | deterministic | Prediction vs. actual outcome feedback loop |
| 49 | cross-case-patterns | DEPLOY256 | deterministic | Pattern recognition across thousands of cases |
| 50 | process-data-integration | DEPLOY257 | deterministic | Sensor/process data correlation with findings |
| 51 | predictive-remaining-life | DEPLOY258 | deterministic | Remaining life estimation, fleet risk management |

---

## 5. Database Schema

### Core Tables
- `inspection_cases` — Central case records (asset, method, status, findings summary)
- `findings` — Individual findings per case (type, severity, location, measurements)
- `evidence` — Photos, documents, measurement data attached to cases
- `code_sets` — Multi-standard code library (ASME, API, AWS, ISO, EN)

### Audit & Governance
- `audit_events` — Immutable event log with chain hashes
- `audit_bundles` — Packaged audit exports
- `org_signing_keys` — Cryptographic signing keys per org
- `inspector_adjudications` — Disagreement resolution records

### Enterprise
- `escalation_events`, `escalation_rules` — Escalation workflow
- `notification_events`, `notification_preferences` — Notification system
- `compliance_requirements`, `compliance_assessments` — Compliance tracking
- `risk_scores`, `risk_configurations` — Risk scoring
- `report_templates`, `generated_reports` — Report generation
- `roles`, `permissions`, `role_permissions` — RBAC
- `validation_rules`, `validation_results` — Data validation
- `ingestion_mappings`, `ingestion_jobs` — Data import

### Concept Intelligence (DEPLOY252–253)
- `concept_registry` — Registered engineering concepts
- `concept_runs` — Concept activation records
- `concept_activations` — Individual concept triggers
- `concept_reliability_scores` — Accuracy tracking per concept
- `concept_calibration_profiles` — Calibration parameters
- Plus 8 additional concept intelligence tables

### Cost Reasoning (DEPLOY254)
- `cost_models` — 15 seeded cost calculation models
- `failure_cost_profiles` — 9 failure cost templates
- `inspection_cost_profiles` — 11 inspection cost templates
- `case_cost_scenarios` — Per-case cost analysis
- `cost_decision_outputs` — ROI and VOI calculations
- `cost_assumption_profiles` — Configurable assumptions
- `cost_timeline_projections` — Multi-horizon cost projections
- `cost_audit_events` — Audit trail

### Outcome Tracking (DEPLOY255)
- `outcome_records` — Actual outcomes vs. predictions
- `prediction_accuracy` — Prediction scoring
- `cost_accuracy` — Cost estimate accuracy
- `inspection_effectiveness` — Method effectiveness tracking
- `concept_accuracy` — Concept activation accuracy
- `outcome_calibration_queue` — Auto-calibration triggers
- `outcome_audit_events` — Audit trail

### Cross-Case Patterns (DEPLOY256)
- `pattern_clusters` — Discovered pattern groups
- `pattern_case_members` — Cases belonging to clusters
- `pattern_rules` — Extracted pattern-based rules
- `pattern_alerts` — Auto-generated pattern match alerts
- `pattern_statistics` — Dimensional statistics
- `pattern_audit_events` — Audit trail

### Process Data Integration (DEPLOY257)
- `process_data_sources` — Registered sensors and data feeds
- `process_data_readings` — Time-series sensor readings
- `process_exceedance_events` — Threshold violation records
- `process_case_correlations` — Process-to-case links
- `process_exposure_summaries` — Operating condition profiles
- `process_audit_events` — Audit trail

### Predictive Remaining Life (DEPLOY258)
- `degradation_models` — 10 seeded industry-standard models (API 581, ASME, API 941, API 579)
- `asset_condition_records` — Point-in-time measurement history
- `life_predictions` — Remaining life estimates with confidence bounds
- `inspection_schedule_recommendations` — Optimized inspection intervals
- `risk_projections` — Forward-looking probability-of-failure curves
- `prl_audit_events` — Audit trail

---

## 6. Key Capabilities in Detail

### Cost Reasoning Engine (DEPLOY254)
Deterministic cost/benefit analysis for every inspection decision:
- **Expected Cost** = P(failure) x Failure Cost Total
- **Value of Information (VOI)** = Expected Cost Before - Expected Cost After - Inspection Cost
- **ROI** = (Avoided Cost - Action Cost) / Action Cost
- Multi-horizon projections: immediate, 3-month, 12-month, 36-month
- Authority integration: HOLD/ESCALATE states apply probability floors
- Executive summary auto-generation with dollar formatting

### Outcome Tracking (DEPLOY255)
Closes the feedback loop — records what actually happened vs. what the system predicted:
- Auto-calibration triggers when cost variance > 25%
- Method effectiveness tracking (flags methods below 40% effectiveness)
- Concept reliability scoring with auto-queued recalibration
- Accuracy dashboard aggregating prediction, cost, inspection, and concept accuracy

### Cross-Case Pattern Recognition (DEPLOY256)
Finds patterns across thousands of cases that no single inspector would see:
- Clusters cases by 5 dimensions: asset_type, method, environment, material_class, vertical
- Cross-dimension combo detection
- Similarity scoring for new case matching
- Auto-alerts when match score > 60%
- Emerging trend detection: finds dimensions with rejection rates elevated vs. baseline
- Severity grading: critical (3+ cases, 70%+ rejection), high (3+, 50%+), medium (5+, 30%+), low (10+, 10%+)

### Process Data Integration (DEPLOY257)
Connects live sensor data to inspection findings:
- Supports sensors, historians, SCADA, DCS, IoT data sources
- Bulk time-series ingestion with auto-exceedance detection
- 6-tier threshold system: critical_high/low, alarm_high/low, above/below_normal
- Case correlation: analyzes readings in lookback window, scores correlation strength
- Operating regime classification: normal, stressed, alarm, critical
- Severity scoring based on exceedance count, time in abnormal regimes, coefficient of variation

### Predictive Remaining Life (DEPLOY258)
The capstone — estimates when components will fail:
- Observed degradation rate from 2+ condition readings
- Fallback to industry-standard models (API 581, ASME BPVC, API 941, API 579)
- Acceleration factors: temperature, pressure, cyclic loading, environment
- Process data factor integration (from DEPLOY257)
- Confidence bounds (+/- 20% rate variation)
- S-curve probability of failure projection
- Risk classification: critical (<6mo), high (<12mo), medium (<36mo), low (<60mo), very_low (60+)
- Optimized inspection scheduling: urgent (3mo), high (6mo), routine (12-24mo), low (36mo)
- Fleet overview: all monitored assets ranked by risk, urgent inspection queue

---

## 7. Security Model

- **Row Level Security (RLS):** Every table. No exceptions. Org isolation at the database level.
- **JWT-based auth:** Supabase Auth with org_id in app_metadata.
- **Service role backend:** Functions use service role key, extract org from JWT for filtering.
- **Cryptographic audit chains:** Enterprise audit (DEPLOY223) with signing keys and chain verification.
- **Evidence integrity:** DEPLOY250 provides chain-of-custody and tamper detection for evidence.
- **RBAC:** DEPLOY234 with role-permission matrix, fine-grained action control.
- **No secrets in code:** Environment variables for all credentials.
- **.gitignore:** Excludes .env, node_modules, dist, .vscode, .netlify.

---

## 8. Frontend Architecture

- **React 18** with functional components and hooks
- **Error Boundary** wrapping entire app — catches runtime crashes, shows recovery UI
- **Supabase Auth integration** — useAuth() hook for session management
- **`.maybeSingle()`** everywhere — graceful null handling (no crashes on missing data)
- **Null-safe rendering** — all display fields use fallback values (e.g., `source || "unknown"`)
- **Action-based API calls** — all backend communication via POST with action routing

### Pages
1. **Dashboard** — Overview metrics, recent cases, system health
2. **Cases** — Case list with search, filtering, sorting
3. **CaseDetail** — Full case view with tabs: Physics Model, Findings, Authority decisions, Audit trail
4. **NewCase** — Case creation form
5. **Login** — Authentication
6. **VoiceInspectionPage** — Voice-driven inspection data entry

### Key Components
- DecisionSpineCard, MaterialAuthorityCard, CompositeRepairCard — Authority decision displays
- OutcomeSimulationCard — What-if scenario visualization
- UniversalCodeAuthorityCard — Code lookup results
- EnterpriseAuditCard — Audit chain display
- InspectorAdjudicationCard — Disagreement resolution UI
- PlannerAgentCard — Inspection planning
- CaseSearchPanel — Advanced search interface
- SimilarCasesPanel — Similar case recommendations
- EscalationQueueCard — Escalation workflow management

---

## 9. Codebase Statistics

| Metric | Count |
|--------|-------|
| Backend functions | 79 files |
| Backend code | ~47,700 lines |
| Frontend code | ~7,000 lines |
| Total code | ~54,700 lines |
| Registered engines | 51 |
| Deterministic engines | 48 (94%) |
| AI-assisted engines | 3 (6%) |
| SQL migrations | 9 migration files |
| Database tables | 80+ tables |
| Industry verticals | 10 |
| Seeded degradation models | 10 |
| Seeded cost models | 15 |
| Seeded failure profiles | 9 |
| Seeded inspection profiles | 11 |
| System check endpoints | 51 |

---

## 10. What Makes This Different

1. **Deterministic-first:** 94% of engines use zero AI. Every decision is traceable, repeatable, and auditable. AI is used only where natural language processing is genuinely needed.

2. **Single-developer scale:** 51 engines, 80+ tables, 10 industry verticals, ~55,000 lines of code — built and operated by one person. The platform compensates for team size with systematic automation.

3. **Full decision lineage:** From raw sensor data through pattern recognition, cost analysis, outcome tracking, to predictive life estimation — every step is recorded and traceable.

4. **Self-correcting:** The outcome tracking engine (DEPLOY255) compares predictions to actual outcomes and auto-queues recalibration when accuracy drops. The system gets smarter over time without manual intervention.

5. **Cross-case intelligence:** The pattern recognition engine (DEPLOY256) sees connections across thousands of cases that no individual inspector could. "Every time we see fatigue cracking on pipeline attachment welds in marine environments, CUI follows within 18 months."

6. **Predictive capability:** The remaining life engine (DEPLOY258) shifts the platform from reactive ("here's what we found") to predictive ("here's what's coming and when"). Uses industry-standard degradation models (API 581, ASME BPVC) with observed rate correction.

7. **Process data fusion:** Unlike traditional NDT platforms that only look at inspection snapshots, DEPLOY257 correlates operating conditions (temperature, pressure, vibration) with findings — answering "why did this fail?" not just "what failed?"

8. **Zero-ops infrastructure:** Netlify + Supabase means no servers to manage, no scaling to configure, no DevOps overhead. The entire platform runs on managed services with automatic SSL, CDN, and database backups.

---

## 11. Deployment Model

Each engine follows an identical deployment pattern:

1. **SQL Migration** — Run in Supabase SQL Editor (creates tables, indexes, RLS policies, seed data)
2. **Netlify Function** — Paste TypeScript file to GitHub (auto-deploys)
3. **Health Registry** — Update health.ts with new engine entry
4. **System Check** — Update system-check.html with new test endpoint
5. **Verify** — Visit system-check page, confirm all engines PASS

This pattern has been executed 51 times without a CI/CD pipeline. The entire deployment process is manual paste-to-GitHub, which eliminates build tooling complexity at the cost of requiring careful file management.

---

## 12. API Pattern

Every engine follows the same contract:

**Request:**
```json
POST /api/{engine-name}
Content-Type: application/json

{
  "action": "action_name",
  "param1": "value",
  "param2": "value"
}
```

**Response:**
```json
{
  "field1": "value",
  "field2": "value"
}
```

**Standard actions available on all engines:**
- `get_registry` — Returns engine name, version, status, and capability list

**Error format:**
```json
{
  "error": "descriptive error message"
}
```

**HTTP status codes:**
- 200: Success
- 400: Bad request / missing params
- 404: Resource not found
- 405: Method not allowed (non-POST)
- 500: Internal error
- 502/503: Service unavailable

---

*This document describes the FORGED NDT Intelligence OS as of April 19, 2026. System version FORGED-NDT/2.0.0 with 51 operational engines.*
