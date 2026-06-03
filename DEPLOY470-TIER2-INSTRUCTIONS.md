# DEPLOY470 — Pilot Readiness TIER 2: the two confirmed correctness bugs

From the Pilot-Readiness Work Order. Both bugs were CONFIRMED-live by the gap-analysis decision-
correctness audit and would fire on the trial inspectors' real offshore cases. Self-contained; no
dependency on Tier 1B. Verified offline with golden cases that lock them against regression.

## 2A — "unmanned"/"unoccupied" no longer fabricates CRITICAL / FATAL  (`decision-core.ts`)
**Bug:** `hasWord()` is plain `indexOf`, so in `resolveConsequenceReality` the critical-keyword scan
matched **"manned" inside "unmanned"** and the receptor scan matched **"occupied" inside
"unoccupied"** → a genuinely unmanned/NUI offshore asset was escalated to CRITICAL with a fabricated
`FATAL -- human occupancy`. Standard offshore vocabulary ("normally unmanned installation"), so the
trial audience would hit it. Same family as the `which`->HIC / `dam`->bridge substring bugs.
**Fix:** word-boundary match the bare `"manned"` in the critKw loop (the deliberate stems like
`"saturation div"`/`"recompression"` stay substring matches); rewrite the receptor scan with
`hasWordBoundary` and split **crew occupancy** (suppressed on an unmanned asset) from an **external
receptor** like a downwind population (which still elevates). Added an explicit
`unmanned`/`NUI`/`unoccupied`/`not normally manned` downgrade that gates only the crew-occupancy
elevation. Inherent life-support hardware (hyperbaric/dive/chamber) and stored-energy/load-path/toxic
paths are untouched.
**Verified (decision-core-hold gate, now 14/14):** "normally unmanned installation" / "unoccupied
wellhead structure" → no fabricated FATAL human-occupancy; "manned production platform, 40 personnel
on board" → still CRITICAL + FATAL (no over-correction).

## 2B — genuine multi-mechanism interaction warnings restored  (`failure-mode-dominance.js`)
**Bug (regression from DEPLOY468 §1.1):** the interaction gate re-derived family confirmation through
`classifyFamily`, whose DIRECT regexes are narrower than FMD's own observed-state vocabulary
("crack present", "crack verified", "fracture surface") and cannot see fatigue at all — so it wrongly
stripped real CUI+fatigue / MIC+HIC / erosion+SCC interactions while `governing_failure_mode` stayed
COMPOUND. A re-derivation where it should have consumed FMD's own determination (single-source).
**Fix:** gate the interaction on FMD's OWN per-family REAL evidence — corrosion = verdict-confirmed
OR a measured wall-loss datum (NOT a passed-in/injected mechanism name, so an injected unobserved
"mic" can't re-assert a fake leg); cracking = FMD's transcript-grounded observed-crack state (rich
vocabulary, covers fatigue); structural = FMD's non-finding-gated indicators. Require >= 2 families
with real evidence; < 2 drops the interaction (so the TEST 36 injected-mic/hic-on-clean-transcript
phantom stays suppressed).
**Verified (fmd-subpath-verdict-gate, now 10/10):** TEST 36 phantom → empty; CUI+fatigue → CASCADE;
MIC+HIC (HIC observed + 38% loss) → SYNERGY; erosion+SCC (cracking verified) → SYNERGY.

Version **v16.21 → v16.22**.

## Verification (offline, all green)
- decision-core-hold: **14/14** (+3 unmanned/manned golden cases)
- fmd-subpath-verdict-gate: **10/10** (+4 interaction golden cases)
- decision-core-integration, reconciliation-layer (77), authority-lock-mechanism, disposition-ledger,
  situational-awareness-consequence: pass
- `node scripts/eval-sa.cjs` → **20 / 20**, XFAIL=0
- decision-core.ts + failure-mode-dominance.js transpile/`node --check` clean

---

## Git — Git Bash at /c/dev/forged-ndt-intelligence (reset first — phantom deletions; add by NAME)
```bash
git reset
git status   # expect modified: decision-core.ts, failure-mode-dominance.js,
             # decision-core-hold.test.cjs, fmd-subpath-verdict-gate.test.cjs, VoiceInspectionPage.tsx;
             # untracked: DEPLOY470-TIER2-INSTRUCTIONS.md.  NO deleted tests/tsconfig.
git add netlify/functions/decision-core.ts netlify/functions/failure-mode-dominance.js tests/decision-core-hold.test.cjs tests/fmd-subpath-verdict-gate.test.cjs src/pages/VoiceInspectionPage.tsx DEPLOY470-TIER2-INSTRUCTIONS.md
git status   # confirm ONLY those 6 staged; NO deletions
git commit -m "DEPLOY470 Tier 2: unmanned/unoccupied no longer fabricates FATAL human-occupancy (word-boundary + NUI downgrade); FMD interaction gate consumes FMD's own observed per-family states so genuine CUI+fatigue/MIC+HIC/erosion+SCC interactions are restored while the TEST 36 phantom stays suppressed; v16.22"
git push
```

## Live check (deployed build, v16.22)
- A "normally unmanned" / "unoccupied" offshore case: consequence is NOT CRITICAL on occupancy grounds
  and the report shows no "FATAL — human occupancy"; a manned platform still reads CRITICAL/FATAL.
- A real CUI+fatigue (or MIC+HIC / erosion+SCC) case with observed cracking: the interaction/synergy
  warning appears again; a clean asset shows none.

## Note
This is the Tier 2 commit. **Tier 1B** (guard the 3 spend survivors + guard the 25 data survivors
[authenticated] + quarantine the 153 orphans + remove system-check.html + LIVE-ENGINES manifest + CI
check) is the next commit (DEPLOY471) — that's the surface-shrink that should also land before the
link goes broad.
