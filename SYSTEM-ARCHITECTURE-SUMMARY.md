# FORGED NDT Intelligence OS — System Architecture Summary

**Version:** FORGED-NDT/2.0.0
**Build Date:** 2026-04-16
**Total Engines:** 25 deployed and verified
**Total Netlify Functions:** 65+
**Database:** Supabase (PostgreSQL + Auth + RLS)
**Frontend:** React/Vite/TypeScript
**Backend:** Netlify Functions (serverless, esbuild-bundled)
**Live URL:** https://4dndt.netlify.app

---

## System Overview

FORGED NDT Intelligence OS is a deterministic, physics-first inspection decision platform for non-destructive testing (NDT). The system ingests inspection data, applies engineering codes and standards, produces auditable decisions, and provides human override capability at every stage.

Every system decision is traceable, every override is recorded, and every action is logged to a tamper-proof audit chain. The system never silently modifies decisions — inspector overrides live alongside system decisions, not in place of them.

---

## Engine Registry (25 Engines)

### Core Engines (DEPLOY167)
1. **decision-core** — Physics-first decision engine. Evaluates inspection data against material properties and engineering limits. Deterministic.
2. **engineering-core** — Engineering calculations: stress analysis, remaining thickness, corrosion rates, fitness-for-service math.
3. **truth-engine** — Cross-validates decisions against multiple data sources. Flags contradictions.
4. **planner-agent** — Generates inspection plans: what to inspect, when, what method, priority.

### AI-Assisted Engines (Core)
5. **run-analysis** — AI-assisted analysis of inspection data with structured reasoning.
6. **observation-layer** — AI observation and pattern recognition across inspection evidence.
7. **similar-cases** (DEPLOY200) — Finds historically similar cases for comparison.

### Authority Engines
8. **run-authority** (DEPLOY216) — Final authority lock on dispositions. Hybrid mode (deterministic rules + AI reasoning). Produces locked, immutable decisions.
9. **material-authority** (DEPLOY219) — Material identification and property verification. Maps materials to families, validates specifications.
10. **composite-repair-authority** (DEPLOY218) — Evaluates composite repair feasibility per ASME PCC-2 and ISO 24817.
11. **governance-matrix** (DEPLOY074) — Maps jurisdictional requirements, service environments, and applicable code hierarchy.
12. **universal-code-authority** (DEPLOY222) — 5-tier code precedence engine: Regulatory > Jurisdictional > Industry Code > Owner Specification > Best Practice. Identifies governing codes, applicable clauses, and conflicts.
13. **export-audit-bundle** (DEPLOY216) — Exports signed audit bundles for external review.

### Decision Architecture
14. **decision-spine** (DEPLOY220) — Orchestrates all deterministic engines into a unified decision. Calls Decision Core, Engineering Core, Material Authority, Run Authority, Code Authority, Governance Matrix. Returns composite decision with confidence score and contributing engine list.
15. **outcome-simulation** (DEPLOY221) — Predictive twins. Simulates outcomes for each possible disposition (repair, replace, monitor, accept). Projects risk curves, cost estimates, remaining life under each scenario.

### Audit & Compliance
16. **enterprise-audit** (DEPLOY223) — Append-only audit event logging. Records who did what, when, from which engine. 25+ event types across 11 categories.
17. **verify-audit-chain** (DEPLOY223) — Walks the complete audit bundle chain for a case. Verifies HMAC-SHA256 hash integrity, signature validity, chain links, and version sequence. Updates case chain_valid flag.
18. **compliance-matrix** (DEPLOY231) — Evaluates regulatory compliance per case. Maps to 6 standards (API 579, API 510, API 570, ASME PCC-2, ASME B31.3, ISO 24817) with 33 total requirements. Auto-detects applicable standards from case data.

### Human Oversight
19. **inspector-adjudication** (DEPLOY226) — Three adjudication types: CONCUR (agree with system), OVERRIDE (disagree with alternative decision), ESCALATE (flag for senior review). Every adjudication captures a snapshot of the system state at that moment. System decisions are never modified — inspector decisions live alongside them.
20. **escalation-workflow** (DEPLOY228) — Manages escalation lifecycle: open > assigned > in_review > resolved. Auto-deadlines by priority (routine=7d, elevated=3d, urgent=24h, emergency=4h). Resolution types: upheld, overturned, modified, deferred.

### Analytics & Intelligence
21. **case-search** (DEPLOY227) — Full-text and filtered search across all cases. 15+ filter dimensions: material, asset type, inspection method, damage type, date range, severity, confidence, override status. Paginated results. Aggregate analytics with breakdowns by any dimension. Dynamic filter options from live data.
22. **trend-analytics** (DEPLOY229) — Time-series analysis: failure trends, repeat offender components, damage type trends, inspection method effectiveness, confidence trajectory, executive summary with 30-day velocity.
23. **risk-scoring** (DEPLOY232) — Composite risk scoring with 8 weighted factors: severity (25%), confidence gap (15%), damage type (15%), override risk (10%), escalation risk (10%), finding density (10%), age risk (10%), compliance risk (5%). Produces ranked risk list and 5x5 risk matrix.

### System Operations
24. **health** (DEPLOY225) — Production health check. Verifies environment, database connectivity, all critical tables, signing keys, case counts, and returns complete engine registry.
25. **notifications** (DEPLOY230) — In-app notification system. Send, bulk send, inbox, read/dismiss, per-user preferences. 13 event types with severity levels. Supports future email digest integration.

---

## Database Schema

### Core Tables
- **inspection_cases** — Central case table. Contains case metadata, system decisions (state, disposition, confidence), inspector overrides, escalation status, audit chain status, and all searchable fields (material, asset_type, inspection_method, damage_type, severity, component_name).
- **findings** — Individual inspection findings linked to cases.
- **evidence** — Evidence items (documents, images, measurements) linked to cases and findings.

### Code & Standards
- **code_sets** (DEPLOY222) — Governing codes assigned to cases with tier/precedence tracking.

### Audit System
- **audit_events** (DEPLOY223) — Append-only event log. INSERT-only RLS (no UPDATE, no DELETE). Records every action with actor, timestamp, event type, and metadata.
- **audit_bundles** (DEPLOY223) — Signed audit packages. HMAC-SHA256 hashed with chain linking. Each bundle references the previous bundle's hash for tamper detection.
- **org_signing_keys** (DEPLOY223) — Cryptographic signing keys for audit bundles.

### Human Oversight
- **inspector_adjudications** (DEPLOY226) — Every inspector concur/override/escalate with rationale, system state snapshot, and agreement rate tracking.
- **escalation_queue** (DEPLOY228) — Escalation lifecycle tracking with priority, deadline, assignment, and resolution.

### Notifications
- **notifications** (DEPLOY230) — Notification inbox with severity, read/dismiss status, case linking, and action URLs.
- **notification_preferences** (DEPLOY230) — Per-user notification settings by event category.

### Indexes
- 14+ performance indexes on inspection_cases for search (status, disposition, state, material, asset_type, inspection_method, damage_type, severity, confidence, override status, created_at).
- Composite indexes for common query patterns (status+date, method+material).

---

## Security Architecture

### Row Level Security (RLS)
Every table has RLS enabled with appropriate policies:
- **Audit tables**: INSERT-only for authenticated users. No UPDATE or DELETE. Prevents tampering.
- **Core tables**: Full CRUD for authenticated users.
- **Service role**: Bypass for server-side operations.

### Audit Chain Integrity
- Every audit bundle is HMAC-SHA256 signed using org signing keys.
- Each bundle's hash includes the previous bundle's hash (chain linking).
- Verification walks the full chain and checks: hash integrity, signature validity, chain continuity, version sequence.
- Broken chains are flagged and logged as audit events.

### Non-Destructive Architecture
- System decisions are NEVER modified by inspector actions.
- Inspector overrides create parallel records (inspector_final_decision, inspector_override_active).
- The "effective decision" is computed at read time based on override status.
- Full system state is snapshotted at every adjudication point.

---

## API Design

All endpoints follow a consistent pattern:
- **Method**: POST only (GET requests fall through to SPA catch-all)
- **Content-Type**: application/json
- **Action-based routing**: `{ action: "verb", ...params }`
- **CORS**: Open (Access-Control-Allow-Origin: *)
- **Error format**: `{ error: "message" }` with appropriate HTTP status codes
- **Consistency**: Every engine uses var-only, string concatenation only, no template literals

### Standard HTTP Status Codes
- 200: Success
- 400: Bad request (missing parameters, invalid action)
- 404: Resource not found (case doesn't exist)
- 405: Method not allowed (non-POST)
- 500: Internal server error
- 503: Service unavailable (critical health check failure)

---

## Code Authority Hierarchy

Five-tier precedence system (DEPLOY222):
1. **Regulatory** (highest) — Government-mandated codes (API 510, API 570)
2. **Jurisdictional** — Local/regional requirements
3. **Industry Code** — Industry standards (ASME B31.3, API 579)
4. **Owner Specification** — Company-specific requirements
5. **Best Practice** (lowest) — Recommended practices

When codes conflict, higher-tier codes take precedence. Conflicts are explicitly tracked and reported.

---

## Compliance Standards Evaluated

| Standard | Name | Requirements |
|----------|------|-------------|
| API 579-1 | Fitness-For-Service | 7 |
| ASME PCC-2 | Repair of Pressure Equipment | 5 |
| ASME B31.3 | Process Piping | 5 |
| API 510 | Pressure Vessel Inspection | 6 |
| API 570 | Piping Inspection | 6 |
| ISO 24817 | Composite Repairs for Pipework | 4 |

Total: 6 standards, 33 requirements, auto-evaluated per case.

---

## Risk Scoring Model

Weighted composite score (0-1) with 8 factors:

| Factor | Weight | Signal |
|--------|--------|--------|
| Severity | 25% | Case state and disposition severity |
| Confidence gap | 15% | System uncertainty (low confidence = high risk) |
| Damage type | 15% | Inherent danger of damage mechanism (hydrogen/SCC highest) |
| Override risk | 10% | Inspector disagreed with system |
| Escalation risk | 10% | Open or multiple escalations |
| Finding density | 10% | Number of findings per case |
| Age risk | 10% | How long the case has been open |
| Compliance risk | 5% | Compliance evaluation gaps |

Risk levels: critical (0.75+), high (0.55-0.74), medium (0.35-0.54), low (0.15-0.34), minimal (<0.15).

---

## Execution Modes

Every engine operates in one of three modes:
- **Deterministic** — Same inputs always produce same outputs. No AI/LLM involvement. 20 of 25 engines.
- **AI-Assisted** — Uses LLM for pattern recognition and reasoning, but outputs are structured and auditable. 3 engines.
- **Hybrid** — Deterministic rules with AI-assisted reasoning for edge cases. 1 engine (Run Authority).
- **Health/Ops** — System operations. 1 engine (Health).

---

## System Health Monitoring

The health endpoint (DEPLOY225) performs:
1. Environment variable validation
2. Database connectivity check
3. Critical table verification (8 tables)
4. Signing key status check
5. Case count and 7-day activity metrics
6. Full engine registry report (25 engines with deploy version, mode, and path)

Available at: `POST /api/health` (full check) or `POST /api/health { quick: true }` (DB only).

System check page: `https://4dndt.netlify.app/system-check.html`

---

## Deploy History

| Deploy | Component | Type |
|--------|-----------|------|
| Core/DEPLOY167 | Decision Core, Engineering Core, Truth Engine, Planner Agent | Foundation |
| DEPLOY074 | Governance Matrix | Authority |
| DEPLOY200 | Similar Cases | AI-Assisted |
| DEPLOY216 | Run Authority, Export Audit Bundle | Authority |
| DEPLOY218 | Composite Repair Authority | Authority |
| DEPLOY219 | Material Authority | Authority |
| DEPLOY220 | Decision Spine (orchestrator) | Architecture |
| DEPLOY221 | Outcome Simulation (predictive twins) | Intelligence |
| DEPLOY222 | Universal Code Authority | Authority |
| DEPLOY223 | Enterprise Audit + Verify Chain | Audit |
| DEPLOY224 | Type Safety Layer (shared TypeScript interfaces) | Infrastructure |
| DEPLOY225 | Production Health Check | Operations |
| DEPLOY226 | Inspector Adjudication | Human Oversight |
| DEPLOY227 | Case Search & Analytics | Analytics |
| DEPLOY228 | Escalation Workflow | Human Oversight |
| DEPLOY229 | Trend Analytics | Analytics |
| DEPLOY230 | Notification System | Communication |
| DEPLOY231 | Compliance Matrix | Compliance |
| DEPLOY232 | Risk Scoring | Intelligence |

---

## Architecture Principles

1. **Deterministic first** — 80% of engines are fully deterministic. No AI randomness in critical decisions.
2. **Non-destructive** — System decisions are never modified. Inspector overrides are parallel records.
3. **Audit everything** — Every action logged with actor, timestamp, and context. Tamper-proof chain.
4. **Physics-first** — Engineering calculations based on material science, not pattern matching.
5. **Code authority** — Every decision traces back to specific code clauses and requirements.
6. **Human-in-the-loop** — Inspectors can concur, override, or escalate any decision.
7. **Transparency** — Confidence scores, contributing engine lists, and decision rationale exposed at every level.
8. **Composable** — Each engine is independent and stateless. The Decision Spine orchestrates them.
