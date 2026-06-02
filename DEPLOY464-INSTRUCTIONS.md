# DEPLOY464 — functional_safety asset class (§2/§3): SIS/ESD route to IEC 61511, not API 510/AASHTO

The ceiling on the safety-function trio. With the Asset Identity Gate (463) making an ESD HOLD
*safely*, this makes it reach the *right* answer: an ESD/SIS now classifies as a functional-safety
asset, locks to IEC 61511 (in-matrix → passes the gate), and the CP4a recognizer concludes "verify
the safety function."

## What changed (3 files)
1. **`netlify/functions/resolve-asset.ts`** — added a `functional_safety` class with **declared-
   identity aliases**: `emergency shutdown system`, `safety instrumented system`, `safety
   instrumented function`, `burner management system`, `high integrity pressure protection`, `logic
   solver` (weights 12–16). **Full phrases only** — never bare acronyms (SIS/ESD/SIF), because the
   matcher is substring-based and "basis" contains "sis". These name the *asset*, so the declared
   identity outweighs incidental component/context matches (e.g. ESD-7's stray "dam" → bridge_concrete).
2. **`netlify/functions/authority-lock.js`** — `functional_safety` → **IEC 61511 + ISA 84** (locked
   primary) + **OSHA PSM 29 CFR 1910.119** (regulatory). Status LOCKED → in-matrix → passes the
   Asset Identity Gate. **Cite + escalate only:** the platform names these and escalates to a
   functional safety engineer; it does **not** compute SIL or run LOPA.
3. **`netlify/functions/decision-core.ts`** — added `functional_safety` to `SUPPORTED_DOMAINS`.

## The full chain (measured)
`Emergency Shutdown System (ESD-7)` and `Safety Instrumented System SIS-204` → **functional_safety**
(conf 0.9, beating "dam"/"pressure transmitter") → authority **LOCKED, IEC 61511 + ISA 84** → passes
the Asset Identity Gate → decision-core proceeds → CP3 evidence gates suppress mechanisms (no damage)
→ the CP4a assurance recognizer sets assurance UNKNOWN_STATE → governing reality = **"verify the
safety function per IEC 61511."** Cascade-root → correct conclusion.

## §2 over-classification guard (verified)
A pressure vessel that merely *mentions* "an emergency shutdown valve and a high-pressure interlock"
(with real wall loss) stays a physical asset — it does NOT flip to functional_safety, because no full
safety-function declared-identity phrase is present and "shutdown valve"/"interlock" are deliberately
not aliases. This is the directive's guardrail against the substring/keyword trap.

## Verified (new gate: functional-safety-class, 7 checks)
- ESD / SIS / BMS → functional_safety; vessel-mentioning-ESD-valve stays physical.
- functional_safety → LOCKED, primary IEC 61511; does NOT route to API 510 / ASME VIII / AASHTO.

## Verification (offline, all green)
- new gate `functional-safety-class.test.cjs`: 7/7
- `node scripts/run-gates.cjs` → **48 / 48**
- `node scripts/eval-sa.cjs` → 20 / 20 (no regression — zero golden-case collisions with the new aliases)
- `npx tsc -b` → clean
- Version **v16.17 → v16.18**.

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence

```bash
git add netlify/functions/resolve-asset.ts netlify/functions/authority-lock.js netlify/functions/decision-core.ts tests/functional-safety-class.test.cjs src/pages/VoiceInspectionPage.tsx DEPLOY464-INSTRUCTIONS.md
git commit -m "DEPLOY464: functional_safety asset class - SIS/ESD declared-identity -> IEC 61511/ISA 84 LOCKED (cite+escalate, no SIL/LOPA); passes the Asset Identity Gate so the assurance recognizer concludes 'verify the safety function'; full-phrase aliases only; v16.18"
git push
```

## Live check (v16.18) — the conclusion check on the trio
Re-run **TEST 33** (ESD-7), **TEST 31/32** (SIS), **TEST 29** (ESD): asset class should now read
**functional_safety**, authority **IEC 61511 / ISA 84 / OSHA PSM** (no API 510/AASHTO, no corrosion
wall), and the Governing Reality should conclude **"A safety-function assurance failure governs …
verify the safety function per IEC 61511 … escalate to a functional safety engineer."** A normal
pressure-vessel/piping case must still produce its full physical assessment (no-regression).

## Status of the finite list
The cascade is closed end-to-end: contest (CP1–3) + assurance recognizer (CP4a) + Asset Identity Gate
+ functional_safety class. Remaining smaller items: **CP4b** regulatory routing (TEST 30), the
**Gulf-of-Mexico jurisdiction word-boundary** fix, and an optional deeper declared-identity-precedence
refactor (the high-weight aliases cover the clear SIS/ESD cases today). Then freeze TEST 29/30/31/32/33
as the golden acceptance set.
