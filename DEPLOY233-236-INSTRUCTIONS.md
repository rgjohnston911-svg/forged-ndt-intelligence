# DEPLOY233-236 — Bridge Build (GPT Red Team Fixes)

These 4 engines close the production-hardening gaps identified by GPT evaluation.

## What's new

| Deploy | Engine | Purpose |
|--------|--------|---------|
| DEPLOY233 | inspection-report | Report generation — 4 templates, pulls all case data |
| DEPLOY234 | rbac | Role-based access control + multi-tenant isolation |
| DEPLOY235 | validation-engine | 20 test scenarios with known outcomes — proof pack |
| DEPLOY236 | data-ingestion | UT thickness grid import, case import, batch import |

Total engines after deploy: **29**

---

## Deploy order

### Step 1: Run DEPLOY234 migration in Supabase

Open Supabase SQL Editor and paste the contents of `DEPLOY234-migration.sql`.

This creates:
- `organizations` table
- `user_roles` table (with role CHECK constraint)
- Adds `org_id` column to inspection_cases, findings, evidence, escalation_queue
- Indexes on all new columns
- RLS policies on new tables

### Step 2: Paste 4 new function files into GitHub

1. `netlify/functions/inspection-report.ts`
2. `netlify/functions/rbac.ts`
3. `netlify/functions/validation-engine.ts`
4. `netlify/functions/data-ingestion.ts`

### Step 3: Update health.ts

Replace the existing `health.ts` with the updated version that has 29 engines in the registry.

### Step 4: Update public/system-check.html

Replace with the updated version that tests all 29 endpoints.

### Step 5: Commit and wait for Netlify deploy

---

## Smoke tests

### Inspection Report (DEPLOY233)
```
POST /api/inspection-report { "action": "get_templates" }
POST /api/inspection-report { "action": "generate", "case_id": "<real-case-id>" }
POST /api/inspection-report { "action": "generate_summary", "case_id": "<real-case-id>" }
```

### RBAC (DEPLOY234)
```
POST /api/rbac { "action": "get_permissions_matrix" }
POST /api/rbac { "action": "create_org", "org_name": "Test Org", "admin_user_id": "<your-user-id>" }
POST /api/rbac { "action": "get_user_context", "user_id": "<your-user-id>" }
```

### Validation Engine (DEPLOY235)
```
POST /api/validation-engine { "action": "get_scenarios" }
POST /api/validation-engine { "action": "run_all" }
POST /api/validation-engine { "action": "get_proof_pack" }
```

### Data Ingestion (DEPLOY236)
```
POST /api/data-ingestion { "action": "get_field_map" }
POST /api/data-ingestion {
  "action": "import_thickness_grid",
  "data": {
    "component_name": "V-101 Shell Course 2",
    "nominal_thickness": 0.500,
    "code_minimum": 0.250,
    "material": "carbon_steel",
    "asset_type": "pressure_vessel",
    "readings": [
      { "location": "A1", "thickness": 0.485 },
      { "location": "A2", "thickness": 0.472 },
      { "location": "A3", "thickness": 0.310 },
      { "location": "B1", "thickness": 0.490 },
      { "location": "B2", "thickness": 0.445 },
      { "location": "B3", "thickness": 0.380 }
    ]
  }
}
```

---

## RBAC Roles Summary

| Role | Level | Key Permissions |
|------|-------|----------------|
| admin | 5 | Everything — manage org, users, roles, export, audit |
| manager | 4 | All cases, analytics, trends, reports, assign escalations |
| reviewer | 3 | All cases, analytics, reports, resolve escalations, adjudicate |
| technician | 2 | Own cases, create cases, submit findings, adjudicate, escalate |
| viewer | 1 | Read-only access to cases and reports |

---

## Validation Scenarios (20 total)

| Category | Count | What it proves |
|----------|-------|---------------|
| Risk scoring | 3 | Critical/minimal/medium risk calculated correctly |
| Damage ranking | 3 | Hydrogen > corrosion > wear > cosmetic |
| Confidence architecture | 2 | Low/missing confidence increases risk |
| Disposition ranking | 1 | Replace > acceptable |
| Override risk | 1 | Active override increases risk |
| Escalation risk | 1 | Open escalation increases risk |
| Age risk | 1 | Old open cases score higher |
| Code authority | 1 | Endpoint responds with structured data |
| Compliance | 2 | 6 standards present, API 579 has 7 requirements |
| Adjudication | 2 | Empty rationale rejected, invalid type rejected |
| Health | 1 | All engines registered |
| Notifications | 1 | Stats endpoint responds |
| Escalation | 1 | Stats endpoint responds |
