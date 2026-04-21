# DEPLOY264: Reality Lock Domain Gating v1.0.0

## What This Does
"Does the system ACTUALLY know enough to evaluate this combination?" — the honesty engine. Declares which process x position x material x code combinations are fully supported, limited, or completely unsupported. When the system doesn't have reliable data for a combination, it says so instead of producing a confident-sounding wrong answer.

55+ supported combinations seeded across 8 processes, 15 positions, 10 materials, and 7 code families. 10 known domain gaps documented with workarounds and resolution plans. Every gate check is audited.

## 10 Capabilities
1. **Get Registry** — engine overview
2. **Gate Check** — validate a combination: proceed / proceed_with_warnings / degraded_mode / blocked
3. **Get Combinations** — list all registered domain combinations with filtering
4. **Get Gaps** — list all known domain gaps
5. **Get Coverage Matrix** — full coverage matrix for a code family
6. **Get Support Summary** — aggregate statistics of what the system supports
7. **Add Combination** — register a new supported combination
8. **Report Gap** — report a new domain gap
9. **Resolve Gap** — mark a gap as resolved
10. **Get Gate History** — audit trail of all gate checks

## Support Levels
- **Full** (90-100% confidence) — code + physics + acceptance criteria + repair pathways all modeled
- **Validated** (80-95%) — covered and tested, some edge cases may exist
- **Limited** (60-80%) — partial coverage, known limitations affect accuracy
- **Experimental** (30-60%) — minimal coverage, results are estimates only
- **Unsupported** (0%) — system refuses to evaluate

## Gate Results
- **proceed** — full support, evaluation uses complete physics model
- **proceed_with_warnings** — supported with known limitations displayed
- **degraded_mode** — limited coverage, reduced confidence, manual verification needed
- **blocked** — not supported, system refuses to evaluate

## Seeded Coverage

### Fully Supported (high confidence)
- SMAW on carbon steel in all positions under D1.1, D1.5, API 1104, ASME VIII, B31.3
- GMAW on carbon steel in flat/horizontal/vertical under D1.1
- GMAW on sheet steel under D1.3
- FCAW-G/FCAW-S on carbon steel under D1.1
- GTAW on carbon/stainless steel under D1.1, D1.6, ASME IX, B31.3
- SAW on carbon steel flat/horizontal under D1.1, ASME VIII

### Limited Support (proceed with warnings)
- GMAW on aluminum under D1.2 (porosity risk, shielding critical)
- GMAW-P on stainless under D1.6 (interpass/sensitization)
- GMAW on sheet aluminum under D1.3 (extreme burnthrough risk)
- GTAW on titanium (trailing shield, contamination)
- GTAW on nickel alloys (hot cracking)
- RSW on sheet steel (VT limitations)
- OFW on carbon steel (legacy process)
- LBW on carbon steel (narrow weld, difficult VT)

### Blocked (system refuses)
- EBW (vacuum process, no photo-based evaluation)
- FSW (solid-state, different defect paradigm)
- RSW on sheet aluminum (no reliable VT criteria)

## 10 Known Domain Gaps
- GAP-001: EBW not modeled (blocking)
- GAP-002: FSW not modeled (blocking)
- GAP-003: Titanium limited acceptance criteria (degraded)
- GAP-004: Duplex stainless not fully modeled (degraded)
- GAP-005: Cast iron repair pathways missing (degraded)
- GAP-006: RSW aluminum no acceptance criteria (blocking)
- GAP-007: AWS D1.4 (rebar) not in code system (blocking)
- GAP-008: LBW limited VT applicability (degraded)
- GAP-009: 6GR position not fully validated (warning)
- GAP-010: Brazing not modeled in weld engine (degraded)

## Deploy Steps

### Step 1: SQL Migration
Run in Supabase SQL Editor:
- File: `supabase/migrations/DEPLOY264_reality_lock_domain.sql`
- Creates 4 tables: domain_combination_registry, domain_gap_registry, domain_validation_checks, domain_audit_events
- Seeds 55+ combinations and 10 known gaps
- Click "Run and enable RLS"

### Step 2: Netlify Function
Paste into GitHub:
- File: `netlify/functions/reality-lock-domain.ts`
- 10 actions (see above)

### Step 3: Health Registry
Paste updated file:
- File: `netlify/functions/health.ts`
- Now has 57 engines

### Step 4: System Check
Paste updated file:
- File: `public/system-check.html`
- Now tests 57 endpoints

## Test After Deploy
Visit: https://4dndt.netlify.app/system-check.html
Expected: 57 PASS (Ctrl+Shift+R to hard refresh)

## How the Gate Check Works

1. **Exact match search** — look for the exact process + position + material + code_family combination
2. **Partial match fallback** — if no exact match, find the closest partial matches (same process + material, same process + code)
3. **Gap check** — scan the gap registry for any gaps that apply to this combination
4. **Determine gate result** — full/validated → proceed; limited → proceed_with_warnings; experimental/no match → degraded_mode; unsupported/blocking gap → blocked
5. **Build message** — clear explanation of what the system can and cannot do for this combination
6. **Audit** — log the gate check with all context

## Architectural Principle

This engine exists because confident wrong answers are more dangerous than honest uncertainty. A Level III inspector who says "I don't know, let me research it" is more trustworthy than one who makes up an answer. The system follows the same principle.
