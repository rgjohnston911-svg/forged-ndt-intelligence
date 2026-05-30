# DEPLOY389 - SA Tier 3a: organizational-failure coverage expansion

## Why
The SA validation corpora (100-case + 150-case cross-domain batteries) showed the
organizational-failure engine was catching only 2 of the ~6 management-system
failures the scenarios describe. It fired `DEGRADATION_IGNORED` +
`SCHEDULE_PRESSURE_OVERRIDE` but MISSED deferred maintenance, downgraded
recommendations, personnel turnover, and incentive bias -- and its degradation /
production-pressure keywords were brittle to phrasing ("accelerated degradation"
and "emphasized production continuity" went undetected).

## What changed (single file, additive)
`netlify/functions/situational-awareness-organizational.cjs`:
- **Four new failure categories** (the gaps the corpora exposed):
  - `DEFERRED_MAINTENANCE` (MAINTENANCE_DEFERRAL, HIGH) - deferred maintenance,
    maintenance backlog, outage delayed, work order deferred, replacement deferred.
  - `RECOMMENDATION_DOWNGRADED` (GOVERNANCE_FAILURE, HIGH) - recommendations
    downgraded/overruled/ignored during planning.
  - `PERSONNEL_TURNOVER` (COMPETENCY_RISK, MEDIUM) - turnover in experienced
    personnel, loss of institutional knowledge, staffing shortage.
  - `INCENTIVE_BIAS` (DECISION_CONTAMINATION, MEDIUM) - incentives/bonus/
    compensation tied to production.
- **Hardened phrasing** on two existing patterns so they are robust to common
  variants: `DEGRADATION_IGNORED` (+degradation, accelerated, worsening,
  increasing severity); `SCHEDULE_PRESSURE_OVERRIDE` (+production continuity,
  production schedule, emphasized production, planned utilization).

Output shape is unchanged (`indicators` / `organizational_failure_score` /
`summary`), so the new detection flows straight into the existing report PDF +
SA card from DEPLOY383 -- no orchestrate or frontend change.

## Verification (corpus-locked, both batteries)
- `tests/situational-awareness-organizational-corpus.test.cjs` (git-ignored):
  - 100-case battery: deferred=101, downgraded=100, turnover=100; avg org score
    **9.9/10** (was ~4.5 with 2 indicators).
  - 150-case cross-domain battery: deferred/downgraded/turnover/pressure/
    degradation all **150/150**; avg **10.0/10**.
- `tests/situational-awareness-organizational.test.cjs` (Test-1 regression):
  unchanged -- still 7 indicators, 10/10 (new keywords add no false indicators).
- `tsc -b` clean.

## Files (2 committed; tests + fixtures git-ignored, run locally)
- `netlify/functions/situational-awareness-organizational.cjs`  (4 new patterns + hardened keywords)
- `DEPLOY389-INSTRUCTIONS.md`                                    (this file)

## Commit
```bash
git pull
node tests/situational-awareness-organizational.test.cjs
node tests/situational-awareness-organizational-corpus.test.cjs
npx tsc -b
git add netlify/functions/situational-awareness-organizational.cjs DEPLOY389-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY389 - SA Tier 3a organizational coverage. Add DEFERRED_MAINTENANCE, RECOMMENDATION_DOWNGRADED, PERSONNEL_TURNOVER, INCENTIVE_BIAS indicators and harden DEGRADATION_IGNORED + SCHEDULE_PRESSURE_OVERRIDE phrasing. Driven by the 100- and 150-case SA corpora; org-risk detection rises from ~2 indicators (avg 4.5/10) to full coverage (avg 9.9-10.0/10). Output shape unchanged -> renders via existing SA card/PDF. Test-1 regression intact (7 indicators). tsc -b clean."
git push
```
Paste the push output.

## Next (long-term roadmap)
- DEPLOY390: classification-keyword coverage (the ~40 'unknown' process assets
  from the classification corpus) -- routed per their API code, authority-verified.
- DEPLOY391: wire the deterministic-core harness (ndt_deterministic_battery.js)
  to decision-core for permanent property-based core coverage.
