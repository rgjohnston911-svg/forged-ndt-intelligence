# DEPLOY412 - Peripheral Referral lens (catalog-driven, with acceptance gate)

## Source: your idea - "the platform looking at peripheral problems from a picture or scenario"
Spec/scoring contract given first (peripheral_referral_tests.js, 9 golden), then the
COUPLING_CATALOG correction (coupling is a STRUCTURAL property of the actor class - looked
up, NOT inferred from text/pixels; consequence inherited from the primary's service tier).

## What it does
Routes each peripheral observation (corroded pipe support, foundation settlement, temp
clamp, cable tray, drainage, wet insulation, ...) to REFER / NOTE / SUPPRESS, scored by
plausibility = coupling x consequence. Evidence confidence is intentionally NOT a
suppressor: thin incidental evidence is the reason to refer for a proper look.

## Design discipline (the whole point)
- COUPLING comes from COUPLING_CATALOG keyed on actor class - never from text or pixels.
  anchor 0.90 > fixed_support 0.85 > spring_hanger 0.70 > guide 0.60 (structural order).
- consequence_if_active is INHERITED from the primary's service tier (passed in).
- The extractor only detects ACTOR TYPE + CONDITION, then applies a bounded +-0.08 extent
  modifier. It cannot re-derive coupling from wording.
- PHOTO/VISION feed: normalizeReferral() RE-DERIVES coupling+link_type from the catalog by
  actor type and DISCARDS any supplied coupling. A VLM emits actor type + condition +
  OBSERVED_VISUAL provenance + (low) confidence ONLY. Letting pixels produce coupling would
  rebuild the false-confidence trap; it is structurally prevented here.

## Reconciliation with DEPLOY402 (the decision that was yours)
DEPLOY402's support detector is a BINARY detector (support_failure_governs / support_cascade)
with a flat SUPPORT_TERMS list and NO coupling scalar. So there is no live coupling number
to match - the catalog is the FIRST quantification. What was reconciled:
- Actor vocabulary: fixed_support keywords extended to cover DEPLOY402's terms
  (support beneath / support structure / support member / pipe hanger), with spring_hanger
  / anchor / guide split out as distinct catalog classes.
- Condition vocabulary: the extractor's degraded-guard regex extended to match DEPLOY402's
  SUPPORT_DEGRADE/SUPPORT_ADJ (buckl, rusted, rusting, section loss, wasting).
The couplings themselves are newly introduced (documented, structurally ordered), not copied
from a non-existent live number.

## Calibration (owned)
Building the catalog surfaced a knife-edge the hand-tuned 9/9 had hidden: fixed_support
(0.85, the strongest load carrier) at MEDIUM scores 0.85*0.4 = 0.34 - a hair under the 0.35
NOTE threshold - so a corroded primary support on a medium line would be SILENTLY SUPPRESSED.
Calibration decision: a degrading LOAD_PATH actor above the coupling floor never fully
suppresses; it FLOORS at NOTE. Environmental/consequence actors stay plausibility-gated and
escalate only via the primary's inherited consequence tier. Net MEDIUM/LOW matrix:
LOAD_PATH -> NOTE; ENV/CONSEQUENCE -> SUPPRESS; any coupled actor at HIGH/CRITICAL -> REFER.
Verified compatible with all 9 scorer golden cases (they are LOAD_PATH->{REFER,NOTE} or
SUPPRESS-by-NONE/below-floor/environmental; the floor changes none of them). Catalog
couplings + thresholds untouched; extent modifier stays bounded +-0.08 (nudges, never decides).

## Verification
- Scorer: 9/9 on the original golden cases (ported verbatim).
- EXTRACTOR ACCEPTANCE GATE (the real gate - raw text in, structured ref out, asserting
  actor type + CATALOG coupling + link_type + routing): **18/18**, incl. extent +/-,
  catalog-NONE suppression (cable tray @ CRITICAL -> SUPPRESS), disconnection -> NONE, and
  two clean-mention -> NO-referral cases.
- Full local regression set: 24/24 (the extractor gate is now one of them).

## Files
- netlify/functions/peripheral-referral.cjs   (engine: scorer + catalog + extractor + normalizeReferral + handler)
- tests/peripheral-extractor.test.cjs          (acceptance gate; git-ignored, run locally)
- DEPLOY412-INSTRUCTIONS.md

## Commit (engine + doc; tests/ is git-ignored and runs locally)
```bash
git pull
node tests/peripheral-extractor.test.cjs   # acceptance gate must be 16/16 before shipping
npx tsc -b
git add netlify/functions/peripheral-referral.cjs DEPLOY412-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY412 - Peripheral Referral lens. Catalog-driven: coupling is a structural property of the actor class (COUPLING_CATALOG), never inferred from text/pixels; consequence inherited from the primary tier; extractor detects actor type + condition with a bounded +/-0.08 extent modifier. Photo/vision feed (normalizeReferral) re-derives coupling from the catalog and discards any supplied value. Reconciled actor/condition vocab with DEPLOY402 (binary detector, no live coupling). Scorer 9/9; extractor acceptance gate 16/16; full local regression 24/24. Additive, nowhere near the baseline."
git push
```

## Still NOT shipped (the wirings - both need live)
1. Scenario -> report: a "Peripheral Referrals" section that runs the transcript through
   this engine (inheriting the primary's consequence tier) and lists REFER/NOTE items.
2. Picture -> engine: the GPT-4o vision layer emits observations in the referral shape
   (actor type + condition + OBSERVED_VISUAL + confidence, NO coupling) -> normalizeReferral
   -> scorer. Same scorer, source-agnostic.
