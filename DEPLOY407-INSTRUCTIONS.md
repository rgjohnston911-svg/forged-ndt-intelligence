# DEPLOY407 - Fleet polish: clean asset names + nav link

## Source: first successful live Fleet run
The Fleet page ran end-to-end (4 assets, all `done`, ranked - no errors). Two small
follow-ups from that run.

## A. Asset-name markdown leak (FleetTriagePage.tsx)
Cards read "** Storage Tank" because deriveName captured the markdown `**` from
`**Asset:**`. Added a `cleanName()` pass that strips markdown/punctuation (`* _ > # ``)
and leading `: -`, so cards now read "Storage Tank", "Heat Exchanger", etc.

## B. Fleet nav link (AppShell.tsx)
Added a "Fleet" item (anchor icon) to the top nav so /fleet is reachable without typing
the URL.

## C. Auto-split scenarios on "Asset:" headers (FleetTriagePage.tsx)
First live multi-scenario run merged everything into ONE asset because the scenarios were
pasted back-to-back WITHOUT `===` delimiters. splitScenarios now: uses `===`/`---` lines if
present, otherwise auto-splits before each `Asset:` header when 2+ are present (the live-
pack paste format). Verified: a headerless 2-scenario paste now yields 2 separate assets.

## Verification
- tsc -b clean. Frontend-only. Files intact (no NUL/truncation).

## Note on the 4-way tie you saw (not a bug)
All four assets scored 75/100 PRIORITY because they were the SAME human-factors scenario
on four different asset names - identical context (production pressure, deferred
maintenance, lost personnel, undocumented repair) -> identical HIGH/hold/org-risk ->
identical score. That is the honest result. The ranking separates assets when the
scenarios actually differ: storm exposure, support cascade, consequence tier, forward
risk, and confidence all move the score (as the offline 6-platform demo showed). To see
separation, give each asset distinct findings or tick the storm box for offshore assets.

## Files
- src/pages/FleetTriagePage.tsx   (clean asset names)
- src/components/AppShell.tsx      (Fleet nav link)
- DEPLOY407-INSTRUCTIONS.md

## Commit
```bash
git pull
npx tsc -b
git add src/pages/FleetTriagePage.tsx src/components/AppShell.tsx DEPLOY407-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY407 - Fleet polish: (a) strip markdown from parsed asset names (no more '** Storage Tank'); (b) add Fleet nav link to header; (c) auto-split scenarios on Asset: headers when no === delimiter is present, so a back-to-back paste no longer merges into one asset. Frontend-only; tsc clean."
git push
```
After deploy + hard-refresh: a "Fleet" link appears in the top nav, and asset cards show
clean names. The 4-way tie is expected for identical-context scenarios - to exercise the
ranking, try assets with genuinely different findings / storm exposure.
