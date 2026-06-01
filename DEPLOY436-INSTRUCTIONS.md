# DEPLOY436 — Convergent-mechanism governs + domain-agnostic drift (TEST 19 & 20)

Two governing-reality refinements, both in the clean arbiter module (low risk, fully eval-covered).

## 1. SYSTEM_DRIFT generalized to any domain (TEST 19 — 500 kV power grid)
The DEPLOY435 drift signals were refinery/offshore-flavored and missed grid vocabulary. Broadened to
**domain-agnostic** documented-fact signals (declining stability/resilience margin, emergent/cross-
system correlation, optimization / automated-dispatch change, control-instability proxies incl.
frequency corrections & near-miss relay interventions, conflicting measured reality / degraded comms,
loss of single-system ownership / experienced personnel, ML alert, operating-regime change). TEST 19
(a grid — a domain the platform has no engines for) now correctly returns SYSTEM_DRIFT_NO_MECHANISM /
"loss of validated operating envelope." Mechanical-fatigue cases (11/14/16) still do not mis-fire.

## 2. CONVERGENT_MECHANISM_GOVERNS (TEST 20 — ammonia terminal)
Reproduced offline: convergence found VIBRATION_INDUCED_FATIGUE (4 streams) but the arbiter fell
through to MEASURED_DAMAGE_GOVERNS and named the FMD single mode (STRUCTURAL_INSTABILITY from a 6°
tilt). The multi-stream story lost to one keyword. **Fix:** a new class — when convergence has a
strong primary hypothesis (≥3 independent streams), that convergent mechanism is the governing
mechanism and **outranks a single-mode FMD finding**; a single mode of a *different family* (e.g.
structural) is named a **contributing CAUSE**, not the governing mechanism. So TEST 20 now reads
"vibration-induced fatigue governs … the structural finding is a contributing cause" — exactly the
cause-vs-mechanism distinction GPT asked for. Verified REAC (convergence + FMD both corrosion → same
family) is not falsely demoted.

## Verified
- `npm run eval` → **11/11** (TEST 19 SYSTEM_DRIFT; TEST 20 CONVERGENT_MECHANISM_GOVERNS naming
  vibration-induced fatigue; all prior cases unchanged).
- `node scripts/run-gates.cjs` → 35/35; `tsc -b` clean.
- Lives in `governingReality.ts` (the report top-line, already wired DEPLOY431) → reaches production.

## Honest scope — NOT fixed (next focused items)
- **Falsely-precise forecast (TEST 20):** the future-state forecaster reported 0% failure at 1/3/5 yr
  despite absent dynamic-loading data. It should express high uncertainty / "cannot be determined."
  That's a separate forecaster-engine honesty fix.
- **FMD non-finding suppression (TEST 17/18):** FMD can still surface a fabricated mechanism banner
  from a stable-corrosion non-finding. The governing-reality top-line is correct; the supporting FMD
  banner cleanup remains.
- GPT's "Dynamic Systems / Fatigue Physics engine" (natural-frequency / modal) is a larger new
  capability, not required for the governing-reality call.

## Bundle (everything uncommitted since DEPLOY433)
- `src/lib/governingReality.ts` — SYSTEM_DRIFT class + domain-agnostic signals + CONVERGENT_MECHANISM_GOVERNS
- `netlify/functions/failure-mode-dominance.js` — DEPLOY434 dynamic-fatigue dominance (TEST 16)
- `scripts/eval-sa.cjs` — eval hardening (word-boundary, must_contain/suspected_leads/governing_statement_contains)
- `tests/fixtures/sa-eval-cases.json` — TEST 16–20 (corpus now 11)
- `DEPLOY434/435/436-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence)
```bash
npm run eval
node scripts/run-gates.cjs
git add src/lib/governingReality.ts netlify/functions/failure-mode-dominance.js scripts/eval-sa.cjs tests/fixtures/sa-eval-cases.json DEPLOY434-INSTRUCTIONS.md DEPLOY435-INSTRUCTIONS.md DEPLOY436-INSTRUCTIONS.md
git commit -m "DEPLOY434-436 - Governing-reality maturation across TEST 16-20: dynamic-fatigue dominance (FMD), SYSTEM_DRIFT_NO_MECHANISM (domain-agnostic: hub/hydrogen/grid), CONVERGENT_MECHANISM_GOVERNS (multi-stream convergence outranks single-mode FMD; cause vs mechanism). Eval corpus 11 cases + scorer hardening. eval 11/11; gates 35/35; tsc clean."
git push
```
