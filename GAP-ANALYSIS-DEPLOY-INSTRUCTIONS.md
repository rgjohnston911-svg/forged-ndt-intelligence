# GAP ANALYSIS DEPLOYMENT — Standards Update + Cross-Engine Consistency Fix

**Date:** 2026-05-01
**Scope:** 3 files updated — no new engines, no SQL migration, no health.ts changes
**Risk:** LOW — data-only changes (editions, clause references, acceptance criteria)
**Rollback:** Revert 3 files to previous commit

---

## What Changed

### Summary

A full cross-system gap analysis identified and fixed:

| Issue | Count | Files |
|-------|-------|-------|
| Duplicate STANDARDS_DB entries removed | 4 | live-code-authority.ts |
| Incorrect edition corrected (API 653) | 1 | live-code-authority.ts |
| Stale editions updated to current | 10 | live-code-authority.ts, nde-image-analysis.ts |
| Missing CLAUSE_LIBRARY entries added | 22 | universal-code-authority.ts |
| Missing CODE_MAPPINGS added | 2 | universal-code-authority.ts |
| Missing ACCEPTANCE_CRITERIA added | 2 | nde-image-analysis.ts |

### Editions Updated

| Standard | Was | Now |
|----------|-----|-----|
| API 650 | 13th Edition (2020) | 14th Edition (2025) |
| API 653 | **6th Edition (2022) — WRONG** | 5th Edition (2014), Addendum 4 (2022) |
| API 510 | 11th Edition (2022) | 11th Edition (2022), Errata 2 (2025) |
| AWS D1.5 | 2020 (8th Edition) | 2025 (9th Edition) |
| AWS D1.8 | 2016 (2nd Edition) | 2025 (5th Edition) |
| AWS D17.1 | 2017 (2nd Edition) | 2024 (4th Edition) |
| ASME BPVC V | 2023 Edition | 2025 Edition |
| ASME BPVC VIII | 2023 Edition | 2025 Edition |
| ASME BPVC III | 2023 Edition | 2025 Edition |
| ASME BPVC XI | 2023 Edition | 2025 Edition |

### Duplicates Removed (live-code-authority.ts)

| Standard | Removed Entry | Kept Entry |
|----------|--------------|------------|
| API 1104 | Line 88 (year: 2019) | Line 121 (year: 2021) — correct |
| ASME B31.3 | Line 93 (2022 Edition) | Line 135 (2024 Edition) — current |
| ASME B31.4 | Line 94 (narrow domains) | Line 136 (expanded domains) |
| ASME B31.8 | Line 95 (narrow domains) | Line 137 (expanded domains) |

### New CLAUSE_LIBRARY Entries (universal-code-authority.ts)

22 entries added — all 47 CODE_MAPPINGS now have matching CLAUSE_LIBRARY coverage:

NRC_10CFR50, FAA_AC43, OSHA_PSM, DOT_PHMSA, NBIC, AWS_D13, AWS_D36M, ASME_VIII, ASME_B313, ASME_B3112, DNV_GL, DNV_OS_C401, API_RP_2A, AASHTO_MBE, IBC, NACE_SP0188, ISO_8501, NACE_SP0198, ISO_24817, ASTM_E3166, ASME_XI, API_571 + API_653, API_1104

### New CODE_MAPPINGS (universal-code-authority.ts)

- `ASME_XI` — Nuclear in-service inspection (triggers: nuclear assets, ISI conditions)
- `API_571` — Damage mechanism identification (triggers: refinery/petrochemical, corrosion/cracking)

### New ACCEPTANCE_CRITERIA (nde-image-analysis.ts)

- `aws_d3_6m` — Underwater welding (Class A/B/O acceptance levels)
- `asme_b31_12` — Hydrogen piping (restrictive criteria for H2 service)

---

## Deployment Steps

### Step 1: Paste Files (3 files, order doesn't matter)

```
netlify/functions/live-code-authority.ts    — FULL REPLACE
netlify/functions/nde-image-analysis.ts     — FULL REPLACE
netlify/functions/universal-code-authority.ts — FULL REPLACE
```

### Step 2: Commit & Deploy

```bash
git add netlify/functions/live-code-authority.ts \
       netlify/functions/nde-image-analysis.ts \
       netlify/functions/universal-code-authority.ts
git commit -m "GAP-ANALYSIS: Fix 4 duplicates, update 10 editions, add 22 clause entries, 2 acceptance criteria, 2 code mappings"
git push origin main
```

### Step 3: Verify

After Netlify deploys (~90 seconds):

1. Hit `/api/live-code-authority` with `{"query": "API 650"}` — confirm returns "14th Edition"
2. Hit `/api/live-code-authority` with `{"query": "API 653"}` — confirm returns "5th Edition" (NOT 6th)
3. Hit `/api/universal-code-authority` with a nuclear case — confirm ASME_XI appears in applicable codes
4. Hit `/api/nde-image-analysis` with underwater weld image — confirm aws_d3_6m criteria apply

### No SQL Migration Required
### No health.ts Changes Required
### No system-check.html Changes Required

---

## Verification Performed

- All 3 files pass TypeScript compilation with zero errors
- No duplicate STANDARDS_DB entries remain
- All 47 CODE_MAPPINGS have matching CLAUSE_LIBRARY entries (was 25/45)
- All editions cross-checked against live-code-authority ↔ nde-image-analysis
- last_updated timestamp set to 2026-05-01
