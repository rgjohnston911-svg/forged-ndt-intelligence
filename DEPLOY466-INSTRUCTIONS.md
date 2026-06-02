# DEPLOY466 — Jurisdiction word-boundary fix (Gulf of Mexico ≠ Mexico)

A standalone fix in `global-authority-engine.ts` (independent of DEPLOY465 — different file).

## The bug
In `resolveLocationText`, a US match ("United States" / "Gulf of Mexico") was discarded as
"overridden" because the Mexico location tagger `/\bmexico|mexican|pemex\b/` matched the **"Mexico"
inside "Gulf of Mexico"** (and would also catch "New Mexico"). So a US Gulf-of-Mexico platform read
as **Mexico** (TEST 29's "Detected Jurisdiction: Mexico"). Classic substring/word-boundary disease.

## The fix
Negative lookbehinds on the Mexico tagger so it does not match after "gulf of " or "new ":
`/(?<!gulf\s+of\s+)(?<!new\s+)\bmexico\b|\bmexican\b|\bpemex\b/i`. The US/BSEE/USCG overlay path is
untouched (it already reads US-offshore correctly).

## Verified (new gate: jurisdiction-wordboundary-gate, 4 checks)
- "Offshore Gulf of Mexico … United States" → **United States** (not Mexico)
- "New Mexico refinery, United States" → **United States** (not Mexico)
- "Pemex … Bay of Campeche, Mexico" → **Mexico** (genuine Mexico still tags)
- "Offshore Mexico … Mexican operator" → **Mexico**

## Verification (offline, all green)
- new gate: 4/4
- `node scripts/run-gates.cjs` → **49 / 49**
- `node scripts/eval-sa.cjs` → 20 / 20
- `npx tsc -b` → clean
- **No version bump** (independent back-end file; avoids colliding with 465's uncommitted v16.19 in
  VoiceInspectionPage). Live-verify by the jurisdiction label, not the version.

---

## Git — commit AFTER DEPLOY465 (different files, so cleanly separable)

```bash
git reset                 # clear any phantom staged-deletions
git add netlify/functions/global-authority-engine.ts tests/jurisdiction-wordboundary-gate.test.cjs DEPLOY466-INSTRUCTIONS.md
git commit -m "DEPLOY466: jurisdiction word-boundary - Mexico tagger no longer matches 'Gulf of Mexico'/'New Mexico' (stay US); genuine Mexico still tags; US/BSEE path unchanged"
git push
```

## Live check
Re-run a US Gulf-of-Mexico scenario (e.g. TEST 29): "Detected Jurisdiction" should read **United
States** (BSEE/USCG overlay), not Mexico.
