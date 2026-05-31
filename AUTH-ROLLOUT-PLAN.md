# Auth Rollout Plan (gap analysis P0-1) - staged on the real call graph

The /api/* surface is unauthenticated. A blanket "add the guard everywhere" WOULD break the app,
because functions call each other internally with no token and several frontend cards raw-fetch
with no auth header. This plan stages the rollout on the actual call graph so nothing breaks.

Mechanism (proven): top-level `require("./auth-guard.cjs")` + after the OPTIONS/method gate:
`var __auth = await authGuard.verifyAuth(event); if (!__auth.ok) { return authGuard.denyResponse(__auth, CORS); }`
auth-guard accepts a Supabase user JWT (SPA path) OR X-API-Key === NDT_API_KEY (server path), fails closed.

PREREQUISITE: set `NDT_API_KEY` in the Netlify environment. Without it, the guard accepts ONLY
JWTs - which is fine for SPA-facing engines, but the internal server-to-server batches (B) REQUIRE
it so callers can authenticate with X-API-Key.

After EVERY batch: deploy to a Netlify PREVIEW, sign in, exercise the affected path, confirm 200
(not 401), THEN promote to production. Revert is trivial (remove the require + the one guard line).

--------------------------------------------------------------------------------------------------
BATCH A - SPA-facing, token'd, NOT internally called, NOT a card target. SAFE TO GUARD DIRECTLY.
--------------------------------------------------------------------------------------------------
DONE (DEPLOY420) - the ENTIRE SPA pipeline (11 engines):
  decision-core, superbrain-synthesis, photo-analysis, situational-awareness-orchestrate,
  parse-incident, voice-incident-plan, resolve-asset, reality-lock, failure-mode-dominance,
  fleet-triage, fleet-systemic. Every LLM-spend engine on the SPA path is now guarded.
  All verified called only by token-attaching pages, none in any internal-call/card list,
  and NO acceptance gate invokes their handlers (gates use internal functions), so guarding
  broke nothing - 35/35.

--------------------------------------------------------------------------------------------------
BATCH B - INTERNAL CALLEES. Guard ONLY AFTER the caller forwards credentials. (Needs NDT_API_KEY.)
--------------------------------------------------------------------------------------------------
Callee  ->  caller(s) that currently fetch it with NO token:
  observation-layer, reasoning-layer, truth-engine        <- run-analysis.ts (51,68,85)
  formula-intelligence-core                                <- formula-chain-executor.ts (138)
  package-store                                            <- replay-audit.cjs (34), perspective-projection.cjs (799)
  perspective-projection                                   <- replay-audit.cjs (43)
  superbrain-report-background                             <- superbrain-report.ts (275)
  tri-model-reasoning-background                            <- tri-model-reasoning.ts (1189), tri-model-reasoning-background.ts (248)
  nde-image-analysis, formula-engine, method-capability,
  universal-code-authority, differential-diagnosis,
  physics-sufficiency-engine, comprehensive-assessment     <- ai-chat.ts callEngine (99, /api/<engine>)
STEP: (1) NDT_API_KEY set; (2) add `headers: { "X-API-Key": process.env.NDT_API_KEY }` to each
internal fetch above (or forward the user's Authorization header); (3) THEN guard the callees.

DONE (DEPLOY421) - the 3 chains with COMPLETE, low-risk caller coverage:
  GUARDED: superbrain-report-background, package-store, perspective-projection.
  FORWARDING added: superbrain-report -> background; replay-audit -> package-store(GET)+perspective-projection;
  perspective-projection -> package-store. full-pipeline gate updated to send X-API-Key. tsc + 35/35 green.
REMAINING (Batch B2 - deferred, higher-risk, do with the same forward-then-guard pattern + preview test):
  - observation-layer, reasoning-layer, truth-engine, formula-intelligence-core: extra callers in
    health.ts + regression-test-authority.ts must forward first.
  - tri-model-reasoning-background: it ALSO dispatches outbound to engines (dynamic /functions/<path>),
    so its outbound calls need forwarding too before it is guarded.
  - ai-chat targets (Batch B3, coordinate w/ C): forward in ai-chat.callEngine, then guard formula-engine,
    method-capability, differential-diagnosis, physics-sufficiency-engine, comprehensive-assessment,
    nde-image-analysis, universal-code-authority (last one also a card -> needs Batch C first).

--------------------------------------------------------------------------------------------------
BATCH C - RAW-FETCH FRONTEND CARDS. Guard ONLY AFTER the card attaches the JWT.
--------------------------------------------------------------------------------------------------
Card                          -> endpoint
  DecisionSpineCard           -> decision-spine
  MaterialAuthorityCard       -> material-authority
  OutcomeSimulationCard       -> outcome-simulation
  PlannerAgentCard            -> planner-agent
  SimilarCasesPanel           -> similar-cases
  UniversalCodeAuthorityCard  -> universal-code-authority   (also an ai-chat target -> see B)
  CompositeRepairCard         -> composite-repair-authority
STEP: update each card to attach `Authorization: Bearer <supabase access_token>` (mirror
EnterpriseAuditCard.tsx / InspectorAdjudicationCard.tsx), THEN guard the endpoints.

--------------------------------------------------------------------------------------------------
BATCH D - ai-chat itself (SPA chat). Confirm the chat UI attaches a JWT, then guard ai-chat. Its
internal callEngine targets are handled by B (do not double-guard before B forwards creds).
--------------------------------------------------------------------------------------------------

--------------------------------------------------------------------------------------------------
ORPHANED ENGINES (~170) - reachable only via public system-check.html. Do NOT guard 170 functions;
instead GATE /system-check.html behind a secret (one redirect rule), which closes their only
public reach at once.
--------------------------------------------------------------------------------------------------

SEQUENCE: set NDT_API_KEY -> A2 (finish SPA pipeline) -> gate system-check.html -> B (internal
forwarding then guard) -> C (card tokens then guard) -> D (ai-chat). Smoke-test each on preview.
