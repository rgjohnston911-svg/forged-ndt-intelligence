# DEPLOY420 - Auth on the heaviest engines (gap analysis P0-1, batch A) + guard gate

## What this does
Closes the biggest piece of the unauthenticated-spend hole by requiring auth on the four heaviest
SPA-facing engines, using the proven auth-guard pattern (top-level require + one line after the
method gate). These four are called ONLY by token-attaching pages and appear in NO internal-call
or raw-fetch-card path (verified against the call graph), so guarding them is safe.

Guarded (require auth now) - the ENTIRE SPA pipeline, 11 engines:
- decision-core.ts, superbrain-synthesis.ts (GPT), photo-analysis.js (vision),
  situational-awareness-orchestrate.cjs, parse-incident.ts (GPT), voice-incident-plan.ts (GPT),
  resolve-asset.ts, reality-lock.ts, failure-mode-dominance.js, fleet-triage.cjs, fleet-systemic.cjs.
Every LLM-spend engine on the SPA path is now behind auth.

auth-guard accepts a Supabase user JWT (the SPA sends it when signed in) OR X-API-Key === NDT_API_KEY.
Fails closed (401) on no/invalid credentials.

## Why the SPA pipeline only (not all 200)
A blanket rollout breaks the app: functions call each other internally with no token, and seven
frontend cards raw-fetch with no auth header. The full staged plan is in AUTH-ROLLOUT-PLAN.md.
This commit guards the entire SPA-facing pipeline (verified safe against the call graph). Still
NOT guarded (need prerequisites first): internal callees (Batch B - need NDT_API_KEY + caller
X-API-Key forwarding), the 7 raw-fetch card endpoints (Batch C - need the cards to attach a JWT),
and ai-chat (Batch D).

## New / updated gates
- tests/auth-guard-enforcement.test.cjs (NEW) - 5/5: no-creds -> 401, valid X-API-Key -> ok,
  wrong key -> 401, case-insensitive header, denyResponse shape. (JWT path needs Supabase - not
  exercised offline.)
- tests/decision-core-hold.test.cjs (UPDATED) - decision-core now requires auth, so the gate sends
  X-API-Key (NDT_API_KEY set in-test) + points NODE_PATH at node_modules for the nested @supabase
  require. The fact that guarding decision-core BROKE this gate until it authenticated is proof the
  guard is enforced.

## Verified
- tsc -b clean. Full local gate suite: 35/35 (includes the new auth gate + the updated HOLD gate).
- Guard present in all four handlers.

## PREREQUISITE before deploy
Set `NDT_API_KEY` in the Netlify environment (Site settings -> Environment variables). The four
guarded engines are SPA-only so a JWT suffices, but set it now - the internal batches (B) need it.

## MANDATORY smoke test (do NOT skip - this path can't be exercised offline)
Deploy to a Netlify PREVIEW (not production), sign in, then:
1. Run a single-asset case end to end (exercises parse-incident, resolve-asset, reality-lock,
   decision-core, failure-mode-dominance, SA-orchestrate, superbrain-synthesis - all guarded).
2. Run a photo analysis (photo-analysis) and a fleet triage (fleet-triage + fleet-systemic).
Confirm 200s, not 401s. ONLY THEN promote to production.
If anything 401s: the SPA isn't sending a token on that path - REVERT (remove the require + the
`authGuard.verifyAuth` line from the affected file) and fix the token attach first.

## Commit (DEPLOY419 + DEPLOY420 are both pending; can ship together)
First clear the stale lock + canary (see DEPLOY419), then:
```bash
node scripts/run-gates.cjs        # 35/35 (or 34 in CI without the local canary)
npx tsc -b
git add netlify/functions/decision-core.ts netlify/functions/superbrain-synthesis.ts netlify/functions/photo-analysis.js netlify/functions/situational-awareness-orchestrate.cjs netlify/functions/parse-incident.ts netlify/functions/voice-incident-plan.ts netlify/functions/resolve-asset.ts netlify/functions/reality-lock.ts netlify/functions/failure-mode-dominance.js netlify/functions/fleet-triage.cjs netlify/functions/fleet-systemic.cjs tests/ AUTH-ROLLOUT-PLAN.md DEPLOY420-INSTRUCTIONS.md
# (plus the DEPLOY419 files if not already committed: .gitignore scripts/run-gates.cjs package.json netlify.toml .github/workflows/ci.yml GAP-ANALYSIS-2026-05-30.md DEPLOY419-INSTRUCTIONS.md)
git commit -m "DEPLOY420 - Auth (P0-1 batch A): require auth-guard on the four heaviest SPA engines (decision-core, superbrain-synthesis, photo-analysis, situational-awareness-orchestrate). Verified safe against the call graph (token'd pages only; no internal/card callers). + auth-guard-enforcement gate (5/5); decision-core-hold gate updated to authenticate (proves the guard is enforced). tsc clean; 35/35 gates. Staged plan for the rest in AUTH-ROLLOUT-PLAN.md. REQUIRES NDT_API_KEY env + a preview smoke test before production."
git push
```
