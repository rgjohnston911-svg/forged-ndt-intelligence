# DEPLOY419 - CI/deploy gate (gap analysis P0-2) + the gap report

## What this fixes
The gap analysis found that **no automated test ran in the deploy pipeline**, and the 34
acceptance gates we built all arc were **git-ignored** (`tests/*.cjs`) - so they never reached
CI. A regression in decision-core, the classifier, or fleet would deploy clean as long as it
type-checked. This converts the whole session's gates from local-only into actual deploy
protection.

## Changes
- `.gitignore` - un-ignore the gates: `tests/*.cjs` then `!tests/*.test.cjs` (the 33 `*.test.cjs`
  gates are now TRACKED; the non-gate `benchmark-runner.cjs` and a leftover `_canary` stay ignored).
- `scripts/run-gates.cjs` (new) - runs every `tests/*.test.cjs` and exits non-zero if any fails;
  prints the failing gate's output tail.
- `package.json` - new script `"test:gates": "node scripts/run-gates.cjs"`.
- `netlify.toml` - build command is now `npm run test:gates && npm run build`, so **a red gate
  blocks the deploy** (the build fails before `vite build` runs).
- `.github/workflows/ci.yml` (new) - on push to main + every PR: `npm ci`, `tsc -b`,
  `npm run test:gates`, `npm test`. Catches regressions before merge and adds the `npm test`
  (tsx unit) suite as a visible check.
- `GAP-ANALYSIS-2026-05-30.md` (new) - the full prioritized gap report.
- 33 `tests/*.test.cjs` gates become tracked files in this commit.

## Verified
- `node scripts/run-gates.cjs` -> **33 / 33 passed**, exit 0.
- Fail-path proven: a deliberately failing gate makes the runner exit 1 (so the Netlify build
  fails -> no deploy).
- `git ls-files --others --exclude-standard tests/` -> exactly 33 `.test.cjs` gates will be
  tracked; `_canary` and `benchmark-runner.cjs` correctly excluded.
- `tsc -b` clean.

## Scope note (honest)
- The DEPLOY gate runs `test:gates` (the 33 deterministic-engine gates, all verified green here).
  `npm test` (the tsx unit suite) is run by the GitHub Action but is NOT yet in the deploy-blocking
  command - it wasn't runnable in my sandbox (esbuild platform mismatch), so I didn't want an
  unverified suite blocking your deploys. Once you confirm `npm test` is green locally, you can
  promote it into the Netlify command: `npm run test:gates && npm test && npm run build`.
- The slow gate (`decision-core-hold.test.cjs`) compiles decision-core via `npx tsc` (~10-20s);
  TypeScript is a devDep so it works in CI. It adds a bit to build time - that is the cost of the
  decision-core HOLD invariants running on every deploy.

## Commit (clear the stale lock first)
A stale `.git/index.lock` is present (OneDrive lock, same root cause as before) and blocks git
writes. Remove it, and delete the leftover canary, then commit:
```bash
del .git\index.lock              # PowerShell/cmd  (bash: rm -f .git/index.lock)
del tests\_canary.test.cjs       # leftover from gate verification (it is git-ignored anyway)

git pull
node scripts/run-gates.cjs       # 33/33 before you ship
git add .gitignore scripts/run-gates.cjs package.json netlify.toml .github/workflows/ci.yml GAP-ANALYSIS-2026-05-30.md DEPLOY419-INSTRUCTIONS.md tests/
git status
git diff --cached --stat          # expect the 6 config/doc files + 33 tests/*.test.cjs
```
Then:
```bash
git commit -m "DEPLOY419 - CI/deploy gate (gap analysis P0-2). Un-ignore the 33 acceptance gates, add scripts/run-gates.cjs, gate the Netlify build (npm run test:gates && npm run build) so a red gate blocks deploy, add .github/workflows/ci.yml (push/PR: gates + npm test + tsc). Converts the arc's gates from local-only to real deploy protection. Runner 33/33; fail-path exits 1; tsc clean. Ships GAP-ANALYSIS-2026-05-30.md."
git push
```

## After this lands - remaining gap-analysis priorities (NOT in this commit)
- **P0-1 auth**: wire `auth-guard.cjs` into the ~200 LLM/heavy endpoints (biggest spend/abuse risk).
- **P0-3 RLS**: scope the `TO public` Supabase policies to `service_role`; remove the
  `DELETE FROM profiles WHERE true` in `supabase-fix-rls.sql`.
- These are launch-blocking, not demo-blocking. See GAP-ANALYSIS-2026-05-30.md for the full list.
