# DEPLOY406 - Dashboard "loading" hang fix (+ ships DEPLOY405 Fleet Triage, never pushed)

## Two things in this push

### A. Dashboard hangs on "Loading dashboard..." (new bug you hit)
Root cause (src/pages/Dashboard.tsx): `loading` starts `true`, and the effect only calls
`loadDashboard()` (which clears it) when `profile?.org_id` exists - otherwise it returns
early and `loading` stays `true` FOREVER. So if the profile has no org_id (or hasn't
resolved yet), the dashboard spins indefinitely. There was also no try/finally, so a
failed Supabase query would hang it too.

Fix:
- No org_id -> `setLoading(false)` and return (effect re-runs when org_id arrives, so a
  slow profile load still resolves; a profile genuinely without an org now shows an empty
  dashboard instead of hanging).
- `loadDashboard()` wrapped in try/catch/finally so `loading` is ALWAYS cleared.

This is independent of the Fleet work and was already live (it's in the deployed
403+404 build) - that's why /voice loads but the dashboard does not.

### B. DEPLOY405 Fleet Triage - was never pushed
That is why there is no /fleet page on the live site: the page exists only in your local
files. The catch-all route redirects /fleet -> / (the dashboard), which is why you landed
on the hanging dashboard. This push deploys the Fleet page + ranking engine + route.
(See DEPLOY405-INSTRUCTIONS.md for full detail.)

## Verification
- tsc -b clean.
- All four files confirmed intact (no truncation/NUL corruption): fleet-triage.cjs
  (exports rankFleet/scoreAsset/urgencyBand/handler), FleetTriagePage.tsx, App.tsx (route
  present), Dashboard.tsx (fixed).
- fleet-triage ranking engine verified offline (prior turn).
- Fleet page batch run still needs the live end-to-end test (unchanged from DEPLOY405).

## Files
- src/pages/Dashboard.tsx              (406 - loading-hang fix)
- netlify/functions/fleet-triage.cjs   (405 - ranking engine + handler)
- src/pages/FleetTriagePage.tsx        (405 - Fleet page)
- src/App.tsx                          (405 - /fleet route)
- DEPLOY405-INSTRUCTIONS.md, DEPLOY406-INSTRUCTIONS.md

## Commit (405 + 406 together)
```bash
git pull
npx tsc -b
git add src/pages/Dashboard.tsx netlify/functions/fleet-triage.cjs src/pages/FleetTriagePage.tsx src/App.tsx DEPLOY405-INSTRUCTIONS.md DEPLOY406-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY405+406 - Fleet Triage page + Dashboard loading-hang fix. (406) Dashboard no longer hangs on 'Loading dashboard...' when profile.org_id is missing or a query fails (clear loading on no-org; loadDashboard wrapped in try/finally). (405) new /fleet page: paste several scenarios (=== separated), run each sequentially through the existing pipeline, rank into one order of action via the deterministic fleet-triage engine (auditable urgency score). Self-contained; does not touch /voice. tsc clean."
git push
```
After it deploys: hard-refresh (Ctrl+Shift+R). The dashboard should load, and **/fleet**
should exist. Then paste scenarios 47 & 48 on /fleet separated by `===`, run, and paste
back the per-asset progress lines + ranked output so I can fix any live endpoint mismatch.

## Note
Expect `git diff --cached --stat` to show 4 code files + 2 docs. If git shows the stray
unmerged paths again, clean them before committing.
