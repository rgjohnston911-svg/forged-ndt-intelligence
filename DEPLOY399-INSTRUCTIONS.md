# DEPLOY399 - Authority resolver fix: "Primary Authority: UNRESOLVED" contradiction

## Source: live-pack LNG transfer-line case (TEST 4)
GPT 8/10. Beyond the governing-mechanism point (already handled by DEPLOY397/398),
the eval flagged a NEW, concrete bug: **"Page 1 says Primary Authority: UNRESOLVED,
even though page 2 correctly identifies API 570 and ASME B31.3. That needs cleanup."**

## Root cause (two disagreeing authority lenses)
The report has TWO authority resolvers:
- decision-core's `resolveAuthorityReality` -> drives the **page-1 header**
  (`authority_reality.primary_authority`).
- `authority-lock.js` -> drives the **page-2 code list** (`authority_chain`).

decision-core's `AUTHORITY_MAP` keys its piping entry on `ac: ["piping"]`, but the
classifier emits `process_piping`. The matcher compares `assetClass` LITERALLY, so
`process_piping` matched no class and (for an LNG transcript lacking the literal word
"piping") no keyword either -> fell through to `UNRESOLVED`. Meanwhile authority-lock
normalized correctly and locked API 570 + ASME B31.3. Same-asset, two answers.
(decision-core already HAS a `FAMILIES` table that knows process_piping->piping; it
just was never applied in the authority resolver.)

## Fix (two layers - root cause + guarantee)
1. **Root cause (decision-core.ts):** `resolveAuthorityReality` now normalizes
   classifier asset-class SYNONYMS to the AUTHORITY_MAP canonical heads before
   matching (`process_piping`/`piping_system`/`process_pipe`/`pipe` -> `piping`;
   `vessel`/`pv`/... -> `pressure_vessel`; `exchanger`/`hx`/... -> `heat_exchanger`;
   `atmospheric_tank`/... -> `storage_tank`; `platform`/`jacket`/... ->
   `offshore_platform`; `bridge_steel`/... -> `bridge`; `railcar`/... -> `rail`).
   **piping and pipeline are kept DISTINCT** (different code regimes: B31.3 vs
   B31.4/B31.8) - only intra-regime synonyms collapse.
2. **Guarantee (VoiceInspectionPage.tsx):** the page-1 "Primary Authority" header now
   reconciles with authority-lock - if decision-core returns UNRESOLVED/empty (or an
   object), the header shows authority-lock's locked codes instead. The header can
   never again contradict the code list later in the report, regardless of which
   resolver misses. Also handles `primary_authority` returned as an object `{code}`.

## Verification (real `resolveAuthorityReality`, transpiled offline)
- process_piping + LNG transcript -> **API 570 + ASME B31.3** (was UNRESOLVED). <- fix
- piping -> API 570 + ASME B31.3 (unchanged)
- **pipeline -> ASME B31.4/B31.8 + 49 CFR 192/195** (NOT collapsed into piping)
- pressure_vessel / vessel -> API 510 + ASME Section VIII
- storage_tank -> API 653
- truly-unknown class, no keyword -> UNRESOLVED (correct refusal preserved)
- tsc -b clean; 23/23 regression locks pass; benchmark (cls 49/50 / org 100 /
  forecast 100) and jurisdiction (50/50) unchanged.

## Note - this commit also carries DEPLOY398 (not yet pushed)
DEPLOY398 (disposition_driver + HIC word-boundary fix) and DEPLOY399 both edit
`src/pages/VoiceInspectionPage.tsx`, so they are entangled in the working tree.
Commit them together (recommended) using the command below.

## Files
- netlify/functions/decision-core.ts            (DEPLOY399 - asset-class normalization in resolveAuthorityReality)
- netlify/functions/failure-mode-dominance.js   (DEPLOY398 - disposition_driver + HIC word-boundary)
- src/pages/VoiceInspectionPage.tsx             (DEPLOY398 banners + DEPLOY399 authority reconciliation)
- DEPLOY398-INSTRUCTIONS.md, DEPLOY399-INSTRUCTIONS.md

## Commit (combined 398 + 399)
```bash
git pull
npx tsc -b
git add netlify/functions/decision-core.ts netlify/functions/failure-mode-dominance.js src/pages/VoiceInspectionPage.tsx DEPLOY398-INSTRUCTIONS.md DEPLOY399-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY398+399 - Decision-layer + authority fixes from live-pack TEST 3/4. (398) FMD emits disposition_driver naming the unresolved suspected-crack risk as what governs the HOLD (not wall thickness); report adds DISPOSITION DRIVER banner + qualifies GOVERNING as confirmed-mechanism; word-boundary-gates hic/ssc/sohic transcript scans so 'thickness' no longer flags HIC. (399) decision-core resolveAuthorityReality normalizes classifier asset-class synonyms (process_piping->piping etc., piping!=pipeline) so process piping resolves to API 570 + ASME B31.3 instead of UNRESOLVED; page-1 Primary Authority header reconciles with authority-lock so it can't contradict the code list. tsc clean; 23/23 locks; benchmark/jurisdiction unchanged."
git push
```
Paste the push output, then re-run TEST 4 to confirm page 1 now reads
"Primary Authority: API 570 + ASME B31.3" (matching page 2) and shows the
DISPOSITION DRIVER / SUSPECTED GOVERNING banners.

## Why this matters
This is the Arbiter principle applied to a real defect: two lenses (decision-core
authority vs authority-lock) disagreed, and the platform showed the contradiction
instead of reconciling it. The fix closes the taxonomy gap at the source AND
guarantees the surfaces agree - exactly the kind of cross-lens reconciliation the
Decision Arbiter is meant to own. The process_piping->piping miss was not LNG-specific;
it would have mis-fired UNRESOLVED on any process-piping asset, so this is a broad fix.
