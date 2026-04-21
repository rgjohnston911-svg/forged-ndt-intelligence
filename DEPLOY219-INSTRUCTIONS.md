# DEPLOY219 — Unified Material Authority Engine

Replaces the single-material DEPLOY218 composite-only pack with a unified engine that detects and assesses **8 material classes** from free-text inspector narratives.

## Material classes covered

1. **Composite Repair** — CFRP, GFRP, bonded wraps (ASME PCC-2, ISO 24817)
2. **Coatings & Surface Systems** — epoxy, FBE, thermal spray, ceramic coatings (NACE, SSPC, ASTM D-series)
3. **Ceramics** — alumina, SiC, CMC, zirconia, refractories (ASTM C-series)
4. **Polymers & Engineering Plastics** — HDPE, PTFE, PEEK, PVC (ASTM D-series, ASME B31.3 Ch. VII)
5. **Elastomers & Rubber** — neoprene, nitrile, EPDM, viton, rubber linings (NACE SP0105)
6. **Advanced Alloys** — titanium, inconel, hastelloy, cu-ni (NACE MR0175, API 579)
7. **Foams & Core Materials** — PU foam, honeycomb, sandwich panels (ASTM C-series)
8. **Hybrid / Smart / Emerging** — nanocomposites, SMA, AM parts (ASTM E3166)

Multiple material classes can fire simultaneously on the same case.

---

## Deploy order

### 1. Run migration
File: `DEPLOY219-migration.sql` in Supabase SQL Editor.
Adds `material_authority_assessment` (jsonb), `material_authority_generated_at` (timestamptz), `material_authority_status` (text).

### 2. Paste function
File: `netlify/functions/material-authority.ts`
Endpoint: `POST /api/material-authority { case_id }`

### 3. Paste component
File: `src/components/MaterialAuthorityCard.tsx`

### 4. Mount on Decision tab in `src/pages/CaseDetail.tsx`

**Import** (with the others):
```
import MaterialAuthorityCard from "../components/MaterialAuthorityCard";
```

**JSX** — immediately after the CompositeRepairCard line:
```
{id && <MaterialAuthorityCard caseId={id} />}
```

---

## Smoke test on the riser case

1. Open NDT-1776299065297 (the riser with composite wrap + coating data).
2. Decision tab → Material Authority Engine → **Scan for materials**.
3. Expected: detects **composite_repair** AND **coatings** (the inspection_context mentions both composite wrap signals and coating blistering/breakdown signals). Should show mechanisms from both classes merged into one view.

---

## Architecture

- Single function, single card, 8 material modules
- Router runs all modules against the case haystack
- Multiple classes can fire simultaneously (e.g., composite wrap + coatings on same riser)
- Results merged: mechanisms, authority codes, and inspection plans are deduplicated
- Status resolution: any HIGH mechanism → "failed"; any mechanism → "suspect"; none → "intact"
- Each module is self-contained — new classes can be added by writing one function + one presence array + registering in ALL_MODULES
