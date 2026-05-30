# FORGED 4D NDT Intelligence OS — Platform Gap Analysis

**Date:** 2026-05-29
**Scope:** Functional completeness · Bugs & robustness · Security & config · Determinism & patent invariants
**Method:** Four parallel read-only subsystem audits (backend functions, frontend, security/config, determinism), cross-checked against `docs/FORGED_SA_BUILD_BRIEF.md`. No production behavior was changed by the audit itself.

## Overall verdict
The **deterministic core and patent invariants are intact** — frozen core untouched, DecisionPackage hashing byte-identical with/without `sa_responses`, no clock/LLM inside SA modules, replay-audit preserved. The SA layer is correctly additive and downstream.

The two areas that need attention are **(1) security posture** — the NDT API surface is effectively open to the internet — and **(2) one functional gap** — the SA "unresolved-CRITICAL → HOLD" safety coupling is wired but currently inert. Neither is a determinism/patent problem; both are addressable.

Severity legend: **HIGH** = correctness/security risk, act first · **MED** = real gap, plan it · **LOW** = polish.

---

## HIGH

### SEC-1 — NDT backend functions do not validate the proxy's API key; the API surface is open
The WeldScan `4dnt-proxy.ts` forwards `X-API-Key`/`X-Tier`/`X-Source` to `https://4dndt.com/api/<endpoint>`, but **no NDT function reads or checks any inbound key** (repo-wide search: 0 matches). With `netlify.toml` redirecting `/api/* → /.netlify/functions/:splat`, every engine (decision-core, weld-evaluate, nde-image-analysis, tri-model-reasoning, etc.) is callable directly by anyone with the URL.
**Impact:** unauthenticated abuse, unbounded LLM spend (these call Anthropic/OpenAI), data exposure. The proxy's "key never hits the client" framing is misleading — the key gates nothing.
**Fix:** add a shared-secret check (one small middleware helper required by each handler) that rejects requests without a valid `X-API-Key`. **Effort: HIGH** (~200 functions, but mechanical) — highest-priority item.

### SEC-2 — Wildcard CORS on ~198 functions, including mutating/audit endpoints
`Access-Control-Allow-Origin: '*'` appears in nearly every function, including state-changing/sensitive ones (`create-case`, `upload-evidence`, `outcome-tracking`, `enterprise-audit`, `rbac`, `data-ingestion`). Combined with SEC-1, any website can drive these from a victim's browser.
**Fix:** restrict `Allow-Origin` to known frontends; require auth on state-changing endpoints. **Effort: HIGH.**

### SEC-3 — No auth on admin/diagnostic endpoints
`enterprise-audit`, `governance-matrix`, `rbac`, `regression-test*`, `verify-audit-chain`, `export-audit-bundle`, `master-router` have no token check and are reachable via `/api/*`. The `rbac` function exists but is not enforced at the gateway.
**Fix:** enforce auth/role checks before sensitive logic (folds into SEC-1's middleware). **Effort: MED–HIGH.**

### FUNC-1 — SA "unresolved-CRITICAL → HOLD" coupling is inert
`decision-core.ts` calls `saGate.validateSet(saResponses, [], startMs)` with `requiredQuestions = []` hardcoded. Consequently `stats.criticalUnresolved` is **always 0**, so the Stage-5 confidence penalty / HOLD-on-unresolved-CRITICAL **can never fire**. The brief's core SA safety mechanism (an unanswered or opinion-only CRITICAL question should reduce confidence and HOLD) is silently neutralized. Pre-SA behavior is unaffected (the block is gated on `sa_responses` presence), so this is a completeness gap, not a determinism break.
**Fix:** carry the scoped required-questions list (`questionId` + `decisionImpact`, already produced by parse-incident Stage 2/3) back through the frontend `sa_responses` submit into decision-core, and pass it to `validateSet`. **Must** be regression-tested (golden + blind) because it can newly introduce HOLDs. **Effort: MED + validation.** Highest-priority functional item.

---

## MED

### BUG-1 — decision-core's gate `require` silently degrades on a bundling failure
`decision-core.ts` does `require("./situational-awareness-gate.cjs")` in a try/catch that, on failure, returns a synthetic empty validated set (`criticalUnresolved: 0`, `validated: []`) with no error surfaced. This is the same class of bug fixed in `parse-incident.ts` (DEPLOY376) — if esbuild ever fails to bundle the sibling `.cjs`, SA evidence is silently dropped with no penalty and no signal. (Note: `situational-awareness-orchestrate.cjs` requires its 5 modules at top-level with no catch, so it fails *loud* — the desired behavior.)
**Fix:** surface a degraded flag the caller can detect, or inline the minimal gate logic as parse-incident now does. **Effort: LOW–MED** (large frozen file — apply carefully).

### FUNC-2 — Consequence Simulator + FINANCIAL/LEGAL views are structurally hollow in production
The frontend calls orchestrate with only `decisionPackage` + `validatedEvidenceSet`; no `probabilityBasis` and no financial/legal inputs are supplied. So every `ConsequenceScenario` is `confidence: 0`/empty and the FINANCIAL/LEGAL stakeholder views fall to their "no inputs" branches. This is **spec-compliant** (the engines correctly never fabricate), but L9.3 and the FINANCIAL role currently produce no usable content.
**Fix:** wire a `probabilityBasis` producer from the L4 Failure Timeline + asset-registry precedents (brief §4.3), and pass user-provided financial inputs. **Effort: MED.**

### BUG-2 — decision-core failure leaves a dead-end UI
If `callAPI("decision-core")` throws, `coreResult` stays null; the run completes but the Export-PDF/Save card (gated on `dc`) never appears and the question card is gone — the user sees a failed step list with **no actionable next step**.
**Fix:** render an explicit "decision-core failed — retry" affordance when `coreResult` is null after a run. **Effort: LOW.**

### BUG-3 — transcript-hash invariant lives in the button handler, not the submit boundary
The "fail loud on transcript mutation" check is only in `handleGenerateWithAnswers`. Any code path that calls `handleGenerate(transcript, saResponses)` directly bypasses it — the guarantee is only as strong as that one call site.
**Fix:** move the hash assertion into `handleGenerate`/`continuePipeline` just before the decision-core POST, where the transcript is actually consumed. **Effort: LOW.**

### BUG-4 — unanswered/dropped questions can be lost without a trace
When non-evidence options (Unknown/N/A) are filtered or all questions are pre-answered, there's no record in the report that questions went unanswered.
**Fix:** surface dropped/unanswered CRITICAL questions in `errors[]` and/or the PDF. **Effort: LOW.** (Pairs naturally with FUNC-1.)

### SEC-4 — Permissive RLS and a destructive statement in tracked SQL
`supabase-fix-rls.sql` sets `schools`/`classes` policies to `USING (true)`/`WITH CHECK (true)` (any authenticated user reads all / inserts arbitrary rows) and contains `DELETE FROM profiles WHERE true;` shipped in a tracked file. `weld_submissions` has no UPDATE policy for teacher grading. (These are WeldScan-side; NDT migrations' `service_role USING (true)` are acceptable since service-role is server-only.)
**Fix:** scope `schools`/`classes` policies to membership; remove the blanket DELETE; add the grading UPDATE policy. **Effort: LOW–MED.**

---

## LOW

- **SEC-5 — Internal-detail leakage.** `4dnt-proxy.ts` returns `err.message` to clients; `health.ts` exposes which env vars are unset, missing tables, and signing-key IDs, and `/system-check.html` is publicly routed. Gate health/system-check behind a secret; strip internal details from public error bodies.
- **BUG-5 — Refusal-PDF pop-up failure is silent.** The domain-refusal report path has no "pop-up blocked" alert (the main report does). **→ Fixed in DEPLOY378.**
- **BUG-6 — `esc()` escapes only `<`/`>`.** Quotes/ampersands in transcript text can malform the report HTML. **→ Fixed in DEPLOY378** (now escapes `& < > " '`).
- **BUG-7 — Stale docs / dead code.** File-header comment still describes v16.6m (DEPLOY176) though current work is DEPLOY364–377; `superbrainLoading` state is declared but never set; a leftover `hash & hash` no-op. Cosmetic.
- **FUNC-3 — Dead defensive code.** `orchestrate.cjs` normalizes object-shaped `fmd.dominant`, but the real producer already emits a string. Harmless; only fires if a different producer appears.

---

## Determinism & patent invariants — PASS (no violations)
- **Directive 1 (frozen core):** only the authorized Stage-5 block changed in `decision-core.ts`; all other frozen files unchanged.
- **Directive 4 (no field added to DecisionPackage):** `validated_evidence_set` lives on the `decision_core` response object, not in the package; `packageHash` is byte-identical with/without `sa_responses`; the SA assembler references the DP by its existing hash and never mutates it.
- **Determinism 1(ii):** no `Date.now()`/`Math.random()`/key-order dependence in any `situational-awareness-*.cjs` (the one `new Date(...)` parses a caller-supplied ISO string).
- **1(ix) no LLM as evidence:** no SA module calls an LLM; the gate rejects `LLM_INFERENCE` + strong provenance; the consequence engine emits `confidence: 0` rather than fabricating probabilities.
- **Hashing/replay:** canonical deep-key-sorted stringify is consistent across assembler / projection / SA package; replay-audit keeps verifying all stored packages.

---

## Recommended sequence
1. **SEC-1 + SEC-3** (auth middleware on the NDT API) — the single most important risk; everything else is secondary to closing the open API surface.
2. **SEC-2** (lock down CORS) — folds in with the auth work.
3. **FUNC-1** (make the unresolved-CRITICAL HOLD actually fire) — the headline functional gap; needs golden/blind regression.
4. **BUG-1** (harden the decision-core gate require, DEPLOY376-style).
5. **SEC-4** (RLS scoping + remove blanket DELETE).
6. **BUG-2/3/4 + FUNC-2** as a frontend/UX + SA-content hardening pass.
7. **LOW** items as cleanup.

## Fixed in this session
**DEPLOY378** — BUG-5 (refusal-PDF pop-up-blocked alert) + BUG-6 (`esc()` now escapes `& < > " '`). Both are safe, isolated report-generator improvements; SA-absent reports remain byte-identical except for correctly-escaped special characters.
