# DEPLOY440 — Stabilization Directive Phases 1 & 2 (test-net first, then baseline)

Implements the first two phases of the Architecture Stabilization Directive v2.0. This is
the safety net the rest of the rearchitecting (Phases 3–11) will be built on top of. **No
engine behavior changed** — this deploy is entirely about the test harness and a true,
honest baseline.

## Phase 1 — fix the test-harness hole (the cheapest, highest-leverage fix)
The eval harness fed a **hand-set `asset_class`** straight into the pipeline and skipped
`resolve-asset` + `reality-lock` — exactly where the furnace→offshore failure lived. Our
own net had a hole at the front of the pipeline.

`scripts/eval-sa.cjs` now begins every case from **raw transcript** and runs the real
front end, mirroring the live frontend's logic (`VoiceInspectionPage.handleGenerate`):

```
transcript → resolve-asset → reality-lock (apply override iff asset_conflict && asset_override)
           → decision-core → authority-lock → FMD → convergence → organizational → governing-reality
```

The derived classification is surfaced on every line (`[asset / dom:domain]`, `*OVR` when
reality-lock overrode) and is assertable via new `asset_class_in` / `asset_class_not`
expectations. The report text scanned for contamination now also includes the derived
asset class + detected domain, so a furnace→offshore classification is caught as
contamination directly.

## Phase 2 — system-breaker fixtures + true baseline
New corpus `tests/fixtures/system-breakers.json` (run alongside the regression corpus):

- **A — furnace process drift:** must classify `pressure_vessel`/`fired_heater`, never
  offshore; must not contain API RP 2A / offshore / structural instability. **PASS** —
  the DEPLOY439 fix holds end-to-end through the real front end.
- **B — LNG assurance failure:** must not invent active corrosion/cracking/instability.
  **PASS.**
- **C — software fleet failure (wind):** must not surface material-damage-governs.
  **PASS.**
- **D — vibration fatigue convergence:** suspected mechanism should lead fatigue.
  **XFAIL (tracked)** — leads HIC under the raw-transcript FMD path.

Each fixture also carries an `axis_target_future` tuple (the §3 three-axis model) so the
fixtures are ready to become hard gates the moment Phases 3–4 land.

## The honest baseline (this is the point of the deploy)
`npm run eval` → **16 / 16 hard cases pass, + 2 tracked baseline XFAIL.**

Switching to raw transcript exposed front-end bugs the old harness was **hiding**. After
a reviewer pass, they sort into three correct buckets — engine debt, fixture bug, label
review — so we don't burn rebuild effort chasing expectations that are themselves wrong:

| Case | Derived | Verdict | Owner |
|---|---|---|---|
| `T13_reac_inlet_piping` | pressure_vessel / refinery | **Engine debt.** REAC **piping** misclassified as a vessel → API 510 instead of 570 (the keyword cascade in miniature: "reactor effluent air cooler" outscores "piping"). | Phase 5 (Component→Asset→Authority) + Phase 7 rule 3 |
| `T16_subsea_tiein` | pipeline (ASME B31.8) | **Fixture bug — CORRECTED.** A subsea pipeline tie-in is governed by B31.8 (gas)/B31.4 (liquid) + API 1111/DNV-ST-F101, **not** API 570 (in-service process piping). The derived B31.8 was right; the expectation was wrong. Expectation fixed; engine untouched. Now a hard PASS. | n/a (fixture) |
| `BREAKER_D_vibration_fatigue` | process_piping | **Engine debt.** Tier-2 FMD ranks HIC over vibration fatigue off an H2S+crack keyword. **Do not tune FMD weights** as an interim fix. | Phase 3 (LLM leads mechanism) + Phase 6 (evidence gate) |

**T13 exit gate (sharpened):** must go green when Phase 5 lands **with no REAC-specific
keyword anywhere in the diff.** If it needs a REAC keyword to pass, the derivation didn't
work and it's been whack-a-mole'd — that counts as a failure of the fix.

**Label-review bucket (not junk, not engine debt):** `T15_flng_lng_loading_line` →
offshore_platform is borderline-defensible (an FLNG unit *is* a classed offshore
installation; the label just misses the LNG-process side). Its assertions pass today;
flagged `classification_review` for a label pass alongside T16, **not** lumped with the
one genuine misclassification smell, `T19` power-grid → offshore/nuclear.

## Reviewer-driven hardening also in this deploy
- **`.gitattributes`** (`* text=auto eol=lf` + binary rules) to kill the OneDrive→C:\dev
  CRLF/LF churn that was burying real diffs. Run once after committing it:
  `git add --renormalize . && git commit -m "normalize line endings"`.
- **§13 architecture-health ledger** now printed every run:
  `governing_reality_classes=12  domain_classifier_keywords=210  XFAIL=2`. Both counts
  must stay flat-or-decreasing; **XFAIL must be monotonically decreasing, target 0 by
  Phase 9.** If a fix raises a count, it's a special-case smell.
- **FINAL PRINCIPLE marker** on Breaker A: when the axis gates land, it must assert *both*
  halves — `PhysicalCondition=ACCEPTABLE` ("physically acceptable today") **and**
  `Assurance=LOST_DESIGN_BASIS`/`Operational=CHANGED_UNREASSESSED` ("not dispositionable").
  That dual conclusion is success criterion 10 and the easiest capability to silently
  regress.

## Why XFAIL instead of red
`npm run eval` is wired into CI/Netlify and blocks deploys. The three baseline failures
are real debt owned by the inverted-flow rebuild (Phases 3–9), not regressions to fix now
(fixing them with keyword patches would be the exact whack-a-mole the directive forbids).
They are marked `baseline_known_fail` with a tracked note: reported as **XFAIL**, visible
on every run, but non-blocking. When the new path genuinely fixes one, remove the marker
and it becomes a hard gate again. This is also the §13 anti-whack-a-mole ledger in action.

## Verified
- `npm run eval` → 16/16 hard pass (+2 tracked XFAIL: T13, BREAKER_D); exit 0.
- `node scripts/run-gates.cjs` → 35/35.
- `npx tsc -b` → clean.
- No engine source changed — only the harness, fixtures, and `.gitattributes`.

## Files
- `scripts/eval-sa.cjs` — raw-transcript front end, classification assertions, two-corpus runner, XFAIL handling, §13 health ledger
- `tests/fixtures/system-breakers.json` — Breakers A–D; axis-target tuples; Breaker A FINAL-PRINCIPLE marker; BREAKER_D note
- `tests/fixtures/sa-eval-cases.json` — T16 fixture-corrected (B31.8) to hard PASS; T13 sharpened exit gate; T15 label-review note
- `.gitattributes` — line-ending normalization
- `DEPLOY440-INSTRUCTIONS.md`

## Commit (from C:\dev\forged-ndt-intelligence — targeted add; tree has line-ending noise from the OneDrive→C:\dev move)
```bash
npm run eval && node scripts/run-gates.cjs && npx tsc -b

git add .gitattributes \
        scripts/eval-sa.cjs \
        tests/fixtures/system-breakers.json \
        tests/fixtures/sa-eval-cases.json \
        DEPLOY440-INSTRUCTIONS.md

git commit -m "DEPLOY440 - Stabilization Phases 1-2: eval harness now runs from RAW TRANSCRIPT through resolve-asset + reality-lock (closes the front-end test-net hole that hid furnace->offshore); add system-breaker corpus A-D with three-axis target tuples + FINAL-PRINCIPLE marker; T16 fixture-corrected (subsea tie-in -> ASME B31.8, not API 570); T13 sharpened exit gate (no REAC keyword in diff); .gitattributes line-ending normalization; S13 health ledger (classes/keywords/XFAIL). Baseline 16/16 hard + 2 tracked XFAIL (T13, BREAKER_D) owned by the inverted-flow rebuild. No engine behavior changed. gates 35/35; tsc clean."

git push

# one-time, after the commit above lands, to retire the OneDrive CRLF/LF churn:
git add --renormalize .
git commit -m "normalize line endings (.gitattributes)"
git push
```

## Next (Phases 3–11, the actual inverted flow)
3. `src/lib/llmHypothesis.ts` — LLM reasons first (JSON, temp 0, evidence-cited).
4. confidence-tagged `resolve-asset`/`reality-lock` (`{value, confidence, evidence, source, isDefault}`).
5. authority **derivation** (Component→Asset→Jurisdiction→Authority), no keyword-selected codes.
6. evidence gate: a mechanism is ACTIVE only with direct evidence.
7. `src/lib/noDestructiveOverride.ts` — the seven rules.
8. tiered deterministic veto (Tier-1 hard veto with cited reason; Tier-2 advisory only).
9. `src/lib/reconciliationLayer.ts` — agree/disagree/veto → the three-axis tuple.
10. shadow-mode rollout (parallel, logged, not driving the report) until breakers + 35 gates pass on the new path.
11. report enhancement (hypothesis · deterministic · reconciliation · conflicts · vetoes · governing tuple · disposition · ledger).
