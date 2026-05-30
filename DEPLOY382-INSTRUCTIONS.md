# DEPLOY382: SA Tier 2 — real probability-weighted scenarios (survival bridge)

## Why
A GPT eval flagged "Future Projection (Level 5)" as missing: the report said "insufficient data for timeline" and gave no probability-weighted scenarios. The Consequence Simulator (L9.3) was already deployed but always emitted `confidence:0` because nothing supplied it a `probabilityBasis` (gap-analysis FUNC-2). The platform computes remaining-**life** + a qualitative confidence band, not raw probabilities — so Tier 2 adds the missing conversion step.

## What This Does
Adds a **survival bridge** that converts the L4 Failure Timeline's own remaining-life estimate + confidence band into a probability distribution (standard API 581 RBI practice: lognormal time-to-failure with the mean = the engine's remaining-life estimate and the variance set by the engine's stated confidence band). The Consequence Simulator then emits **real probability-weighted scenarios** (e.g. "Failure in 1–3 years: 35%, 3–5 years: 41%, survives >5y: 24%"), which now render in the report.

It never fabricates: when the timeline is not quantified (`insufficient_data` / `dormant` / no governing time), the bridge returns an empty basis and the simulator correctly stays at `confidence:0` — exactly as the HOLD report did.

## Files in This Deploy
1. **NEW — `netlify/functions/situational-awareness-survival-bridge.cjs`** — pure deterministic module. `buildProbabilityBasis(failureTimeline, decisionPackage)` → `{ byOption: { CONTINUE, SHUTDOWN } }` (lognormal-derived, partitioned to ~1.0) or empty when unquantified. No clock/LLM/random.
2. **MODIFIED — `netlify/functions/situational-awareness-orchestrate.cjs`** — requires the bridge; when given a `failureTimeline` (and no explicit `probabilityBasis`), derives the basis and feeds the Consequence Simulator. (~12-line diff.)
3. **MODIFIED — `src/pages/VoiceInspectionPage.tsx`** — (a) the SA chain now runs **after** the failure-timeline step (so the real `failureTimeline` is available), capturing the DecisionPackage + validated evidence at the decision-core step; (b) the report's SA section now renders a **"Future Scenarios (probability-weighted)"** block when a real scenario exists. (~49-line diff.)
4. **LOCAL-ONLY — `tests/situational-awareness-survival-bridge.test.cjs`** — git-ignored. Verifies lognormal monotonicity, partition-to-1.0, insufficient-data → empty, determinism, and end-to-end through the simulator. Run: `node tests/situational-awareness-survival-bridge.test.cjs`.

## Modeling note (transparency)
The probabilities are a deterministic function of the platform's **own** remaining-life estimate and its **own** confidence band — not invented numbers. Band → distribution spread: HIGH = CoV 0.30, MODERATE = 0.50, LOW = 0.75; scenario confidence: HIGH 0.80 / MODERATE 0.60 / LOW 0.40. DERATE and MORE_DATA are intentionally left with no basis (`confidence:0`) because there's no quantitative basis for a derate factor.

## Verify (local)
```
node tests/situational-awareness-survival-bridge.test.cjs
```
Expected: `All DEPLOY382 survival-bridge checks passed ...`. `tsc -b` also passes. (Run `npm run build` locally if OneDrive permits; Netlify runs the full build regardless.)

## Deploy Steps (git bash)
```
git pull
node tests/situational-awareness-survival-bridge.test.cjs
git add netlify/functions/situational-awareness-survival-bridge.cjs netlify/functions/situational-awareness-orchestrate.cjs src/pages/VoiceInspectionPage.tsx DEPLOY382-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Confirm those 4 files staged (the `tests/` file is git-ignored). Then:
```
git commit -m "DEPLOY382 - SA Tier 2: survival bridge converts L4 remaining-life + confidence band into a lognormal probabilityBasis (API 581 style), feeding real probability-weighted scenarios into the Consequence Simulator. SA chain runs after the failure-timeline step; report renders Future Scenarios. No fabrication: unquantified timeline -> confidence:0. tsc -b clean."
git push
```
If an `index.lock` error appears, `rm -f ".git/index.lock"` and retry.

## After Deploy — verify live
Run an inspection on an asset with **quantifiable** thickness/corrosion data (so the failure-timeline produces a governing remaining life with MODERATE+ confidence). Confirm the report's Situational Awareness section now shows a **Future Scenarios** block with probability-weighted outcomes. On a thin-data HOLD case, confirm no scenarios appear (correct — not fabricated).

## Roadmap
Tier 1 (stakeholder + conflict on every report) and Tier 2 (this, real scenarios) close the eval's Levels 2, 3, and 5. **Tier 3 remains:** the net-new engines — Organizational Failure Detection, Escalation Momentum, Converging Failure Pathway (eval Levels 1 & 4).
