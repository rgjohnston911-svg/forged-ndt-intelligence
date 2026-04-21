# DEPLOY261: Authority Lock System v1.0.0

## What This Does
"Which exact clause governs this disposition?" — the question that separates a legal inspection record from an opinion. This engine pins the specific table, row, section, or paragraph of the governing code before any accept/reject decision is allowed. No disposition without a locked clause.

D1.1 Table 8.1 (static) vs Table 8.2 (cyclic) — different undercut limits, different porosity limits, completely different outcomes. API 1104 Section 9.3.8 — cracks prohibited regardless. ASME VIII UW-51 — RT acceptance with thickness-dependent slag limits. This engine knows which one governs and locks it before the system says accept or reject.

## 10 Capabilities
1. **Get Registry** — engine overview and capabilities
2. **Get Editions** — list active code editions with year and issuing body (9 editions seeded)
3. **Get Clauses** — list all clauses for a code family with category filtering
4. **Lookup Clause** — find the governing clause for a weld context (code + loading + joint + discontinuity + method) using scored matching algorithm
5. **Lock Authority** — lock a specific clause to an assessment with full context snapshot
6. **Get Lock** — retrieve active authority lock(s) for an assessment; blocks disposition if no lock exists
7. **Verify Lock** — verify lock validity (edition still active, clause not superseded)
8. **Get Clause Criteria** — get specific acceptance/rejection criteria within a locked clause
9. **Get Clause History** — full audit trail of all lock events for an assessment
10. **Compare Clauses** — compare governing clauses across multiple codes for the same scenario with strictness ranking

## Coverage

### 9 Code Editions Tracked
AWS D1.1 (2020), AWS D1.2 (2019), AWS D1.3 (2018), AWS D1.5 (2020), AWS D1.6 (2017), API 1104 (2021), ASME VIII (2023), ASME B31.3 (2022), ASME IX (2023)

### 50+ Clauses Seeded Across All Codes
- **AWS D1.1:** Tables 8.1, 8.2 (visual static/cyclic), Tables 6.1-6.4 (RT/UT static/cyclic), Clauses 3.7.3, 5.22, 5.24, 5.24.1, Tables 8.9-8.10 (tubular)
- **AWS D1.2:** Tables 8.1-8.2 (aluminum visual), Clauses 3.7, 5.3
- **AWS D1.3:** Table 4.1 (sheet steel), Clauses 2.5, 3.2, 4.3
- **AWS D1.5:** Tables 6.1-6.3 (bridge VT/RT/UT), Clause 12 (fracture critical), Clause 5.18
- **AWS D1.6:** Table 6.1 (stainless), Clauses 3.4, 5.6
- **API 1104:** Sections 9.3 through 9.3.9, Table 1, Section 9.7, Appendix A (ECA)
- **ASME VIII:** UW-33, UW-35, UW-40, UW-51, UW-52, UW-53, UCS-56, UG-93
- **ASME B31.3:** Tables 341.3.2, 341.3.2A, Clauses 328, 331, 341.4, Chapter IX M323
- **ASME IX:** QW-150, QW-160, QW-190, QW-200, QW-250

### 12 Clause Categories
visual_acceptance, rt_acceptance, ut_acceptance, mt_pt_acceptance, weld_size, preheat, interpass, joint_design, qualification, procedure, repair, general_requirement

### Detailed Acceptance Criteria Seeded
- D1.1 Table 8.1 (static): 10 criteria including crack/IF/IP prohibited, undercut max 1mm, porosity max 2.4mm
- D1.1 Table 8.2 (cyclic): 8 criteria — stricter undercut (0.25mm), no underfill, no piping porosity
- API 1104 Section 9.3: 7 criteria including crack prohibited, IP max 25mm, burnthrough max 6.4mm
- ASME VIII UW-51: 5 criteria including crack/IF/IP prohibited, thickness-dependent slag limits

## Deploy Steps

### Step 1: SQL Migration
Run in Supabase SQL Editor:
- File: `supabase/migrations/DEPLOY261_authority_lock_system.sql`
- Creates 6 tables: authority_code_editions, authority_clause_registry, authority_clause_conditions, authority_clause_criteria, authority_locks, authority_lock_audit
- Seeds 9 editions, 50+ clauses, acceptance criteria, clause conditions
- Reference tables have read-only policies; lock/audit tables have org isolation

### Step 2: Netlify Function
Paste into GitHub:
- File: `netlify/functions/authority-lock-system.ts`
- 10 actions (see above)

### Step 3: Health Registry
Paste updated file:
- File: `netlify/functions/health.ts`
- Now has 54 engines

### Step 4: System Check
Paste updated file:
- File: `public/system-check.html`
- Now tests 54 endpoints

## Test After Deploy
Visit: https://4dndt.netlify.app/system-check.html
Expected: 54 PASS (Ctrl+Shift+R to hard refresh)

## How the Clause Lookup Algorithm Works

The lookup engine scores each candidate clause against the provided context:

- **Code family match** — must match (eliminates non-matching codes)
- **Loading condition** — +30 if loading matches clause's applies_to_loading array
- **Joint type** — +20 if joint type matches clause's applies_to_joint_types array
- **Discontinuity type** — +25 if the discontinuity is in the clause's coverage list
- **Examination method** — +25 if method maps to clause's governs_category (VT→visual, RT→rt, UT→ut, MT/PT→mt_pt)
- **Mandatory flag** — +5 for mandatory clauses
- **Priority rank** — bonus for lower rank numbers

The highest-scoring clause becomes the governing clause. Up to 3 alternatives are returned with explanations of why they scored lower.

## Key Architectural Principle

**No disposition without a locked clause.** The get_lock action returns `disposition_allowed: true/false`. If no active lock exists for an assessment, the system blocks the disposition and returns: "No active authority lock. Disposition BLOCKED until a governing clause is locked."

This means:
1. `lookup_clause` → finds the governing clause
2. `lock_authority` → locks it to the assessment with context snapshot
3. `get_lock` → confirms lock exists → disposition proceeds
4. `verify_lock` → confirms edition is still current before final sign-off

Every lock is audited. Every superseded lock is preserved. Full traceability from disposition to code clause.
