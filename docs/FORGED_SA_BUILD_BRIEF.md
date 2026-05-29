# FORGED 4D NDT — Situational Awareness Build Brief

**Handoff file for Claude Code.** This is the single source of truth for adding the
Situational Awareness (SA) layer to the 4D NDT Intelligence OS **without rebuilding,
regressing, or compromising the patent-disclosed core.**

Stack: Claude Code · GitHub (web editor → commit) · Supabase · Netlify (functions + auto-deploy).

---

## 0. Read this first — what "better than the original" means

The validated deterministic core is the platform's primary asset:
- DEPLOY154 / v16.6e baseline + the DEPLOY162→DEPLOY360 hardening stack
- 20+ golden cases at 100%, Golden Suite ~97.1%, Blind Suite ~97.4%
- Full provisional patent disclosure already filed against this architecture

**"Better" does NOT mean rewriting the core.** It means three things only:

1. Adding the SA capability the original lacked, architected so it can **never** corrupt the core.
2. Promoting two invariants the original enforced *by convention* — provenance non-increase
   and evidence-vs-opinion separation — to **structural enforcement**.
3. Closing the two specific holes that caused the last SA failure (Section 2).

Rebuilding the core would discard validated, patent-disclosed work and reintroduce every bug
the hardening sprints already closed. **Do not do it.**

---

## 1. PRIME DIRECTIVES (non-negotiable)

1. **The deterministic core (layers L0–L8) is FROZEN.** Do not refactor, reshape outputs, rename
   fields, "clean up", or "improve" any of: `decision-core.ts`, `comprehensive-assessment.ts`,
   `disposition-pathway.js`, `authority-lock-system.ts`, `mechanism-catalog.ts`,
   `decision-package-assembler.cjs`, `package-store.cjs`, `replay-audit.cjs`, `sign-export.cjs`,
   `coherence-log.cjs`. Touch them only where this brief explicitly authorizes it.

2. **SA is strictly additive and strictly downstream of the frozen DecisionPackage.** It runs
   after the package is assembled and hashed. It consumes the package; it does not produce it.

3. **SA NEVER writes back into any core layer.** No SA module may import or call the L0–L8 engines.
   The dependency is one-way: SA → DecisionPackage. Never the reverse.

4. **SA output NEVER goes inside the DecisionPackage.** Do **not** add a `validatedEvidenceSet`
   (or any other SA field) to the DecisionPackage. Adding any field — even `null` — changes the
   canonical-JSON SHA-256 and silently breaks `replay-audit.cjs` against every package already in
   Supabase/Blobs. SA output lives in a **separate `SituationalAwarenessPackage`** that references
   the DecisionPackage **by hash**. The DecisionPackage stays byte-for-byte identical.

5. **Answering a question is NEW EVIDENCE, not a mutation.** When a user/stakeholder answers an
   SA question, the answer is validated by the gate, typed as evidence, and fed as input to a
   **fresh deterministic core run** that produces a **new** frozen DecisionPackage superseding the
   old one (chain by hash). Nothing is ever edited in place. This is how the loop stays
   deterministic, replayable, and patent-safe.

6. **One revertable stage at a time. Every commit ships.** Follow Section 6 in order. Backend
   functions deploy before any frontend that depends on them. Use sequential `DEPLOY##` numbering.

7. **Closed enumerations stay closed.** No new asset domains (patent Claim 7 = 14 domains). No new
   hard locks (Claim 8 = 10 locks). SA adds neither.

8. **The transcript is immutable input.** SA answers are carried in a sibling field
   (`sa_responses[]`), never concatenated into the transcript. See Section 2A.

---

## 2. What broke last time — do not repeat either failure

The previous SA attempt caused major problems via **two distinct holes**. SA must close **both**.

### 2A. Intake-surface hole (transcript mutation)
SA answers were folded back into the `transcript` string and re-parsed through L0–L3. That
re-resolved `assetClass` off contaminated text and broke determinism before provenance ever
mattered. This was the NDT TEST 2 exploit.
**Guard:** SA answers travel as typed `sa_responses[]`, a sibling of `transcript`. On any
re-generation, assert `sha256(submitted_transcript) === sha256(original_transcript)` and **fail
loud** if they differ. The transcript is never mutated.

### 2B. Provenance hole (opinion became evidence)
SA answers — including opinions, recommendations, "Unknown", and malformed values — were accepted
as evidence. Evidence must remain measured / observed / documented fact.
**Guard:** Every candidate answer passes through the **Reality Validation Gate** (Appendix A)
before it can enter the working evidence set. The gate keys off the **typed `answerSource`**, not
on whether an LLM was involved.

---

## 3. Protected invariants (patent + determinism)

Preserve all of these. SA must not weaken any of them; it should strengthen 1(iv) and 1(ix).

- **1(i) Physics-first** — SA runs only after the deterministic engines complete.
- **1(ii) Determinism** — same input → same output. No `Date.now()`, no `Math.random()`, no
  Object-key-order dependence inside any SA module. Time-sensitive logic (staleness) takes an
  explicit `referenceMs` parameter passed by the caller; it never reads the clock itself.
- **1(iii)/2 Klein bottle 6-state topology** — disposition state machine untouched. SA consumes
  disposition; it never produces it.
- **1(iv) Provenance non-increase** — no downstream layer may raise apparent evidence strength
  above its source. The gate enforces this structurally (Appendix A).
- **1(v) Reality-confidence-gated disposition** — the existing hard confidence gate is unchanged.
  Do **not** add a new "CRITICAL-unresolved → HOLD" rule inside the gate. Once SA evidence is typed
  and fed into a fresh run, the **existing** gate already HOLDs if a CRITICAL question is still
  unresolved. The only parser work is scoping (Section 6, Stage 3) so out-of-scope CRITICAL
  questions are not emitted in the first place.
- **1(ix) LLM synthesis-only** — LLMs may narrate over validated evidence; they may never be an
  evidence source. The gate rejects `LLM_INFERENCE` paired with strong provenance.
- **3 Multi-LLM adversarial validation** — unchanged; SA is orthogonal and downstream.
- **4 / 5** — FMD 0.6 compound rule and reality-tier-stratified timeline (L4) untouched.
- **7 / 8** — 14 domains and 10 hard locks remain closed.
- **11 / 12 / 13 / 14** — evidence ledger, authority chain, inspection scoring, contradiction
  matrix schemas all unchanged.
- **19 DecisionPackage canonicalization** — unchanged because SA never modifies the package
  (Directive 4).
- **CIP-a/b/c** — replay verification, Reality Integrity Score, coherence log: unchanged. SA may
  emit **new** event types into the coherence log but must not alter existing event semantics.

---

## 4. Reconciled SA architecture

### 4.1 Boundary
- **Logical separation, not a separate running service.** Same repo, same Netlify deploy. SA lives
  in a dedicated function namespace: `netlify/functions/situational-awareness-*.cjs`. SA modules
  import the `SituationalAwarenessPackage`/`DecisionPackage` contracts only. They are structurally
  forbidden from importing `decision-core` or any L0–L8 engine. (A true separate service is a later
  option only if a second product — diving ops, WHAT IF MD — consumes the package; do not build it
  now.)

### 4.2 The loop (how SA "awareness" works without mutation)
```
DecisionPackage (frozen, hashed)
        │
        ▼
parse-incident emits typed, scope-checked questions[]
        │
        ▼  user answers
sa_responses[] (sibling to transcript; transcript untouched)
        │
        ▼
reality-validation-gate.validateSet()  → ValidatedEvidenceSet
        │
        ├─ unresolved CRITICAL? → SituationalAwarenessPackage flags it; existing gate will HOLD
        │
        ▼  validated entries become typed evidence INPUT
fresh deterministic core run → NEW DecisionPackage (new hash, supersedes old, chained)
        │
        ▼
SA projection modules (L9.1–L9.4) read the new package
        │
        ▼
SituationalAwarenessPackage { decisionPackageHash, validatedEvidenceSet, stakeholderViews,
                              conflictMatrix, consequenceScenarios, executiveBrief }
```

### 4.3 Modules
- **L9.0 `reality-validation-gate.cjs`** — pure deterministic gate (Appendix A). Substrate;
  everything else consumes its output.
- **L9.1 `situational-awareness-stakeholder.cjs`** — projects the package into role views
  (existing 6 + RELIABILITY, FINANCIAL, LEGAL). FINANCIAL/LEGAL signals come only from
  user-provided inputs or the authority chain — never LLM-inferred.
- **L9.2 `situational-awareness-conflict.cjs`** — deterministic enumerated bias/conflict ruleset
  over the role views. No LLM.
- **L9.3 `situational-awareness-consequence.cjs`** — per-option scenarios; pulls probabilities from
  L4 Failure Timeline + Supabase precedents only; emits `confidence: 0` when no basis exists.
  Build this **last**, after the rest is validated.
- **L9.4 `situational-awareness-brief.cjs`** — one-page executive rendering of L9.1–L9.3. Produces
  no new evidence.

Data contracts are in Appendix B.

---

## 5. Permanent coding constraints (apply to every file)

- **`netlify/functions/*.js` and all new SA `*.cjs`: pure JS only.** No TypeScript syntax. `var`
  declarations only (no `const`/`let`). String **concatenation** only — no template literals / no
  backticks. `module.exports` pattern. Avoid arrow functions; use `function` declarations.
- **`netlify/functions/decision-core.ts`** is the explicit `.ts` exception; it carries
  `@ts-nocheck`. Inside TS callback closures, capture locals into `var` first (strict mode loses
  null-narrowing across closure boundaries).
- **Always deliver complete, paste-ready replacement files.** Never line-by-line diffs or partial
  edits. The user commits whole files via the GitHub web editor.
- **Backend Netlify functions deploy before any dependent frontend.**
- **Sequential `DEPLOY##` numbering** on every change set.
- Before any GitHub web-editor commit, the user runs **Ctrl+F "git pull"** — surface that reminder.
- React card components live at **`src/` root**, not `src/components/`.
- The PDF generator lives **inside `VoiceInspectionPage.tsx`** as `generateInspectionReport()` —
  not a separate file. Export-PDF must gate on `isGenerating`.
- **Diagnose before writing code.** If a change isn't clearly additive and reversible, stop and
  state the risk before proceeding.

---

## 6. Staged build order

Each stage is independently revertable and leaves the platform shippable. Pre-SA behavior (no
`sa_responses` in the request) must stay **bit-identical** at every stage.

| # | Deliverable | Must NOT do | Acceptance gate |
|---|---|---|---|
| 1 | `situational-awareness-gate.cjs` (= `reality-validation-gate.cjs`, Appendix A) + unit tests. **No callers.** | Touch any core file | Unit tests green; module imported by nothing |
| 2 | `parse-incident.ts`: emit typed `questions[]` with `decisionImpact`, `allowedProvenances`, options filtered against the Non-Evidence Token Registry. Backwards-compatible (old shape still works). | Emit out-of-scope CRITICAL questions; change pre-SA output | Pre-SA parse output bit-identical |
| 3 | Question **scoping** in `parse-incident.ts`: do not emit a CRITICAL question incompatible with the inspection scope (resolves the routine-UT-survey false-HOLD case). | Add scope logic anywhere downstream | No spurious CRITICAL questions on routine scenarios |
| 4 | `VoiceInspectionPage.tsx`: rewrite `handleGenerateWithAnswers` to build typed `sa_responses[]` as a sibling to `transcript`. Add the transcript-hash invariant (2A). | Mutate the transcript; alter pre-SA submit path | Transcript hash equal on re-gen; pre-SA submit unchanged |
| 5 | Orchestrator wiring: when `sa_responses[]` present, call `validateSet()`, feed validated entries as typed evidence into a **fresh** core run producing a new DecisionPackage. | Add fields to DecisionPackage; add a HOLD rule in the gate | New package valid + chained; existing gate HOLDs on unresolved CRITICAL |
| 6 | **Regression**: full Golden Suite + Blind Suite + classifier batch with `sa_responses` ABSENT. | — | Bit-identical dispositions on all cases |
| 7 | `situational-awareness-stakeholder.cjs` (6 → 9 role views) | LLM-infer FINANCIAL/LEGAL | Pure-function determinism test |
| 8 | `situational-awareness-conflict.cjs` (enumerated bias rules) | Any LLM call | Deterministic on fixed inputs |
| 9 | `situational-awareness-brief.cjs` + report section (renders only when SA present) | Render anything when SA absent | Report bit-identical when SA absent |
| 10 | `situational-awareness-consequence.cjs` | Invent probabilities | `confidence:0` when no basis |
| 11 | `SituationalAwarenessPackage` assembler + hash/sign/coherence-log extension | Modify DecisionPackage hashing | SA package hashes/signs independently |

---

## 7. Definition of done

- Every stage above green, in order.
- With `sa_responses` absent: Golden + Blind + classifier batch **bit-identical** to the frozen
  baseline.
- `replay-audit.cjs` still verifies **every pre-existing** stored DecisionPackage (proves Directive
  4 held).
- Transcript-hash invariant fires correctly on a deliberately-mutated re-gen test.
- Gate rejects: opinions, `LLM_INFERENCE`+strong-provenance, Non-Evidence Tokens, stale evidence,
  and collapses duplicates — all under unit test.

---

## 8. EXPLICITLY FORBIDDEN

- Rewriting / refactoring / "improving" any frozen core file (Directive 1).
- Adding any field to the DecisionPackage (Directive 4).
- Mutating the transcript (Directive 8 / 2A).
- Treating any LLM output as an evidence source (1(ix)).
- Adding a new hard lock or a CRITICAL-unresolved HOLD rule inside the gate (use the existing gate).
- Adding a new asset domain (Claim 7).
- Building a separate network service now (4.1).
- Reading the clock inside any SA module (use `referenceMs`).
- Partial / line-by-line edits (Section 5).

---

## Appendix A — Stage 1 reference implementation: `reality-validation-gate.cjs`

Pure, deterministic, no I/O, no LLM, no clock. Paste-ready. **No callers** at Stage 1.

```js
// ============================================================================
// reality-validation-gate.cjs   (SA layer L9.0 substrate)
// FORGED 4D NDT — Situational Awareness
//
// PURE DETERMINISTIC MODULE.
//   - No callers at Stage 1.
//   - No LLM. No network. No filesystem. No Date.now() / Math.random().
//   - var only. String concatenation only. module.exports.
//
// Purpose: validate every candidate EvidenceEntry before it may enter the
// working evidence set. Enforces (structurally):
//   * provenance non-increase            (patent 1(iv))
//   * LLM-source-with-strong-provenance rejection (patent 1(ix))
//   * Non-Evidence Token Registry filtering
//   * speculation-on-CRITICAL rejection
//   * staleness windows (via caller-supplied referenceMs)
//   * duplicate collapse (deterministic, strongest-wins)
//
// The gate keys off the TYPED answerSource, never off whether an LLM touched
// the bytes. An LLM that merely parses inspector free-text into a typed value
// is a TOOL: set answerSource = "INSPECTOR_FIELD" and note extractionTool.
// ============================================================================

// Closed registry of answer values that are never evidence (normalized).
var NON_EVIDENCE_TOKENS = [
  "", "unknown", "n/a", "na", "none", "not sure", "notsure",
  "dont know", "do not know", "tbd", "to be determined",
  "maybe", "possibly", "idk", "unsure", "no idea", "not applicable"
];

// answerSource -> the strongest provenance that source is permitted to assert.
var SOURCE_MAX_PROVENANCE = {
  INSTRUMENT:          "MEASURED",
  INSPECTOR_FIELD:     "OBSERVED",
  DOCUMENT:            "DOCUMENTED",
  REGISTRY:            "DOCUMENTED",
  LLM_INFERENCE:       "INFERRED",
  STAKEHOLDER_OPINION: "REPORTED",
  ASSUMPTION:          "ASSUMED"
};

// Provenance strength ranking (higher = stronger).
var PROVENANCE_RANK = {
  MEASURED: 5, OBSERVED: 4, DOCUMENTED: 4,
  INFERRED: 2, REPORTED: 2, ASSUMED: 1, UNKNOWN: 0
};

// Provenance levels strong enough to RESOLVE a CRITICAL question.
var STRONG_PROVENANCE = { MEASURED: true, OBSERVED: true, DOCUMENTED: true };

// Staleness windows in ms, by question decision impact.
var STALENESS_MS = {
  CRITICAL: 1000 * 60 * 60 * 24 * 7,
  HIGH:     1000 * 60 * 60 * 24 * 30,
  MEDIUM:   1000 * 60 * 60 * 24 * 90,
  LOW:      1000 * 60 * 60 * 24 * 365
};

function normalizeToken(value) {
  if (value === null || value === undefined) { return ""; }
  var s = String(value).toLowerCase();
  s = s.replace(/[^a-z0-9 ]/g, "");
  s = s.replace(/\s+/g, " ");
  return s.replace(/^ +| +$/g, "");
}

function isNonEvidenceToken(value) {
  var norm = normalizeToken(value);
  for (var i = 0; i < NON_EVIDENCE_TOKENS.length; i++) {
    if (NON_EVIDENCE_TOKENS[i] === norm) { return true; }
  }
  return false;
}

function rankOf(provenance) {
  var r = PROVENANCE_RANK[provenance];
  return (typeof r === "number") ? r : -1;
}

// Validate a single candidate entry. Returns { ok, reason }.
function validateEntry(entry, referenceMs) {
  if (!entry || typeof entry !== "object") {
    return { ok: false, reason: "MALFORMED_ENTRY" };
  }
  if (!entry.questionId || !entry.answerSource ||
      !entry.answerProvenance || !entry.questionDecisionImpact) {
    return { ok: false, reason: "MISSING_REQUIRED_FIELD" };
  }
  if (isNonEvidenceToken(entry.answerValue)) {
    return { ok: false, reason: "NON_EVIDENCE_TOKEN" };
  }

  var maxProv = SOURCE_MAX_PROVENANCE[entry.answerSource];
  if (!maxProv) {
    return { ok: false, reason: "UNKNOWN_SOURCE" };
  }
  if (rankOf(entry.answerProvenance) < 0) {
    return { ok: false, reason: "UNKNOWN_PROVENANCE" };
  }

  // Provenance non-increase: asserted strength may not exceed the source ceiling.
  // (This is what rejects LLM_INFERENCE claiming OBSERVED/MEASURED/DOCUMENTED.)
  if (rankOf(entry.answerProvenance) > rankOf(maxProv)) {
    return { ok: false, reason: "PROVENANCE_INFLATION" };
  }

  // Staleness (only when a timestamp and reference time are both present).
  if (entry.observedAtIso && typeof referenceMs === "number") {
    var t = new Date(entry.observedAtIso).getTime();
    if (isNaN(t)) {
      return { ok: false, reason: "BAD_TIMESTAMP" };
    }
    var window = STALENESS_MS[entry.questionDecisionImpact];
    if (typeof window === "number" && (referenceMs - t) > window) {
      return { ok: false, reason: "STALE_EVIDENCE" };
    }
  }

  return { ok: true, reason: null };
}

// Validate a set of candidates against the required questions.
//   candidates       : array of EvidenceEntry
//   requiredQuestions: array of { questionId, decisionImpact }
//   referenceMs      : caller-supplied epoch ms (NEVER read the clock here)
// Returns a ValidatedEvidenceSet.
function validateSet(candidates, requiredQuestions, referenceMs) {
  var validatedByQuestion = {};   // questionId -> { entry, index }
  var validated = [];
  var rejected = [];
  var list = (candidates && candidates.length) ? candidates : [];

  for (var i = 0; i < list.length; i++) {
    var entry = list[i];
    var result = validateEntry(entry, referenceMs);
    if (!result.ok) {
      rejected.push({ entry: entry, reason: result.reason });
      continue;
    }
    var qid = entry.questionId;
    var existing = validatedByQuestion[qid];
    if (!existing) {
      validatedByQuestion[qid] = { entry: entry, index: i };
    } else {
      // Duplicate collapse: strongest provenance wins; tie -> earliest index.
      var keepNew = false;
      if (rankOf(entry.answerProvenance) > rankOf(existing.entry.answerProvenance)) {
        keepNew = true;
      }
      if (keepNew) {
        rejected.push({ entry: existing.entry, reason: "DUPLICATE_COLLAPSED" });
        validatedByQuestion[qid] = { entry: entry, index: i };
      } else {
        rejected.push({ entry: entry, reason: "DUPLICATE_COLLAPSED" });
      }
    }
  }

  // Flatten kept entries in original submission order for determinism.
  var keptIndexed = [];
  for (var key in validatedByQuestion) {
    if (validatedByQuestion.hasOwnProperty(key)) {
      keptIndexed.push(validatedByQuestion[key]);
    }
  }
  keptIndexed.sort(function (a, b) { return a.index - b.index; });
  for (var k = 0; k < keptIndexed.length; k++) {
    validated.push(keptIndexed[k].entry);
  }

  // Resolution check. A required question is unresolved if it has no kept
  // entry, or it is CRITICAL and its kept entry is not strong provenance
  // (speculation-on-CRITICAL does not resolve it).
  var unresolvedQuestions = [];
  var required = (requiredQuestions && requiredQuestions.length) ? requiredQuestions : [];
  var criticalUnresolved = 0;
  for (var q = 0; q < required.length; q++) {
    var rq = required[q];
    var kept = validatedByQuestion[rq.questionId];
    var resolved = false;
    if (kept) {
      if (rq.decisionImpact === "CRITICAL") {
        resolved = STRONG_PROVENANCE[kept.entry.answerProvenance] === true;
      } else {
        resolved = true;
      }
    }
    if (!resolved) {
      unresolvedQuestions.push(rq.questionId);
      if (rq.decisionImpact === "CRITICAL") { criticalUnresolved++; }
    }
  }

  return {
    validated: validated,
    rejected: rejected,
    unresolvedQuestions: unresolvedQuestions,
    stats: {
      submitted: list.length,
      validated: validated.length,
      rejected: rejected.length,
      criticalUnresolved: criticalUnresolved
    }
  };
}

module.exports = {
  validateEntry: validateEntry,
  validateSet: validateSet,
  // exported for unit tests:
  isNonEvidenceToken: isNonEvidenceToken,
  normalizeToken: normalizeToken,
  SOURCE_MAX_PROVENANCE: SOURCE_MAX_PROVENANCE,
  PROVENANCE_RANK: PROVENANCE_RANK
};
```

### Minimal unit checks for Stage 1 (paste into a `*.test.cjs` or a scratch runner)
```js
var gate = require("./situational-awareness-gate.cjs");

function assert(cond, msg) { if (!cond) { throw new Error("FAIL: " + msg); } }

// opinion / non-evidence token rejected
assert(gate.isNonEvidenceToken("Unknown") === true, "Unknown is non-evidence");
assert(gate.isNonEvidenceToken("0.418") === false, "measurement is evidence");

// LLM claiming OBSERVED is rejected (provenance inflation)
var r1 = gate.validateEntry({
  questionId: "q1", questionDecisionImpact: "HIGH",
  answerValue: "wall loss present", answerSource: "LLM_INFERENCE",
  answerProvenance: "OBSERVED"
}, 0);
assert(r1.ok === false && r1.reason === "PROVENANCE_INFLATION", "LLM cannot assert OBSERVED");

// instrument MEASURED accepted
var r2 = gate.validateEntry({
  questionId: "q2", questionDecisionImpact: "CRITICAL",
  answerValue: "0.418", answerSource: "INSTRUMENT", answerProvenance: "MEASURED"
}, 0);
assert(r2.ok === true, "instrument MEASURED accepted");

// CRITICAL resolved only by strong provenance
var set = gate.validateSet(
  [{ questionId: "leak", questionDecisionImpact: "CRITICAL",
     answerValue: "maybe later", answerSource: "STAKEHOLDER_OPINION",
     answerProvenance: "REPORTED" }],
  [{ questionId: "leak", decisionImpact: "CRITICAL" }],
  0
);
assert(set.stats.criticalUnresolved === 1, "opinion does not resolve CRITICAL");

console.log("All Stage 1 gate checks passed.");
```

---

## Appendix B — Data contracts

```
EvidenceEntry {
  questionId:            string
  questionDecisionImpact:"CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  answerValue:           string            // the actual answer
  answerSource:          "INSTRUMENT" | "INSPECTOR_FIELD" | "DOCUMENT" | "REGISTRY"
                       | "LLM_INFERENCE" | "STAKEHOLDER_OPINION" | "ASSUMPTION"
  answerProvenance:      "MEASURED" | "OBSERVED" | "DOCUMENTED" | "INFERRED"
                       | "REPORTED" | "ASSUMED" | "UNKNOWN"
  observedAtIso?:        string            // ISO timestamp; enables staleness check
  extractionTool?:       string            // annotation only (e.g. "llm-parser"); NOT the source
}

ValidatedEvidenceSet {
  validated:            EvidenceEntry[]
  rejected:             { entry: EvidenceEntry, reason: string }[]
  unresolvedQuestions:  string[]           // questionIds still open (incl. speculated CRITICALs)
  stats:                { submitted, validated, rejected, criticalUnresolved }
}

SituationalAwarenessPackage {
  decisionPackageHash:  string             // references the FROZEN DecisionPackage by hash
  validatedEvidenceSet: ValidatedEvidenceSet
  stakeholderViews:     StakeholderRealityView[]   // L9.1
  conflictMatrix:       ConflictMatrix             // L9.2
  consequenceScenarios: ConsequenceScenario[]      // L9.3 (built last)
  executiveBrief:       ExecutiveBrief             // L9.4
  saPackageHash:        string             // SA artifact's own hash (independent of DP hash)
}
```

**Provenance ceiling reference** (what each source may assert):
`INSTRUMENT→MEASURED · INSPECTOR_FIELD→OBSERVED · DOCUMENT/REGISTRY→DOCUMENTED ·
LLM_INFERENCE→INFERRED · STAKEHOLDER_OPINION→REPORTED · ASSUMPTION→ASSUMED`.
Only `MEASURED/OBSERVED/DOCUMENTED` can resolve a CRITICAL question.
