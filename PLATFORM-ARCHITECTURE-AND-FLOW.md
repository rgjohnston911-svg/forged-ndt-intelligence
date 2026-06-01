# FORGED 4D NDT Intelligence OS — Architecture, Flow, and the Honest Problem

**Purpose of this document.** Stop the one-scenario-at-a-time grind. This is a single,
accurate map of how the platform actually works (pulled from the code, not from memory),
an honest diagnosis of *why it keeps losing to GPT*, and a menu of real architectural
options. It is written to be read by a human, by GPT, and by Claude together so we can
agree on a direction before writing another line of engine code.

---

## 1. What the platform is supposed to do

Take a field inspection account (voice or text) about an industrial asset and produce a
defensible engineering disposition: what is the asset, what governs its risk, what code/
authority applies, what is the remaining strength, what should happen next — with every
claim traceable to a stated fact or a cited standard. The differentiator vs a raw LLM is
supposed to be **determinism, provenance, and auditability**: the same input always gives
the same answer, and every answer can be defended in front of a regulator.

---

## 2. The actual pipeline (in execution order)

This is the real sequence in `src/pages/VoiceInspectionPage.tsx` (`handleGenerate` →
`continuePipeline`). ~238 serverless functions exist in `netlify/functions/`, but the
live decision path is this chain:

```
TRANSCRIPT (voice/text)
   │
   ├─►(parallel)  parse-incident         → events, numeric values
   │              resolve-asset          → asset_class / asset_type / confidence   [resolve-asset.ts]
   │              voice-grammar-bridge    → extracted measurements
   │
   ├─► reality-lock          → domain classification + asset-compat override        [reality-lock.ts + domain-classifier.cjs]
   │        ▲ THE CASCADE ENTRY POINT — see §6
   │
   ├─[pause]  clarifying questions (first round only)
   ├─[pause]  evidence confirmation
   │
   └─► continuePipeline:
          evidence-provenance        → which facts are trusted
          authority-lock             → governing code (API 510/570/653/RP 2A/…)     [authority-lock.js]
          global-authority-engine    → jurisdiction crosswalk (US ↔ local)
          remaining-strength         → B31G / wall-loss / MAOP                       [remaining-strength]
          decision-core              → consequence tier, disposition spine          [decision-core.ts]
          failure-mode-dominance     → governing/suspected mechanism                 [failure-mode-dominance.js]
          disposition-pathway        → actions, intervals, conditions               [disposition-pathway.js]
          failure-timeline           → time-to-failure estimate                     [failure-timeline.js]
          situational-awareness-orchestrate → SA package + convergence              [situational-awareness-*.cjs]
          resolveGoverningReality()  → DETERMINISTIC ARBITER over all of the above   [src/lib/governingReality.ts]
          superbrain-synthesis       → LLM (GPT-4o), runs LAST with full bundle      [superbrain-synthesis.ts]
   │
   └─► REPORT RENDER (governing-reality top line + per-engine cards)
```

Two facts about this shape matter enormously:

1. **It is linear and front-loaded.** `resolve-asset` and `reality-lock` run first, and
   every engine after them consumes their output. The asset classification is the
   foundation the entire tower is built on.
2. **The LLM runs last, as a synthesizer — not as the reasoner.** GPT only sees the
   problem *after* the deterministic engines have already committed to an asset, an
   authority, and a mechanism. The LLM cannot fix an upstream classification error; it
   can only narrate on top of it.

---

## 3. Deterministic engines vs the LLM

- **Deterministic engines** (`.ts`/`.js`/`.cjs`): pure functions, keyword/regex/physics
  driven, no randomness. Strength: reproducible, auditable, fast. Weakness: brittle —
  they recognize what their keyword lists were written to recognize, and nothing else.
- **The LLM (superbrain, GPT-4o)**: constrained by a report-provenance validator so it
  can't invent facts. Strength: holistic reasoning over the whole transcript. Weakness:
  in this architecture it is boxed in at the end and inherits whatever the engines decided.
- **`governingReality.ts`**: a deterministic *arbiter* that sits above the engines and
  picks which "reality" governs, by a precedence ladder (§4). It never invents; it only
  selects among already-computed engine outputs.

---

## 4. The governing-reality precedence ladder

`resolveGoverningReality()` ranks candidate realities top-down and returns the first that
fires (this is the report's headline):

```
1.  CONFIRMED_CRITICAL_DAMAGE
1b. CONTROL_SOFTWARE_FLEET_FAILURE          (software change + fleet-wide failure pattern)
2.  SYSTEM_DRIFT_NO_MECHANISM               (≥3 domain-agnostic drift signals, no defect)
2b. OPERATIONAL_CHANGE_WITHOUT_REASSESSMENT
3.  CONVERGENT_MECHANISM_GOVERNS            (≥3 convergence streams; outranks single-mode FMD)
4.  SUSPECTED_GOVERNING_MECHANISM
5.  FORWARD_TRAJECTORY_GOVERNS
6.  ASSURANCE_FAILURE_UNKNOWN_STATE         (≥2 "loss of ability to know" facts)
7.  ORGANIZATIONAL_ASSURANCE_FAILURE
8.  MEASURED_DAMAGE_GOVERNS
9.  INSUFFICIENT_EVIDENCE_HOLD
10. NONE
```

Each class is signature-gated (named only when its specific signals are present) to
prevent contamination. **This ladder is also where most of the recent firefighting has
landed** — almost every TEST 16–22 fix added or reordered a class here. That is a symptom
worth noting (§6).

---

## 5. How it is tested today

- **35 acceptance gates** (`tests/*.test.cjs`, run by `scripts/run-gates.cjs`) — block a
  deploy if red. Wired into CI and the Netlify build.
- **Offline SA eval harness** (`npm run eval` → `scripts/eval-sa.cjs`, 14 cases in
  `tests/fixtures/sa-eval-cases.json`) — runs the full decision-core → governing-reality
  pipeline per case and scores structured labels + anti-contamination ("must_not_contain").

Important limitation: **the eval harness keys off `asset_class` passed in directly.** It
does *not* exercise `resolve-asset` + `reality-lock` — which is exactly where the TEST 22
furnace→offshore failure lived. Our test net has a hole at the front of the pipeline.

---

## 6. The honest diagnosis — why it keeps losing to GPT

The pattern across 20 tests is not 20 unrelated bugs. It is **two structural weaknesses**
expressing themselves over and over:

### Weakness A — a brittle, keyword-gated front end on a linear pipeline
The asset/domain is decided first by keyword matching, and every downstream engine trusts
that decision. So a single weak keyword can poison everything. TEST 22 is the textbook
case: the generic word *"hydrocarbon"* scored the furnace as **offshore**, and
`reality-lock` then **force-overrode** the correctly-resolved pressure vessel to
`offshore_platform` → API RP 2A → structural-instability → fabricated fatality. As GPT put
it: *"once the authority engine is wrong, everything downstream becomes contaminated."*
That is not a keyword bug — it is the **cascade architecture** doing what a cascade does.

GPT does not have this failure mode because GPT reads the **entire transcript at once** and
reasons holistically. It never "commits" to an asset class via a keyword tally that the
rest of the reasoning is then chained to.

### Weakness B — corrections accumulate as special cases, not principles
Look at §4: TEST 16 added fatigue-dominance, 17/18 added SYSTEM_DRIFT, 20 added
CONVERGENT_MECHANISM, 21 added ASSURANCE_FAILURE, 22 added CONTROL_SOFTWARE_FLEET. Each was
a correct fix for that scenario, but the method is *pattern-matching to the last failure*.
The next unseen scenario finds the next gap. This is why it feels like whack-a-mole: it **is**
whack-a-mole, because the system encodes a growing list of recognized situations rather than
a general reasoning procedure. GPT generalizes; a keyword ladder enumerates.

### The net effect
The platform is most competitive when a scenario falls squarely inside a class it already
encodes (confirmed damage, a clean documented vessel). It loses to GPT whenever the
scenario (a) trips a brittle classifier at the front, or (b) is a *kind* of situation the
ladder hasn't been taught yet. Adding more classes narrows the gap asymptotically but never
closes it, because the world has more situations than we can enumerate.

---

## 7. What the platform is actually good at (don't throw this away)

The deterministic core has real, defensible value that GPT alone does **not** provide:
reproducibility (same input → same output, every time), provenance (no invented numbers —
the validator blocks it), code citations, B31G/remaining-strength math, and an auditable
trace a regulator can follow. The problem is not that the engines are worthless — it's that
they are positioned as the *reasoner* (front of a cascade) when their real strength is as a
*verifier/constrainer*. That reframing is the key to §8.

---

## 8. The real options (this is the decision to make together)

### Option A — Keep hardening the linear pipeline (status quo)
Make each engine defensive: confidence-gate every classifier, forbid destructive overrides,
add classes as new situations appear. *(The TEST 22 fix already did two of these: removed
the bad keyword, and added a rule that a domain keyword can't override a high-confidence
asset.)*
- **Pro:** low risk, preserves all current behavior, no rearchitecting.
- **Con:** does not fix the root. It is whack-a-mole with better gloves. Will keep losing
  to GPT on novel scenarios.

### Option B — Invert the flow: LLM reasons first, engines verify  ◄ recommended direction
Let GPT read the whole transcript and produce a *structured hypothesis* (asset, governing
risk, suspected mechanism, recommended disposition) **first**. Then the deterministic
engines run as **verifiers/guardrails**: confirm or challenge the asset, run the B31G math,
check the code citation, enforce provenance, and — critically — the deterministic layer may
only **VETO with a cited physics/code reason**, never silently override. The governing-
reality arbiter reconciles the two.
- **Pro:** plays to each side's strength — GPT's holistic reasoning + the engines' rigor
  and auditability. Kills the cascade (no early keyword commitment). This is the structure
  the user already intuited ("should GPT decide first, then the platform check?").
- **Con:** larger change; needs a clean contract between the LLM hypothesis and the
  verifier engines; must define what counts as a valid deterministic veto.

### Option C — Parallel + reconciliation
LLM and deterministic engines run **independently** on the same transcript. A reconciliation
layer surfaces *agreements* (high confidence) and *disagreements* (flagged for human review),
and the deterministic side can only downgrade/veto with a cited reason.
- **Pro:** maximal transparency; disagreement itself becomes a useful signal; safest for
  high-stakes calls.
- **Con:** most engineering; two full passes; needs a real reconciliation policy.

### A note on testing (applies to any option)
Close the §5 hole: the eval harness must exercise `resolve-asset` + `reality-lock` from raw
transcript, not from a pre-set `asset_class`. The bug that wasted the most time was invisible
to our own test net.

---

## 9. Constraints any solution must respect (non-negotiable)

1. **Facts only — never infer human behavior or motive.** No complacency/ego/fear/intent
   assumptions. Unprovable, varies globally, makes the system unreliable.
2. **Determinism + provenance preserved.** Whatever GPT proposes, the final answer must
   still be reproducible and every number/citation must trace to a stated fact or standard.
3. **No destructive overrides.** An automated step may not silently replace a
   higher-confidence finding with a lower-confidence default (the TEST 22 lesson).
4. **Auditability.** The trace a regulator follows must survive the rearchitecting.

---

## 10. The one question to answer first

**Do we keep trying to make the deterministic engines out-reason GPT (Option A), or do we
re-cast them as GPT's verifier/guardrail and let GPT carry the reasoning (Option B/C)?**

Everything else — which classes to keep, how to gate classifiers, what the eval covers —
follows from that single choice. Recommend we (human + GPT + Claude) agree on this before
the next code change.
