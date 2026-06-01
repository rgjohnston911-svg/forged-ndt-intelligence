# DEPLOY449+450 — Convergence evidence-provenance + monitoring-trust on physical assets

Bundles the two fixes that clear the RAE precondition (suite 20/20 by provenance).

## DEPLOY450 — convergence evidence-provenance guard (GPT's TEST 26 smoking gun)
`situational-awareness-convergence.cjs` was activating evidence streams by naive keyword
`indexOf` with **no context check**, so it manufactured streams from negated / normal text:
- "no fatigue cracking detected" → fired `PRIOR_SIMILAR_FAILURE` (keyword "fatigue crack")
- "vibration 0.14 ips … condition normal" → fired `VIBRATION`
…and declared "vibration-induced fatigue" on a physically-healthy platform (TEST 26).

**Fix — a stream may only activate from a real, non-negated, not-within-limits occurrence:**
- **within-limits / normal** qualifier is judged at the **sentence** level (a measured reading
  reported normal / within tolerance / below alarm is a non-finding) — kills the TEST 26
  "vibration 0.14 ips … normal" match;
- **bare negation** (no/not/without/never) is judged at the **clause** level (adjacent to the
  keyword), so an unrelated negation in a *different* clause ("…fatigue, **not** corrosion")
  cannot suppress a real finding;
- decimal-protected sentence split (period+space) so "0.14" doesn't fragment the clause.
- Added genuine positive verbs `vibrates` / `vibrate` to the VIBRATION stream so the real
  finding is what matches.

**T20 fixed by provenance, not whitelist:** T20's convergence now traces to "the line
**vibrates significantly** during compressor startup" + "experienced **fatigue cracking** …
**nearly identical** transfer line" — real transcript evidence. TEST 26 stays suppressed
because it has none. Same logic, opposite outcomes, decided by evidence.

## DEPLOY449 — monitoring-assurance governs a physically-healthy asset (flare-gas)
`reconciliationLayer.ts`: broadened assurance/operational detection to monitoring-trust
vocabulary (control-logic patch, MOC opened-but-not-closed, vendor-unsupported change,
independent transmitter still showing spikes, "cannot be independently validated"), and a
precedence rule: when there is no CONFIRMED physical damage but the assurance basis is
UNKNOWN/LOST, **assurance governs over a merely-suspected physical mechanism**. New
`BREAKER_F` (flare-gas) locks it: governing reality = monitoring-assurance failure, not
corrosion/API 579.

## Verified
- `npm run eval` → **20/20 hard**, XFAIL 0.
- `node scripts/run-gates.cjs` → **41/41** (convergence gate preserved).
- `npx tsc -b` → clean. §13 ledger flat (12 classes / 210 keywords).

## Honest scope (unchanged)
The governing-reality banner is correct for these cases. The legacy FMD supporting **card**
can still print a physical FFS package on a healthy asset — that body-card cleanup, and the
RAE role-authority refactor (delete the human-factor stakeholder layer), are the next work,
both gated on this being committed green.

## Files
- `netlify/functions/situational-awareness-convergence.cjs` (provenance guard + vibrates)
- `src/lib/reconciliationLayer.ts` (monitoring-trust assurance/operational + precedence)
- `tests/fixtures/system-breakers.json` (BREAKER_F)
- `tests/reconciliation-layer.test.cjs` (flare governingStatement assertion)
- `DEPLOY449-INSTRUCTIONS.md`, `DEPLOY450-INSTRUCTIONS.md`

## Commit + push (Git Bash, from /c/dev/forged-ndt-intelligence — NOT OneDrive)
```bash
rm -f .git/index.lock
git add netlify/functions/situational-awareness-convergence.cjs src/lib/reconciliationLayer.ts tests/fixtures/system-breakers.json tests/reconciliation-layer.test.cjs DEPLOY449-INSTRUCTIONS.md DEPLOY450-INSTRUCTIONS.md
git commit -m "DEPLOY449+450 - convergence evidence-provenance guard (kills manufactured vibration-induced-fatigue on healthy assets; T20 restored by provenance) + monitoring-assurance governs a physically-healthy asset (flare-gas BREAKER_F). eval 20/20; gates 41/41; tsc clean."
git push
git log --oneline -1
```
