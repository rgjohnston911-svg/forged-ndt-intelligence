# DEPLOY431 — Governing Reality Engine (deterministic, facts-and-physics only)

## What this adds
The platform's top-level output: **"What is actually controlling the decision?"** — distinct from
"what defect was found" and "what mechanism exists." Previously this was implied across the
convergence, FMD, organizational, and future-state layers but never resolved into one explicit field.

## Design (the discipline that makes it safe)
`src/lib/governingReality.ts` is a **deterministic arbiter**, not a new evidence producer and not an
LLM call. It reads already-computed outputs (decision-core consequence/disposition/hard-locks, FMD
governing/suspected/disposition_driver, convergence primary + matched streams, organizational facts,
future-state) and selects the controlling reality by a fixed precedence:

1. CONFIRMED_CRITICAL_DAMAGE — decisive (no-go / hard lock)
2. OPERATIONAL_CHANGE_WITHOUT_REASSESSMENT — operating duty increased + a documented reassessment/MOC
   gap (the TEST 11/14 root); the suspected mechanism is named as the resulting controlling risk
3. SUSPECTED_GOVERNING_MECHANISM — suspected higher-consequence mechanism without the op-change root
4. FORWARD_TRAJECTORY_GOVERNS — acceptable today, forecast to breach before next intervention
5. ORGANIZATIONAL_ASSURANCE_FAILURE — documented assurance gaps, no specific mechanism
6. MEASURED_DAMAGE_GOVERNS — the confirmed mechanism is genuinely controlling
7. INSUFFICIENT_EVIDENCE_HOLD
8. NONE — honest fallback (asserts nothing)

**Facts and physics only.** It never infers human motive, mindset, or behavior (complacency, ego,
fear, bias) — those are unprovable, vary worldwide, and would make the system unreliable. The
statement is composed ONLY from signals actually present (anti-contamination, same as convergence):
a class can't be named without its signature signals, and an operational-change reality requires both
the duty-increase fact AND a documented reassessment/MOC gap (a class won't fire on the duty change
alone).

## Also in this deploy
- DEPLOY404 organizational banner relabeled to documented-fact language (removed "management-system
  breakdown" / "weak controls" → "documented deferred/incomplete reviews / missing MOC").
- Audited the organizational engine: its indicators are already documented-fact based (no behavioral
  labels).

## Verified
- Resolver battery (compiled offline): **10/10** — TEST 14 → OPERATIONAL_CHANGE_WITHOUT_REASSESSMENT
  (names the duty change + reassessment gap + suspected fatigue, no behavioral language); confirmed
  critical → decisive; suspected-only → suspected; forward → forward; org-only → assurance; benign →
  NONE; anti-contamination (op-change without a gap does NOT fire); no-behavioral-language assertion.
- `tsc -b` clean; `node scripts/run-gates.cjs` → **34/34**. The tsx gate
  (`src/lib/__tests__/governingReality.test.ts`) runs under `npm test` in CI.
- Wired into the report as the top-line "Governing Reality" banner (additive; try/caught so it can
  never block the report).

## Files
- `src/lib/governingReality.ts` (new — the arbiter)
- `src/lib/__tests__/governingReality.test.ts` (new — gate)
- `src/pages/VoiceInspectionPage.tsx` (top-line banner + DEPLOY404 relabel)
- `DEPLOY431-INSTRUCTIONS.md`, `PLATFORM-OVERVIEW.md` (platform reference doc)

## Commit (from C:\dev\forged-ndt-intelligence)
```bash
npx tsc -b
node scripts/run-gates.cjs
git add src/lib/governingReality.ts src/lib/__tests__/governingReality.test.ts src/pages/VoiceInspectionPage.tsx DEPLOY431-INSTRUCTIONS.md PLATFORM-OVERVIEW.md
git commit -m "DEPLOY431 - Governing Reality Engine: deterministic, facts-and-physics-only arbiter that names which established reality controls the decision (precedence over decision-core/FMD/convergence/org/future-state). Anti-contamination (class needs its signature signals; operational-change needs duty-increase AND a documented reassessment gap); never infers human behavior. Top-line report banner. DEPLOY404 banner relabeled to documented-fact language. Resolver 10/10; tsc clean; gates 34/34. Adds PLATFORM-OVERVIEW.md."
git push
```

## After deploy — TEST 14 re-run
The report's new top line should read approximately: "Governing reality: an operational change
(throughput increased 35%) has altered the asset's duty without a corresponding engineering
reassessment (no vibration study on record; no MOC). The controlling risk is the resulting
vibration-induced fatigue, which is not measured by the current wall-loss data and remains
unconfirmed." — no behavioral attribution, every clause fact-backed.
