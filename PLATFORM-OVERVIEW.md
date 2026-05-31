# FORGED 4D NDT Intelligence OS — Platform Overview

Technical reference. Describes what the system does, the processing flow, the engines, and the
cross-cutting guarantees. No marketing language.

## 1. What it is
A decision-support system for non-destructive testing (NDT) and mechanical/asset integrity. It takes
a field inspection scenario (voice transcript or typed text, optionally photos) and produces an
auditable disposition: what the governing risk is, what code authority applies, what the remaining
strength is, what is still unknown, and what action to take — with every safety-critical number
traceable to a deterministic engine.

The design separates two responsibilities:
- **Deterministic engines** own the safety-critical numbers and the disposition (consequence,
  remaining strength, code authority, hold/no-go logic). Same input → same output, every time.
- **A language model (GPT-4o)** is used only for narrative synthesis and is constrained by a
  provenance validator so it cannot introduce a number the engines did not produce.

## 2. End-to-end flow (single-asset / voice path)
1. **Input** — transcript (voice→text or typed). Optional photos.
2. **Field extraction** — `src/lib/fieldExtraction.ts` (canonical, comma-safe, provenance per field)
   + `parse-incident` / `voice-grammar-bridge` extract numeric values (pressures, wall thickness,
   wall loss, diameter, material grade) and qualitative findings. Operating vs design pressure are
   kept distinct; measured wall = minimum of all readings; wall loss computed from nominal−measured
   when not explicitly stated.
3. **Asset resolution** — `resolve-asset` maps the description to an `asset_class` (piping, pressure
   vessel, tank, heat exchanger, bridge, etc.) via an alias database.
4. **Domain classification + gate** — `domain-classifier` assigns the engineering domain and refuses
   unsupported domains (e.g. aircraft, wind) rather than guessing. `reality-lock` can override.
5. **decision-core** (physics-first brain) — the central engine. Produces:
   - `consequence_reality` (tier LOW/MEDIUM/HIGH/CRITICAL, human/environmental impact, basis)
   - `damage_reality` (validated damage mechanisms with severity, API 571-style)
   - `decision_reality` (disposition, hard locks, guided recovery steps)
   - `reality_confidence` (band + numeric, reduced per unresolved critical question)
   - `authority_reality`, `inspection_reality` (sufficiency verdict)
   - Consequence escalation rules: structural-instability + stored energy → CRITICAL; fire + stored
     energy → CRITICAL; toxic/H2S; receptor-exposure amplifier (occupied/populated); offshore manned
     platform + hydrocarbon/toxic medium → CRITICAL; support/secondary-element cascade governance.
6. **authority-lock** — locks the applicable codes by component type (e.g. piping → API 570 + ASME
   B31.3; vessel → API 510 + ASME Section VIII; + API 579 FFS, NACE MR0175 for sour service). A
   component discriminator routes by the described component (e.g. "REAC inlet piping" → piping
   authority, not the served exchanger).
7. **remaining-strength** — B31G / Modified B31G (RSTRENG simplified) Level 1 screening: MAOP, wall
   loss, safe-envelope vs operating pressure. Includes an input-consistency guard: if operating
   pressure exceeds the nominal-wall Barlow capacity at the assumed grade, it flags inconsistent
   inputs (understated material grade) rather than emitting a false pressure-reduction.
8. **failure-mode-dominance (FMD)** — determines the governing failure path and separates:
   `governing_failure_mode` (the confirmed/measured mode, e.g. corrosion), `suspected_governing_
   mechanism` (e.g. fatigue, pending confirmation), and `disposition_driver` (what actually governs
   the hold/decision). Corrosion/cracking/structural paths with confirmation-state logic.
9. **failure-timeline** — progression state and urgency.
10. **future-state-forecaster** — forward-risk trajectory (trend acceleration, rising throughput,
    deferred turnaround); can make an asset acceptable-today but governed-by-forward-risk.
11. **Situational Awareness layer** (see §4).
12. **superbrain-synthesis** (GPT-4o) — failure narrative, contradiction matrix, pre-inspection
    briefing, inspector action card. Gated by the **report-provenance validator**: every figure in
    the narrative must trace to a deterministic engine field, or the report is flagged.
13. **Render** — `VoiceInspectionPage` assembles the report (governing banners, FFS card, authority,
    SA brief, convergence, organizational risk, forward-risk).

## 3. Fleet path
- **fleet-triage** — deterministic ranking of multiple assets by urgency (consequence tier +
  disposition + severity), with band floors (e.g. HIGH + hold → PRIORITY).
- **fleet-systemic / peripheral-referral** — cross-asset pattern detection (e.g. a shared peripheral
  actor or recurring degradation across a cohort), rendered as a parallel "Systemic Patterns" panel,
  kept disjoint from the per-asset urgency bands.
- **fleet-isolation** — guards against cross-asset contamination in a batch.
- Input scenarios auto-split on `Asset:` headers; the same production renderer drives the fleet view.

## 4. Situational Awareness layer (L9.x)
Reads the upstream deterministic artifacts and summarizes; it produces no new safety-critical
evidence.
- **Convergence detection** — groups independent evidence streams (incident history, vibration,
  operational change, structural interface, prior similar failure, deferred maintenance, storm
  loading, process chemistry, wall loss, coating, cathodic protection, etc.) under candidate failure
  hypotheses. A hypothesis is eligible only when its **required signature streams** are present
  (anti-contamination), and the narrative is **generated from the streams that actually matched** —
  a mechanism is never named without its evidence. Reports a convergence score (0–10). Honest
  fallback (no mechanism asserted) when nothing qualifies.
- **Organizational-failure detection** — deferred/overdue maintenance, schedule/production pressure,
  missed or incomplete engineering reviews, missing MOC; produces an organizational-risk score.
- **Stakeholder views + conflict matrix** — distinct perspectives (operations, safety, engineering,
  reliability, legal, inspector) and where they conflict (e.g. OPS continue vs Safety shutdown).
- **Executive brief** — qualitative life-safety / financial / regulatory risk, recommendation,
  unknowns.
- **Forward-risk** elevated as a top-level disposition consideration.

The layer's purpose: separate the *measured defect* from the *governing reality* — e.g. corrosion is
measured by UT, but vibration-induced fatigue (from an operational change without engineering
reassessment) is what actually governs the disposition.

## 5. Cross-cutting
- **Auth** — `auth-guard.cjs`: Supabase user JWT (Authorization: Bearer) or `X-API-Key`; fails
  closed. Engines and frontend engine-calls attach the user token.
- **Provenance** — report-provenance validator binds the synthesized narrative to engine fields.
- **CI / acceptance gates** — 34 deterministic gates (`scripts/run-gates.cjs`); the Netlify build
  runs `npm run test:gates && npm run build`, so a red gate blocks the deploy. GitHub Action runs on
  push/PR.
- **Data** — Supabase (Postgres) with RLS; service-role writers, scoped read policies.
- **Public demo** — `/demo` route, curated no-auth scenarios held to the same provenance/HOLD/CLUSTER
  gates as production.

## 6. Frontend surfaces
- `/voice` — VoiceInspectionPage: the primary single-asset analysis + report.
- `/fleet` — FleetTriagePage: multi-asset ranking + systemic panel.
- `/demo` — public guided demo.
- Dashboard, Cases, Case detail; modular cards (DecisionSpine, MaterialAuthority, OutcomeSimulation,
  PlannerAgent, UniversalCodeAuthority, CompositeRepair, SimilarCases).

## 7. Determinism & honesty guarantees
- Safety-critical numbers and dispositions originate in deterministic engines (reproducible).
- HOLD on insufficient evidence; refuse on unsupported domains; flag inconsistent inputs — the error
  direction is always conservative (never a false GO).
- Anti-contamination: hypotheses/narratives can only name mechanisms backed by present evidence.
- The LLM cannot introduce unverified numbers (provenance gate).

## 8. Known limitations / open items
- Remaining-strength is B31G Level 1 screening (localized/general metal loss; not crack-like flaws);
  Level 2/3 API 579 is out of scope.
- Flaw length defaults to a conservative infinite-length assumption when not provided.
- "Governing Reality" is currently expressed via convergence + organizational-failure layers, not yet
  a single explicit labeled field (open design item: which engine owns it).
- Run-on/packed field transcripts: tier-2 calibration against real field audio still open.
- GPT extraction pass (front-of-pipe candidate extraction with a verbatim hallucination guard) is
  specced but not built (`verifyVerbatim` exists in fieldExtraction.ts as the guard primitive).

## 9. Tech stack
- Frontend: React + Vite (TypeScript).
- Backend: Netlify Functions (TypeScript + CommonJS `.cjs` deterministic engines).
- LLM: GPT-4o (synthesis) with Anthropic Claude failover.
- Data/auth: Supabase (Postgres + Auth + RLS).
- Repo: git; CI via Netlify build gate + GitHub Actions.
