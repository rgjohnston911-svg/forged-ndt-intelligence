# FORGED NDT Intelligence OS — System Summary for External Evaluation

**Purpose of this document:** a self-contained brief you can paste into another LLM (GPT-4/5, Gemini, etc.) to get an independent evaluation of the architecture, design choices, gaps, and next moves. Written to be read cold by a reviewer with no prior context.

---

## 1. What the platform is

FORGED NDT Intelligence OS is a web-based decision-support and authority system for Non-Destructive Testing (NDT) inspection. It ingests inspection evidence (narratives, photos, radiographs, ultrasonic thickness grids, CSV instrument exports), extracts structured findings, evaluates them against code rules (API 510 for pressure vessels, API 570 for piping, AWS D1.1 for welding, etc.), and produces a locked, auditable disposition: `accept`, `review_required`, or `reject`.

The target user is the inspector, the Certified Welding Inspector (CWI), the plant integrity engineer, and the inspection-authority signatory. The goal is to out-perform and out-predict a team of senior humans by combining pattern recall at scale, deterministic code compliance, and cross-case memory — while remaining auditable enough for regulated work.

- Live site: https://4dndt.netlify.app
- Sole founder / developer: one person (domain expert)
- Stage: shipping; ~215 deploys in

## 2. Stack

- **Frontend:** React + Vite + TypeScript. Dark-theme UI. React Router for routing.
- **Backend:** Netlify Functions (serverless TypeScript). One function per responsibility.
- **Database:** Supabase (Postgres + Auth + Storage + Row-Level Security). Now with pgvector enabled.
- **AI providers:** OpenAI (`gpt-4o` for finding extraction, `text-embedding-3-small` for case embeddings) and Anthropic Claude (physics-reasoning finding extraction).
- **Deploy flow:** local edits → paste to GitHub web editor → Netlify auto-deploys on commit.

## 3. Core data model (simplified)

- `inspection_cases` — canonical case record. Fields: case_number, title, component_name, weld_id, joint_type, method, material_class, load_condition, code_family, code_edition, code_section, thickness_mm, final_disposition, final_confidence, final_decision_reason, authority_locked, authority_locked_at, authority_evidence (JSONB), truth_engine_summary, org_id, **case_summary**, **case_embedding (vector 1536)**, **embedded_at**.
- `findings` — individual observed defects or features per case (crack, undercut, wall_loss, porosity, slag_inclusion, etc.) with severity, confidence, and source (openai, claude, merged, authority).
- `measurements` — numeric measurements per finding (length, depth, width, area) in imperial + metric.
- `thickness_readings` — parsed CSV thickness grids (UT corrosion maps, CML readings) with grid coordinates and nominal.
- `evidence` — uploaded files (photos, scans, instrument outputs).
- `rules` — rule-evaluation results per case, tied to code references.
- A legacy `cases` table exists but is orphaned — system writes only to `inspection_cases`.

## 4. Request → decision pipeline

### 4.1 Case creation
Front end posts to `/api/create-case`. Function validates inputs against CHECK-constrained enums (material_class, method, etc.), inserts into `inspection_cases`, returns case id. UI routes to `/cases/:id`.

### 4.2 Evidence intake
Inspector uploads photos/files and/or pastes narrative on the Evidence tab. Files go to Supabase Storage. Narrative and structured inputs feed the finding extractors.

### 4.3 Dual-model finding extraction (ensemble)
Two independent LLM extractors run:
- **OpenAI extractor** — `gpt-4o` prompted to enumerate NDT findings from the evidence with confidence scores.
- **Claude extractor** — physics-reasoning-oriented prompt targeted at mechanisms a human would infer (fatigue, creep, SCC patterns) rather than surface defects only.

Both produce JSON arrays of `{ finding_type, confidence, severity, reasoning }`.

### 4.4 Conflict resolver (deterministic, inline in `run-authority.ts`)
- If **both** models agree on a finding → merge with boosted confidence (avg × 1.15, capped 0.98), labeled `DUAL_AGREEMENT`.
- If **only one** model finds it:
  - If the finding type is in the HARD_REJECTABLE set (crack, incomplete_fusion, incomplete_penetration, overlap) → `CONSERVATIVE_ESCALATION`, retain with confidence × 0.85.
  - Else → `SINGLE_SOURCE_RETAINED`, confidence × 0.80.
- Output: a unified `mergedFindings` array + a `resolutions` array (the audit trail explaining every merge decision).

### 4.5 Thickness grid evaluator (`evaluateThicknessGrid()`)
Looks up all `thickness_readings` for the case, computes min/avg/max and percent of nominal. Applies API 510/570 rules:
- Any reading < 50% of nominal → hard reject.
- Any reading 50–80% of nominal → FFS (Fitness-For-Service) review required.
- All readings ≥ 80% of nominal → pass (on this axis).

Produces a `thickness_summary` object embedded in `authority_evidence`.

### 4.6 Authority Lock
`run-authority.ts` consumes the merged findings, thickness summary, and rule-evaluation results, and emits:
```
{ locked, disposition, confidence, authority_evidence }
```
Rules that drive the outcome:
- Crack / incomplete fusion / incomplete penetration with confidence ≥ 0.6 → hard reject, locked.
- Wall loss < 50% nominal → hard reject, locked.
- Wall loss 50–80% nominal → review_required, unlocked.
- All other findings within limits → accept, locked.

After locking, the function deletes any prior `source='authority'` wall_loss findings for the case and inserts a fresh synthetic wall_loss finding row reflecting the thickness grid verdict, so the Findings tab shows what drove the disposition. Idempotent — re-running is safe.

### 4.7 UI surfaces
- **Overview tab** — case metadata.
- **Evidence tab** — uploads, narrative, thickness-grid CSV upload widget. On successful CSV parse, auto-triggers `run-authority` so the inspector doesn't have to click manually.
- **Physics Model tab** — computed physics context (nominal vs observed).
- **Findings tab** — merged findings with source tags.
- **Rules tab** — rule evaluations with code references.
- **Decision tab** — final disposition, locked banner, WHAT/WHY/HOW block, authority evidence stats, color-coded Wall Thickness Summary card, and **Similar Prior Cases panel** (see §5).
- **Teaching tab** — aspirational surface for explain/teach (partial).

## 5. Case Similarity Retrieval Layer (just shipped as DEPLOY215)

This is the first *compounding* layer of the platform.

- Every case has a canonical summary string built from component + material + method + findings + measurements + thickness + disposition + reasoning.
- The summary is embedded with OpenAI `text-embedding-3-small` (1536 dimensions) and stored in `inspection_cases.case_embedding`.
- An `ivfflat` index over cosine distance backs a Postgres RPC `find_similar_cases(query_embedding, query_org_id, exclude_case_id, match_count)`.
- The `/api/similar-cases` function returns the top-K nearest neighbors scoped to the caller's org.
- `SimilarCasesPanel` component on the Decision tab shows the top-5 with similarity %, disposition color, and clickable links.
- Lazy embedding: if a case isn't embedded when the panel loads, the function embeds it inline and caches the result.

**Design intent:** this is how the platform "learns" without ever updating model weights — every locked case becomes retrievable evidence for the next one. Functionally learning, architecturally auditable, regulatory-safe.

## 6. Engines present in the codebase

Beyond `run-authority.ts` the repo has additional engines whose frontends are partially wired:

- `reasoning-layer.ts`, `truth-engine.ts` — deeper reasoning over merged findings and code context. Output feeds `truth_engine_summary` on the case.
- `code-authority-resolution.ts`, `run-code-applicability.ts`, `code-trace.ts`, `code_trace_registry.ts` — code-applicability engine: which sections of which codes apply to this component/material/service combination.
- `decision-core.ts`, `decision-dominance.ts` — disposition adjudication when multiple rules conflict.
- `engineering-core.ts`, `materials-core.ts`, `architecture-core.ts` — domain reasoning modules.
- `reality-lock.ts`, `run-reality-loop.ts`, `run-convergence.ts` — iterative-convergence loop for ambiguous evidence.
- `governance-matrix.ts`, `master-router.ts`, `run-universal-route.ts` — routing layer for multi-industry dispatch (piping vs welding vs structural vs aerospace).
- `voice-incident-plan.ts`, `parse-incident.ts`, `event-enrich.ts`, `incident-inspection-chain.ts` — incident-path intake (voice-to-plan, event enrichment).
- `dre-*.ts` (dre-get-case, dre-record-intake, dre-run-evaluation, dre-run-whatif) — "Decision & Reasoning Engine" what-if analysis surfaces.
- `time-progression.ts`, `run-external-event.ts` — time-series / cycle-based deterioration.
- `observation-layer.ts`, `resolve-asset.ts` — perception-to-asset resolution.

Many of these are backend-complete but the UI surfaces are partial; the next frontend track is wiring Engine 3 (`reasoning-layer` + `truth-engine`) to the Decision tab beyond the current summary.

## 7. Hard constraints in the codebase (non-negotiable house style)

- `var` only — no `let` or `const`. Reason: Git Bash paste workflow corrupted block-scoped declarations historically; `var` never breaks.
- String concatenation only — no backtick template literals. Same reason.
- `@ts-nocheck` at the top of every `.ts` file (this rule is inconsistently applied in `.tsx` files — a known gap).
- Standing directive: **"prioritize and fix issues which fix the system not scenario fixes."** Structural repair over band-aid patches.
- React Router static path precedence matters: `/cases/new` must resolve to `NewCase`, not the `:id` route. `CaseDetail` has a UUID guard that renders `<NewCase />` directly if a non-UUID lands on `:id`, to avoid an infinite redirect loop that killed an earlier deploy.

## 8. Recent deploy log (most recent last)

- **DEPLOY209** — unified New Case flow on `inspection_cases` via `/api/create-case`; UUID guard in `CaseDetail`.
- **DEPLOY210** — CSV thickness grid parser. New `thickness_readings` table, `parse-thickness-csv.ts` function, `ThicknessGridUpload.tsx` component. Handles 2D grids and flat lists. Supports `# units: in|mm` and `# nominal: 0.375` header directives.
- **DEPLOY211** — wired thickness data into `run-authority.ts`. Three API 510/570 rules based on percent-of-nominal.
- **DEPLOY212** — embedded `thickness_summary` into `authority_evidence` payload; added color-coded Wall Thickness Summary card to Decision tab.
- **DEPLOY213** — auto-generates a synthetic `source='authority'` wall_loss finding row after Run Authority Lock, idempotent, so Findings tab reflects the drivers of the disposition.
- **DEPLOY214** — progressive re-evaluation. Auto-triggers `run-authority` after a thickness CSV upload so the inspector doesn't have to click Run Authority Lock manually. Also repaired a local truncation of `CaseDetail.tsx` that had accumulated from a prior paste cycle.
- **DEPLOY215** — Case Similarity Retrieval Layer (the first compounding-knowledge layer). pgvector + embedding column + `find_similar_cases` RPC + `embed-case.ts` + `similar-cases.ts` + `SimilarCasesPanel.tsx` mounted on Decision tab.
- **DEPLOY216** — **Decision Spine.** Migration adds decision_bundle + hash + version + signed_at + ood_score + ood_flag + physics_coverage columns. New `decision-spine.ts` function composes case + findings + thickness + neighbors + OOD + physics into a deterministic-hashed signed audit bundle. New `export-audit-bundle.ts` re-verifies integrity and exports the bundle. New `DecisionSpineCard.tsx` UI surface. The spine that binds the four moats (data, regulatory, physics, calibration) into one untouchable architecture.

## 9. Architecture classification (honest)

- **Agentic?** Yes, at the platform level — planned, tool-using, iterating over state.
- **Multi-agent?** No. It's an *ensemble* (two LLMs independently extract, one deterministic resolver adjudicates). True multi-agent (planner + implementer + reviewer with their own contexts and back-and-forth) is not in the architecture yet.
- **Self-learning?** No — and deliberately not, for audit reasons. No model weights are updated by user interaction. Instead, the platform uses retrieval-augmented memory: every locked case joins a vector-indexed library (DEPLOY215) that new cases search. Functionally learning, architecturally deterministic.
- **Deterministic where it matters?** Yes — the rule engine is classical. LLMs are confined to evidence extraction at the edges. The disposition layer is rule-based and auditable. This is the correct architecture for regulated inspection work.

## 10. What the ambition is

Not a demo. A "concept machine" that accurately out-thinks, out-performs, and out-predicts a team of the smartest NDT inspectors, CWIs, engineers, architects, and operations people, by combining:

1. **Perception at scale** — every scan, photo, narrative, waveform, CSV.
2. **Cross-domain reasoning** — metallurgy + fracture mechanics + code + load history + fabrication history + operational context, all under one working memory.
3. **Compounding memory** — every locked case improves the next decision.
4. **Consistency** — no Friday-vs-Monday inspector variance; two CWIs on the same weld disagree 15–30% of the time; the machine does not.
5. **Prediction** — apply API 579 FFS, Paris law (fatigue), Larson-Miller (creep), Miner's rule (cumulative damage) to every CML on every asset continuously; flag trajectories five inspections before a human would notice.

## 10b. The Decision Spine (DEPLOY216 — the structural moat)

Following external evaluation, the platform now has a **single architectural spine** that composes every other engine into one signed, hash-verifiable audit bundle. This is the move that makes the platform untouchable: not any one feature, but the spine that binds them.

**`netlify/functions/decision-spine.ts`** — takes a case_id, gathers every input (case, findings, measurements, thickness, rules), pulls top-K neighbors via the DEPLOY215 RPC, then runs three stages and writes a signed bundle:

1. **OOD scoring.** Top-neighbor cosine similarity → `in_distribution` (≥ 0.82), `marginal` (0.72–0.82), `out_of_distribution` (< 0.72), `unknown` (no neighbors). Persists `ood_score` + `ood_flag`. The machine knows when it does not know.

2. **Physics sufficiency.** For each candidate check (wall thickness vs nominal API 510/570; crack-like flaw FFS API 579 Part 9; fatigue BS 7910 / ASME VIII Div 2; creep API 579 Part 10), emits `{ required, runnable, missing_inputs[], result }`. Coverage % = runnable / required. Reports exactly which inputs to gather to close coverage. Solver slots are stubbed with version markers — DEPLOY220+ wires the actual FFS solvers in without changing the spine contract.

3. **Synthesis narrative.** One short English block combining authority disposition + OOD flag + physics coverage + neighbor precedent. This is what the audit bundle cites and what the UI shows.

**`netlify/functions/export-audit-bundle.ts`** — returns the signed bundle plus an integrity re-verification: rehashes the stored bundle and compares against the stored hash. Any mismatch proves tampering or data drift. This is the artifact an inspection authority of record can sign.

**Bundle hashing.** SHA-256 over a deterministic JSON serialization (keys sorted at every level) of the bundle. Reproducible across runs of the same content. Labeled honestly as "integrity hash" — actual cryptographic signing with a key slots in later as a wrapper.

**Schema additions on `inspection_cases`:** `decision_bundle JSONB`, `decision_bundle_hash TEXT`, `decision_bundle_version TEXT`, `decision_bundle_signed_at TIMESTAMPTZ`, `ood_score NUMERIC(5,4)`, `ood_flag TEXT (CHECK)`, `physics_coverage JSONB`. Indexes on bundle hash (regulator-mode lookup) and on OOD flag (review queue).

**`src/components/DecisionSpineCard.tsx`** — the single regulator-facing surface. Shows OOD flag with color-coded confidence band, physics coverage %, spine version, signed-at timestamp, synthesis narrative, full bundle hash, and a Verify + Export button that re-runs the integrity check and downloads the signed bundle as JSON.

**Why this is the moat:**

- **Data moat (DEPLOY215 — case library)** is data the spine *uses*.
- **Physics moat (DEPLOY220+ — FFS solvers)** are solvers the spine *calls*.
- **Calibration moat (OOD)** is a stage *inside* the spine.
- **Regulatory moat (signed audit bundles)** is the spine's *output*.

A competitor cannot replicate any one of these without also replicating the spine that composes them, and cannot replicate the spine without years of compounding case data behind it. The spine is the integration; integration is the hardest thing to copy.

## 11. Planned / queued work

- **DEPLOY216** — integrate Case Similarity into `run-authority.ts` reasoning. Before adjudication, pull top-K neighbors and pass their summaries + dispositions into the Claude / reasoning-layer prompt as context. Blocked on pulling the current production `run-authority.ts` back into the local workspace (local copy is truncated; prod is live and correct).
- **Engine 3 frontend wiring** — surface `reasoning-layer` and `truth-engine` outputs beyond the current single-field summary.
- **Physics layer** — API 579 FFS calculators, Paris law, Larson-Miller, Miner's rule, applied automatically whenever inputs exist.
- **Planner-agent layer** — when evidence is insufficient, plan what to gather next (targeted UT scan at grid coordinates, pull historical inspection reports, query weld procedure). Moves the platform from "answerer" to "investigator."
- **Calibration / OOD layer** — confidence scoring plus explicit "this case resembles no prior" flag when retrieval returns nothing close. Teaches the machine to know its own edges.
- **Additional parsers** — Krautkramer/GE DMS, Olympus 38DL, other instrument exports beyond thickness CSVs.
- **Teaching tab** — render the full audit chain (evidence → findings → rules → neighbors → disposition) as an explainable story.
- **Backfill** — one-shot script to embed all historical cases (currently lazy-embed only; existing cases won't have vectors until someone opens them).

## 12. Known fragilities

- Workspace drift: the local Desktop copy of several large files has accumulated truncation from prior paste cycles. Production on GitHub is authoritative. Two files caught this way so far: `CaseDetail.tsx` (repaired in DEPLOY214) and `run-authority.ts` (identified during DEPLOY215 design; not yet pulled fresh).
- `@ts-nocheck` is not consistently applied to `.tsx` files; strict-mode upgrades could bite.
- No automated test suite; verification is manual + Netlify build failures.
- Lazy-embed model means early cases won't have vectors until someone views their Decision tab. Non-problem at this scale but worth a backfill before any demo.

## 13. Questions for an external reviewer

1. Is the ensemble (dual-LLM → deterministic resolver) the right architecture, or is a single-model-with-reflection pattern cleaner?
2. Where should the planner-agent layer live — as a new engine composing existing functions, or embedded in `run-authority.ts`?
3. Is `text-embedding-3-small` (1536d) sufficient for NDT domain similarity, or is a domain-tuned or larger model worth the cost?
4. Should the case summary be augmented with a structured "feature vector" (e.g., one-hot material class, one-hot method, numeric thickness percentile) concatenated to the text embedding?
5. What's the right way to surface "this case resembles no prior" — a dedicated OOD detector, a similarity threshold, or a confidence calibration layer?
6. For the physics layer, is it better to wrap existing FFS libraries (e.g., commercial API 579 solvers) or implement the algorithms directly in TypeScript for auditability?
7. What is the best path to a regulator-accepted audit trail? What evidence is the inspection authority of record (API ICP, AWS CWI certifying body) likely to demand to accept an AI-assisted disposition?
8. Is there a credible competitor doing this (not a scan-capture vendor, but a full decision-authority system)?

---

*End of brief. Paste into GPT / Gemini / other reviewer to request an honest critique of architecture, gaps, risks, and prioritization of the planned work.*
