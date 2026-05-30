# DEPLOY404 - Human-factors / management-system governance banner (closes the archetype)

## Source: live-pack human-factors case (TEST 8) - 9/10
The question loop is fixed (the report generated). The org-failure detector fired
(7.5/10) and disposition was correctly held. GPT's only weakness:

> "It says GOVERNING: NONE. Better wording: 'No active damage mechanism governs from the
> minor indication; disposition is governed by asset-integrity assurance failure /
> management-system breakdown.'"

## Root cause
When no physical damage mechanism is active, FMD returns governing_failure_mode = NONE
and the report showed a bare "GOVERNING: NONE" - even though the organizational-failure
detector had identified the real governing concern (deferred maintenance, lost
expertise, undocumented repair, missing records, outdated procedures). The org risk was
shown only down in the SA brief, not as a governing-level statement.

## Fix (VoiceInspectionPage.tsx)
New banner alongside the governing banners: when the organizational-failure score is
significant (>= 5, or >= 2 indicators), surface
- "DISPOSITION GOVERNED BY: asset-integrity assurance failure / management-system
  breakdown (org risk N/10) - no active damage mechanism governs from the minor
  indication; the governing risk is unknown asset condition from weak controls and
  missing documentation." (when governing_failure_mode is NONE), or
- "DISPOSITION ALSO GOVERNED BY: ... management-system breakdown ..." (when a mechanism
  is also active).
This is the same confirmed-vs-governing pattern as fatigue (DEPLOY398), support
(DEPLOY402), and forward-risk (DEPLOY401), now for the human-factors axis. FMD's
governing_failure_mode is untouched - this is a governing-CONCERN statement, not a
mechanism claim.

## Verification
- tsc -b clean. Frontend-only (org field names confirmed: organizational_failure_score,
  indicators). Threshold (score>=5 or >=2 indicators) avoids firing on trivial mentions.

## This commit also carries DEPLOY403 (definitive question-loop fix), still unpushed
Both touch only src/pages/VoiceInspectionPage.tsx.

## Files
- src/pages/VoiceInspectionPage.tsx   (DEPLOY403 pause-gate + DEPLOY404 org-governing banner)
- DEPLOY403-INSTRUCTIONS.md, DEPLOY404-INSTRUCTIONS.md

## Commit (403 + 404)
```bash
git pull
npx tsc -b
git add src/pages/VoiceInspectionPage.tsx DEPLOY403-INSTRUCTIONS.md DEPLOY404-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY403+404 - question-loop + human-factors governance. (403) clarifying-question pause fires only on the first round; after the user answers a round the pipeline proceeds and never re-asks, even if parse-incident rephrases questions. (404) when no active damage mechanism governs but the org-failure detector fires, the report shows 'DISPOSITION GOVERNED BY: asset-integrity assurance failure / management-system breakdown' instead of a bare GOVERNING: NONE (human-factors archetype). tsc clean; frontend-only."
git push
```
After pushing, wait for the Netlify build and HARD-REFRESH (Ctrl+Shift+R), then re-run
TEST 8 - expect the management-system governance banner; and confirm the question loop
is gone.

## Milestone
This closes the FIFTH and final live-pack archetype. All five now have a governing-
concern surfacing when the obvious defect is NOT the governing risk:
- fatigue (DEPLOY397/398): confirmed corrosion + SUSPECTED governing fatigue + disposition driver
- consequence (DEPLOY400): receptor-exposure -> CRITICAL life-safety
- future-state (DEPLOY401): forward-trajectory governing (trend/deferred/throughput)
- support (DEPLOY402): support failure + cascade governs over a within-limits primary
- human-factors (DEPLOY404): management-system breakdown governs when no mechanism is active
