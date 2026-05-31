# DEPLOY415 - Extractor negation hardening + aggregation honesty (ships with DEPLOY414)

## Why this exists (the reviewer's question, answered straight)
The peripheral extractor's 18/18 acceptance gate is **self-authored** - I wrote the
scenarios AND the expected outputs. That is the same blind spot the isolation corpus had
before the adversarial poisoners: a gate built from my own labels cannot catch the cases I
did not think to write. Everything in the systemic (fleet aggregation) layer rests on the
extractor producing clean referrals - right actor class, not negated - so this is the
load-bearing piece, and it had had the least independent scrutiny.

Probing it adversarially immediately surfaced a real, dangerous bug.

## Bug found (negation false-positives) - the worst case for the systemic layer
The degraded-guard had NO negation handling (FMD and future-state both got `hitNotNegated`;
the peripheral extractor never did). So:
- "no corrosion found on the pipe support"      -> emitted fixed_support  (WRONG)
- "spring hanger shows no signs of degradation"  -> emitted spring_hanger  (WRONG)
- "foundation inspected, not settling, sound"    -> emitted foundation     (WRONG)
- "pipe support: corrosion ruled out after UT"   -> emitted fixed_support  (WRONG, post-cue)

At fleet scale this is the silent killer: a fleet of assets each reporting "no corrosion on
the support" aggregates into a **confident CLUSTER/PREVALENCE finding of a program failure
that does not exist.** The clean-input aggregation gate (10/10) would never reveal it,
because it was handed perfect referrals - which is exactly the reviewer's point that the
gate validates the logic, not the pipeline.

## Fix (root cause, in peripheral-referral.cjs)
- `isNegated(win, idx, cueLen)` - scans the ~24 chars BEFORE each degradation cue (within
  the clause) for a negation (no / not / without / never / free of / absence of / no signs of
  / no evidence of / no indication), AND the ~24 chars AFTER for post-cue negation
  (ruled out / not found / not detected / none found / negative / cleared / no longer present).
- `degradedNotNegated(win)` replaces the old un-negated `/corro|crack|.../.test(win)` regex:
  a cue now counts only if at least one occurrence is NOT negated.
- The catalog, couplings, thresholds, extent modifier, and scorer are untouched.

## New committed gate (the lock)
`tests/peripheral-extractor-adversarial.test.cjs` - **9/9**. Negation (pre + post), substring
safety ("guidelines" != guide), clean-mention (no degradation -> no referral), and controls
that MUST still fire. A NAIVE FOIL (keyword + un-negated degrade scan = the pre-fix behaviour)
is run alongside and **fails 4/4 negation cases**, proving the gate discriminates. This is the
same discipline as the deviance guard: the regression is now pinned and cannot silently return.

## Aggregation honesty fix (fleet-peripheral-aggregation.cjs)
The EXPECTED_RATES anchors (marine 0.30, inland 0.05, CUI 0.40) were labeled LITERATURE /
EXPERT_PRIOR but I **invented them** - they are not sourced from any study or fleet history.
Relabeled `source: 'PLACEHOLDER'` with a header note and per-entry `review_note`:
**any PREVALENCE finding is PROVISIONAL until these are replaced with sourced values.**
CLUSTER (cohort-vs-rest) needs none of this table and is the half that can be trusted today.
No logic changed - this is an honesty relabel so the code stops claiming a source it lacks.

## Verification
- Extractor acceptance gate: **18/18** (unchanged - clause scoping breaks none; standalone
  standing water still refers, protecting cases 10/11).
- Extractor adversarial gate (negation + future/completed remediation): **12/12**; foil fails **5/5**.
- Extractor INDEPENDENT corpus (the second mind): **8/8**; naive foil fails **5/5** trap classes.
- Aggregation gate: **13/13** (6 fleets + 3 deviance-guard locks + 3 anchor-gating locks + integration).
- Voice-stress corpus (medium probe): Tier-1 **5/5 LOCKED** (disfluency, no-punctuation,
  spoken negation, spoken future/completed remediation); Tier-2 run-on attribution **0/3
  KNOWN-OPEN** (measured, not asserted - the gate stays green on what is locked and PRINTS
  the open rate). Synthetic until validated on real field transcripts.
- Full local regression: **29/29**. `tsc -b` clean. Both engines: 0 NUL bytes, require OK.

## KNOWN-OPEN (measured, not hidden) - the medium gap, for the next probe
Clause scoping needs CLAUSES it can detect. Verified behaviour: "the corrosion is on the
line but the pipe support is fine" -> (none) CORRECT; the same content as a punctuation-free
run-on "uh the pipe support the corrosion is on the line not the support that one is fine"
-> fixed_support:REFER WRONG. The attribution fix is strongest where the input is cleanest
and weakest where it is messiest - and production input is voice-transcribed field speech
(run-ons, no punctuation, packed utterances, disfluency), the messiest case. The fix is not
wrong; it is validated on the wrong medium. The next gate is a voice-transcript-stress
corpus to MEASURE the false-negative rate clause-scoping pays on that medium - gold
validation requires real field transcripts. Co-location demotion was confirmed CLAUSE-scoped
(loadPathSpans uses clauseSpan, not a character window), so the bleed killed for attribution
does not re-enter through the drainage door.

## The gap this does NOT close (stated plainly)
A self-authored adversarial gate hardens the classes I could foresee (negation, substring,
clean-mention). It does NOT remove my authoring blind spot. The only thing that does is an
**INDEPENDENT corpus of real inspector phrasings** (raw text -> expected actor class), authored
by someone other than me - the exact treatment the ranking corpus got (your labels, my adapter,
two minds agreeing). Until the extractor has that, the systemic layer's real-world accuracy is
bounded by whether real inspector language matches the precise terms I keyed on, and that bound
is unmeasured. This is the recommended next gate before the frontend wiring.

## DEPLOY415b - second mind: the independent corpus found three more classes
The reviewer then supplied an INDEPENDENT adversarial corpus (8 cases, authored without
sight of the extractor - the second set of eyes the self-authored 18/18 could never be).
Running the REAL extractor against it via an adapter surfaced exactly what a single probe
should be assumed NOT to have fully closed:

- **The C3/C5 passes were ACCIDENTAL.** Bare "support" is not a keyword, so attribution
  (C3) and temporal (C5) silently passed via NON-DETECTION. With real text ("pipe support")
  BOTH false-fired REFER: "the pipe is corroded but the pipe support is fine" read the
  corrosion onto the support; "was corroded last year but has since been replaced" ignored
  the remediation. The bare-noun gap was MASKING two live bugs.
- **C6 (actor precision) was a real miss:** "the guide shows corrosion" emitted nothing
  because only "pipe guide" (not bare "guide") was keyed.
- **C8 (clean control) over-emitted:** incidental "water pooling" beside a corroded support
  spawned a separate drainage REFER - which at fleet scale is a second phantom cluster.

Root-cause fixes in peripheral-referral.cjs (not per-case patches):
- **Clause scoping** (`clauseSpan`/`clauseAround`): the condition scan is bound to the
  actor's own clause (split on contrastive conjunctions + sentence stops), so a condition
  on a different subject cannot bleed across "but". This is the attribution fix. Documented
  trade-off: it errs toward the SAFER error (a cross-clause anaphora may be missed - a false
  negative - rather than a phantom referral created, which is what corrupts aggregation).
- **Temporal-remediation guard** (`remediatedPast` + `remediationCompleted`): a remediation
  verb (replaced/repaired/...) PAIRED with a past-frame (was/last year/since...) suppresses
  the stale referral. Two refinements from the reviewer's follow-up: (a) the pairing avoids
  suppressing a live finding because something unrelated was repaired; (b) PLANNED remediation
  is not COMPLETED remediation - "was corroded and WILL be replaced next shutdown" /
  "scheduled for replacement" is corroded NOW and MUST still refer, so a remediation verb
  preceded by a future marker (will/to be/scheduled/planned/pending/next...) does not count
  as done. Without (b) a guard keying on "replaced" silently suppresses an active finding.
- **Word-boundary bare-noun match** (`findActor`, `WB_ACTOR`): "\bguide\b" detects "the
  guide" but not "guided wave" (a UT method) or "guidelines".
- **Co-location demotion** (`WATER_OBS`, `withinLoadPathClause`): an incidental puddle in
  the same clause as a load-path structural finding is folded in as context; STANDALONE
  "standing water" still refers (protected - it is two of the 18 acceptance cases). This
  fixed C8 without the blunt "water terms are not drainage" removal, which had regressed
  those two cases (a new blind spot from a one-line fix - exactly the failure mode to avoid).

Result: independent corpus **8/8**; the keyworded C3/C5 variants now also return (none),
proving the fix is real, not the bare-noun accident. Committed as a permanent gate.

## DEPLOY415b - structural anchor gating (the relabel made load-bearing)
The PLACEHOLDER relabel was made BEHAVIORAL, not cosmetic. `buildExpectedRates` now returns
provenance ({rate, confidence, source, observed_n}); `resolveExpected` gates signal strength
on it. A PLACEHOLDER / LOW-confidence / zero-sample anchor can NO LONGER emit a confirmed
PREVALENCE - it degrades to a new **PREVALENCE_PROVISIONAL** signal ("exceeds an unsourced
placeholder rate - establish the baseline, do not treat as confirmed systemic"). A plain
number (caller-asserted, as in the gate's hand-specified rates) stays confident, so no
regression. An invented baseline now STRUCTURALLY cannot produce a confident systemic call.
Locked by 3 new aggregation-gate checks (PLACEHOLDER -> provisional; sourced -> confirmed).

## Files
- netlify/functions/peripheral-referral.cjs            (negation guard + clause scoping + temporal + bare-noun + co-location)
- netlify/functions/fleet-peripheral-aggregation.cjs   (PLACEHOLDER honesty + structural PREVALENCE confidence-gating)
- tests/peripheral-extractor-adversarial.test.cjs      (negation lock + foil; git-ignored, runs locally)
- tests/peripheral-extractor-independent.test.cjs      (the reviewer's independent corpus, 8/8 + foil; committed gate)
- tests/peripheral-extractor-voice-stress.test.cjs     (medium probe: Tier-1 locked, Tier-2 run-on KNOWN-OPEN measured)
- DEPLOY414-INSTRUCTIONS.md, DEPLOY415-INSTRUCTIONS.md

## Commit (engines + docs; tests/ is git-ignored and runs locally)
```bash
git pull
node tests/peripheral-extractor.test.cjs              # 18/18
node tests/peripheral-extractor-adversarial.test.cjs  # 9/9, foil fails 4/4
node tests/fleet-peripheral-aggregation.test.cjs      # 10/10
npx tsc -b
node tests/peripheral-extractor-independent.test.cjs   # 8/8, foil fails 5/5
git add netlify/functions/peripheral-referral.cjs netlify/functions/fleet-peripheral-aggregation.cjs DEPLOY414-INSTRUCTIONS.md DEPLOY415-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY414+415 - Fleet peripheral aggregation (cohort-aware: CLUSTER vs PREVALENCE vs ELEVATED_NO_CONTRAST; sound-asset-anchored guarded deviance guard; strictly parallel). DEPLOY415: hardened the SELF-AUTHORED extractor against two independent probes. Negation false-positives rooted out (isNegated/degradedNotNegated, pre+post-cue). The reviewer's INDEPENDENT corpus then surfaced three more classes the negation fix missed - attribution (clause-scoping: a condition cannot bleed across 'but' onto another subject), temporal resolution (remediatedPast: past-framed + remediated = not live), and actor-class precision (word-boundary bare-noun match: 'the guide' detected, 'guided wave' not) - plus co-location demotion so an incidental puddle folds into the structural finding while standalone standing water still refers. C3/C5 had been MASKED by a bare-noun gap; both now correct on real text. Structural anchor gating: a PLACEHOLDER/LOW/zero-sample expected rate can no longer emit a confirmed PREVALENCE (degrades to PREVALENCE_PROVISIONAL) - an invented baseline structurally cannot produce a confident systemic call. Extractor 18/18, negation-adversarial 9/9, independent corpus 8/8, aggregation 13/13, full regression 28/28, tsc clean."
git push
```

## Next (still NOT shipped - both need live, and the wiring is a DESIGN call, not plumbing)
1. **Independent extractor corpus** (recommended FIRST): real inspector phrasings -> expected
   actor class, authored externally. Closes the authoring blind spot the way the ranking corpus did.
2. **/fleet "Systemic Patterns" panel**: runs aggregatePeripherals over per-asset referrals
   (flags = REFER actors). The parallel-not-coupled discipline lives in the engine; on screen it
   can leak - if the panel sits inline with the order of action, users read a systemic finding as
   a reason to jump an asset's rank (the coupling deliberately kept out of code). It must be a
   SEPARATE panel addressed to the integrity/reliability owner, not the inspector reading the
   action list. Where it sits IS the discipline, in pixels.
