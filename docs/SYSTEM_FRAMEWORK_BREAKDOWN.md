# FORGED 4D NDT Platform — System Framework Breakdown

**Purpose.** This document describes the platform's architecture in two parallel forms — (A) the platform as it exists today, without the Situational Awareness (SA) layer, and (B) the platform with the proposed SA layer added. It is written to be evaluated by external reviewers (GPT and Claude) for the question: *what is the best implementation path for the SA layer that (i) does not impact any patent claim and (ii) does not regress any pre-SA feature.*

The document is deliberately verbose where verbosity is needed and concise where it is not. It is structured so a reviewer can read either side independently and then compare.

---

## 0. Reviewer brief

Three questions are being asked of the reviewers:

1. **Patent invariance.** Does the proposed SA layer (B) violate, weaken, or render unenforceable any claim of the FORGED 4D NDT Provisional Patent Disclosure? If so, where?

2. **Pre-SA feature invariance.** Does adding the SA layer (B) break, regress, or alter the observable behavior of any existing feature in the without-SA platform (A)? If so, where? An additive layer is acceptable; a behavior change inside the existing layers is not.

3. **Implementation sequencing.** Given (1) and (2), what is the lowest-risk implementation order of the SA sub-modules? The platform must remain shippable at every commit boundary.

Reviewers are asked to call out specific layers by name when identifying concerns. The layer numbering (L0–L10) is shared between (A) and (B) so cross-references resolve.

---

## 1. Vocabulary (used throughout)

| Term | Meaning |
|---|---|
| **Transcript** | The raw inspector input (typed or voice-to-text). The single textual source of inspector-side reality. |
| **Asset** | The physical object under inspection (piping, vessel, tank, bridge, offshore platform, etc.). |
| **Reality layer** | A named engine that produces a typed, internally-consistent view of one aspect of reality (Physical, Damage, Consequence, Authority, Inspection, Decision). |
| **Hard confidence gate** | The deterministic enforcement rule that forces `disposition = HOLD_FOR_REVIEW` whenever consequence tier ∈ {HIGH, CRITICAL} and reality confidence < 0.60. |
| **Hard lock** | A patent-enumerated condition (10 total per Claim 8) that forces a specific disposition class regardless of other signals. |
| **DecisionPackage** | The frozen, hashable, replayable artifact produced at the end of the deterministic pipeline. Boundary between *computed* and *narrated*. |
| **PIL** | Perspective Intelligence Layer. Projects one DecisionPackage into multiple role views (currently 6) without altering invariant truth. |
| **Evidence ledger** | The structured list of evidence requirements per validated mechanism, used to gate disposition. |
| **Synthesis-only LLM** | An LLM that may narrate and summarize over already-validated evidence but may not generate evidence itself. Patent Claim 1(ix). |
| **Provenance non-increase** | The rule that the apparent strength of evidence may never be inflated by routing through downstream layers (LLM, form, narrator). Patent Claim 1(iv). |

---

## 2. Patent claim summary (constraints on any design)

The following claims constrain both designs. Both (A) and (B) must preserve all of them.

| Claim | Description | Implication for design |
|---|---|---|
| 1(i) | Physics-first reality computation precedes any LLM narration. | LLMs cannot run before the deterministic engines complete. |
| 1(ii) | Determinism: same input → same output. | All engines and gates must be pure functions over typed inputs. No nondeterministic ordering. |
| 1(iii) | Klein bottle 6-state cyclic decision topology. | The disposition state machine must implement exactly 6 cyclic states. |
| 1(iv) | Provenance non-increase. | No downstream layer may raise the apparent strength of evidence above its source. |
| 1(v) | Reality-confidence-gated disposition. | Disposition is locked when overall reality confidence falls below the consequence-tier-specific threshold. |
| 1(ix) | LLM constrained to synthesis-only role. | LLMs may not be the source of evidence; only the synthesizer over already-validated evidence. |
| 2 | Klein bottle 6-state cyclic decision topology (detail of 1(iii)). | Confirms 6-state cycle; no other shape permitted. |
| 3 | Multi-LLM adversarial validation with deterministic arbiter. | When multiple LLMs are used for synthesis, a deterministic arbiter (not another LLM) reconciles them. |
| 4 | 0.6-fraction compound mechanism rate-control rule. | Compound mechanism rate selection is bounded by a 0.6 fraction. |
| 5 | Reality-tier-stratified failure timeline. | Failure timeline output is stratified by reality tier. |
| 7 | 14 enumerated asset domains. | The asset domain enumeration is closed; new domains cannot be added without invalidating the claim. |
| 8 | 10 enumerated hard locks. | The hard lock catalogue is closed; new hard locks cannot be added without claim impact. |
| 11 | Required evidence ledger structure. | The evidence ledger schema is part of the claim. |
| 12 | Authority lock chain output structure. | Authority chain output schema is part of the claim. |
| 13 | Inspection method physics-coverage scoring. | The inspection scoring rubric is part of the claim. |
| 14 | Contradiction matrix output structure. | Contradiction matrix output schema is part of the claim. |
| 19 | DecisionPackage canonicalization and hashing. | The canonical-JSON-then-SHA256 hashing path is part of the claim. |
| CIP-a | Replay verification | Replay-audit module structure is part of the claim. |
| CIP-b | Reality Integrity Score | RIS computation is part of the claim. |
| CIP-c | Chain-of-custody event log | Coherence log schema is part of the claim. |

Any SA design that adds new state inside the L3 reality layers, alters the disposition state machine, or routes LLM output back into the evidence-intake surface violates one or more claims above. The SA layer must be **strictly additive** and **strictly downstream** of the existing reality layers.

---

## 3. Platform (A): without Situational Awareness

This is the platform as it exists today, inclusive of tonight's hardened classifier (DEPLOY358/359/360) and the PIL/Audit infrastructure (DEPLOY354/355/356).

### L0 — Input

| Component | Type | Role |
|---|---|---|
| `VoiceInspectionPage.tsx` | Frontend | Single textarea for transcript (typed or voice-to-text). Optional photo upload and asset registry context. Submits via POST. |

Output of L0: a JSON payload `{ transcript, asset?, confirmed_flags?, evidence_provenance? }`.

### L1 — Parsing and Classification

| Component | Type | Role |
|---|---|---|
| `parse-incident.ts` | Backend | NLP parser. Extracts events, numeric values, environmental phases from transcript. Emits `parsed = { events, numeric_values, environment, raw_text }`. |
| `resolve-asset.ts` | Backend | Free-text asset classifier. Maps transcript → one of the 14 enumerated asset domains. May return `asset_class = "unknown"` and defer to decision-core's cascade. |
| `decision-core.ts` cascade (lines 6020–6242) | Backend | Hardened classifier cascade with DEPLOY359 code-based lock + 7 downstream promotion gates + DEPLOY358 base-domain normalization. Resolves final `assetClass`. |

L1 produces a typed `parsed` object and a final `assetClass`. The final `assetClass` is one of the 14 enumerated domains (Patent Claim 7).

### L2 — Asset Context Resolution

| Component | Role |
|---|---|
| `event-enrich.ts` | Annotates extracted events with mechanism/environment context. |
| `code-authority-resolution.ts` | Resolves the primary, secondary, and conditional authority chains given asset class and jurisdiction. |
| `jurisdiction detection` (inside decision-core) | Determines US/EU/UK/NO/AU/BR/CA/ME/SG jurisdiction overlay. |
| Asset registry lookup (Supabase) | Carries forward prior inspection findings, prior dispositions, prior CML grids. |

### L3 — Reality Layers (the five engines)

This is the platform's structural core. Five named engines, each producing a typed, internally-consistent reality view. Order is fixed; each consumes outputs of prior engines.

| Engine | Module(s) | Output shape (top-level) |
|---|---|---|
| **Physical Reality** | `decision-core.ts:resolvePhysicalReality` | `{ stress, thermal, chemical, energy, time, field_interaction, material, environment, process_chemistry, flow_regime, deposits, coating, physics_confidence, physics_summary, context_inferred }` |
| **Damage Reality** | `decision-core.ts:resolveDamageReality` + `mechanism-catalog.ts` | `{ validated_mechanisms, rejected_mechanisms, indeterminate_mechanisms, primary_mechanism, damage_confidence, physics_narrative }` |
| **Consequence Reality** | `decision-core.ts:resolveConsequenceReality` | `{ consequence_tier, failure_mode, failure_physics, consequence_basis, human_impact, environmental_impact, operational_impact, enforcement_requirements, damage_state, damage_trajectory, threshold_score, threshold_reasons, monitoring_urgency, consequence_confidence }` |
| **Authority Reality** | `decision-core.ts:resolveAuthorityReality` + `authority-lock-system.ts` | `{ primary_authority, secondary_authorities, conditional_authorities, physics_code_alignment, code_gaps, design_state_warning, authority_confidence, jurisdiction_applied }` |
| **Inspection Reality** | `decision-core.ts:resolveInspectionReality` + `inspection-retrieval.ts` | `{ proposed_methods, recommended_package, method_assessments, all_method_scores, best_method, sufficiency_verdict, physics_reason, required_methods, missing_coverage, constraint_analysis, inspection_confidence }` |

Each engine is a pure function. Each emits a confidence scalar in [0, 1]. No engine may invoke an LLM. Each respects Patent Claim 1(i) (physics first) and 1(ii) (determinism).

### L4 — Computation Engines (called by L3 or in parallel)

| Engine | Role |
|---|---|
| **Failure Mode Dominance (FMD v1.3.2)** | Selects governing mechanism among validated candidates. Implements 0.6-fraction compound mechanism rate-control rule (Patent Claim 4). |
| **Remaining Strength (B31G v1.1)** | Computes MAOP via B31G and modified B31G. Used by Disposition Pathway when corrosion is the governing path. |
| **Failure Timeline (v1.1)** | Projects mechanism-specific time-to-failure stratified by reality tier (Patent Claim 5). |
| **Physics Computations** | Stress, thermal, fracture mechanics, fitness-for-service (API 579). |
| **NPS Inference** | Schedule-based nominal wall inference for piping when not provided. |
| **Multi-LLM Adversarial Validator** | When invoked, runs multiple LLMs and reconciles via deterministic arbiter (Patent Claim 3). |

### L5 — Disposition Engine

| Component | Role |
|---|---|
| `disposition-pathway.js` | Builds the final disposition, hard locks, evidence ledger, inspection plan, escalation triggers, enforcement metadata, conditions, temporary controls. Implements the 6-state Klein bottle cyclic decision topology (Patent Claim 2). |
| `decision-dominance.ts` | Selects dominant path among Disposition Pathway candidates. |
| Hard confidence gate (inside decision-core) | Forces `HOLD_FOR_REVIEW` when consequence tier ∈ {HIGH, CRITICAL} and reality confidence < 0.60 (Patent Claim 1(v)). |
| Hard locks (10 enumerated, Patent Claim 8) | Override disposition when triggered. |

L5 output: a typed `decision_reality` object containing `{ disposition, disposition_basis, gates, guided_recovery, phased_strategy, hard_locks, decision_trace }`.

### L6 — Required Evidence Ledger

| Component | Role |
|---|---|
| `disposition-pathway.js:buildRequiredEvidenceLedger` | For each unverified mechanism, emits the list of confirmation evidence, rule-out evidence, and severity quantifiers required to close it (Patent Claim 11). |
| `disposition-pathway.js:buildRequiredInspectionPlan` | Maps each unverified mechanism to its mechanism-specific inspection methods. |

L6 output: `required_evidence_ledger[]` and `required_inspection_plan[]`. The ledger is structured; each entry names the mechanism, its current reality state, and the typed evidence requirements.

### L7 — DecisionPackage Assembly

| Component | Role |
|---|---|
| `decision-package-assembler.cjs` | Crystallizes outputs of L3–L6 into the canonical `DecisionPackage` artifact. Hashes via SHA-256 over canonical JSON (Patent Claim 19). |

Output: a `DecisionPackage` with `{ packageHash, schemaVersion, packageId, decisionTimestamp, disposition, confidence, fmd, timeline, hardLocks, bindingClauses, contradictions, consequence, provenance, remainingStrength, resolved, requiredInspections, mustNotConclude }`.

The DecisionPackage is immutable. All downstream consumers operate on this frozen object.

### L8 — Audit / Replay / Custody / Signing

| Component | Role |
|---|---|
| `package-store.cjs` | Persistent storage by packageHash. Backed by Netlify Blobs. Idempotent. |
| `replay-audit.cjs` | Re-runs a stored package against the current engine and verifies bit-identical output. Supports CIP-a. |
| `sign-export.cjs` | HMAC-SHA256 signing of the DecisionPackage at export time. Key rotation supported. |
| `coherence-log.cjs` | Append-only audit log of every package event (created, signed, replayed, projected). Supports CIP-c. |
| Reality Integrity Score | Composite confidence/coherence score on the package. Supports CIP-b. |

### L9 — Perspective Intelligence Layer (PIL)

| Component | Role |
|---|---|
| `perspective-projection.cjs` | Projects the DecisionPackage into 6 role views (INSPECTOR, ENGINEER, TECHNICIAN, OPS_MANAGER, SAFETY, STUDENT). Invariant truth is preserved across all 6 projections; only emphasis, terminology, and detail level vary. |

PIL is a pure function over the DecisionPackage. It cannot alter `disposition`, `confidence`, `hardLocks`, `fmd`, or any other engineering output. It only re-formats.

### L10 — Synthesis and Rendering

| Component | Role |
|---|---|
| `superbrain-synthesis.js` | LLM synthesis layer. Constrained to narration over already-validated evidence (Patent Claim 1(ix)). Produces failure narrative, contradiction matrix, pre-inspection briefing, procedure forensics, inspector action card. |
| `generateReport.ts` | Frontend renderer. Composes the final HTML/PDF report from L7 + L9 + L10 outputs. |
| `VoiceInspectionPage.tsx` | Frontend display of all the above. |

L10 produces no new evidence. Any LLM output that contradicts the DecisionPackage is rejected by the deterministic arbiter (Patent Claim 3).

### L11 — Validation Harnesses

| Component | Role |
|---|---|
| `golden-suite-100-case-validation.cjs` | 100 curated cases. Marketing 97.1% Golden Suite. |
| `blind-validation-suite.cjs` | 55+ blind cases. Marketing 97.4% Blind Suite. |
| `classifier-batch.cjs` (new tonight) | 30 classifier-focused cases. 30/30 pass post-DEPLOY360. |
| Many domain-specific suites | Cross-domain, adversarial, photo-assessment, field-chaos, etc. |

### Summary of (A)

Today's platform implements a strict physics-first deterministic pipeline through L0–L7, with L8 providing audit/custody/signing, L9 providing role projection, and L10 providing constrained synthesis. The Required Evidence Ledger (L6) lists what evidence is needed but the platform has **no mechanism for accepting structured evidence answers post-disposition** other than re-submitting an enriched transcript through L0 — which is the surface the bug in tonight's NDT TEST 2 was exploiting.

---

## 4. Platform (B): with Situational Awareness — proposed

The SA layer is **strictly additive** and **strictly downstream** of L7 (DecisionPackage). It does not modify L0–L7. It does not alter any existing layer's output shape. It does not write back into any prior layer's state.

The SA layer is composed of five sub-modules, here numbered L9.1 through L9.5 because they parallel and extend the PIL (L9). All five operate on the frozen DecisionPackage. None invoke an LLM as an evidence generator. None alter the disposition state machine.

### L9.0 — Reality Validation Engine (the SA substrate)

| Component | Role |
|---|---|
| `reality-validation-gate.cjs` | Pure deterministic gate. Validates every candidate `EvidenceEntry` (typed envelope) before it enters the working evidence set. Implements: provenance non-increase enforcement, LLM-source-with-strong-provenance rejection, speculation-on-CRITICAL rejection, Non-Evidence Token Registry filtering, staleness windows, duplicate collapse. |
| `parse-incident.ts` (extended) | Emits typed question contracts including `decisionImpact`, `allowedProvenances`, and `options[].implies_provenance`. Filters question options against the Non-Evidence Token Registry. |
| `VoiceInspectionPage.tsx` (extended) | Builds typed `sa_responses: EvidenceEntry[]` from form selections. Submits as sibling field to `transcript`. Stops mutating the transcript. |
| `decision-core.ts` (extended) | Reads `sa_responses`. Calls `validateSet()`. Adds CRITICAL-unresolved → HOLD rule to the existing hard confidence gate. |

L9.0 is the **substrate** — every higher SA module must operate on its output (`ValidatedEvidenceSet`), never on raw transcripts or raw form responses. L9.0 enforces Claim 1(iv) and 1(ix) structurally.

**Full contract:** `docs/REALITY_VALIDATION_ENGINE_CONTRACT.md`.

### L9.1 — Stakeholder Reality Engine

Extends PIL (L9) from 6 role projections to 9. Adds:

| Projection | Source signals (from validated evidence only) |
|---|---|
| `RELIABILITY` | Mechanism progression rate, failure precedents in similar units, time-to-failure projections from L4. |
| `FINANCIAL` | Operational impact ($ revenue at risk), shutdown cost, intervention cost. Sourced only from inputs explicitly provided by the user; never inferred by LLM. |
| `LEGAL` | Regulatory authority chain from L3 Authority Reality, reporting thresholds, jurisdiction overlays. |

Each role projection emits a typed `StakeholderRealityView`:

```json
{
  "role": "RELIABILITY|FINANCIAL|LEGAL|...",
  "position": "<canonical position statement>",
  "evidence_basis": [ <EvidenceEntry from ValidatedEvidenceSet>, ... ],
  "confidence": <0-1>,
  "what_they_want": "<CONTINUE|DERATE|SHUTDOWN|MORE_DATA|N/A>",
  "what_they_fear": "<string>",
  "decision_contamination_risk": "<LOW|MEDIUM|HIGH>"
}
```

The Stakeholder Reality Engine is a pure deterministic projection over the ValidatedEvidenceSet plus the DecisionPackage. It does not invoke an LLM. It does not write back to any L3 engine.

### L9.2 — Conflict Detection Engine

Operates on the 9 StakeholderRealityViews. Outputs a typed `ConflictMatrix`:

```json
{
  "options": ["CONTINUE", "DERATE", "SHUTDOWN", "MORE_DATA"],
  "stakeholder_positions": {
    "INSPECTOR": { "wants": "...", "rationale": "..." },
    "ENGINEER": { ... },
    ...
  },
  "active_conflicts": [
    { "between": ["SAFETY", "OPS_MANAGER"], "axis": "shutdown_now", "severity": "..." }
  ],
  "decision_contamination_flags": [
    { "stakeholder": "OPS_MANAGER", "type": "PRODUCTION_PRESSURE", "evidence": "<EvidenceEntry>" }
  ],
  "conflict_resolution_priority": ["SAFETY", "INTEGRITY", "RELIABILITY", "OPERATIONS"]
}
```

The Conflict Detection Engine implements a fixed bias-detection ruleset (production-bonus → contamination flag, prior trauma → contamination flag, missing calibration → contamination flag, etc.). The rules are deterministic and enumerated. No LLM.

### L9.3 — Consequence Simulator

For each option in the ConflictMatrix, computes a typed `ConsequenceScenario`:

```json
{
  "option": "CONTINUE|DERATE|SHUTDOWN|MORE_DATA",
  "probability_weighted_outcomes": [
    { "outcome": "...", "probability": 0.X, "consequence_basis": "...", "evidence_source": [...] }
  ],
  "expected_value": { "financial": "<$/day>", "safety": "<life-safety risk score>", "regulatory": "<exposure>" },
  "confidence": <0-1>,
  "evidence_basis": [ <EvidenceEntry>, ... ]
}
```

The Consequence Simulator pulls probability inputs from L4 (Failure Timeline) and the asset registry (precedent failures in similar units). It does not invent probabilities. If no probability basis exists, the scenario is emitted with `confidence = 0` and `probability_weighted_outcomes = []`.

### L9.4 — Executive Decision Brief

A one-page rendering layer. Takes outputs of L9.1, L9.2, L9.3 and renders the canonical executive summary:

- Recommendation (from disposition + simulator weighting)
- Risk (life-safety, financial, regulatory)
- Confidence (overall ValidatedEvidenceSet confidence)
- Unknowns (unresolved CRITICAL questions from L9.0)
- Code basis (from L3 Authority Reality)
- Conflict summary (from L9.2)

The brief is a typed rendering of upstream outputs. It produces no new evidence.

### Summary of (B)

The SA layer adds five new sub-modules (L9.0–L9.4) downstream of the DecisionPackage. It does not modify L0–L8. It does not alter the disposition state machine, the asset domain enumeration, the hard lock enumeration, or any reality layer output shape. It introduces a typed evidence contract (`EvidenceEntry`, `ValidatedEvidenceSet`) and a deterministic validation gate that enforces Patent Claims 1(iv) and 1(ix) structurally — making those claims **harder to violate** rather than easier.

---

## 5. Where (B) differs from (A) — exact integration points

This section lists every place in the codebase where (B) requires a change.

| File | Change in (B) | Risk to existing behavior |
|---|---|---|
| `src/pages/VoiceInspectionPage.tsx` | `handleGenerateWithAnswers` rewritten. Builds typed `sa_responses[]`. Stops mutating transcript. | Pre-SA inspections that don't use SA Q&A behave identically. SA Q&A inspections behave correctly instead of corruptly. |
| `netlify/functions/parse-incident.ts` | `questions[]` emitted as typed contracts. Options filtered against Non-Evidence Token Registry. | Pre-SA path unchanged. SA path now emits valid evidence rather than form clicks. |
| `netlify/functions/decision-core.ts` | New code path: when `sa_responses[]` present, call `reality-validation-gate.cjs:validateSet()` and integrate results into evidence intake. Add CRITICAL-unresolved → HOLD rule to existing hard confidence gate. | Pre-SA path (no `sa_responses`) unchanged. Existing hard confidence gate unchanged in default behavior; the CRITICAL-unresolved rule only adds a MORE-restrictive HOLD condition, never relaxes existing gates. |
| `netlify/functions/comprehensive-assessment.ts` | Same as decision-core: read `sa_responses` if present, route through validation gate. | Pre-SA orchestrator path unchanged. |
| `netlify/functions/perspective-projection.cjs` | Extended from 6 to 9 role projections. No change to existing 6. | Existing role projections behave identically. |
| `netlify/functions/reality-validation-gate.cjs` | **New file.** Pure module. No existing callers. | None. |
| `netlify/functions/stakeholder-reality-engine.cjs` | **New file.** Pure module. Called only from new SA endpoints. | None. |
| `netlify/functions/conflict-detection-engine.cjs` | **New file.** Pure module. | None. |
| `netlify/functions/consequence-simulator.cjs` | **New file.** Pure module. | None. |
| `netlify/functions/executive-brief.cjs` | **New file.** Pure module. | None. |
| `netlify/functions/decision-package-assembler.cjs` | Optionally extended to include a `validatedEvidenceSet` field in the DecisionPackage when SA was used. Default behavior unchanged. | DecisionPackage hash semantics preserved: `validatedEvidenceSet` is included in canonical JSON ordering so hashes are stable. |
| `docs/REALITY_VALIDATION_ENGINE_CONTRACT.md` | **New file.** Authoritative spec. | None. |
| `docs/STAKEHOLDER_REALITY_ENGINE_CONTRACT.md` | **New file, to be written in next phase.** | None. |

**Total existing files modified: 5.** Each modification is **additive and gated on `sa_responses` presence**. The pre-SA code path (no `sa_responses` in the request body) is bit-identical to (A).

---

## 6. Patent claim impact analysis

For each claim, this section states whether (B) preserves it.

| Claim | Preserved? | Reasoning |
|---|---|---|
| 1(i) physics-first | YES | SA modules run downstream of L3 reality engines. Cannot run before deterministic engines complete. |
| 1(ii) determinism | YES | All SA modules are pure functions over typed inputs (ValidatedEvidenceSet + DecisionPackage). No nondeterministic ordering. |
| 1(iii) Klein bottle 6-state topology | YES | Disposition state machine in L5 is untouched. SA modules consume disposition; they do not produce it. |
| 1(iv) provenance non-increase | **STRENGTHENED** | Reality Validation Gate enforces this structurally for all evidence entering the working set, including form responses and LLM-derived candidates. Pre-SA platform relied on convention; (B) makes it enforceable. |
| 1(v) reality-confidence-gated disposition | YES | Existing hard confidence gate unchanged. CRITICAL-unresolved → HOLD rule adds a MORE-restrictive condition. |
| 1(ix) LLM synthesis-only | **STRENGTHENED** | Gate explicitly rejects `LLM_INFERENCE` source paired with OBSERVED/MEASURED/DOCUMENTED provenance. Pre-SA platform relied on developer discipline; (B) makes it structurally impossible. |
| 2 Klein bottle topology detail | YES | Same as 1(iii). |
| 3 multi-LLM adversarial validation | YES | Unchanged. SA layer is downstream of and orthogonal to multi-LLM synthesis. |
| 4 0.6-fraction compound mechanism rule | YES | L4 FMD is unchanged. |
| 5 reality-tier-stratified timeline | YES | L4 Failure Timeline unchanged. Consequence Simulator (L9.3) consumes its output. |
| 7 14 enumerated asset domains | YES | Asset domain enumeration unchanged. SA layer does not introduce new domains. |
| 8 10 enumerated hard locks | YES | Hard lock enumeration unchanged. SA layer adds no new hard locks. CRITICAL-unresolved → HOLD is an enforcement of existing locks, not a new lock. |
| 11 required evidence ledger structure | YES | Ledger schema unchanged. SA layer adds the ValidatedEvidenceSet alongside, not in place of, the ledger. |
| 12 authority lock chain output | YES | Authority chain schema unchanged. |
| 13 inspection method physics-coverage scoring | YES | Inspection Reality unchanged. |
| 14 contradiction matrix output | YES | Contradiction matrix schema unchanged. SA layer's ConflictMatrix is a different object at a different layer. |
| 19 DecisionPackage canonicalization | YES | DecisionPackage hashing preserved. New `validatedEvidenceSet` field, if added, participates in canonical ordering. |
| CIP-a replay verification | YES | SA modules are pure functions; replaying the same `sa_responses[]` produces bit-identical outputs. |
| CIP-b Reality Integrity Score | YES | RIS computation unchanged. Optionally extended to include SA gate statistics. |
| CIP-c chain-of-custody event log | YES | Coherence log unchanged. SA events (sa_responses submitted, gate decisions, projections generated) may be added as new event types but do not alter existing event semantics. |

**Result:** Zero claims violated. Two claims (1(iv) and 1(ix)) materially strengthened by structural enforcement.

---

## 7. Pre-SA feature impact analysis

For each feature category, this section states whether (B) preserves observable behavior when `sa_responses` is not present.

| Feature category | Behavior in (B) when `sa_responses` absent |
|---|---|
| Free-text transcript classification | Bit-identical to (A). DEPLOY358/359/360 hardened classifier unchanged. |
| Asset classification cascade | Bit-identical. Hardened classifier outputs identical for all 30 regression scenarios. |
| Physical / Damage / Consequence / Authority / Inspection reality | Bit-identical. L3 engines untouched. |
| FMD, Remaining Strength, Failure Timeline | Bit-identical. L4 engines untouched. |
| Disposition Pathway | Bit-identical when `sa_responses` absent. New CRITICAL-unresolved → HOLD rule only fires when `sa_responses` is present AND a CRITICAL question is unresolved; default code path unchanged. |
| Required Evidence Ledger / Required Inspection Plan | Bit-identical. Schema unchanged. |
| DecisionPackage assembly + hashing | Bit-identical. New optional `validatedEvidenceSet` field is null when absent; canonical JSON ordering preserves hash stability. |
| Package store / replay-audit / sign-export / coherence-log | Bit-identical. |
| PIL (6 existing role projections) | Bit-identical. New projections (RELIABILITY, FINANCIAL, LEGAL) are additive. |
| Superbrain synthesis | Bit-identical. LLM synthesis layer unchanged. |
| Report generation (`generateReport.ts`) | Bit-identical when `sa_responses` absent. Optional new SA sections render only when SA data is present. |
| Validation harnesses (Golden Suite, Blind Suite) | Bit-identical. The marketing 97.1% / 97.4% numbers measured against `comprehensive-assessment` (which doesn't use the SA path) are unaffected. |

**Result:** Zero pre-SA features regressed. Every observable behavior with `sa_responses` absent is bit-identical to (A).

---

## 8. Implementation sequence (proposed)

Each stage is independently revertable. Every commit boundary leaves the platform shippable. Pre-SA users see no behavior change at any stage.

| Stage | Deliverable | Risk | Ship-able? |
|---|---|---|---|
| 1 | `docs/REALITY_VALIDATION_ENGINE_CONTRACT.md` (already done) | None — pure documentation | Yes |
| 2 | `netlify/functions/reality-validation-gate.cjs` + unit tests. No integration. | None — pure module with no callers | Yes |
| 3 | `parse-incident.ts` extended to emit typed questions. Backwards-compat: old shape still supported. | Low — additive fields | Yes |
| 4 | `VoiceInspectionPage.tsx` rewritten `handleGenerateWithAnswers`. Builds typed `sa_responses[]`. Stops mutating transcript. | Low — only affects users who use SA Q&A. Pre-SA path unchanged. | Yes |
| 5 | `decision-core.ts` + `comprehensive-assessment.ts` extended to read `sa_responses` and call validation gate. CRITICAL-unresolved → HOLD rule added. | Low — gated on `sa_responses` presence | Yes |
| 6 | Regression test: NDT TEST 1 + NDT TEST 2 fixtures + full classifier batch + Golden Suite re-run. | None — verification only | Yes |
| 7 | `docs/STAKEHOLDER_REALITY_ENGINE_CONTRACT.md` | None | Yes |
| 8 | `stakeholder-reality-engine.cjs` extending PIL to 9 projections | Low — additive | Yes |
| 9 | `conflict-detection-engine.cjs` | None — new module | Yes |
| 10 | `consequence-simulator.cjs` | None — new module | Yes |
| 11 | `executive-brief.cjs` + report rendering | None — additive section | Yes |
| 12 | Production deploy of full SA layer | Low — all stages independently verified | Yes |

---

## 9. Open architectural questions for reviewers

Three questions where reviewer input would materially shape implementation:

**Q1.** The Reality Validation Gate proposes that any LLM-sourced EvidenceEntry with `provenance ∈ {OBSERVED, MEASURED, DOCUMENTED}` is rejected unconditionally. Is this too strict for cases where an LLM is extracting structured data from inspector free-text (e.g., parsing "UT was 0.418 inches at CML 4" into a typed measurement)? Proposed answer: the LLM in that path is a **parser**, not an evidence source; the evidence source is `INSPECTOR_FIELD`, the LLM is a tool. Should the gate make this distinction explicit, or should it rely on the upstream caller correctly attributing the source?

**Q2.** The CRITICAL-unresolved → HOLD rule forces HOLD whenever any CRITICAL question lacks OBSERVED/MEASURED/DOCUMENTED evidence. This is correct for safety but may produce HOLDs on inspections where CRITICAL questions are reasonably out of scope (e.g., a routine UT thickness survey doesn't need to resolve "is there an active leak?" because the answer is presumed NO based on operational status). Proposed answer: questions emitted by `parse-incident` should be context-scoped — `parse-incident` should not emit a CRITICAL question if its scope is incompatible with the inspection type. Should the gate also accept an explicit `out_of_scope` attestation from the user that downgrades the question's effective decision impact?

**Q3.** The PIL currently produces 6 deterministic role views (INSPECTOR, ENGINEER, TECHNICIAN, OPS_MANAGER, SAFETY, STUDENT). The Stakeholder Reality Engine proposes extending to 9 (add RELIABILITY, FINANCIAL, LEGAL). Does the patent's role-projection claim (if any) constrain the number or identity of projections? Are there roles missing from the 9 that downstream users would need (e.g., INSURANCE, REGULATORY, EXECUTIVE)? Note that EXECUTIVE is partially served by the Executive Decision Brief (L9.4), which is a synthesized one-page summary rather than a per-role projection.

---

## 10. Files referenced

| Path | Purpose |
|---|---|
| `docs/DECISION_PACKAGE_CONTRACT.md` | Authoritative spec for L7 |
| `docs/REALITY_VALIDATION_ENGINE_CONTRACT.md` | Authoritative spec for L9.0 |
| `docs/SYSTEM_FRAMEWORK_BREAKDOWN.md` | This document |
| `netlify/functions/decision-core.ts` | L1, L3, L5 core |
| `netlify/functions/comprehensive-assessment.ts` | Orchestrator |
| `netlify/functions/disposition-pathway.js` | L5, L6 |
| `netlify/functions/authority-lock-system.ts` | L3 Authority |
| `netlify/functions/decision-package-assembler.cjs` | L7 |
| `netlify/functions/package-store.cjs` | L8 |
| `netlify/functions/replay-audit.cjs` | L8 |
| `netlify/functions/sign-export.cjs` | L8 |
| `netlify/functions/coherence-log.cjs` | L8 |
| `netlify/functions/perspective-projection.cjs` | L9 |
| `netlify/functions/superbrain-synthesis.js` | L10 |
| `src/pages/VoiceInspectionPage.tsx` | L0, L10 |
| `classifier-batch.cjs` | L11 (new regression harness from tonight) |

---

## Appendix A. Glossary deltas vs. DecisionPackage contract

The Reality Validation Engine contract introduces vocabulary that is not in the DecisionPackage contract. The terms below should be treated as authoritative.

- **EvidenceEntry**: a single typed envelope representing one piece of evidence answering one question. Has typed `answerSource`, `answerProvenance`, `questionDecisionImpact`.
- **ValidatedEvidenceSet**: a collection of EvidenceEntries that have passed the Reality Validation Gate, plus a list of unresolved questions and gate statistics.
- **Non-Evidence Token Registry**: the closed list of answer values (e.g., "Unknown", "N/A") that the gate rejects unconditionally.
- **Decision contamination**: a deterministically-detected condition where a stakeholder's stated position is influenced by an enumerated bias (production-bonus, prior-trauma, missing-calibration, etc.).
- **Out-of-scope attestation**: a typed declaration by the user that a specific CRITICAL question is not applicable to this inspection's scope. Subject to its own provenance gating.

