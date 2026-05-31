# DEPLOY414 - Fleet Peripheral Aggregation (cohort-aware, systemic-pattern)

## Source: your spec - cohort-relative aggregation, kept parallel to the ranking
Two contracts supplied: expected_rate_table.cjs (sound-asset anchored baseline with a
deviance guard) + fleet_peripheral_aggregation_tests.cjs (reference detector + 6-fleet
golden corpus). Ported into a real engine + committed gate.

## What it does
Turns per-asset PERIPHERAL REFERRALS into PROGRAM-LEVEL findings. Systemic is NOT "many
assets flagged X" (corrosion is common -> floods). It is "more than the shared context
predicts", split into two distinct signals:
- CLUSTER: a cohort's incidence of actor X far exceeds the REST of the fleet -> localized
  common cause (coating batch / environment / install crew). No external data needed.
- PREVALENCE: fleet-wide incidence exceeds the EXPECTED (sound-asset) rate -> fleet-wide
  systemic (CP / coating program). Without an expected rate it degrades honestly to
  ELEVATED_NO_CONTRAST ("high, but cannot confirm systemic"), never a false "systemic".

## Two disciplines that make it honest (and the WRONG versions it beats)
1. COHORT-RELATIVE, not absolute. The naive "fleet rate >= 0.4" detector floods on a
   marine fleet where corrosion IS the baseline (golden F3); the cohort-aware engine
   stays SILENT on F3 and fires on the real cluster (F1) and the real prevalence (F2).
2. SOUND-ASSET ANCHORED baseline with a DEVIANCE GUARD. The expected rate is anchored to
   what sound assets show; observation refines it DOWN automatically but can only be
   revised UP behind HUMAN REVIEW. The naive self-training baseline goes silent by pass 1
   under a sustained 0.80-vs-0.30 failing program; the guarded one keeps FIRING all 6
   passes and raises review_pending. (Normalization of deviance: Piper Alpha, Columbia.)

## Strictly parallel - NEVER touches the ranking
Output is a program-level recommendation to the integrity/reliability owner. It does NOT
disposition any asset and does NOT re-rank the fleet order of action. (A program issue
like "review the CP program" is not a reason to bump asset 7's urgency - that coupling is
deliberately not built.)

## Verification (committed gate; git-ignored, runs locally)
tests/fleet-peripheral-aggregation.test.cjs - 10/10:
- 6 whole-fleet golden cases (CLUSTER / PREVALENCE / ELEVATED_NO_CONTRAST / silent-noise /
  below-MIN_AFFECTED / below-MIN_COHORT / multi-actor).
- 3 deviance-guard locks (effective_expected stays clamped at anchor under a sustained
  failing program; review_pending raised; PREVALENCE keeps firing).
- 1 integration: peripheral-referral REFERs -> flagsFromReferrals -> aggregation input.
Full local regression: 27/27.

## Files
- netlify/functions/fleet-peripheral-aggregation.cjs   (engine: CLUSTER/PREVALENCE + expected-rate table + guarded updateExpected + buildExpectedRates + flagsFromReferrals + handler)
- tests/fleet-peripheral-aggregation.test.cjs           (acceptance gate; git-ignored, run locally)
- DEPLOY414-INSTRUCTIONS.md

## Commit (engine + doc; gate runs locally)
```bash
git pull
node tests/fleet-peripheral-aggregation.test.cjs   # 10/10 before shipping
npx tsc -b
git add netlify/functions/fleet-peripheral-aggregation.cjs DEPLOY414-INSTRUCTIONS.md
git commit -m "DEPLOY414 - Fleet peripheral aggregation (cohort-aware systemic-pattern detection). CLUSTER (cohort vs rest-of-fleet) + PREVALENCE (fleet vs sound-asset expected rate; degrades to ELEVATED_NO_CONTRAST without one). Expected-rate baseline is sound-asset anchored with a deviance guard (refines down automatically, gates up behind human review) so a fleet-wide failure cannot self-train the baseline to silence. PROGRAM-LEVEL output for the integrity owner; never dispositions an asset or re-ranks the fleet. Gate 10/10; full regression 27/27. Additive."
git push
```

## NOT shipped yet (wiring - needs live)
A fleet-level "Systemic Patterns" section on /fleet that runs aggregatePeripherals over the
per-asset peripheral referrals (flags = REFER actors) and lists CLUSTER/PREVALENCE findings
as a PARALLEL panel - distinct from the ranked order of action, addressed to the integrity
/ reliability owner. Same scorer/engine, source-agnostic (text or photo referrals).
