# DEPLOY387 - SEC-3: auth enforcement canary on master-router

## What
Adopts the `auth-guard.cjs` helper (shipped DEPLOY379) on `master-router` — the
first NDT function to actually ENFORCE auth. Unauthenticated requests now get
401; valid callers (Supabase user JWT from the SPA, or the server `X-API-Key`)
pass. This is the production canary that proves the adoption pattern + env
config (NDT_API_KEY confirmed set; SUPABASE_* already used by create-case)
before rolling auth out to the high-value endpoints.

## Why master-router first (zero blast radius)
- `netlify.toml` routes `/api/*` straight to `:splat`, so master-router is a
  standalone intake endpoint, NOT a dispatcher other endpoints pass through.
- Repo-wide search: master-router has **no SPA caller and no function-to-function
  caller** (only comment mentions). Enforcing it cannot break the app or any
  internal call. Any unauthenticated hit is exactly what SEC-3 wants blocked.
- The app is fully login-gated (`App.tsx`: `if (!user) return <Login/>`), so the
  SPA always carries a Bearer token — the pattern is safe to extend next.

## Adoption pattern (reused by every future endpoint)
```ts
var authGuard = require("./auth-guard.cjs");   // TOP-LEVEL: bundling failure 500s, never silently allows
...
// after the OPTIONS/method guards, before the work:
var auth = await authGuard.verifyAuth(event);
if (!auth.ok) { return authGuard.denyResponse(auth, CORS_HEADERS); }
```

## Verification
- `tsc -b` clean.
- `tests/auth-guard.test.cjs` (git-ignored): no creds -> 401; valid X-API-Key ->
  allow (service); wrong key + no JWT -> 401; case-insensitive headers;
  denyResponse shape; stripBearer/getHeader helpers.
- Post-deploy smoke test (run after Netlify publishes):
  ```bash
  # Expect 401:
  curl -i -X POST https://4dndt.netlify.app/api/master-router -H "Content-Type: application/json" -d '{"transcript":"annual inspection"}'
  # Expect 200 (replace with the real key):
  curl -i -X POST https://4dndt.netlify.app/api/master-router -H "Content-Type: application/json" -H "X-API-Key: <NDT_API_KEY>" -d '{"transcript":"annual inspection"}'
  ```

## Files (2)
- `netlify/functions/master-router.ts`   (+14: top-level require + verifyAuth guard)
- `DEPLOY387-INSTRUCTIONS.md`             (this file)
(`tests/auth-guard.test.cjs` is git-ignored.)

## Commit
```bash
git pull
node tests/auth-guard.test.cjs
npx tsc -b
git add netlify/functions/master-router.ts DEPLOY387-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY387 - SEC-3: enforce auth-guard on master-router (zero-caller canary). Top-level require + verifyAuth/denyResponse; rejects unauthenticated requests (401), accepts Supabase JWT or server X-API-Key. No SPA/internal caller -> no blast radius. Proves the auth adoption pattern + env before rolling out to high-value endpoints. tsc -b clean; auth-guard test passes."
git push
```
Paste the push output, then run the curl smoke test above.

## Next (expansion, after the canary is confirmed live)
1. **High-value / LLM-spend endpoints** (SEC-1): decision-core, weld-evaluate,
   nde-image-analysis. All are SPA-called via callAPI (token always present) and
   reachable server-to-server via X-API-Key. **Before enforcing**, confirm no
   CI/cron/external tool calls them unauthenticated (you were unsure) — a quick
   way is to ship them in fail-open log-only mode for a day and watch the
   function logs, then flip to enforce.
2. **Audit endpoints with token-carrying SPA callers**: enterprise-audit,
   verify-audit-chain — verify BOTH EnterpriseAuditCard fetches attach the token
   first.
3. **Needs a client fix before enforcing**: export-audit-bundle is called as a
   tokenless GET (DecisionSpineCard); add the Authorization header there first.
4. **CORS lockdown (SEC-2)** folds in once auth is enforced.
