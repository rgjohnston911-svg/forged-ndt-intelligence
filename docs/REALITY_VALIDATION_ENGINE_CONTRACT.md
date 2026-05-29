# Reality Validation Engine Contract — v1.0

**Status:** Authoritative. The implementation must conform to this exactly.
**Patent alignment:** Enforces Claim 1(iv) provenance non-increase and Claim 1(ix) LLM-synthesis-only constraint across the situational awareness layer. Supports Claims 1, 5, 8, 11 of the FORGED 4D NDT Provisional Patent Disclosure.
**Consumers:** `netlify/functions/decision-core.ts`, `netlify/functions/comprehensive-assessment.ts`, `netlify/functions/parse-incident.ts`, `netlify/functions/perspective-projection.cjs`, `src/pages/VoiceInspectionPage.tsx`.

---

## 0. Purpose

The Reality Validation Engine is the **gate that protects the working evidence set from unprovenanced answers**. It runs over every candidate evidence entry — whether sourced from inspector field observation, sensor reading, code citation, calculation result, user form selection, or LLM inference — and classifies it by provenance and source before deciding whether it may enter the working set, and at what strength.

The Engine exists because the original NDT engine's core discipline — *"if reality is unknown, do not invent reality"* — was violated when the situational awareness layer began collecting user form responses and appending them to the working evidence as if they were field observations. The Engine restores that discipline as a typed, deterministic, testable architectural module that all evidence flows through.

It is the boundary between *candidate answer* and *accepted evidence*. Everything upstream proposes; the Engine disposes. Once an EvidenceEntry passes the gate, downstream decision logic may rely on its `provenance` and `confidence` fields as ground truth. Once an EvidenceEntry is rejected, the underlying question stays `UNRESOLVED` and the disposition gate continues to block.

The Reality Validation Engine does NOT replace the existing decision pipeline. It runs additively as a pre-gate to the existing `decision-core` evidence intake. Existing physics, damage, consequence, and authority reasoning continues unchanged. Only the *evidence intake surface* changes shape.

---

## 1. Top-level shapes

### 1.1 `EvidenceEntry`

Every piece of evidence in the system is represented as a typed envelope:

```json
{
  "entryId": "<string>",
  "questionId": "<string>",
  "questionText": "<string>",
  "questionDecisionImpact": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "answerValue": "<string|number|boolean|null>",
  "answerSource": "<SourceEnum>",
  "answerProvenance": "<ProvenanceEnum>",
  "answerConfidence": <number 0-1>,
  "collectedAt": "<ISO 8601>",
  "collectedBy": "<string|null>",
  "rawText": "<string|null>",
  "gateDecision": "<ACCEPTED|ACCEPTED_PROVISIONAL|REJECTED>",
  "gateReason": "<string>"
}
```

`gateDecision` and `gateReason` are populated by the Engine. All other fields are populated by the source layer.

### 1.2 `ValidatedEvidenceSet`

The Engine outputs a single object that decision-core consumes in place of the old free-text transcript evidence-extraction path:

```json
{
  "schemaVersion": "1.0",
  "caseId": "<string>",
  "evidenceTimestamp": "<ISO 8601>",
  "entries": [ <EvidenceEntry>, ... ],
  "unresolvedQuestions": [
    {
      "questionId": "<string>",
      "questionText": "<string>",
      "decisionImpact": "<LOW|MEDIUM|HIGH|CRITICAL>",
      "reason": "<UNRESOLVED|REJECTED_LOW_PROVENANCE|REJECTED_NON_EVIDENCE_VALUE|NO_RESPONSE>"
    }, ...
  ],
  "gateStatistics": {
    "candidatesIn": <int>,
    "accepted": <int>,
    "acceptedProvisional": <int>,
    "rejected": <int>,
    "rejectionsByReason": { "<reason>": <int>, ... }
  }
}
```

---

## 2. Enums

### 2.1 `ProvenanceEnum`

| Value | Meaning | Examples |
|---|---|---|
| `OBSERVED` | Eyewitness field observation by qualified person at the asset. | "Inspector saw a wet spot at the elbow," "ROV video showed coating damage." |
| `MEASURED` | Quantified reading from a calibrated instrument. | UT thickness 0.418", pressure 425 psig, hardness 18 HRC. |
| `DOCUMENTED` | Written record from an authoritative document. | API 570 governing code, original CMTR shows SA-106-B, drawing rev 4 wall = 0.562". |
| `INFERRED` | Derived by deterministic reasoning from observed/measured/documented inputs OR selected by a user from a constrained option list. | Form click "Yes, pressure change" from a Q&A card; UT trend derived from CML readings. |
| `SPECULATION` | An answer with no traceable basis. Includes LLM-generated content that does not cite a verified source, and free-text guesses by users. | LLM response "Probably HTHA," user-typed "Maybe a crack." |
| `NONE` | No answer was provided. Includes empty strings, null, and explicit non-answers like "Unknown," "N/A," "TBD." | (literal absence or non-evidence tokens) |

**Provenance ordering, weakest to strongest:** `NONE < SPECULATION < INFERRED < DOCUMENTED < MEASURED < OBSERVED`. (`OBSERVED` outranks `MEASURED` because direct observation is harder to falsify than a delegated instrument reading; both are stronger than written documentation alone.)

### 2.2 `SourceEnum`

| Value | Meaning |
|---|---|
| `SENSOR` | Direct sensor reading, presented with calibration metadata. |
| `INSPECTOR_FIELD` | Free-text inspector transcript or voice-to-text capture, parsed by `parse-incident`. |
| `CODE_CITATION` | Reference to a governing standard (API 570, ASME B31.3, etc.) extracted from the transcript or attached as evidence. |
| `CALCULATION` | Deterministic engine output (B31G remaining wall, Folias factor, etc.). |
| `USER_FORM_SELECTION` | User clicked an option in an SA Q&A card. |
| `LLM_INFERENCE` | Generated by an LLM. Always pairs with `provenance ∈ {INFERRED, SPECULATION}`. Never `OBSERVED` or `MEASURED`. |
| `PRIOR_INSPECTION` | Carried forward from a prior case in the asset registry. Subject to staleness rules (§6.4). |
| `NONE` | No source identified. Forces `provenance = NONE`. |

**Patent claim 1(ix) enforcement:** No EvidenceEntry may simultaneously have `answerSource = LLM_INFERENCE` and `answerProvenance ∈ {OBSERVED, MEASURED, DOCUMENTED}`. The Engine rejects such entries unconditionally with reason `LLM_OUTSIDE_SYNTHESIS_ROLE`.

### 2.3 `DecisionImpactEnum`

Each question carries a fixed decision-impact tier that determines how the Engine treats provenance shortfalls.

| Value | Meaning | Examples |
|---|---|---|
| `LOW` | Resolution does not change the disposition. | "Coating manufacturer name," "year of last paint job." |
| `MEDIUM` | Resolution shifts confidence but not the disposition class. | "Pit density per square foot," "ambient humidity at inspection." |
| `HIGH` | Resolution shifts the disposition between adjacent classes (e.g., MONITOR ↔ ENGINEERING_REVIEW). | "Fatigue margin estimate," "corrosion rate over last 3 readings." |
| `CRITICAL` | Resolution can change between HOLD/CONTINUE/SHUTDOWN; affects life-safety, environmental, or major financial exposure. | "Is there an active leak?", "Is the asset within Nelson curve limits after feedstock change?", "Was the calibration of the pressure sensor valid at the time of the reading?". |

---

## 3. Gate rules

The gate runs as a pure function over each candidate `EvidenceEntry`. It is deterministic, idempotent, and produces no side effects outside setting `gateDecision` and `gateReason`. No LLM is invoked inside the gate.

### 3.1 Hard rejections (return `REJECTED`)

The Engine rejects unconditionally when any of the following hold:

1. `answerValue` is null, empty string, or whitespace-only.
2. `answerValue` (lowercased, trimmed) matches the Non-Evidence Token Registry (§4).
3. `answerSource = NONE`.
4. `answerProvenance = NONE`.
5. `answerSource = LLM_INFERENCE` AND `answerProvenance ∈ {OBSERVED, MEASURED, DOCUMENTED}` (Claim 1(ix) violation).
6. `answerProvenance = SPECULATION` AND `questionDecisionImpact ≥ MEDIUM`.

Rejection sets `gateReason` to one of: `EMPTY_VALUE | NON_EVIDENCE_TOKEN | NO_SOURCE | NO_PROVENANCE | LLM_OUTSIDE_SYNTHESIS_ROLE | SPECULATION_ON_MATERIAL_QUESTION`.

### 3.2 Provisional acceptance (return `ACCEPTED_PROVISIONAL`)

The Engine accepts but marks the entry provisional when:

1. `answerProvenance = INFERRED` AND `questionDecisionImpact = CRITICAL`. The disposition gate treats provisional evidence as **insufficient to close** a CRITICAL question — the question stays effectively `UNRESOLVED` for disposition purposes even though the entry is recorded.
2. `answerProvenance = DOCUMENTED` AND `collectedAt` older than the staleness window for the question class (§6.4).

Provisional entries appear in the report's evidence ledger with explicit "PROVISIONAL — DOES NOT CLOSE QUESTION" annotation.

### 3.3 Full acceptance (return `ACCEPTED`)

All other entries pass. The Engine sets `gateDecision = ACCEPTED` and the entry enters the working evidence set at the strength implied by its `answerProvenance` field.

### 3.4 Decision gate interaction

`decision-core`'s hard confidence gate consumes the `ValidatedEvidenceSet` and applies the existing reality-confidence math, with one additional rule: **any CRITICAL question in `unresolvedQuestions[]` forces `disposition = HOLD_FOR_REVIEW` regardless of overall confidence.** A platform that produces a CONTINUE recommendation while a CRITICAL question is unresolved is failing the gate.

---

## 4. Non-Evidence Token Registry

Closed list. Case-insensitive, trimmed match. Any answerValue matching this list is rejected with reason `NON_EVIDENCE_TOKEN`.

```
unknown
n/a
na
none
not sure
not applicable
no response
tbd
to be determined
?
??
???
-
--
n/k
not known
don't know
dont know
unspecified
not specified
```

The Engine treats these as **declared non-answers**. They do not constitute evidence. They do not raise the provenance state of the question. They leave the question `UNRESOLVED`.

This registry is owned by `reality-validation-gate.cjs` and is the single source of truth across frontend and backend. The frontend uses it to refuse to render these as selectable options in SA Q&A cards (§5.2).

---

## 5. Integration contracts

### 5.1 `parse-incident.ts` — Typed Question Emission

When `parse-incident` returns `needs_input = true`, the `questions[]` array entries conform to:

```json
{
  "questionId": "<string, stable across re-asks>",
  "questionText": "<string>",
  "decisionImpact": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "allowedProvenances": ["INFERRED", "DOCUMENTED", "MEASURED", "OBSERVED"],
  "options": [
    { "value": "<string>", "implies_provenance": "<ProvenanceEnum>" },
    ...
  ],
  "freeTextAllowed": <boolean>,
  "rationale": "<string>"
}
```

`options[].value` must never appear in the Non-Evidence Token Registry. The Engine validates this at startup of `parse-incident` and refuses to emit malformed question sets.

### 5.2 Frontend — `VoiceInspectionPage.tsx`

The "AI Needs More Information" card is governed by the typed question contract. Specifically:

1. The card renders option buttons from `q.options[].value`. The registry filter (§4) is applied client-side as a defense-in-depth check; a violation logs a console error and the option is not rendered.
2. `selectedAnswers` stores the chosen option's full envelope, not its raw string. Shape per selected answer:

```json
{
  "questionId": "<string>",
  "answerValue": "<string>",
  "answerSource": "USER_FORM_SELECTION",
  "answerProvenance": "<ProvenanceEnum from option.implies_provenance>",
  "answerConfidence": 0.6,
  "collectedAt": "<ISO 8601>"
}
```

3. `handleGenerateWithAnswers` builds a `sa_responses: EvidenceEntry[]` array and submits it as a sibling field to `transcript` in the API payload. The transcript field is NOT mutated. The transcript field carries only what the inspector wrote or said.

### 5.3 Backend — `decision-core.ts` and `comprehensive-assessment.ts`

The handler signature gains an additional optional field on the request body:

```json
{
  "transcript": "<string>",
  "sa_responses": [ <EvidenceEntry>, ... ],
  "asset": { ... },
  ...
}
```

When `sa_responses[]` is present:

1. The handler imports the Reality Validation Gate module and runs each entry through it.
2. Accepted entries are added to the working evidence set with their declared provenance.
3. Provisional entries are added but flagged.
4. Rejected entries are dropped silently from the working set but logged into `gateStatistics`.
5. The `ValidatedEvidenceSet` is included in the response under `decision_core.validated_evidence` for audit visibility.

The Reality Validation Gate module is `netlify/functions/reality-validation-gate.cjs`, exported via:

```js
module.exports = {
  validateEntry: function(candidate) { ... returns gated entry ... },
  validateSet: function(candidates) { ... returns ValidatedEvidenceSet ... },
  NON_EVIDENCE_TOKENS: [ ... ],
  PROVENANCE_RANK: { ... }
};
```

### 5.4 Backwards compatibility

Requests that arrive WITHOUT `sa_responses[]` behave exactly as today. The Engine activates only when typed responses are supplied. The legacy text-annex approach is explicitly NOT supported — there is no annex parser, and any inspector free-text appended to the transcript is treated as inspector field observation, subject to the same gate rules via `parse-incident`'s extraction.

---

## 6. Staleness, idempotency, and replay

### 6.1 `entryId` uniqueness

`entryId` is a SHA-256 hash over the canonical JSON of `(questionId, answerValue, answerSource, answerProvenance, collectedAt, collectedBy)`. Two entries with identical content collapse to a single working evidence record; the second is rejected with reason `DUPLICATE_ENTRY`.

### 6.2 Replay determinism

The gate is pure and deterministic. Running the same `ValidatedEvidenceSet` through the same gate version produces an identical output. The DecisionPackage assembler may include the gate version in its provenance field to support replay verification.

### 6.3 Question carry-forward

When a question is `UNRESOLVED` at disposition time, the question persists in the case record. On the next inspection, the question is re-presented to the inspector with its prior `decisionImpact` intact. Resolution is incremental.

### 6.4 Staleness windows by question class

| Question Class | Staleness Window | Example |
|---|---|---|
| Material identification | None (immutable once documented) | CMTR-confirmed SA-106-B is permanent. |
| Calibration validity | 12 months | Pressure sensor calibration. |
| Inspection findings | Per the asset's inspection interval | UT readings, visual observations. |
| Operating envelope | Until next documented MOC | Operating pressure, temperature, feedstock. |
| Regulatory threshold | Per the cited rule's amendment date | BSEE reporting threshold, NACE MR0175 hardness limit. |

`collectedAt` older than the window forces `gateDecision = ACCEPTED_PROVISIONAL` with reason `STALE_EVIDENCE`. Re-validation is required before the entry can close a CRITICAL question.

---

## 7. Patent compliance notes

The Engine reinforces three patent claims:

**Claim 1(iv) — Provenance non-increase.** No upstream layer may produce an EvidenceEntry whose `answerProvenance` is stronger than the source actually supports. The gate's `LLM_OUTSIDE_SYNTHESIS_ROLE` rule and the `USER_FORM_SELECTION → INFERRED` mapping enforce this structurally; provenance cannot be inflated by routing through the form layer or the LLM layer.

**Claim 1(ix) — LLM synthesis-only.** The gate explicitly rejects LLM-sourced entries that claim OBSERVED, MEASURED, or DOCUMENTED provenance. LLMs may synthesize narrative over already-validated evidence (as in `superbrain-synthesis.js`); they may not be the source of the evidence itself.

**Claim 1(ii) — Determinism.** The gate is a pure function. Given identical inputs and identical gate-module version, the output is bit-identical. This is verifiable by hashing `ValidatedEvidenceSet` and comparing across runs.

---

## 8. Test strategy

The Engine ships with three test surfaces:

### 8.1 Unit tests — `tests/reality-validation-gate.test.cjs`

One assertion per gate rule. Covers: empty values, non-evidence token rejection, LLM-source-with-strong-provenance rejection, speculation-on-critical rejection, provisional-on-critical-inferred, staleness handling, duplicate entry collapse, provenance rank ordering.

Target: 25+ assertions, 100% pass.

### 8.2 Integration tests — extend `classifier-batch.cjs`

The existing 30-scenario classifier batch is renamed `decision-batch.cjs` and gains a `sa_responses[]` column. Scenarios that include form responses are added: NDT TEST 2 with the actual form selections that produced the bad output today, NDT TEST 1 with feedstock-change SA responses, plus 10 synthetic scenarios spanning the SourceEnum × ProvenanceEnum × DecisionImpactEnum cross-product.

Target: every CRITICAL-impact question without OBSERVED/MEASURED/DOCUMENTED evidence produces HOLD_FOR_REVIEW. No report contains naked answer values without question pairing. No "Unknown" appears as accepted evidence.

### 8.3 Regression — NDT TEST 1 and NDT TEST 2 fixtures

The exact transcripts from NDT TEST 1 (hydrotreater) and NDT TEST 2 (deepwater Gulf jumper) are committed as fixtures. The pre-Engine baseline reports are captured. Post-Engine reports must (a) eliminate the unprovenanced answer flood entirely, (b) leave CRITICAL questions explicitly UNRESOLVED with traceable reasons, and (c) produce HOLD_FOR_REVIEW dispositions with full evidence ledger visibility.

---

## 9. Implementation sequence

1. **Stage 1 (this document).** Contract spec frozen.
2. **Stage 2.** `reality-validation-gate.cjs` module + unit tests. No frontend or backend integration yet. Pure module, fully tested in isolation.
3. **Stage 3.** `parse-incident.ts` extended to emit typed question contracts (§5.1). `options[]` filtered against Non-Evidence Token Registry.
4. **Stage 4.** Frontend (`VoiceInspectionPage.tsx`) rewritten to build typed `sa_responses[]` (§5.2). Transcript field stops being mutated. Submission payload includes `sa_responses` as a sibling field.
5. **Stage 5.** Backend (`decision-core.ts`, `comprehensive-assessment.ts`) wired to call `validateSet()` and apply results. CRITICAL-unresolved → HOLD rule added to disposition gate.
6. **Stage 6.** Regression fixtures and batch tests pass. NDT TEST 2 re-run produces a clean report.
7. **Stage 7.** Production deploy.

Each stage is independently revertable. No stage is shipped until the prior stage's tests pass.

---

## 10. What this is not

This contract does not specify:

- The Stakeholder Reality Engine (the per-role projection of validated evidence into Inspector/Engineer/Reliability/Safety/Operations/Financial/Legal views). That is the next layer, designed in a separate contract.
- The Conflict Matrix and Consequence Simulator. Those operate on outputs of the Stakeholder Reality Engine.
- The Executive Decision Brief. That is a rendering of the Conflict Matrix and Consequence Simulator outputs.

Those four modules are downstream consumers of the `ValidatedEvidenceSet` produced by this Engine. Each must operate on the gated evidence set, not on raw transcripts or raw form responses. The Reality Validation Engine is the substrate that protects them all.

---

## Appendix A. Glossary

- **Candidate answer.** An EvidenceEntry as proposed by an upstream layer, before the gate runs.
- **Working evidence set.** The collection of accepted EvidenceEntries that downstream decision logic operates on.
- **Question class.** A category of question that shares decision-impact rules and staleness rules.
- **Provenance state.** The strongest provenance achieved on a question across all accepted entries answering it.
- **Closing a question.** Adding evidence sufficient to move the question from UNRESOLVED to RESOLVED for disposition purposes. CRITICAL questions require OBSERVED, MEASURED, or DOCUMENTED provenance to close.

