# DEPLOY272: Weld Acceptance Authority v2.0.0 "Smartest CWI Core"

**Date:** 2026-04-21
**Engine:** weld-acceptance-authority (rebuilt — no new engine number)
**Platform Version:** FORGED-NDT/2.0.0

---

## Overview

Complete rebuild of the Weld Acceptance Authority engine from v1.0.0 to v2.0.0. All core logic is now hardcoded in the function file — same pattern as live-code-authority.ts. No database dependency for standards, criteria, or physics rules.

**What changed:**
- 12 welding codes with real numeric acceptance criteria (was: conditional notes)
- 65+ discontinuity types with ISO 6520 taxonomy (was: 25 types from DB)
- 15 material families with weldability data (was: DB lookup)
- 15 welding processes with physics (was: DB lookup)
- 18 joint configurations (was: DB lookup)
- 7 service condition modifiers — sour, cryogenic, cyclic, seismic, lethal, hydrogen, high-temp (was: none)
- 10 damage progression models (was: none)
- 5 repair method families with step-by-step procedures (was: inline strings)
- 15 API actions (was: 12)

**New actions:** get_code_library, get_service_conditions, get_damage_models, get_repair_methods

**Acceptance criteria now include real numbers:**
- AWS D1.1: undercut static max 1.6mm (0.8mm if t<25mm), cyclic max 0.25mm
- API 1104: burn-through max 6.4mm, undercut max 0.8mm or 12.5% wall
- ASME VIII: undercut max 0.8mm, porosity max 4.8mm per Appendix 4
- ISO 5817: Quality levels B/C/D with specific limits
- And many more per code

---

## Step 1: Push to GitHub & Deploy

```bash
cd "NDT Platform"
git add .
git commit -m "DEPLOY272: Rebuild Weld Acceptance Authority v2.0.0 — Smartest CWI Core"
git push origin main
```

Netlify auto-deploys on push.

### Updated Files

- `netlify/functions/weld-acceptance-authority.ts` — Complete rebuild v2.0.0
- `netlify/functions/health.ts` — Updated deploy tag to DEPLOY272

### No SQL Migration Required

All knowledge is hardcoded. Existing `weld_assessments` and `weld_audit_events` tables are compatible.

---

## Step 2: Verify

1. Go to `https://4dndt.netlify.app/system-check.html`
2. Click **Run Full System Check**
3. Confirm 64 endpoints respond (all PASS)

### Quick Smoke Tests

```
POST /api/weld-acceptance-authority  →  { "action": "get_registry" }
POST /api/weld-acceptance-authority  →  { "action": "get_code_library" }
POST /api/weld-acceptance-authority  →  { "action": "get_discontinuity_registry" }
POST /api/weld-acceptance-authority  →  { "action": "get_service_conditions" }
POST /api/weld-acceptance-authority  →  { "action": "get_damage_models" }
```

### Test Acceptance Check

```json
POST /api/weld-acceptance-authority
{
  "action": "check_acceptance",
  "discontinuity_key": "undercut",
  "code_key": "aws_d1_1",
  "measured_value": 2.0,
  "loading_condition": "static",
  "thickness": 30
}
```
Expected: REJECT (2.0mm > 1.6mm limit for static, t>=25mm)

```json
POST /api/weld-acceptance-authority
{
  "action": "check_acceptance",
  "discontinuity_key": "undercut",
  "code_key": "aws_d1_1",
  "measured_value": 0.5,
  "loading_condition": "static",
  "thickness": 30
}
```
Expected: ACCEPT (0.5mm < 1.6mm limit)

### Test Service Condition Override

```json
POST /api/weld-acceptance-authority
{
  "action": "check_acceptance",
  "discontinuity_key": "arc_strike",
  "code_key": "api_1104",
  "service_conditions": ["sour_service"]
}
```
Expected: REJECT (arc strikes not permitted in sour service per NACE MR0175)

---

## Code Editions (as of 2025)

| Code | Current Edition |
|------|----------------|
| AWS D1.1 | 2025 (26th Edition) |
| AWS D1.2 | 2014 (5th Edition) |
| AWS D1.3 | 2018 (2nd Edition) |
| AWS D1.5 | 2015 (7th Edition) |
| AWS D1.6 | 2017 (2nd Edition) |
| AWS D1.8 | 2025 (3rd Edition) |
| API 1104 | 22nd Edition (2021) |
| ASME VIII | 2025 Edition |
| ASME IX | 2025 Edition |
| ASME B31.1 | 2024 Edition |
| ASME B31.3 | 2024 Edition |
| ISO 5817 | 4th Edition (2023) |

These editions are maintained via the Live Code Authority auto-update pattern.
