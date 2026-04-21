# DEPLOY222 — Universal Code Authority Engine

Deterministic 5-tier precedence resolver that identifies which inspection codes govern each case. Maps asset type, industry, findings, and conditions to a hierarchy of regulatory, jurisdictional, industry, owner, and best-practice codes — then resolves conflicts and assigns clause-level references.

## What it does

Given a case's asset type, industry, findings, and material status, the engine:

1. **Identifies applicable codes** from 19 seeded standards across 5 tiers
2. **Ranks by precedence** (Tier 1 regulatory > Tier 2 jurisdictional > Tier 3 industry > Tier 4 owner > Tier 5 best practice)
3. **Resolves conflicts** when multiple codes apply at the same tier (CONSERVATIVE_MERGE — stricter requirement wins)
4. **Assigns governing set** with primary/supplementary/reference roles
5. **Matches specific clauses** from the built-in clause library (API 510, 570, 579, PCC-2, AWS D1.1, NACE MR0175)
6. **Determines authority level**: regulatory, jurisdictional, code_authoritative, provisional, or advisory

## Deploy order

### 1. Run migration
File: `DEPLOY222-migration.sql` in Supabase SQL Editor.
Adds: `code_authority_result` (jsonb), `code_authority_generated_at`, `governing_codes` (jsonb), `precedence_tier` (text), `authority_conflicts` (jsonb) to inspection_cases.
Creates: `code_sets` table with 19 seeded standards.

### 2. Paste function
File: `netlify/functions/universal-code-authority.ts`
Endpoint: `POST /api/universal-code-authority { case_id }`

### 3. Paste component
File: `src/components/UniversalCodeAuthorityCard.tsx`

### 4. Mount on Decision tab in `src/pages/CaseDetail.tsx`

**Import** (with the others, around line 25):
```
import UniversalCodeAuthorityCard from "../components/UniversalCodeAuthorityCard";
```

**JSX** — immediately after the OutcomeSimulationCard line (~line 737):
```
{id && <UniversalCodeAuthorityCard caseId={id} />}
```

---

## Smoke test on the riser case

1. Open NDT-1776299065297 (the riser with 12 thickness readings).
2. Decision tab → Universal Code Authority → **Resolve Code Authority**.
3. Expected results:
   - **Authority Level**: CODE AUTHORITATIVE (Tier 3 industry codes match)
   - **Governing Codes**: API 510 (primary), API 579 (supplementary), ASME PCC-2 (supplementary if composite repair keywords present)
   - **Applicable Clauses**: Multiple clauses from API 510 (general inspection, external corrosion, CML) and API 579 (Part 4 wall loss, Part 5 local thin areas)
   - **Tier Overlaps**: 1 overlap at Tier 3 (multiple industry codes), resolution: CONSERVATIVE_MERGE
   - **Precedence Hierarchy**: Shows all matched codes as color-coded tier chips
   - **Resolution Trace**: 6 steps showing code count at each stage
   - **DETERMINISTIC** badge visible

---

## Architecture

- Runs ALONGSIDE run-authority.ts (does not replace it)
- This engine determines WHICH codes apply; run-authority evaluates evidence AGAINST those codes
- 5-tier precedence: lower tier number = higher authority
- Trigger matching: asset_types, industries, conditions, regions checked against case text fields + findings
- Clause library: specific section/paragraph references for major codes
- Conflict resolution: same-tier overlaps flagged, stricter requirement governs
- Fallback chain: if no codes match, defaults to ASME Section V general NDE requirements
- Results persisted to inspection_cases for downstream use by decision-spine and dashboard
