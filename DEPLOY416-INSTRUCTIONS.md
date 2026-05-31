# DEPLOY416 - /fleet "Systemic Patterns" panel (the design call, wired + gated)

## What shipped
The parallel program-level view on /fleet, built against the placement design that two
independent derivations converged on. The discipline the engine enforces in code -
systemic findings run PARALLEL to the order of action, never re-ranking or dispositioning
an asset - now survives into the pixels, and is locked by machine-checks so it cannot leak
in a later style pass.

## The locked design (six rules, color resolved to the disjoint palette)
1. FIREBREAK - the panel is its OWN region (data-region="systemic"), below the order of
   action, never a sidebar beside it and never a badge on an asset row.
2. DIFFERENT READER - "for: integrity / reliability owner" badge; the ranked list is for
   the operator ("what to address first").
3. PRINTED NON-COUPLING - the panel states in plain text that it does NOT re-rank or
   disposition any asset.
4. DISJOINT PALETTE - systemic uses teal (confirmed: CLUSTER / PREVALENCE) and gray
   (provisional: PREVALENCE_PROVISIONAL / ELEVATED_NO_CONTRAST). It NEVER reuses an urgency
   band colour (#dc2626 / #ea580c / #ca8a04 / #16a34a) or band name. (This corrected the one
   real disagreement: info-blue collided with the elevated band; teal/gray is disjoint.)
5. PROVISIONAL LOOKS PROVISIONAL - a PREVALENCE_PROVISIONAL finding always renders WITH its
   "cannot confirm" caveat; the structural anchor-gating from the engine surfaces honestly.
6. HONEST CHIP - the top chip encodes confidence ("N patterns / M confirmed"), anchors DOWN
   to the panel (unmissable without being adjacent, without forcing the panel open), and its
   count equals the rendered finding count.
   + graceful degrade: zero findings -> one calm "no program-level patterns" line, never an
   empty scary box and never a hidden section.

## The four machine-checks (the strongest part: design call back inside the method)
src/lib/__tests__/systemicPanel.test.ts gates the discipline against a future "improvement":
- CHECK 1 (firebreak): findings render only inside one data-region="systemic"; the view is
  built from findings alone and every item palette is teal/gray (no urgency identity).
- CHECK 2 (no coupling): the panel HTML contains no urgency band colour and no band name in
  human-facing text (the machine data-signal="ELEVATED_NO_CONTRAST" attribute - the systemic
  vocabulary, not a band - is excluded from the band-name scan).
- CHECK 3 (provisional honesty): a PREVALENCE_PROVISIONAL finding never renders without
  "cannot confirm", and never as a confirmed (teal) item.
- CHECK 4 (honest chip): chip count == rendered findings; chip "confirmed" == teal findings.
Plus a graceful-degrade check (empty -> one line, no chip). The page renders the panel from
this same pure module (renderSystemicPanelHTML), so the gate binds to what is actually shown.

## Architecture (parallel by construction)
- netlify/functions/fleet-systemic.cjs - one composed call: per asset
  extractPeripheralsFromText -> scoreReferrals -> flagsFromReferrals, then aggregatePeripherals
  over the fleet. Returns program-level findings ONLY - it is handed transcripts but never the
  ranked urgency, and returns nothing that re-ranks or dispositions. PURE (composes two gated
  engines).
- src/lib/systemicPanel.ts - pure view model + HTML renderer (single source of truth for the
  panel; the gate and the page both use it).
- src/pages/FleetTriagePage.tsx - after fleet-triage ranking, a SEPARATE best-effort
  fleet-systemic call (a systemic failure cannot break the order of action); renders the count
  chip in the header and the panel in its own region below the ranked list. Cohort/context are
  optional scenario hints ("cohort: batch_1998", "context: marine_splash"); default cohort
  "fleet" (CLUSTER needs explicit cohorts; PREVALENCE needs a context).

## Verification
- Panel discipline gate (src/lib/__tests__/systemicPanel.test.ts): 4 checks + graceful, all
  pass (verified here via the compiled module; runs under `npm test` on the dev machine).
- fleet-systemic composition gate (tests/fleet-systemic.test.cjs): 7/7 (transcript -> flags ->
  CLUSTER; clean fleet silent; findings carry no urgency).
- End-to-end: a cohort of corroded supports -> fixed_support:CLUSTER -> chip "1 pattern /
  1 confirmed" -> teal cluster in its own region, zero band colours.
- Full .cjs regression: 30/30. tsc -b clean. No NUL/truncation in the shipped files.

## Files
- netlify/functions/fleet-systemic.cjs            (new - composed endpoint)
- src/lib/systemicPanel.ts                          (new - pure view model + renderer)
- src/lib/__tests__/systemicPanel.test.ts           (new - the four-check discipline gate)
- tests/fleet-systemic.test.cjs                     (new - composition gate; git-ignored, runs locally)
- src/pages/FleetTriagePage.tsx                     (wired: chip + panel + fleet-systemic call)
- package.json                                      (test glob now includes src/lib/__tests__)
- DEPLOY416-INSTRUCTIONS.md

## Commit
```bash
git pull
npm test                                  # includes the 4-check panel discipline gate
node tests/fleet-systemic.test.cjs        # 7/7
npx tsc -b
git add netlify/functions/fleet-systemic.cjs src/lib/systemicPanel.ts src/lib/__tests__/systemicPanel.test.ts src/pages/FleetTriagePage.tsx package.json DEPLOY416-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY416 - /fleet Systemic Patterns panel: the parallel-not-coupled discipline carried into the UI and locked. Separate region (data-region=systemic) below the order of action, addressed to the integrity/reliability owner, never re-ranking or dispositioning an asset. Disjoint palette (teal confirmed / gray provisional - never an urgency band colour/name). Confidence-encoding count chip that anchors down (unmissable without being adjacent). PREVALENCE_PROVISIONAL always renders its 'cannot confirm' caveat. Graceful one-line degrade. Four machine-checks (2 coupling + 2 honesty) in src/lib/__tests__/systemicPanel.test.ts so the discipline cannot silently leak in a later layout edit. New composed fleet-systemic.cjs endpoint (extract->flags->aggregate, pure). Panel gate + graceful pass; fleet-systemic 7/7; full regression 30/30; tsc clean."
git push
```

## After deploy (UI verification on the dev machine)
Hard-refresh /fleet, run a multi-asset paste where several assets share a "cohort: X" hint and
mention a corroded support. Expect: ranked order of action unchanged; a "N patterns / M
confirmed" chip in the header that scrolls to the panel; a separate Systemic Patterns panel in
teal/gray, addressed to the integrity owner, stating it does not re-rank. With no patterns: the
one-line "no program-level patterns" message, no chip.

## Still open (tracked, not parked)
Run-on attribution (voice-stress Tier-2, 0/3 synthetic) needs REAL field transcripts to
calibrate - the live demo risk is a packed utterance throwing a phantom support referral that
rolls into a phantom systemic finding in THIS panel. Data-collection task, not code.
