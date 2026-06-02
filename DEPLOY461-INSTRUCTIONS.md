# DEPLOY461 — Governance Contest CP3, commit 5: consequence failure_mode gated on evidence

**Commit 5 of 5 — CP3 (the consumption contract) is complete.** The consequence engine stops
manufacturing a physical failure *mechanism* on a clean asset.

## What changed
- **`netlify/functions/decision-core.ts`** (consequence engine):
  - The `crack_propagation_pressure_breach` failure mode was being manufactured from cyclic-loading
    **physics potential alone** (cyclic loading + stress concentration + stored energy), with no
    confirmed damage. Now gated: it only fires when `degradationCertainty !== "UNVERIFIED"` — i.e.,
    there is confirmed / suspected / probable damage evidence.
  - **Final backstop:** with no confirmed/suspected/visible damage (`degradationCertainty` UNVERIFIED
    and no evidence), any residual active-mechanism failure mode
    (`crack_propagation_pressure_breach` / `structural_pressure_cascade` / `fire_pressure_cascade`)
    is downgraded to `no_confirmed_mechanism`. The governing reality governs, not a fabricated
    mechanism.
  - The structural/fire cascade modes were already evidence-gated (visible deformation / actual fire
    exposure) — unchanged. Consequence **tier** and **human_impact** (consequence-of-failure
    severity, tied to asset class) are unchanged — those are legitimate and not a manufactured
    mechanism.
- Version **v16.14 → v16.15**.

## Verification (offline, all green)
- `node scripts/eval-sa.cjs` → **20 / 20** — eval-sa runs the full decision-core pipeline on all 20
  cases and is decision-core's authoritative regression gate; no regression from the consequence
  change.
- `node scripts/run-gates.cjs` → **46 / 46**
- `npx tsc -b` → clean
- (No standalone gate added: decision-core's consequence is internal and only cleanly exercised
  through the eval harness, which already covers it end-to-end. The behavioral proof is the live
  TEST 31/32 check below.)

## CP3 — DONE (the consumption contract, all five satellites)
1. ✅ `_mechanism-evidence.cjs` — the single verdict (457)
2. ✅ Authority Lock — mechanism-triggered locks gate on the verdict (458)
3. ✅ FMD sub-paths — corrosion/cracking/structural gate on the verdict (459)
4. ✅ Disposition ledger / inspection plan — evidence floor (460)
5. ✅ Consequence failure_mode — gated on evidence (461)

The mechanism tower (HIC / API-579 / crack locks / corrosion-path-active / TOFD-MT ledger /
crack-propagation consequence) no longer fabricates on a clean asset — every mechanism-dependent
satellite reads the same evidence verdict.

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence

```bash
git add netlify/functions/decision-core.ts src/pages/VoiceInspectionPage.tsx DEPLOY461-INSTRUCTIONS.md
git commit -m "DEPLOY461: governance contest CP3 commit 5 (CP3 complete) - consequence failure_mode gated on evidence; no manufactured crack_propagation/cascade on a clean asset; v16.15"
git push
```

## Live check (v16.15) — this is the CP3 capstone check
Re-run **TEST 31 / TEST 32** (the SIS) and **TEST 30** (hydrogen piping). The full report body
should now be free of fabricated mechanism content on these clean assets:
- Authority Lock: no Part 9 / NACE / Part 4-5 (asset-class API 510/ASME VIII may remain — §6).
- FMD: no active corrosion/cracking path.
- Required Evidence Ledger / Inspection Plan: no TOFD/MT/crack-sizing for an unevidenced mechanism.
- Consequence: failure mode is not `crack_propagation_pressure_breach` (no manufactured mechanism).
- Governing Reality top line: clean.

The remaining wrongness on TEST 31/32 is now ONLY: (a) asset class still pressure_vessel/API 510
(the §6 classifier — SIS class + identity-precedence), and (b) the tuple still ESTABLISHED/STABLE
so it HOLDs on the confidence gate instead of concluding "verify the safety function" (the CP4
assurance recognizer). Those two are the last items.

## Next
CP4 — the coverage recognizers: the assurance recognizer (safety-function integrity — TEST 29/31/32)
and regulatory routing (TEST 30). This is the load-bearing fix that makes these scenarios actually
*conclude* correctly. Plus the §6 classifier (SIS class + identity-precedence; Gulf-of-Mexico
jurisdiction word-boundary).
