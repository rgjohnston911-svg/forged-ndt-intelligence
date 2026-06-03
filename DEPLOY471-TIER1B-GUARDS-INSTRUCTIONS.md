# DEPLOY471 — Pilot Readiness TIER 1B (part 1): guard the spend/data endpoints

Guards the 28 live spend/data endpoints + wires every credential path so nothing chain-breaks.
The 153-orphan quarantine + system-check.html removal + LIVE-ENGINES manifest/CI is **DEPLOY472**
(separate commit, per the split: guards and the 153-file move have opposite failure modes).

## Guard model (catch #1)
`auth-guard.cjs` `verifyAuth` is the **combined** check: accepts `X-API-Key === NDT_API_KEY` (exact
compare) **OR** a Supabase user JWT. So one uniform guard is connectivity-safe — internal callers
forward the server key, frontend sends the JWT, both accepted. **Tradeoff (post-pilot):** the
internal/frontend boundary has collapsed (every guarded endpoint accepts both). Tolerable for a
single-shared-credential authenticated pilot; tighten to per-bucket acceptance post-pilot.

## Security gate — NDT_API_KEY is a skeleton key now, so it MUST stay server-only (PASS)
- Not in `src/`; no `VITE_`/`NEXT_PUBLIC_` prefix; every ref is `process.env.NDT_API_KEY`. Not in the client bundle.
- Every keyed caller's base origin is a **constant/process.env** (`process.env.URL`/`DEPLOY_URL`/
  hardcoded `4dndt.netlify.app`); **none request-derived** (no `event.headers.host`/body host) — the
  key cannot be forwarded off-origin (no SSRF/exfil). Only the path segment is dynamic.

## RECONCILIATION (built from a fresh fetch inventory, not the edge map)
**28 endpoints guarded** (verifyAuth after method gate; internal no-gate ones guard first-statement):
similar-cases, observation-layer, reasoning-layer, truth-engine, api579-level2-part5,
api653-tank-assessment, case-search, cfi-engine, composite-repair-authority, comprehensive-assessment,
cross-domain-deliberate, cross-domain-deliberate-background, cross-domain-deliberation-status,
decision-spine, differential-diagnosis, escalation-workflow, material-authority, nde-image-analysis,
offshore-structural-assessment, outcome-simulation, physics-sufficiency-engine, pipeline-integrity-engine,
planner-agent, run-analysis, run-authority, superbrain-report, universal-code-authority, verify-audit-chain.

**10 internal callers forward the server key** (every server-to-server fetch, no exceptions):
run-analysis→(obs/reasoning/truth), comprehensive-assessment→(engine table), ai-chat→callEngine,
cross-domain-deliberate→-background, apmm-orchestrator, tri-model-reasoning-background,
uncertainty-reliability-core, validation-engine, formula-chain-executor, superbrain-report(pre-existing).

**Frontend JWT** — wired where missing: CaseSearchPanel (case-search), EscalationQueueCard
(escalation-workflow), CaseDetail (run-analysis **and** run-authority). Verified per-call-site
(Bearer on the guarded fetch, not file-level): SimilarCasesPanel, MaterialAuthorityCard,
OutcomeSimulationCard, PlannerAgentCard, CompositeRepairCard, UniversalCodeAuthorityCard,
EnterpriseAuditCard, ThicknessGridUpload, NewCase, DecisionSpineCard.

**Demotions (justified whole-file):** export-audit-bundle & inspection-report contain **zero `fetch(`**
— their decision-spine/verify-audit-chain mentions are text in notes. So those two are frontend-only,
**not** duals. Real duals = universal-code-authority (ai-chat fwd + card JWT) and run-analysis
(CaseDetail JWT + trio fwd). cross-domain-deliberation-status is frontend-polled (poll_url string).

**Core decision path deliberately UNGUARDED** (works anonymously or authenticated): parse-incident,
resolve-asset, reality-lock, evidence-provenance, global-authority-engine, decision-core,
failure-mode-dominance, disposition-pathway, remaining-strength, failure-timeline, voice-grammar-bridge,
authority-lock, the SA chain. FleetTriagePage + VoiceInspectionPage only call these (verified).

## Verified offline
- All 28 guarded functions transpile + `node --check` clean (individually; `@ts-nocheck` hides them from tsc -b).
- 10 caller forwards transpile clean; response headers never keyed (no client key leak).
- `npx tsc -b` clean (frontend .tsx wiring).
- **Run empirically against the edited tree** (not deduced): all 49 acceptance gates green + eval-sa **20/20**; grep confirms no gate invokes a guarded handler in-process, so the guards can't break the suite.
- Open core path verified spend=no/write=no (DEPLOY469 closure intact); cross-domain trio has no frontend poller (webhook-delivered), so guarding it hangs no inspector UI.
- Version v16.22 → **v16.23**.

## Post-pilot (explicit backlog)
- Tighten the combined guard to per-bucket credential acceptance (close the boundary collapse).
- Allowlist the dynamic `enginePath`/`engineName` fan-out targets (currently path-only, host is constant — bounded).

## Durability invariant (folds into DEPLOY472 CI check)
"Every `fetch(` to an internal function endpoint forwards `X-API-Key: process.env.NDT_API_KEY`." Add a
CI grep that flags any server-to-server fetch lacking the key header, alongside the LIVE-ENGINES manifest.

---

## Git — Git Bash at /c/dev/forged-ndt-intelligence (reset first; large diff)
The phantom deletions live in tests/ + repo root, NOT in netlify/functions or src — so directory-adds are safe here.
```bash
git reset
git add netlify/functions/ src/ DEPLOY471-TIER1B-GUARDS-INSTRUCTIONS.md
git status   # MUST confirm: 34 modified under netlify/functions (28 guarded + 6 caller-only:
             #   apmm-orchestrator, tri-model-reasoning, tri-model-reasoning-background,
             #   uncertainty-reliability-core, validation-engine, formula-chain-executor)
             # + 3 frontend (CaseSearchPanel, EscalationQueueCard, CaseDetail) + VoiceInspectionPage;
             # NO deleted tests/tsconfig staged, no stray src files. If count != 34, find the dropped forward before committing.
git commit -m "DEPLOY471 Tier 1B(guards): auth-guard 28 spend/data endpoints (combined JWT-or-server-key); forward server key on all 10 internal callers; wire frontend JWT on case-search/escalation/CaseDetail run+authority; core decision path left open; NDT_API_KEY confirmed server-only; v16.23"
git push
```

## Live verification (the two-directional click-through — only this catches a half-handled dual)
Log in (shared pilot credential). **Authenticated → 200 / works:** run a full case through CaseDetail
(fires run-analysis + run-authority + the internal trio), open the export/verify bundle
(decision-spine + verify-audit-chain), the universal-code-authority card, **case search**, the
**escalation queue**. Then **anonymous → 401** spot-check (same shape as the DEPLOY469 ×3): e.g.
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://4dndt.netlify.app/api/case-search -d '{}'
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://4dndt.netlify.app/api/run-analysis -d '{}'
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://4dndt.netlify.app/api/similar-cases -d '{}'
```
Authenticated-works + anonymous-blocked is the proof the guard landed without breaking the app.
