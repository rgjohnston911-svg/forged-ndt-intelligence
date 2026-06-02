# FORGED NDT Intelligence OS — Gap Analysis (v16.21 / post-DEPLOY468)

**Date:** 2026-06-02  **Scope:** entire platform — decision-correctness, build/type/test health,
security/auth, architecture/dead-code. Four parallel audits, evidence cited to `file:line`.
**Method:** static read + offline reproduction where noted. No files were modified.

---

## Headline

The **decision core that the hardening arc rebuilt is solid** — verdict-gating of authority, the FMD
headline/sub-paths, and the governance contest hold up under audit. The real exposure is **everything
around it**: the deployed backend is unauthenticated and untype-checked at scale, ~190 orphaned
engines ship live, and the dev environment itself (OneDrive-synced working tree) is corrupting git.
Two live correctness bugs surfaced — one pre-existing substring/negation regression, one introduced by
DEPLOY468 §1.1.

### What is healthy (verified)
- `tsc -b` clean; the typed `src/lib` decision core (`reconciliationLayer`, `evidenceGate`,
  `governingAxes`, `authorityDerivation`, `governancePipeline`, `noDestructiveOverride`) is
  effectively `any`-free and `@ts-nocheck`-free.
- All acceptance gates pass (49/49, ~32s warm) and `eval-sa` is **20/20 with XFAIL=0**.
- **No secrets committed**; `.env*` gitignored; **no service-role key in the client bundle** (only the
  anon key, which is designed public); `auth-guard.cjs` fails closed and is well-designed.
- No injection sinks (no `eval`/`Function`/`child_process` on user input; no string-built SQL).
- `authority-lock.js` is correctly verdict-gated (cracking/corrosion/NACE locks gate on
  `mev.confirmed`/`mev.sour_service`; the raw `indexOf` scans are dead booleans, no bypass).
- The `/demo` route is genuinely safe-public (pre-baked deterministic scenarios, no engine/LLM/DB).

---

## P0 — Fix first (exploitable now / wrong output can ship / lost work)

### P0-1 (SECURITY) — ~150 service-role serverless functions are reachable UNAUTHENTICATED
`netlify.toml` deploys every file in `netlify/functions/` as a public `/api/<name>` endpoint
(`/api/* → /.netlify/functions/:splat`, esbuild bundler). Only ~14–18 handlers enforce `auth-guard`;
**167 functions instantiate a `SUPABASE_SERVICE_ROLE_KEY` client** (which bypasses Postgres RLS) yet
most have no auth gate. `AUTH-ROLLOUT-PLAN.md:3` already acknowledges *"the /api/* surface is
unauthenticated."* Confirmed live, sensitive, unguarded:
- `data-ingestion.ts:200/207/236` — anonymous `insert` into production `inspection_cases` (RLS bypassed).
- `ai-chat.ts:201/232` — no auth; tier read from request body (`user_tier`) → anonymous full-tier
  Anthropic spend + paywall bypass + engine fan-out.
- `batch-processing-gateway.ts:425`, `export-audit-bundle.ts`, `notifications.ts` — service-role / audit export, no auth.
- `system-check.html` (`netlify.toml:40-43`) is the public doorway to all of the above; the rollout
  plan's recommendation to gate it was never applied.

**Impact:** unauthenticated read/write to the production DB, confidentiality breach (audit export),
and uncapped LLM spend. **Fix:** complete the staged `auth-guard` rollout, prioritizing every
service-role function; derive tier from the verified user, never the body; gate or remove
`system-check.html`.

### P0-2 (ARCH/OPS) — the `.git/index` corruption is the OneDrive-synced working tree
The recurring `rm -f .git/index && git reset` before nearly every commit is the classic symptom of
OneDrive (+ Windows AV) re-writing/locking `.git/index` mid-operation. The env carries a working dir
at `C:\Users\rjohn\OneDrive\Desktop\NDT Platform`, and `.gitignore:32` even references a
"OneDrive-locked canary." **Impact:** repeated index corruption → aborted commits and real lost-work
risk. **Fix (highest leverage):** develop only in `C:\dev\forged-ndt-intelligence` (already present,
already where commits run) and stop using the OneDrive copy — or exclude the repo from OneDrive sync
and add it to Defender exclusions. Confirm a single active clone. Aggravated by P1-6 (a repo zip and
scratch artifacts tracked in-tree).

### P0-3 (BUILD) — the entire deployed backend is NEVER type-checked
`tsconfig.json` `include` is `["src"]` only, so the **202 `.ts` files in `netlify/functions/`** (incl.
the 6,872-line `decision-core.ts`) are outside `tsc -b`. On top of that, **154 of them carry
`@ts-nocheck`**, and Netlify bundles via esbuild (no type checking). **Impact:** "tsc -b clean"
validates the React layer but gives ≈0 type coverage of the actual inference engines — a type error
in any backend function ships undetected. **Fix:** add a `netlify/tsconfig.json` (`include:
["functions"]`) referenced from `tsc -b`, then burn down errors; treat `@ts-nocheck` as a ratchet
(forbid new, decrement over time), starting with `decision-core.ts`.

---

## P1 — Real gaps (correctness risk, drift, or broken/rotted infra)

### P1-1 (CORRECTNESS, confirmed) — "unmanned"/"unoccupied" substring inflates consequence to CRITICAL/FATAL
`decision-core.ts:4333` and `:4481` (`resolveConsequenceReality`): `critKw` includes `"manned"` and
the scan uses bare `indexOf`, so **"unmanned"** matches `"manned"` → `tier=CRITICAL`,
`humanImpact="FATAL — human occupancy"`; likewise `"unoccupied"` matches `"occupied"`. **Trigger:**
"normally unmanned installation" / "unoccupied structure" (standard offshore NUI vocabulary).
**Impact:** a genuinely unmanned asset is escalated to CRITICAL with fabricated FATAL occupancy — the
inverse of reality (same family as the "which"→HIC / "dam"→bridge bugs). Direction is conservative,
but the answer is wrong. **Fix:** use `hasWordBoundary` (already defined ~line 526) + clause-local
negation, and recognize "unmanned/NUI/unoccupied" as a *downgrade* signal.

### P1-2 (CORRECTNESS, confirmed — regression from DEPLOY468 §1.1) — FMD interaction gate over-suppresses genuine multi-mechanism warnings
`failure-mode-dominance.js:1169–1180` (the `__confirmedFamilies < 2` gate I added). The interaction
block (877–965) decides CASCADE/SYNERGY from FMD's *own* rich observed vocabulary
(`inferCrackConfirmationState`: "crack present", "crack verified", "visible cracking", "fracture
surface", "hardness exceeded NACE"), but the new gate re-derives confirmation from
`classifyFamily("cracking", …)`, whose DIRECT regexes are **narrower** and don't match those phrases.
When they disagree the gate strips a real interaction. **Reproduced:** CUI+fatigue / MIC+HIC /
erosion+SCC cases with "crack present and verified" lose the CASCADE/SYNERGY warning
(`interaction_flag:false`) while `governing_failure_mode` stays COMPOUND. Also: `classifyFamily` only
knows corrosion/cracking/structural, so any **fatigue-driven** interaction can never reach 2 confirmed
families. **Impact:** real synergy warnings ("CUI accelerates fatigue", "MIC-generated hydrogen feeds
HIC — rate models non-conservative") silently lost → under-stated disposition. **Fix:** gate the
interaction on FMD's *own* per-family observed states (`hasCorrosionMode`, `hasCrackingMode_observed`,
`hasStructuralMode`) that already produced it — not on a second stricter matcher. (Keeps the TEST 36
phantom fix: those families are non-observed there, so the interaction still drops.)

### P1-3 (ARCH) — two jurisdiction/authority resolvers in the LIVE path with no parity guard
Both are called by the live VoiceInspectionPage: `global-authority-engine.ts` (its own
`JURISDICTION_REGISTRY` + NLP resolver, ~147–507) and `decision-core.ts` (inline
`JURISDICTION_CODE_STACKS`/`AUTHORITY_MAP`, ~DEPLOY203). A third code path lives in
`authority-lock.js:452`. The only parity test guards mechanism verdicts, not jurisdiction. **Impact:**
the resolvers can disagree on governing code/jurisdiction for the same case and drift silently — the
exact single-source violation the mechanism-parity test was built to prevent. **Fix:** designate one
resolver as source of truth, have the others consume it, add a parity/golden test.

### P1-4 (ARCH/SECURITY) — ~190 orphaned engines deployed as live, authoritative-looking `/api` endpoints
Of ~240 function files, only ~46 are reachable from the app; ~190 have no caller (e.g.
`conceptual-reasoning-brain`, `neurosymbolic-reasoning`, `closed-loop-self-learning-brain`,
`convergence-proof`, the entire `dde-*`/`differential-diagnosis`/`cfi-engine` cluster, every
`advanced-*-engine`, every vertical). They still export handlers and are publicly reachable, many
without auth. `cfi-engine.ts:341` even POSTs to a `dde-engine` that **does not exist**. **Impact:**
(a) a large surface where future fabricated/incorrect logic can hide and be invoked directly while
looking authoritative; (b) compounds the auth exposure (P0-1); (c) bloats every deploy. **Fix:**
quarantine non-live engines to a `_unused/`/`archive/` outside the functions root behind a tracked
LIVE-ENGINES manifest; add a CI check that fails on a function with no caller and no allowlist entry.

### P1-5 (ARCH) — stale duplicate source files tracked at repo root
Root-level `VoiceInspectionPage.tsx` (stamped **v16.6m / DEPLOY176**, ~45 deploys behind the live
`src/pages/VoiceInspectionPage.tsx` v16.21) and a root `decision-core.ts` / `superbrain-synthesis.js`
duplicate the real files. The root VIP even hardcodes the anon Supabase key. `src/App.tsx:11` imports
only `./pages/VoiceInspectionPage`. **Impact:** an editor (human or agent) can "fix" a fabrication bug
in the wrong file and change nothing in prod; reviewers can't tell which is live. **Fix:** delete the
root duplicates; keep one canonical source.

### P1-6 (BUILD/CI) — the 100-case validation workflow references a file that doesn't exist
`.github/workflows/run-validation.yml` runs `node golden-suite-100-case-validation.cjs`, which is not
in the repo → the workflow `MODULE_NOT_FOUND`s on every dispatch. **Impact:** a "validation gate" that
looks live but has never run. **Fix:** restore the harness (root `golden-suite-runner.js` may be the
intended target) or delete the workflow.

### P1-7 (BUILD) — gate suite recompiles TS per-gate (cold-start fragility, not a true hang)
12 of 49 gates spawn `npx tsc` at runtime; `decision-core.ts` is compiled ≥2× independently. Warm
run is ~32s/RC=0 (no hang reproduced), but a cold cache or slow CI runner can blow a tight timeout —
which is what the earlier ">180s" observation was. **Fix:** precompile the shared TS once to a temp
dir and have gates `require` the prebuilt JS (a `precompile` step in `run-gates.cjs`), or switch gates
to `tsx`. Cuts the suite to ~5–8s and removes the fragility.

### P1-8 (CORRECTNESS, latent) — consequence `MANUFACTURED_ACTIVE` gate excludes PROBABLE
`decision-core.ts:4740` neutralizes the fabricated physical failMode only when
`degradationCertainty === "UNVERIFIED"`. But `PROBABLE` is assignable from `reality_score >= 0.6` with
no observation basis (`:4617`), so a physics-only score could keep an active `pressure_boundary_failure`
on a no-evidence asset. Could not construct a clean ≥0.6/`obs=false` stack from the boosts read →
**latent, not reproduced.** **Fix:** change the gate to `degradationCertainty !== "CONFIRMED" &&
!hasDamageEvidence && !hasAnyVisibleDamage`, or forbid PROBABLE from a score with `observation_basis=false`.

### P1-9 (CORRECTNESS, latent / defense-in-depth) — contest has no backstop against absorbing a CONFIRMED physical
`governancePipeline.ts:165–187` causal-merge has no tier/state guard: a bid with `causedBy="PHYSICAL"`
absorbs a `CONFIRMED_DAMAGE` physical into `basisBids` and demotes FFS (reproduced in isolation).
**Not reachable today** — the only producer guards `causedBy="PHYSICAL"` to `tuple.physical ===
"SUSPECTED"` (`reconciliationLayer.ts:291`). **Fix:** in the arbiter, never let a CONFIRMED/DIRECT
physical be absorbed as a cause — fall back to compound. Cheap insurance on the sole arbiter.

### P1-10 (ARCH) — engine version stamps are stale and internally inconsistent
The frontend subtitle advertises "Authority Lock v1.0 / FMD v1.3.2 / Disposition Pathway v1.1", but
`authority-lock.js` header is v1.3; `disposition-pathway.js` stamps `engine_version: …-v1.0-deploy174`
while declaring `version: "1.2"`; FMD stamps `…-v1.3.2-deploy171.7` (~300 deploys stale). **Impact:**
audit bundles stamp misleading engine versions — provenance can't be trusted to identify what ran.
**Fix:** centralize one `ENGINE_VERSIONS` constant; assert the frontend subtitle matches each engine's
self-reported version in a test.

---

## P2 — Hardening / cleanup

- **(CORRECTNESS) disposition-pathway phantom ledger via "probable"** — `disposition-pathway.js:845`
  `isEvidencedEnough` only applies the observation_basis gate to `unverified`; a physics-only
  "probable" still earns a full crack-NDE ledger on a clean asset. Downstream of P1-8 (same root); tie
  the ledger gate to the same evidence condition. (No genuine-candidate suppression bug found.)
- **(CORRECTNESS) SA convergence re-derives a mechanism independent of the verdict** —
  `situational-awareness-convergence.cjs` narrates "vibration-induced fatigue"/"internal corrosion"
  from keyword streams (≥2 non-negated streams, clause-aware negation). It feeds the *advisory* SA
  package, not the governing disposition, so it can't fabricate a verdict — but cross-check its family
  against `buildMechanismVerdict` and label SUSPECTED when the verdict has no match.
- **(SECURITY) CORS `*`** on authenticated/mutating endpoints (`master-router.ts`, `llm-proxy.js`,
  `ai-chat.ts`, `create-case.ts`, broadly) — restrict to known app origins.
- **(SECURITY) no security headers** (`netlify.toml:72-81`) — add CSP/HSTS/X-Frame-Options/
  X-Content-Type-Options/Referrer-Policy.
- **(SECURITY) error-detail leakage** — `create-case.ts:149/178`, `data-ingestion.ts` return raw
  `error.message`/`String(err)` to clients; log server-side, return generic.
- **(SECURITY) frontend generic CRUD on anon key** — `src/utils/supabase.ts:19-79` exposes
  `sbInsert/sbUpdate/sbDelete(table,…)`; security rests entirely on RLS being enabled + policy-tested
  on every table. Verify RLS; prefer guarded functions for privileged mutations.
- **(BUILD) `any` density / `@ts-nocheck`** — `decision-core.ts` has 58 `:any`/`as any` and
  `@ts-nocheck`; ratchet down after P0-3.
- **(ARCH) giant single files** — `decision-core.ts` 6,872 lines, `VoiceInspectionPage.tsx` 3,075,
  `failure-mode-dominance.js` 1,225; extract typed sub-modules to cut blast radius.
- **(ARCH) repo hygiene** — `forged-ndt-intelligence-repo.zip` and many `system-test-v*`,
  `*-PASTE-THIS.txt`, scratch runners tracked in-tree; `*.zip` not gitignored. Move to
  `docs/archive/`+`scratch/` (gitignored); `git rm --cached` the zip. (Also aggravates P0-2.)
- **(BUILD) orphan root test scripts** — `golden-suite-runner.js`, `system-test-v*.js`,
  `reality-challenge.js` etc. imply coverage that nothing runs.

---

## Suggested remediation order
1. **P0-2 (OneDrive)** — one-time environment fix; stops the lost-work risk that taxes every commit.
2. **P1-1 + P1-2** — the two live correctness bugs; small, well-scoped, and P1-2 is a fresh
   DEPLOY468 regression worth closing before it's frozen into the golden set. Bundle as one DEPLOY.
3. **P0-1 + P1-4** — the security rollout and engine quarantine are the same surface; stage together
   per the existing `AUTH-ROLLOUT-PLAN.md`, prioritizing service-role functions, then quarantine the
   orphans so the auth surface shrinks.
4. **P0-3 + P1-7 + P1-10** — type-check the backend, precompile the gate suite, centralize versions:
   the "make regressions visible" batch.
5. **P1-3 + P1-8 + P1-9 + P2 correctness** — single-source the jurisdiction resolver, tighten the
   certainty-state boundaries, add the arbiter backstop: the "harden the core further" batch.

The decision core itself is in good shape — these are the gaps between a correct engine and a
defensible *platform*.
