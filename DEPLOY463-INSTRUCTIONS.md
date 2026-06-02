# DEPLOY463 — Asset Identity Gate (the cascade-root fix)

Promotes the signal the platform **already computes** — the Authority Lock's "asset class not
mappable to a governing authority" — into a hard front-of-decision **HALT**. An asset whose
identity can't be authority-anchored now produces an honest HOLD instead of a poisoned cascade
(TEST 33: ESD-7 → bridge_concrete → AASHTO + a corrosion-mechanism wall).

## What changed
- **`netlify/functions/decision-core.ts`** — a new Asset Identity Gate immediately after the
  existing `SUPPORTED_DOMAINS` gate, before any physical/damage/consequence reasoning. If the
  passed-in `authority_lock.status` is anything other than `LOCKED` (i.e., no governing **primary**
  authority could be mapped), decision-core returns a terminal HOLD
  (`asset_identity_unresolved: true`, reusing the `domain_not_supported` render path): no authority,
  mechanism, consequence, disposition, or inspection analysis is produced.
  - **Reuse, don't rebuild:** it consumes the Authority Lock's *existing* determination
    (`status`) — it does not re-derive a matrix.
  - **Halts on uncertainty, never keywords.** No "if SIS/ESD then…" rule.
  - **Offline-safe:** when `authority_lock` is absent (the eval harness passes `null`), the gate
    does not fire — engine-level tests are unaffected.
- Version **v16.16 → v16.17**.

## Why this catches TEST 33 (measured, not assumed)
The live classifier assigned `bridge_concrete` at **confidence 0.8** (an alias-match on "dam"), so a
*soft* low-confidence trigger would have missed it. The reliable signal is the **hard** one:
`bridge_concrete` returns Authority Lock `status = PARTIAL`, no primary authority. The gate halts on
that. (Authority-mappable LOCKED classes — pressure_vessel/process_piping/pipeline/storage_tank/
offshore_platform/heat_exchanger/boiler — pass untouched.)

## Verified (new gate: asset-identity-gate, 6 checks)
| asset / authority status | result |
|---|---|
| bridge_concrete + PARTIAL (TEST 33) | **HOLD** — asset_identity_unresolved, no downstream analysis |
| offshore_platform + UNRESOLVED | **HOLD** |
| pressure_vessel + LOCKED (golden) | proceeds — full assessment |
| pressure_vessel + null authority_lock (offline) | gate inert — proceeds |

## Verification (offline, all green)
- new gate `asset-identity-gate.test.cjs`: 6/6
- `node scripts/run-gates.cjs` → **47 / 47**
- `node scripts/eval-sa.cjs` → 20 / 20 (no regression — gate inert with null authority_lock)
- `npx tsc -b` → clean

## Scope note (honest)
The criterion "no LOCKED primary authority → HOLD" also holds **genuine bridges** (`bridge_steel`/
`bridge_concrete` map AASHTO only as supplemental, never a locked primary in this build). That is
intentional and honest — the platform should not assess what it cannot authority-anchor — but it
means bridge assessment is HOLD-only until a bridge primary authority is mapped (a separate task).
Flag if bridges should be exempted.

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence

```bash
git add netlify/functions/decision-core.ts tests/asset-identity-gate.test.cjs src/pages/VoiceInspectionPage.tsx DEPLOY463-INSTRUCTIONS.md
git commit -m "DEPLOY463: Asset Identity Gate - decision-core HOLDs when authority-lock cannot map a governing authority (status != LOCKED); ESD->bridge_concrete becomes a clean identity HOLD instead of a fabricated cascade; offline-safe; v16.17"
git push
```

## Live check (v16.17)
Re-run **TEST 33** (ESD-7 ammonia). It should now produce a clean **HOLD** — "asset identity not
confidently established / no governing authority for this class — resolve classification before
assessment" — with **no AASHTO header, no CRITICAL/structural consequence, no corrosion/crack
mechanism wall**, and the header-vs-lock contradiction gone. A normal pressure-vessel/piping case
must still produce a full assessment (confirm one as the no-regression check).

## Next (to reach the *right* answer, not just a safe HOLD)
- **Classifier precedence (§2):** classify on the declared "Asset:" identity over incidental
  component keywords, so ESD/SIS stop alias-matching to bridge/vessel.
- **functional_safety class (§3):** ESD/SIS become in-matrix → route to IEC 61511 (citation +
  escalation only) → `NO_DAMAGE_MECHANISM_APPLICABLE`. Then the CP4a recognizer (462, already live)
  reaches "verify the safety function." Freeze TEST 29/31/32/33 as the golden set.
