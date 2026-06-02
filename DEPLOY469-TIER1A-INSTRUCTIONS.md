# DEPLOY469 — Pilot Readiness TIER 1A: lock the exposure before the link circulates

From the Pilot-Readiness Work Order. The day-one risk once a shared link reaches an inspector pool is
the **unauthenticated backend** — uncapped anonymous Anthropic spend and anonymous prod-DB writes.
This locks the named spend/data/exfil endpoints. (Tier 1B quarantine + Tier 2 correctness are separate.)

## STEP 0 (DO THIS ON THE MACHINE FIRST — I can't): move off OneDrive
The recurring `.git/index` corruption is OneDrive (+ Windows AV) locking `.git/index` mid-commit.
Develop **only** in `C:\dev\forged-ndt-intelligence` (already where you commit). Stop using
`C:\Users\rjohn\OneDrive\Desktop\NDT Platform`, or exclude the repo from OneDrive sync + add a
Defender exclusion. Confirm a single active clone before committing.

## What changed (auth-guard the exposed endpoints; tier from the verified user, never the body)
- **`ai-chat.ts`** — the headline fix. Added the `auth-guard` (top-level require, fail-closed); an
  anonymous POST now returns **401**. Tier is derived **server-side** (defaults to the cheapest
  "assistant"), never from `body.user_tier`; `user_id` comes from the **verified token**, not the
  body (also closes an IDOR on the conversation history/usage actions). Added a best-effort
  per-principal rate limit (in-memory, per warm instance — defense-in-depth on top of auth).
  Reproduced: anon POST with `user_tier:"platform"` → `401 {"error":"Missing auth token"}`.
- **`data-ingestion.ts`** — guarded (was anonymous `insert` into prod `inspection_cases` via the
  service-role client, RLS-bypassed).
- **`export-audit-bundle.ts`** — guarded (audit/data exfil). Companion frontend change in
  **`src/components/DecisionSpineCard.tsx`** attaches the session JWT to the verify/export fetch so
  the logged-in flow keeps working.
- **`batch-processing-gateway.ts`**, **`notifications.ts`** — guarded (service-role clients).
- **Already guarded, no change needed:** `llm-proxy.js`, `master-router.ts` (verified). **`create-case.ts`**
  already authenticates inline and the frontend already sends its token (left as-is to avoid churn).

## Why this can't break the pilot
`ai-chat / data-ingestion / batch-processing-gateway / notifications` have **no frontend caller** —
guarding them affects only direct API abuse. `export-audit-bundle` is called by DecisionSpineCard,
which now sends the JWT. The **core inspector decision path** (decision-core, parse-incident,
resolve-asset, FMD, disposition-pathway, reconcile) is deliberately **not** in this set, so an
anonymous/logged-in inspector's analysis flow is unaffected.

## Verified (offline)
- All 5 patched functions transpile clean (no syntax errors).
- `npx tsc -b` clean (covers the DecisionSpineCard.tsx change).
- Functional: `ai-chat` anon POST → **401**; spoofed `user_tier:"platform"` never used.
- No decision engine touched → gates/eval unaffected (last green: 49/49, eval 20/20 at DEPLOY468).

## STILL OPEN (not in this commit — see the work order)
- **`system-check.html`** (the public doorway) is folded into **Tier 1B** (quarantine), where it
  moves out of the deploy path alongside the ~190 orphaned engines.
- **Tier 1B** — quarantine orphaned engines + LIVE-ENGINES manifest + CI check (shrinks the surface).
- **Tier 2** — the two confirmed correctness bugs (unmanned→FATAL word boundary; FMD interaction gate).
- **Systemic note:** tier is client-supplied across `tier-gate.ts` / `nde-image-analysis.ts` too;
  there is no server-side tier column today. ai-chat now defaults to the cheapest tier; wiring a real
  `profiles.tier` lookup is post-pilot.

---

## Git — Git Bash at /c/dev/forged-ndt-intelligence (reset first — phantom deletions)
```bash
git reset
git status   # expect modified: ai-chat.ts, data-ingestion.ts, notifications.ts,
             # batch-processing-gateway.ts, export-audit-bundle.ts, src/components/DecisionSpineCard.tsx;
             # untracked: DEPLOY469-TIER1A-INSTRUCTIONS.md.  NO deleted tests/tsconfig.
git add netlify/functions/ai-chat.ts netlify/functions/data-ingestion.ts netlify/functions/notifications.ts netlify/functions/batch-processing-gateway.ts netlify/functions/export-audit-bundle.ts src/components/DecisionSpineCard.tsx DEPLOY469-TIER1A-INSTRUCTIONS.md
git commit -m "DEPLOY469 Tier 1A: auth-guard the exposed endpoints (ai-chat/data-ingestion/export-audit-bundle/batch-processing-gateway/notifications); ai-chat tier+user_id from verified token not body (+ rate limit, IDOR fix); DecisionSpineCard sends JWT to export-audit-bundle"
git push
```

## Live check (on the deployed URL, not a claim)
```bash
# each should return 401/403, NOT 200:
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://4dndt.netlify.app/api/ai-chat -H "Content-Type: application/json" -d '{"action":"chat","message":"hi","user_tier":"platform"}'
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://4dndt.netlify.app/api/data-ingestion -H "Content-Type: application/json" -d '{"action":"import_thickness_grid","data":[]}'
curl -s -o /dev/null -w "%{http_code}\n" https://4dndt.netlify.app/api/export-audit-bundle?case_id=x
```
Then confirm the logged-in app still works: run a case, and the DecisionSpine "verify" button still
returns the bundle (it now sends your JWT). Core voice analysis is unchanged.
