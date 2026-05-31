# DEPLOY421 - Auth on internal callees (gap analysis P0-1, Batch B partial)

## What this does
Guards three internal-only functions and makes their callers authenticate via X-API-Key, so the
server-to-server chains keep working while the endpoints stop being publicly callable.

GUARDED (now require auth - JWT or X-API-Key):
- superbrain-report-background   (only caller: superbrain-report)
- package-store                  (callers: replay-audit GET, perspective-projection POST)
- perspective-projection         (caller: replay-audit; also invoked by the full-pipeline gate)

FORWARDING added (caller now sends `X-API-Key: process.env.NDT_API_KEY`):
- superbrain-report -> superbrain-report-background
- replay-audit      -> package-store (GET) and perspective-projection (POST)
- perspective-projection -> package-store (fire-and-forget persist)

These three were chosen because their FULL caller set is known and covered (no frontend caller, no
other internal caller). Verified by grepping every `/api|/functions/<callee>` reference + every gate.

## REQUIRES NDT_API_KEY (already set by you)
The guarded callees accept X-API-Key only when NDT_API_KEY is present in their env, and the callers
send `process.env.NDT_API_KEY`. If NDT_API_KEY is missing in a deploy context, these internal chains
401. You set it in Netlify - confirm it exists in the SAME deploy context you smoke-test (prod vs
branch/preview can be scoped separately).

## Gate fix
full-pipeline.test.cjs invokes perspective-projection.handler directly; it now sets NDT_API_KEY +
sends X-API-Key. (The break-then-fix is proof the guard is enforced.) tsc clean; full suite 35/35.

## NOT done yet (Batch B2/B3 - deferred on purpose, see AUTH-ROLLOUT-PLAN.md)
- observation-layer / reasoning-layer / truth-engine / formula-intelligence-core: extra callers in
  health.ts + regression-test-authority.ts must forward first.
- tri-model-reasoning-background: dispatches outbound to engines dynamically - forward those too first.
- ai-chat's 7 target engines (coordinate with the card batch C, since universal-code-authority is both).

## Smoke test (preview, after NDT_API_KEY confirmed in that context)
In addition to the A/A2 checks (case + photo + fleet), exercise:
- Generate a Superbrain report (superbrain-report -> background).
- A replay / audit action if surfaced in the UI (replay-audit -> package-store + perspective-projection).
Confirm 200s. A 401 on these means NDT_API_KEY is missing in that deploy context (not a code bug).
Revert is removing the require + guard line from the 3 callees.

## Commit (with DEPLOY419 + 420; all pre-launch hardening)
```bash
node scripts/run-gates.cjs && npx tsc -b
git add netlify/functions/superbrain-report-background.ts netlify/functions/package-store.cjs netlify/functions/perspective-projection.cjs netlify/functions/superbrain-report.ts netlify/functions/replay-audit.cjs tests/full-pipeline.test.cjs AUTH-ROLLOUT-PLAN.md DEPLOY421-INSTRUCTIONS.md
git commit -m "DEPLOY421 - Auth P0-1 batch B (partial): guard superbrain-report-background, package-store, perspective-projection (full caller coverage), forward X-API-Key in superbrain-report/replay-audit/perspective-projection, fix full-pipeline gate. Requires NDT_API_KEY in env. tsc clean; 35/35. Remaining internal chains staged in AUTH-ROLLOUT-PLAN.md."
git push
```
