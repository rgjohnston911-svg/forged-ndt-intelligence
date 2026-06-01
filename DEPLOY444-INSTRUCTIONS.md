# DEPLOY444 — Stabilization Phase 6: evidence gate for physical damage (XFAIL → 0)

A physical mechanism may be called `ACTIVE` / `CONFIRMED_DAMAGE` only with **direct
evidence**. Indirect indicators support at most `SUSPECTED`. Consequence, missing records,
high-risk class, failures elsewhere, a *repaired/past* finding, or a keyword match are
**never** sufficient. This clears the last tracked baseline XFAIL — **BREAKER_D**.

## `src/lib/evidenceGate.ts` (new, pure, gated)
- `classifyMechanismEvidence(mechanism, transcript)` → `{ level: CONFIRMED | SUSPECTED |
  NONE, evidence[], reason }`.
  - **Direct** (→ CONFIRMED): corrosion = measured wall loss / %-loss / corrosion product /
    measured rate; cracking = UT/PAUT/MT/PT/AE indication / through-wall / active growth;
    structural = settlement beyond allowable / buckling / failed support / measured deformation.
  - **Blockers** (a direct finding that is within-limits / negated / *re-welded* / repaired →
    cannot be ACTIVE): "no significant wall loss", "within allowable", "re-welded", "repaired".
  - **Indirect** (→ SUSPECTED only): sour/H2S/CO2/chloride for corrosion; wet-H2S/sour-service
    for cracking; vibration/slugging/transient/unsupported-span/throughput for fatigue.
  - **Insufficient** (recorded, never promote): "similar … at another company", "failures
    elsewhere", "records lost", "catastrophic", "passed inspection".
- `gateSuspectedMechanisms(list, transcript)` → stable re-rank by evidence level. Promotes an
  evidenced mechanism above an unevidenced one **without inventing or dropping** anything.

## FMD output gated (no weight tuning)
`failure-mode-dominance.js` gains a clearly-labelled Phase-6 block that re-ranks the
**output** `suspected_governing_mechanism` just before the response: it recognizes evidenced
fatigue when ≥2 documented dynamic-loading signals are present, and demotes a blocked /
unevidenced cracking mechanism below it. The FMD screening **weights are untouched** — this
constrains the result, exactly as the BREAKER_D owner note required ("do not tune the FMD
weights").

## BREAKER_D retired — the proof
The vibration-fatigue spool: trace H2S + a branch that "cracked once and was **re-welded**"
+ "no significant wall loss". HIC has no active-cracking evidence (repaired + only trace
service) → demoted; fatigue is evidenced by vibration/slugging/transients/unsupported-span/
throughput → leads.

```
PASS  BREAKER_D_vibration_fatigue_convergence [process_piping / dom:offshore_oil_gas]
SA EVAL: 18 / 18 hard cases passed
ARCH-HEALTH (S13): governing_reality_classes=12  domain_classifier_keywords=210  XFAIL=0
```

- **XFAIL 1 → 0.** All baseline debt cleared — three phases ahead of the Phase-9 target.
- **§13 ledger flat: 12 classes / 210 keywords.** The fix is an evidence gate, not a keyword.
- No regressions: all 18 hard cases pass, including genuine-mechanism cases (a measured
  64% wall loss still reads CONFIRMED; the gate only demotes the *unevidenced*).

## Verified
- `node tests/evidence-gate.test.cjs` → 11 assertions.
- `node scripts/run-gates.cjs` → **39/39**.
- `npx tsc -b` → clean.
- `npm run eval` → 18/18 hard, **XFAIL 0**.

## Files
- `src/lib/evidenceGate.ts`
- `netlify/functions/failure-mode-dominance.js` (Phase-6 output gate + family-regex fix)
- `tests/evidence-gate.test.cjs`
- `DEPLOY444-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence — targeted add)
```bash
node tests/evidence-gate.test.cjs && node scripts/run-gates.cjs && npx tsc -b && npm run eval

git add src/lib/evidenceGate.ts \
        netlify/functions/failure-mode-dominance.js \
        tests/evidence-gate.test.cjs \
        DEPLOY444-INSTRUCTIONS.md

git commit -m "DEPLOY444 - Stabilization Phase 6: evidence gate for physical damage. evidenceGate.ts: a mechanism is ACTIVE/CONFIRMED only with direct evidence; indirect -> SUSPECTED; consequence/records/elsewhere/repaired/negated -> never active. FMD output re-ranked by evidence level (no weight tuning): evidenced fatigue leads an unevidenced HIC. BREAKER_D RETIRED -> XFAIL 0. eval 18/18 hard; gates 39/39; tsc clean; S13 flat (12/210)."

git push
```

## Next — Phases 7-9: override, veto, reconciliation
- **Phase 7** `noDestructiveOverride.ts` — the seven rules (low conf can't override high;
  defaults can't override explicit; facility can't override component; domain/jurisdiction
  keyword can't override explicit asset; conflicts surfaced, never hidden).
- **Phase 8** tiered veto wiring (Tier-1 hard veto with cited reason; Tier-2 advisory).
- **Phase 9** `reconciliationLayer.ts` — consume the LLM hypothesis + deterministic suite +
  the evidence gate + authority derivation, emit the **three-axis governing tuple**, and turn
  the breaker `axis_target_future` tuples into live assertions (incl. Breaker A's FINAL
  PRINCIPLE dual output). This is where the inverted flow becomes the governing path.
