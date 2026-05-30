# DEPLOY413 - Fleet ranking CORRECTNESS (band-floor calibration) + adversarial isolation

## Why (the reviewer's point: stability != correctness)
The isolation gate proved the ranking is STABLE and uncontaminated. It said nothing about
whether the order/bands are RIGHT. Built the missing acceptance test - a hand-labeled fleet
asserting a deliberately dangerous asset lands at the top and a benign one at the bottom -
and it immediately surfaced two wrong band labels (knife-edge, same class as the peripheral
fixed_support@MEDIUM):
- HIGH-consequence assets WITHHOLDING continued-service approval (hold/no_go) scored 55-58,
  a hair under PRIORITY's 60, and were labeled ELEVATED. A held HIGH asset shown as
  "schedule near-term, monitor" is wrong.
- A MEDIUM-consequence asset with a finding scored 28 and collapsed to ROUTINE - the SAME
  band as a benign LOW asset. MEDIUM and LOW must be distinguishable.

## Fix (consequence-aware BAND FLOOR; owned)
fleet-triage.cjs now applies a policy band-floor after scoring (raises only, never lowers,
emits a traceable band_floor_reason; SCORE and SORT ORDER untouched - this relabels the band):
- CRITICAL consequence -> floor PRIORITY.
- HIGH consequence + withholding disposition (hold/no_go) -> floor PRIORITY.
- HIGH consequence (any disposition) -> floor ELEVATED (never ROUTINE).
- MEDIUM consequence -> floor ELEVATED (always at least near-term review).
- LOW -> no floor.
The band is a POLICY classification, not a raw-score bucket - same philosophy as the
peripheral LOAD_PATH NOTE-floor.

## New / strengthened gates (git-ignored, run locally)
- tests/fleet-ranking-correctness.test.cjs (NEW): 17/17. Hand-labeled bands + the core
  acceptance test (dangerous #1, benign last) + ordering invariants (storm > no-storm twin,
  breach > stable held HIGH, consequence tier monotone down the ranking).
- tests/fleet-isolation.test.cjs (STRENGTHENED): 11/11. Added adversarial STATE-POISONERS -
  an extreme/garbage asset (huge strings, org=999999, control chars) ranked between two runs
  of a normal target, and an extreme poison transcript between two peripheral runs - so the
  corpus can actually TRIP a shared-state bug, not just smoke-test. Closes the "these 50
  don't contaminate" vs "the architecture isolates" gap.
- Full local regression: 26/26.

Honest scope note: the committed correctness + isolation gates cover the deterministic .cjs
engines. The full per-asset pipeline incl. decision-core isolation is the offline
forward-vs-reverse harness (50/50); it needs the build step so it is not a committed lock.

## Files
- netlify/functions/fleet-triage.cjs   (band-floor calibration + band_floor_reason)
- tests/fleet-ranking-correctness.test.cjs, tests/fleet-isolation.test.cjs  (gates; git-ignored)
- DEPLOY413-INSTRUCTIONS.md

## Commit (engine + doc; gates run locally)
```bash
git pull
node tests/fleet-ranking-correctness.test.cjs   # 14/14 - the product acceptance test
node tests/fleet-isolation.test.cjs              # 11/11 - incl. poisoners
npx tsc -b
git add netlify/functions/fleet-triage.cjs DEPLOY413-INSTRUCTIONS.md
git commit -m "DEPLOY413 - Fleet ranking correctness: consequence-aware band floor (held HIGH-consequence assets floor at PRIORITY; HIGH never ROUTINE; MEDIUM floors at ELEVATED so it never collapses with benign LOW). Score/sort order untouched; band is a policy classification with a traceable band_floor_reason. Surfaced by a new ranking-correctness gate (14/14: dangerous#1, benign-last, monotone tiers). Isolation gate strengthened with adversarial state-poisoners (11/11). Full local regression 26/26."
git push
```

## External cross-validation (independent corpus) + active-failure floor
Ran the live rankFleet against an INDEPENDENTLY-authored correctness corpus (different
schema + 5 domain-true invariants, incl. a deliberately WRONG magnitude-only ranker that
must fail the order invariants). Via a principled field-adapter (not tuned to pass):
**5/5 invariants held** - the ranking keys on governing risk, not damage magnitude.

It surfaced one real gap: a confirmed ACTIVE leak on a LOW-consequence fluid scored 45
-> ELEVATED. Domain-true call: a thing actively losing containment is IMMEDIATE-class
regardless of consequence. Added an `active_failure` band floor -> IMMEDIATE (the
uncontested half). Ranking-correctness gate now 17/17 (locks the floor; drops a
false-universal consequence-monotonicity assertion - an active failure legitimately
outranks higher-consequence not-yet-failed assets by urgency class).

OPEN DECISION (the contested half, deliberately NOT made unilaterally): order-of-action
sort policy when an active-failure asset is IMMEDIATE-class but low weighted score:
  - SCORE-FIRST (current): order = consequence-weighted urgency; band is a parallel flag.
    A trivial active leak cannot jump a critical near-failure, but an IMMEDIATE item can
    sit mid-list.
  - BAND-FIRST: order respects urgency CLASS first (all IMMEDIATE before all PRIORITY);
    the active leak leads, but a low-consequence leak outranks a critical not-failed asset.
DECISION (operator): SCORE-FIRST. Order = consequence-weighted urgency; band is a parallel
flag (an active failure is flagged IMMEDIATE-class even if it sits mid-list). No code change;
the validated ranking is preserved. A trivial active leak cannot jump a critical near-failure.

## Deferred (next, when greenlit): cohort-aware peripheral aggregation
Build it cohort-relative - flag systemic when incidence clusters BEYOND what the shared
context (environment/service/coating/age) predicts, NOT raw ">=N assets" (which floods in a
corrosive environment). Keep it PARALLEL to the ranking with its own owner (reliability /
integrity engineer); do NOT wire it into per-asset urgency - that is a separate, later,
deliberately-gated decision.
