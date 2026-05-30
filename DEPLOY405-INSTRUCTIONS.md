# DEPLOY405 - Fleet Triage (multi-asset ranking)

## What this adds
A self-contained Fleet Triage page that ranks several assets into one defensible
ORDER OF ACTION - built for the multi-asset decision under time pressure (e.g. several
platforms in a hurricane's path: which do you address first?).

Access at **/fleet** (4dndt.com/fleet). It does NOT touch the single-asset /voice flow.

## How it works
1. Paste several scenarios in the page, separated by a line of `===` (or `---`).
2. Each scenario runs SEQUENTIALLY (unattended - no question/evidence pauses) through the
   same backend the single-asset page uses: parse-incident -> resolve-asset ->
   reality-lock -> decision-core -> situational-awareness-orchestrate.
3. A defensive summary is extracted per asset (consequence tier, disposition, governing
   mode, support-cascade flags, future-state verdict, organizational-failure score,
   confidence band, storm exposure). A failed call degrades that asset gracefully -
   it never breaks the batch.
4. The new deterministic engine `fleet-triage.cjs` ranks them by an AUDITABLE urgency
   score (0-100): consequence (dominant) + disposition + governing severity + forward
   risk + support cascade + organizational risk + confidence-under-consequence + storm
   exposure. Every point is traceable to a named driver - no hidden weighting.
5. The page renders the order of action: a fleet summary + ranked cards (rank, band,
   score, the drivers that produced it, and a recommended action).

A "these assets are all in a storm/hurricane path" checkbox sets the storm axis for the
whole fleet; it is also auto-detected per scenario from storm keywords.

## Safety (the original question)
Batch is safe by construction: the analysis engines are pure/stateless (no shared
mutable state), each scenario is independent, and the only writes are additive. Running
many scenarios cannot corrupt anything.

## Verification
- `fleet-triage.cjs` ranking engine: VERIFIED offline. On a representative 6-platform
  hurricane fleet it ordered correctly (CRITICAL+storm+cascade first; an equally-severe
  ONSHORE asset NOT in the storm path correctly dropped below storm-exposed peers; clean
  asset last), with every score component shown.
- tsc -b: CLEAN (page + route).
- 23/23 regression locks pass; existing flows untouched.
- NOT yet verified end-to-end: the page's live batch run (it needs the deployed LLM +
  endpoints). The per-asset pipeline is built from the EXACT call shapes the /voice page
  uses, and extraction is fully defensive, but the first live run may surface an
  endpoint-body mismatch to iterate on. This is expected for a v1 UI that can't be
  exercised offline.

## Files
- netlify/functions/fleet-triage.cjs   (new - deterministic ranking engine + HTTP handler)
- src/pages/FleetTriagePage.tsx         (new - the Fleet Triage page)
- src/App.tsx                            (route /fleet + import)
- DEPLOY405-INSTRUCTIONS.md

## Commit
```bash
git pull
npx tsc -b
git add netlify/functions/fleet-triage.cjs src/pages/FleetTriagePage.tsx src/App.tsx DEPLOY405-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY405 - Fleet Triage (multi-asset ranking). New /fleet page: paste several scenarios (=== separated), run each sequentially through the existing pipeline (unattended), then rank into one order of action via the new deterministic fleet-triage engine (auditable urgency score: consequence + disposition + governing severity + forward risk + support cascade + organizational risk + confidence + storm exposure; every point traceable). Self-contained, does not touch /voice. Ranking engine verified offline; batch UI needs a live test pass. tsc clean; 23/23 locks."
git push
```
After the build deploys, open **/fleet**, paste 2-3 of the test scenarios separated by
`===`, tick the storm checkbox, and Run. Paste back what you see (especially any per-asset
"error" status) and I will fix any endpoint-body mismatch from the real responses.

## Notes
- No nav link added yet (reach it via /fleet). I can add one to the top nav once the
  live batch run is confirmed working - kept this commit minimal to limit risk.
- v1 shows the ranked dashboard, not a per-asset PDF for each; per-asset full reports can
  be added next if useful.
- Heads-up: the Edit tool truncated/NUL-corrupted files mid-build again (App.tsx and
  fleet-triage.cjs); both were restored/rewritten clean and verified (require + tsc), so
  the committed state is intact.
