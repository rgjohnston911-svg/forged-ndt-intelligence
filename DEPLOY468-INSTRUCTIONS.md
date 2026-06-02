# DEPLOY468 — TEST 36 close-out: finish CP3 (verdict consumption) + authority follows reality

Closes the residual TEST 36 leaks from the Close-Out Directive. Two roots (finish CP3; authority
follows the governing reality) plus two refinements. **Nothing new** — verdict-consumption and
reality-driven routing only. No new engines, no new states, no nullity lock, no section-suppression.

## What changed

**§1 — the last four satellites consume the one `MechanismVerdict` (no re-derivation):**
- **§1.1 (priority, the fabrication)** `netlify/functions/failure-mode-dominance.js` — the
  interaction/synergy block enumerated API-571 pairs off the *passed-in* mechanism list and
  hard-coded "confirmed", so an upstream KB that injected mic/hic on a clean subsea asset printed
  **"MIC + confirmed HIC"** with no corrosion/H2S/microbial data. Now an interaction is asserted
  ONLY when ≥2 mechanism families are CONFIRMED by the verdict (per-family `classifyFamily`, so a
  genuine corrosion+cracking case still gets its real synergy). No confirmed mechanisms → the block
  emits nothing; "confirmed" never appears unverified.
- **§1.2** `netlify/functions/decision-core.ts` — the consequence backstop now neutralizes
  `pressure_boundary_failure` / `structural_failure` (and the release/support-failure modes) on an
  evidence-free asset, not just the three cascade modes. Consequence **tier stays HIGH**; only the
  fabricated physical failure-MODE is dropped. Cannot fire for any asset with real damage evidence.
- **§1.3 / §1.4** `netlify/functions/disposition-pathway.js` — an *unverified* mechanism now earns a
  mechanism ledger / mechanism-specific NDE plan ONLY with a real `observation_basis`. The 0.10
  physics-potential phantom fatigue (no basis) no longer demands crack NDE or carries a Mechanical
  Fatigue ledger. A genuine suspected mechanism (real indirect indicator → basis) keeps its
  screening ledger. Gate on **basis**, never on keyword.

**§2 — authority follows the governing reality** `src/lib/reconciliationLayer.ts` — when the contest
determines ASSURANCE governs, the citation/escalation authority follows the recognizer flavor:
SAFETY → **IEC 61511 / IEC 61508 / ISA 84 / OSHA PSM**; CONTROL → **ISA 18.2 / OSHA PSM / MOC**.
The physical asset-class codes (API RP 2A / B31.8 / API 579) drop to a new `referenceCodes` field —
kept, not governing. Conditional on the governing reality: a PHYSICAL axis is untouched. This also
neutralizes a multi-asset / asset-class misclassification for authority purposes.

**§3 — the recognizer states the protection-layer answers** (output-wording sharpening, gated on
stated signals; no hardcoded figures): "Operators have become a hidden protection layer …" and
"The independent protection layer is degraded …". Also broadened the human-compensation signal so
"manual choke adjustments increased" / "we manage the chokes manually" register (TEST 36 now reads
the A∧B behavioral divergence → assurance **UNKNOWN_STATE**, not DEGRADED).

**§4 — compound-merge causality** `src/lib/reconciliationLayer.ts` — when physical is SUSPECTED
*solely via dynamic-loading* AND assurance is adverse from a protective/control function, the
dynamic loading is a **downstream forward-risk consequence** of the control root, not a co-equal
peer. The causal merge levels it beneath the assurance root (assurance is the surviving
manifestation), so disposition is the assurance disposition — **restricted, validation required** —
not averaged down to monitor. The dynamic-loading note is KEPT (it has a slugging basis), stated as
forward-risk.

Version **v16.20 → v16.21**.

## Verified (offline, all green)
| check | result |
|---|---|
| TEST 36 disposition | **restricted_reassessment_required** (was monitor_and_inspect) |
| TEST 36 interaction | empty — no MIC/HIC; "confirmed" appears nowhere unverified |
| TEST 36 authority | **IEC 61511 / ISA 84 / PSM** govern; API RP 2A → reference |
| TEST 36 governing statement | safety-function governs + hidden-protection-layer + degraded-independent-protection-layer + dynamic-loading-as-forward-risk |
| genuine corrosion+cracking | real synergy retained (per-family confirmed) |
| physical governing reality | authority stays physical, no reference demotion (§2 conditional — no over-fire) |
| reconciliation-layer gate | **77 assertions** (+12 TEST 36 golden trace) |
| fmd-subpath / disposition-ledger / mechanism-parity / authority-lock / asset-identity / functional-safety / jurisdiction gates | all pass |
| `node scripts/eval-sa.cjs` | **20 / 20** (no regression) |
| `npx tsc -b` | clean |

(Per-gate runs are green; `scripts/run-gates.cjs` aggregates them.)

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence (reset first — recurring phantom deletions)

```bash
git reset
git status   # confirm modified: failure-mode-dominance.js, decision-core.ts, disposition-pathway.js,
             # reconciliationLayer.ts, reconciliation-layer.test.cjs, VoiceInspectionPage.tsx;
             # untracked: DEPLOY468-INSTRUCTIONS.md.  NO deleted tests/tsconfig.
git add netlify/functions/failure-mode-dominance.js netlify/functions/decision-core.ts netlify/functions/disposition-pathway.js src/lib/reconciliationLayer.ts tests/reconciliation-layer.test.cjs src/pages/VoiceInspectionPage.tsx DEPLOY468-INSTRUCTIONS.md
git commit -m "DEPLOY468: TEST 36 close-out - CP3 satellites consume the one verdict (no fabricated MIC/HIC synergy, no phantom crack-NDE/ledger, consequence failure-mode gated); authority follows the governing reality (assurance -> IEC 61511/ISA 18.2/PSM, physical codes -> reference); recognizer states the protection-layer answers; dynamic-loading leveled beneath the control root -> restricted; v16.21"
git push
```

## Live check (v16.21) — re-run TEST 36
- **Interaction block empty** — no "MIC + confirmed HIC"; the word "confirmed" appears nowhere unverified.
- **Disposition: restricted / validation required** (not monitor; not continue).
- **Authority: IEC 61511 / ISA 18.2 / PSM govern**; B31.8 / API 579 / API RP 2A reference only.
- Governing reality explicitly states the **hidden-protection-layer** and **ESD-bypass-degradation** answers.
- **Dynamic loading retained** as a forward-risk consequence of the control degradation.
- **Jurisdiction: United States / US OCS** (DEPLOY466 did not regress).
- No "structural failure" / pressure-boundary mode asserted; consequence framed around the protection-layer reality.

## Freeze the assurance golden set
TEST 29 / 31 / 33 / 34 / 35 / **36** are now frozen as the assurance-governed golden set (in the
reconciliation-layer gate alongside the 20 physical golden cases, the 6 system-breakers, and the
contradiction check). With §1 + §2 in place, an in-matrix misclassification (pump→piping,
multi-asset→pipeline) no longer corrupts authority or consequence — it only mislabels the Asset
Classification field. The classifier drops from cascade-root to cosmetic labeling.
