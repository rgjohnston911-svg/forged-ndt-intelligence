# DEPLOY380: API Auth — Phase 2 (SPA sends the session token)

## What This Does
Makes the SPA's `callAPI()` attach the logged-in user's Supabase session token (`Authorization: Bearer <access_token>`) to every `/api/*` request. This is **Phase 2 of 3** and is **additive / non-breaking**: the backend does not enforce auth yet, so sending the header changes nothing functionally — but it makes the entire SPA ready for enforcement in Phase 3.

## Changes (all in `src/pages/VoiceInspectionPage.tsx`)
1. `import { supabase } from "../lib/supabase";` (the app's existing Supabase client).
2. In `callAPI()`: before the `fetch`, read the session via `supabase.auth.getSession()` and add `Authorization: Bearer <token>` **only when a session exists**. If there's no session or the lookup throws, it proceeds with no auth header — identical to the prior behavior.

## Why it's safe
- **Non-breaking.** Functions don't check the token yet (Phase 3), so behavior is unchanged whether or not the header is present.
- **Graceful.** No session → no header (wrapped in try/catch). `getSession()` reads the cached local session (no network round-trip).
- **Compiles clean.** `tsc -b` exits 0. Diff is ~12 lines, isolated to `callAPI` + one import.
- **Note:** the `SUPABASE_KEY` constant in this file (line ~1137) is the **public anon key** (safe to ship by design, gated by RLS) and the direct Supabase REST insert path is unchanged.

## Local build (recommended; Netlify is the authoritative gate)
This is a frontend change. Run a full build locally if you can:
```
npm run build
```
(If OneDrive blocks `vite build` as before, `tsc -b` already passed here and Netlify will run the full build on clean infra.)

## Deploy Steps (git bash)
```
git pull
git add src/pages/VoiceInspectionPage.tsx DEPLOY380-INSTRUCTIONS.md
git status
git diff --cached --stat src/pages/VoiceInspectionPage.tsx
```
Confirm `modified: src/pages/VoiceInspectionPage.tsx` + `new file: DEPLOY380-INSTRUCTIONS.md`, and a small (~12-line) diff. Then:
```
git commit -m "DEPLOY380 - API Auth Phase 2: callAPI attaches the Supabase user session token (Authorization: Bearer). Additive/non-breaking - backend does not enforce yet; no session -> no header as before. Readies the SPA for Phase 3 enforcement."
git push
```
If an `index.lock` error appears, `rm -f ".git/index.lock"` and retry. Confirm `git status` shows the file staged before committing.

## After Deploy — quick live sanity check
Once Netlify publishes: run a normal inspection and confirm the pipeline still works exactly as before (the new header is ignored by the unenforced backend). In browser DevTools → Network, an `/api/*` request should now carry an `Authorization: Bearer …` header when you're logged in.

## Next: Phase 3 (enforcement — the careful part)
With the helper (Phase 1) live and the SPA sending tokens (Phase 2), enforcement rolls out **incrementally**:
1. Pick a small pilot set of sensitive endpoints (e.g. `enterprise-audit`, `export-audit-bundle`, `rbac`) — ideally ones the SPA already calls with a token.
2. In each, `var authGuard = require("./auth-guard.cjs");` at top level (fail-closed) and, in the handler after the OPTIONS/method checks, `var auth = await authGuard.verifyAuth(event); if (!auth.ok) { return authGuard.denyResponse(auth, headers()); }`.
3. Deploy, verify the SPA still works AND an unauthenticated curl now gets 401.
4. Expand batch by batch, re-verifying each time. Set `NDT_API_KEY` on the NDT Netlify site (matching WeldScan's proxy value) before enforcing any endpoint the proxy calls.
