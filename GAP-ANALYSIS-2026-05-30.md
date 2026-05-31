# FORGED NDT - System Gap Analysis (2026-05-30)

Method: three parallel read-only audits (security/auth, dead-code/placeholder, test-coverage/
robustness) + direct build-health signals. Cross-checked against the prior GAP-ANALYSIS-2026-05.md.
Coverage is high on the risk surface and the debt we know about; it is NOT an exhaustive line audit
of all 238 functions. Build health at time of writing: tsc -b clean; 33/33 local .cjs gates pass;
working tree clean.

IMPORTANT framing: almost none of this blocks the COLUMBUS DEMO (the /demo route is fully static,
and the app is operator-driven on stage). These are LAUNCH-blocking items - what must be true before
real, unattended, public users hit the system.

==================================================================================================
P0 - LAUNCH-BLOCKING
==================================================================================================

P0-1  Unauthenticated /api/* surface (unbounded LLM spend + data exposure)
  netlify.toml redirects /api/* -> /.netlify/functions/:splat with no edge auth. Auth is per-
  function, and only 2 of 238 functions reference auth-guard.cjs (master-router + the guard itself).
  Every LLM-calling engine the SPA uses is publicly callable with no token:
  decision-core.ts (CORS * at 6119, 0 auth matches), parse-incident.ts:517, ai-chat.ts:168,
  photo-analysis.js:206, tri-model-reasoning.ts:773, voice-incident-plan.ts:174,
  inspection-intelligence.ts:342, superbrain-synthesis, + ~12 more. Anyone with the URL can drive
  unbounded OpenAI/Anthropic spend and reach data endpoints (create-case, upload-evidence, rbac).
  This is the prior doc's SEC-1/2/3, STILL OPEN.
  FIX: the infrastructure exists - add `authGuard.verifyAuth(event)` (top-level require, deny on
  ok:false) to every LLM/heavy/state-changing handler, mirroring master-router.ts:483-485. Mechanical
  but ~200 files; script it and gate on a shared wrapper.

P0-2  No automated test gate runs in CI / the deploy build
  netlify.toml build command = "npm run build" = "tsc -b && vite build" - type-checks and bundles,
  runs ZERO tests. The 34 .cjs acceptance gates are git-ignored (.gitignore: tests/*.cjs) so they are
  not even in the checked-out repo and can never run in CI. The committed `npm test` suite covers the
  cross-domain TS modules + 2 demo/panel tests, NOT the deterministic engines (decision-core,
  classifier, fleet, remaining-strength) - and `npm test` is not wired into the build anyway. The
  100-case workflow (.github/workflows/run-validation.yml) is workflow_dispatch (manual) and runs
  against the LIVE site post-deploy, so it cannot block a bad deploy. NET: a regression in any
  safety-critical engine deploys clean as long as it type-checks.
  FIX: un-ignore tests/*.cjs (or move to a tracked path), add a "pretest"/CI step that runs the .cjs
  gates + npm test, and make the Netlify build (or a GitHub Action on push/PR) fail on a red gate.

P0-3  Permissive Supabase RLS on user-data tables exposed to the shipped anon key
  The SPA ships a working anon key and talks to Supabase REST directly. Several policies omit a role
  clause and default to TO public: DEPLOY265 (reasoning_sessions, learning_records,
  hypothesis_tracking, calibration_scores, adversarial_challenges), DEPLOY271 (superbrain_reports -
  full report contents), DEPLOY353 (audit/cache INSERT WITH CHECK(true)). Also supabase-fix-rls.sql
  ships schools/classes SELECT/INSERT USING(true) AND a committed `DELETE FROM profiles WHERE true;`
  (re-running it wipes profiles).
  FIX: scope these to TO service_role (the backend client bypasses RLS anyway, so nothing is lost);
  delete the bulk DELETE statement. Confirm whether supabase-fix-rls.sql (WeldScan education schema)
  is still deployed.

==================================================================================================
P1 - HIGH (before broad launch; not demo-blocking)
==================================================================================================

P1-1  ~170 of 238 functions are orphaned - reachable only via public system-check.html
  The React app calls ~42 functions. The entire vertical/engine library (aerospace, nuclear, medical-
  bio, subsea, marine, API581-RBI, 50+ authority/engine/brain functions) is invoked only by
  public/system-check.html (a 157-call diagnostic harness, publicly routed) and tests - not by
  decision-core (zero engine dispatch), any orchestrator, or any user path. This inflates the attack/
  deploy surface and is where all the stub logic (P1-2) lives.
  FIX: gate /system-check.html behind a secret; decide which engines are actually in the product vs
  archived. (Architectural - your call.)

P1-2  Placeholder/stub logic inside (orphaned) production engines - harmless today, lands the moment wired
  concept-intelligence-v21.ts:814 (replay fabricates a summary instead of recomputing);
  governance-matrix.ts:705-722 and code-authority-resolution.ts:400 (AI-fallback stubs return EMPTY
  governance for unknown assets); cost-reasoning-engine.ts:337,352 (authority/concept weighting are
  no-ops). Blast radius limited because these engines are orphaned - but each will silently degrade
  if wired into the app.

P1-3  Single-asset Peripheral Referrals + photo/vision feed: specced, never built
  peripheral-referral.cjs header advertises a text path AND a photo-analysis (vision) referral feed.
  The FLEET path is fully wired (fleet-systemic.cjs -> FleetTriagePage Systemic Patterns - good). The
  single-asset "Peripheral Referrals" report section and the vision feed do not exist (no reference in
  VoiceInspectionPage.tsx or photo-analysis.js).
  FIX: either wire extractPeripheralsFromText into the VoiceInspection report + add the photo emitter,
  or trim the header's vision claim so the code doesn't promise more than it does.

P1-4  BUG-1: SA-gate failure silently drops penalties (decision-core.ts:6147,6165-6169)
  The situational-awareness-gate require sits in a try/catch that, on a bundling failure, returns
  criticalUnresolved:0 with only an error field and no loud failure - SA penalties silently vanish.
  FIX: surface a degraded flag, or inline the gate (parse-incident already did this).

P1-5  FUNC-2: stakeholder views render empty (VoiceInspectionPage.tsx:2503)
  situational-awareness-orchestrate is called without probabilityBasis/financial inputs, so every
  ConsequenceScenario is confidence:0 and the FINANCIAL/LEGAL stakeholder views are blank. Spec-
  compliant (no fabrication) but the feature produces nothing. Either supply the inputs or hide the
  empty views.

P1-6  ~15 flagship engines with NO test gate (anywhere)
  weld-acceptance-authority.ts (accept/reject adjudication, also 2 empty catches), api579-level2-part5,
  api653-tank-assessment, api581-rbi-engine, predictive-remaining-life, pipeline-integrity-engine,
  risk-scoring, the decision-spine/decision-dominance/decision-liability/executive-decision family,
  the authority routers (master-router, run-authority, global-authority-engine, universal-code-
  authority, code-authority-resolution), truth-engine, contradiction-engine, reality-lock, and the
  dde-mechanism-kb-* knowledge bases. A misroute or codified-math regression here is invisible.
  FIX: add acceptance gates for the ones that are actually in the product (intersect with the ~42
  wired functions first - many of the 15 are in the orphan set).

P1-7  3 handlers JSON.parse(event.body) before their try block -> 502 on malformed input
  api581-rbi-engine.ts:512, riser-dynamics-engine.ts:34, diffusion-embedding-retrieval.ts:164.
  FIX: move the parse inside try and return 400 on bad JSON.

==================================================================================================
P2 - LOWER / HOUSEKEEPING
==================================================================================================

P2-1  60 empty catch blocks across 48 files. Most are best-effort DB inserts (defensible) but a few
      are on computation paths that should at least log: formula-chain-executor.ts:226,273,
      formula-intelligence-core.ts:601, multi-physics-4d-projection.ts:373/408/443,
      weld-acceptance-authority.ts:2278,2458.
P2-2  CORS Access-Control-Allow-Origin: * on ~201 functions. Low severity (auth is header/JWT, not
      cookie) - tighten to the SPA origin once P0-1 auth lands.
P2-3  Marker debt is mostly benign: 179 @ts-nocheck (expected on pages/handlers), only ~4 real TODOs
      (the P1-2 stubs). No mock/dummy data corrupts live user outputs.

==================================================================================================
CONFIRMED FINE (audited, no action)
==================================================================================================
- No hardcoded LLM secrets; only Supabase ANON keys are embedded (correct to ship). .env* git-ignored.
- /demo is fully static - zero fetch/api/supabase calls; renders curated, provenance-gated data.
- auth-guard.cjs is well-built (fails closed, JWT + X-API-Key) - the gap is adoption, not the guard.
- create-case.ts enforces JWT properly (the one protected SPA write path).
- FUNC-1 (HOLD coupling, prior doc P0) is FIXED (decision-core.ts:6148-6164, DEPLOY386).
- No mock data in real decision outputs.

==================================================================================================
KNOWN THIS-ARC DEBT (tracked, not re-litigated here)
==================================================================================================
- #54 run-on attribution calibration vs REAL field audio (your-side data task; demo is safe).
- git index corruption recurs while the repo lives in OneDrive (rm .git/index && git reset fixes it;
  moving the repo out of OneDrive ends it).
- report-provenance derived-number edge (a computed-but-unstored number could false-flag; rare).
- fleet PREVALENCE placeholder anchors (intentional, self-labeled, gated out of confirmed findings).

==================================================================================================
RECOMMENDATION (sequencing)
==================================================================================================
Before Columbus (demo): nothing here blocks it. Optionally gate system-check.html (P1-1) so a curious
attendee can't drive the orphaned engines.
Before LAUNCH (real users): P0-1 (auth), P0-2 (CI gate), P0-3 (RLS) are the three that matter, in that
order. P0-2 is the highest-leverage/lowest-risk (un-ignore tests + a CI step) and protects everything
else you change. P0-1 is the biggest spend/abuse risk. Do P0-2 first, then P0-1, then P0-3.
