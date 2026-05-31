# DEPLOY423 - Card token-attach (gap analysis P0-1, Batch C frontend half)

## What this does
The seven frontend cards that previously raw-fetched their endpoints with NO auth header now
attach the Supabase JWT (`Authorization: Bearer <token>`), mirroring the proven pattern in
EnterpriseAuditCard / InspectorAdjudicationCard:
  DecisionSpineCard, MaterialAuthorityCard, OutcomeSimulationCard, PlannerAgentCard,
  UniversalCodeAuthorityCard, CompositeRepairCard, SimilarCasesPanel.
(SimilarCasesPanel also gained the `supabase` import it was missing.)

## Why it is safe to ship now (additive, zero functional risk)
The endpoints these cards call are NOT guarded yet, so they ignore the token. Attaching a header
an endpoint ignores changes nothing for users. This is PREP: it lets the matching endpoints be
guarded next without breaking the cards.

## NOT done (deferred until the preview confirms the cards still work)
Guard the 6 card endpoints (decision-spine, material-authority, outcome-simulation, planner-agent,
composite-repair-authority, similar-cases) - same 1-line auth-guard pattern as the pipeline.
universal-code-authority is ALSO an ai-chat internal target, so it is guarded with Batch B3 (after
ai-chat forwards X-API-Key), not here.

## Verification
- tsc -b clean (catches syntax errors even in these @ts-nocheck files).
- Frontend behavior cannot be exercised offline. On the preview, open each card and confirm it
  still loads/returns (it should - the token is simply added; endpoints ignore it). If a card
  errors, the token-attach edit broke it - revert that one card.

## Files (commit to the launch-hardening branch)
```bash
git add src/components/DecisionSpineCard.tsx src/components/MaterialAuthorityCard.tsx src/components/OutcomeSimulationCard.tsx src/components/PlannerAgentCard.tsx src/components/UniversalCodeAuthorityCard.tsx src/components/CompositeRepairCard.tsx src/components/SimilarCasesPanel.tsx AUTH-ROLLOUT-PLAN.md DEPLOY423-INSTRUCTIONS.md
git commit -m "DEPLOY423 - Card token-attach (P0-1 batch C frontend half): the 7 raw-fetch cards now send the Supabase JWT (additive, endpoints still ignore it). Prereq for guarding their endpoints. tsc clean. Endpoint-guarding deferred until preview confirms the cards work."
git push
```
