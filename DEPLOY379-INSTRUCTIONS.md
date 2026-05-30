# DEPLOY379: API Auth — Phase 1 (verifyAuth shared helper)

## What This Does
Adds a shared request authenticator, `netlify/functions/auth-guard.cjs`, that the NDT functions will adopt to close the open-API-surface finding (GAP-ANALYSIS SEC-1/2/3). This is **Phase 1 of 3** and is **non-breaking**: the helper ships with **no callers**, so it deploys as a no-op (like the SA modules) and changes nothing in production yet.

## The auth model (why this shape)
The SPA already authenticates users via Supabase (`src/lib/auth.tsx`, sessions with `access_token`). The proven verification pattern already exists in `create-case.ts` (`supabase.auth.getUser(token)` with the service-role client). `verifyAuth(event)` generalizes it and accepts **either**:
- a valid **Supabase user JWT** — `Authorization: Bearer <access_token>` (the SPA path), or
- a valid **server key** — `X-API-Key === process.env.NDT_API_KEY` (the WeldScan `4dnt-proxy` server-to-server path).

It **fails closed**: missing token, bad token, missing config, or any thrown error → `ok:false`. Callers deny on `ok:false`.

## The 3-phase rollout (so the live app never breaks)
- **Phase 1 (this deploy):** ship the helper, no callers. Zero production impact.
- **Phase 2 (next):** make the SPA's `callAPI` attach the user's `Authorization: Bearer` token. Additive — sending a header nobody enforces yet is harmless, but it makes the whole SPA ready.
- **Phase 3:** enforce `verifyAuth` on functions **incrementally**, starting with sensitive/admin endpoints, verifying the live SPA still works after each batch. Functions adopt it via a **top-level** `require` (so a bundling failure 500s = fail-closed, never silently allows).

## Files in This Deploy
### 1. NEW — `netlify/functions/auth-guard.cjs`
Exports `verifyAuth(event)` → `{ ok, principal:'user'|'service', user, status, error }` and `denyResponse(authResult, corsHeaders)`. Pure-style (`var` only, no template literals, no arrow functions); requires `@supabase/supabase-js` (already a dependency).

### 2. LOCAL-ONLY — `tests/auth-guard.test.cjs`
Git-ignored. Tests the offline paths (valid X-API-Key → service; missing/wrong token → 401; token without Supabase config → 500 fail-closed; header parsing). The live JWT path (`getUser`) is verified post-deploy. Run: `node tests/auth-guard.test.cjs`.

## Config note (for Phase 3, not needed now)
For the server-to-server path to work once enforced, set **`NDT_API_KEY`** in the NDT Netlify site's environment variables to the **same value** the WeldScan site's proxy sends (WeldScan already reads `process.env.NDT_API_KEY`). Until enforcement, no env change is required.

## Deploy Steps (git bash)
```
git pull
node tests/auth-guard.test.cjs
git add netlify/functions/auth-guard.cjs DEPLOY379-INSTRUCTIONS.md
git status
```
Confirm exactly those two files are staged (the `tests/` file is git-ignored and won't appear). Then:
```
git commit -m "DEPLOY379 - API Auth Phase 1: verifyAuth() shared helper (Supabase JWT or X-API-Key, fail-closed). No callers yet (non-breaking, deploys no-op). Mirrors create-case.ts getUser pattern. Foundation for incremental enforcement."
git push
```
If an `index.lock` error appears, `rm -f ".git/index.lock"` and retry. Confirm `git status` shows the file staged before committing.

## After Deploy
No behavior change (no callers). Next: **Phase 2** — wire the SPA `callAPI` to send the session token.
