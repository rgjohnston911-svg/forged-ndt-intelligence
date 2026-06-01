# DEPLOY441 — Stabilization Phase 3: the LLM Hypothesis Engine (the flow inverts)

This is the phase where the architecture actually inverts. The LLM now reasons
**holistically and first**, producing a structured, evidence-cited hypothesis BEFORE any
deterministic engine commits. Nothing is wired into the live report yet — that is Phase 10
(shadow mode). Phase 3 builds the capability, its contract, and its offline gate.

## What shipped

### `src/lib/governingAxes.ts` — the three-axis model (replaces the named-class ladder)
Three closed, low-cardinality enums. Governing reality is the **tuple**, not a class:
- `PhysicalCondition = ACCEPTABLE | SUSPECTED | CONFIRMED_DAMAGE | UNKNOWN`
- `AssuranceState   = ESTABLISHED | DEGRADED | UNKNOWN_STATE | LOST_DESIGN_BASIS`
- `OperationalChange = STABLE | CHANGED_UNREASSESSED | FLEET_PATTERN`

Plus never-throw coercion (`toPhysicalCondition` / `toAssuranceState` / `toOperationalChange`),
`clampConfidence`, and the **FINAL PRINCIPLE predicate** (success criterion 10):
`isPhysicallyAcceptableButNotDispositionable()` — true when an asset is physically
ACCEPTABLE today yet its assurance/operational axes make it not dispositionable. ~48
combinations, **zero enumeration growth**.

### `src/lib/llmHypothesis.ts` — the hypothesis engine (testable; transport injected)
- `buildHypothesisPrompt(transcript)` — chat messages enforcing: JSON only; every
  conclusion grounded in transcript evidence; **facts/physics only, never infer human
  behavior**; `CONFIRMED_DAMAGE` only with direct evidence; assign all three axes
  independently; it is correct to be "ACCEPTABLE today" yet "not dispositionable".
- `parseAndValidateHypothesis(raw)` — returns a fully schema-valid `LLMHypothesis` and
  **never throws**: malformed JSON degrades to a low-confidence UNKNOWN hypothesis
  (`meta.ok=false`), confidences are clamped to 0..1, bogus enums coerce to safe defaults,
  string/array fields are normalized, code fences are stripped.
- `generateHypothesis(transcript, { callModel })` — orchestrates build → call → validate.
  `callModel` is **injected** (default posts to the `llm-proxy` function), so the gates
  exercise the full path offline with a fake model. A transport failure degrades to a
  graceful UNKNOWN hypothesis. Model + temperature are pinned (`gpt-4o`, `0`) per §12.

### `netlify/functions/llm-proxy.js` — thin pure-JS transport
Auth-guarded (`auth-guard.cjs verifyAuth`), allow-lists the model, pins temperature 0,
forwards messages to OpenAI, returns `{ content }`. No prompt construction, no schema work
— all of that stays in the gated TS lib. Requires `OPENAI_API_KEY` (already used by
superbrain-synthesis); returns 503 if absent.

### `tests/llm-hypothesis.test.cjs` — Phase-3 acceptance gate (offline, deterministic)
23 assertions: prompt contract (JSON-only, behavioral-inference forbidden, evidence gate,
transcript carried), schema validation, clamping/coercion, code-fence stripping, graceful
degradation on malformed JSON and on transport failure, injected fake model, and the
FINAL PRINCIPLE predicate. No live LLM needed.

## Verified
- `node tests/llm-hypothesis.test.cjs` → 23/23.
- `node scripts/run-gates.cjs` → **36/36** (new gate auto-discovered).
- `npx tsc -b` → clean.
- `npm run eval` → 16/16 hard (+2 tracked XFAIL).
- **ARCH-HEALTH (§13): governing_reality_classes=12, domain_classifier_keywords=210,
  XFAIL=2 — all unchanged.** The inverted flow adds capability without adding a single
  named class or keyword. That is the anti-whack-a-mole invariant holding.

## Not yet (by design)
- Not wired into the live report (Phase 10 shadow mode runs it in parallel, logged, before
  it ever drives a disposition).
- The reconciliation layer (Phase 9) consumes this hypothesis + the deterministic suite and
  emits the governing tuple; the tiered veto (Phase 8), authority derivation (Phase 5),
  evidence gate (Phase 6), confidence-tagged classification (Phase 4) and no-destructive-
  override (Phase 7) are the remaining build.

## Files
- `src/lib/governingAxes.ts`
- `src/lib/llmHypothesis.ts`
- `netlify/functions/llm-proxy.js`
- `tests/llm-hypothesis.test.cjs`
- `DEPLOY441-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence — targeted add)
```bash
node tests/llm-hypothesis.test.cjs && node scripts/run-gates.cjs && npx tsc -b && npm run eval

git add src/lib/governingAxes.ts \
        src/lib/llmHypothesis.ts \
        netlify/functions/llm-proxy.js \
        tests/llm-hypothesis.test.cjs \
        DEPLOY441-INSTRUCTIONS.md

git commit -m "DEPLOY441 - Stabilization Phase 3: LLM hypothesis engine (flow inverts). governingAxes.ts (three-axis model + FINAL PRINCIPLE predicate, zero enumeration growth); llmHypothesis.ts (evidence-cited JSON-only prompt, never-throw schema validation, graceful degradation, injected transport, model/temp pinned); llm-proxy.js (thin auth-guarded OpenAI proxy); Phase-3 gate (23 assertions, offline/deterministic). Not yet wired to report (Phase 10 shadow). gates 36/36; tsc clean; eval 16/16; S13 health flat (12 classes / 210 keywords / XFAIL 2)."

git push
```
