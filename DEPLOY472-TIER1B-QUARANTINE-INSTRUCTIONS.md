# DEPLOY472 — Pilot Readiness TIER 1B (part 2): quarantine the orphan engines

Removes the dead/unreachable engine surface so it stops deploying as public `/api` endpoints, and
makes the invariant durable. Pairs with DEPLOY471 (guards). Last pilot-blocker.

## What changed
- **153 orphan engine files → `archive/functions/`** (outside the Netlify functions path, so they no
  longer deploy / 404). These had **no caller** in `src/`, no internal `require`/`fetch` from any live
  function, and no dynamic-dispatch reach — verified before moving (0 live→orphan references) and
  after (0 broken refs in the 87 remaining). Includes the entire dde-*/cfi-engine-local/advanced-*-engine/
  vertical/`*-brain` cluster and the 6 dynamic-dispatch callers (apmm-orchestrator, tri-model-reasoning
  ±background, uncertainty-reliability-core, validation-engine, formula-chain-executor).
- **`weld-acceptance-authority`** also quarantined — the CI check (below) caught it as transitively
  dangling once its only callers (orphans) were moved. Convergence verified.
- **NOT moved (live, kept deployed):** `cfi-engine` (guarded in 471, a comprehensive-assessment fan-out target) — distinct from the archived `cfi-engine-local`. Both dynamic dispatchers' full runtime target sets (comprehensive-assessment ENGINE_ROUTES + ai-chat callEngine) were enumerated and confirmed to point only at deployed engines; no dispatch resolves to an archived file.
- **`system-check.html`** (the public doorway to those engines) moved out of `public/` to `archive/`,
  and its `netlify.toml` redirect removed — it no longer deploys.
- **`scripts/check-live-engines.cjs`** + **`scripts/LIVE-ENGINES.txt`** (87-entry manifest): a CI gate
  that (a) FAILS if any deployed function is unreachable from src/public/toml (a new no-caller engine,
  i.e. a re-introduced orphan), and (b) WARNs if an internal-fetching function lacks `X-API-Key`
  (the DEPLOY471 forward-key invariant). Wire it into the build to keep the surface from regrowing.
- Version v16.23 → **v16.24**.

## Verified offline (post-move)
- **CI check passes:** 87 reachable functions, no orphan deployed.
- **0 broken references**: no remaining function require/imports/fetches a moved name; no test/gate references a moved file.
- **eval-sa 20/20**, decision-core-hold 14/14, reconciliation-layer 77, fmd-subpath 10/10 (live path untouched).
- Only 2 live functions use dynamic fetch paths (ai-chat, comprehensive-assessment); both target only live engines (verified incl. api581-rbi-engine).

## Security effect
The ~119 spend/data-bearing orphans (service-role clients / LLM calls that were unguarded public
`/api` endpoints) are no longer deployed at all — closed by removal, not by 28 more guards. Combined
with DEPLOY471, the public function surface is the 87 live engines (28 guarded + the open core path +
shared modules), not 240.

---

## Git — Git Bash at /c/dev/forged-ndt-intelligence (large move diff; reset first)
This is ~153 deletions under netlify/functions + 153 additions under archive/ + system-check move +
netlify.toml + manifest/CI + version. Too many to name — but `git add -A` is safe **only after** a
clean reset confirms no phantom test deletions.
```bash
git reset
git status   # EYEBALL: ~153 moved netlify/functions -> archive/, system-check.html moved,
             # netlify.toml + VoiceInspectionPage modified, new scripts/check-live-engines.cjs +
             # scripts/LIVE-ENGINES.txt + DEPLOY472 doc.  CRITICAL: NO "deleted: tests/..." or
             # "deleted: tsconfig.json/vite.config.ts".  If those phantom deletions appear:
             #    rm -f .git/index && git reset      (then re-check status)
git add -A
# VERIFY BY ARITHMETIC, not by reading 300+ lines:
git diff --cached --name-status | grep '^D' | grep -v '^D\tnetlify/functions/' | grep -v system-check   # MUST be empty (no deletion outside the move)
# and the move must balance 1:1 -
echo "deleted under functions:"; git diff --cached --name-status | grep -cE '^(D|R[0-9]*)\tnetlify/functions/'
echo "added under archive:";    git diff --cached --name-status | grep -cE '^(A|R[0-9]*).*archive/functions/'
# if the first grep prints ANY line (a stray tests/tsconfig deletion) or the two counts don't match -> stop:
#    git reset && rm -f .git/index && git reset    then re-add
git commit -m "DEPLOY472 Tier 1B(quarantine): move 153 unreachable orphan engines to archive/ (no longer deployed as public /api); remove system-check.html + its redirect; add LIVE-ENGINES manifest + CI reachability/forward-key gate; v16.24"
git push
```

## Live check (after Published)
- Spot-check a few quarantined endpoints now 404 (were 200 or 401 before):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://4dndt.netlify.app/api/conceptual-reasoning-brain -d '{}'   # expect 404
curl -s -o /dev/null -w "%{http_code}\n" https://4dndt.netlify.app/system-check.html                                  # expect 404
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://4dndt.netlify.app/api/differential-diagnosis -d '{}'        # still LIVE+guarded -> 401, NOT 404
```
- **Runtime check for the move (the one static analysis can't do):** create one case (NewCase) and run a **full CaseDetail analysis** with the Network tab open. Watch for any **404 or 500** mid-analysis — that is exactly where a dynamic dispatch to an archived engine would surface. Expect run-analysis + observation-layer + reasoning-layer + truth-engine all 200 (this ALSO closes the one 471 item still unproven live: the run-analysis->trio server-key forward, which the 0-cases console test could not fire).
- Confirm the inspector Voice flow still works (v16.24 stamp) — core path untouched.
- The guarded endpoints (case-search etc.) still 401 anonymous / accept your JWT — unchanged from 471.

## After this: the pilot link is surface-safe
- Anonymous spend/data closed (471 guards + 472 removal).
- Dead authoritative-looking surface gone; cfi→nonexistent-dde-engine gone.
- CI gate keeps it from regrowing.
Post-pilot backlog (unchanged): per-bucket guard tightening, enginePath allowlist, the parked CP3
satellite-consumption directive (TEST 37/41 mechanism enumeration on no-mechanism cases).
