# DEPLOY435 — SYSTEM_DRIFT_NO_MECHANISM governing reality (TEST 17 & 18)

## The gap (TEST 17 and TEST 18, both ~8.1–8.6)
Two consecutive scenarios with **no physical damage mechanism** — a deepwater hub and a refinery
hydrogen network, both drifting toward instability through operational + control-system change with
every individual discipline reporting "acceptable." The SA layer found the right story, but the
governing-reality / mechanism layer still tried to anchor on a material mechanism (corrosion / HIC /
vibration fatigue) because that's what it knows. GPT's repeated point: the governing mechanism is not
always material degradation — sometimes it is control-system instability / organizational drift /
optimization-induced fragility, with no defect at all.

## The fix (governing-reality engine — the top-line arbiter, my clean module)
New class **`SYSTEM_DRIFT_NO_MECHANISM`**, ranked #2 (right after CONFIRMED_CRITICAL_DAMAGE). It fires
when **≥3 distinct control/network drift signals** are documented and no confirmed critical defect
exists. Signals (facts only): rising stability/instability index, cross-unit/cross-domain correlation,
APC / optimization-software change, control-loop hunting, anti-surge / surge activity, analyzer
disagreement, loss of single-system ownership, an ML/analytics correlation alert. When it fires, the
top line reads: *"the system has drifted toward instability … no material damage mechanism governs;
the controlling risk is loss of the validated operating envelope / system-level (control/network)
instability — not corrosion or a measured defect. Resolution requires a multidisciplinary systems
review, not an inspection."* — and lists the matched signals as provenance. Facts only; no behavioral
inference.

**Gating:** the ≥3-distinct-control-signal threshold means mechanical-fatigue cases (TEST 11/14/16),
which lack this cluster, do **not** mis-fire — verified they keep their operational-change / fatigue
classes.

## Verified
- `npm run eval` → **9/9**. TEST 17 & 18 now assert `governing_class = SYSTEM_DRIFT_NO_MECHANISM` and a
  governing statement containing "operating envelope"; TEST 11/14/16 unchanged.
- `node scripts/run-gates.cjs` → 35/35; `tsc -b` clean.
- Live: the governing-reality engine reads the transcript and is already the report top-line
  (DEPLOY431), so this reaches production automatically.

## Bundled (all uncommitted SA work)
This commit also lands **DEPLOY434** (FMD dynamic-fatigue dominance, TEST 16) and the **eval hardening**
(must_contain / suspected_leads checks, word-boundary contamination matching, governing_statement_
contains) plus the TEST 16/17/18 corpus cases (corpus now 9).

## Honest scope — what is NOT fixed yet
The governing-reality **top line** is now correct for drift scenarios. But the deterministic **FMD /
mechanism layer** can still surface a fabricated mechanism (e.g. "governing mode: corrosion" from a
*stable* corrosion non-finding, or a mild vibration-fatigue) lower in the report. Suppressing that —
teaching FMD that a documented non-finding is not a governing mechanism — is the next focused
core-engine fix (it needs full eval coverage so the cases where corrosion genuinely governs, e.g.
REAC's 64% loss, are unaffected). The capstone output is right; the supporting mechanism banner is the
remaining cleanup.

## Files
- `src/lib/governingReality.ts` (SYSTEM_DRIFT class + signals)
- `netlify/functions/failure-mode-dominance.js` (DEPLOY434 fatigue dominance)
- `scripts/eval-sa.cjs`, `tests/fixtures/sa-eval-cases.json` (eval hardening + TEST 16/17/18)
- `DEPLOY434-INSTRUCTIONS.md`, `DEPLOY435-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence)
```bash
npm run eval
node scripts/run-gates.cjs
git add src/lib/governingReality.ts netlify/functions/failure-mode-dominance.js scripts/eval-sa.cjs tests/fixtures/sa-eval-cases.json DEPLOY434-INSTRUCTIONS.md DEPLOY435-INSTRUCTIONS.md
git commit -m "DEPLOY434+435 - SYSTEM_DRIFT_NO_MECHANISM governing reality (TEST 17/18): >=3 control/network drift signals + no confirmed defect -> governing reality is loss of validated operating envelope, NOT a material mechanism (facts only; mechanical-fatigue cases unaffected). Bundles FMD dynamic-fatigue dominance (TEST 16) + eval hardening (word-boundary matching, must_contain/suspected_leads/governing_statement_contains) + TEST 16/17/18 corpus. eval 9/9; gates 35/35; tsc clean."
git push
```
