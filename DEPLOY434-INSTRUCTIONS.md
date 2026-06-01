# DEPLOY434 — Dynamic-fatigue dominance over H2S→HIC screening (TEST 16)

## The issue (GPT, TEST 16 — 9.4/10)
On the subsea tie-in scenario the SA layer correctly found the system-level story (flow/vibration-
induced fatigue from a 35% throughput increase + slugging + transient excursions + unsupported span +
scour + no MOC). But the **Failure Mode Dominance** engine still elevated **HIC** as the suspected
governing mechanism — purely because H2S is present — even though the evidence trail overwhelmingly
favors dynamic fatigue. Because the Governing Reality Engine consumes `FMD.suspected_governing_
mechanism`, the HIC bled into the top-line and the disposition reasoning ("hold because HIC unresolved"
instead of "hold because the operating envelope changed and fatigue is unassessed").

## Cause
`suspected_governing_mechanism` was just `screeningMechanisms` in the fixed enum order
`["hic","ssc","scc","fatigue",...]` — so HIC always led, regardless of the actual evidence weight.

## Fix
`failure-mode-dominance.js`: added **dynamic-fatigue dominance**. When multiple DISTINCT documented
dynamic-loading signals are present (vibration / slugging / flow-induced / transient pressure /
unsupported span / cyclic / throughput increase — ≥2 categories), a fatigue mechanism that is already
a screening candidate is **moved to the front** of the suspected-governing list. It re-orders an
already-detected mechanism by documented-fact weight; it does not invent fatigue, and it makes no
behavioral inference. H2S→HIC remains a legitimate secondary suspicion (H2S is real) — it just no
longer outranks a strong fatigue convergence.

## Verified
- FMD offline: TEST 16 (fatigue signals + H2S) → suspected leads **fatigue**; a sour separator with
  no dynamic signals does NOT get a fatigue false-positive (control).
- **`npm run eval` → 7/7** — TEST 16 added as a permanent case asserting `suspected_leads: "fatigue"`
  and `must_contain: ["fatigue"]`. (This is the first fix validated by the batch harness rather than a
  manual loop.)
- `node scripts/run-gates.cjs` → 35/35 (no regression to the structural discriminator / other FMD
  behavior); `tsc -b` clean.

## Also in this deploy
- `scripts/eval-sa.cjs` gained `must_contain` and `suspected_leads` check types.
- `tests/fixtures/sa-eval-cases.json` gained the TEST 16 case (corpus now 7).

## Files
- `netlify/functions/failure-mode-dominance.js` (dynamic-fatigue dominance + helpers)
- `scripts/eval-sa.cjs`, `tests/fixtures/sa-eval-cases.json`
- `DEPLOY434-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence)
```bash
npm run eval
node scripts/run-gates.cjs
git add netlify/functions/failure-mode-dominance.js scripts/eval-sa.cjs tests/fixtures/sa-eval-cases.json DEPLOY434-INSTRUCTIONS.md
git commit -m "DEPLOY434 - Dynamic-fatigue dominance in FMD (TEST 16): when >=2 documented dynamic-loading signals are present, a fatigue screening candidate leads the suspected-governing list ahead of a generic H2S->HIC trigger (re-orders an already-detected mechanism by fact weight; no invention, no behavioral inference). Governing reality + disposition now name fatigue, not HIC. eval-sa gains must_contain/suspected_leads; TEST 16 added (corpus 7). eval 7/7; gates 35/35; tsc clean."
git push
```

## Note (GPT's secondary point)
GPT also noted API RP 1111 / DNV-ST-F101 should rank higher for subsea pipeline systems. That's the
same DNV/SIGTTO authority-enrichment enhancement noted in DEPLOY432 — additive, deferred. The core
authority routing (API 570 piping, not vessel) is correct.
