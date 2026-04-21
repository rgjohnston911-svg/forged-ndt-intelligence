# DEPLOY227 — Case Search & Analytics Engine

Lets managers (and eventually other roles) search across all cases by material, asset type, inspection method, damage type, date range, severity, confidence, override status, and free text. Returns paginated results and aggregate analytics with breakdowns.

## What it does

Three actions:

1. **search** — Filter and paginate cases. Any combination of filters. Sortable by any field. Returns matching cases with pagination info.

2. **analytics** — Same filters, but returns aggregate stats: disposition breakdown, material breakdown, method breakdown, damage type breakdown, override rate, confidence stats, and monthly trend data.

3. **filter_options** — Returns all distinct values for each filterable field. Used to populate dropdown menus in the UI.

### Available filters (all optional, combined with AND):
- `date_from` / `date_to` — date range
- `status` — open, closed, in_progress, etc.
- `disposition` — repair, replace, monitor, acceptable, etc.
- `state` — system state/decision
- `material` — material type (Carbon Steel, Stainless 316, etc.)
- `material_family` — ferrous, non-ferrous, composite, etc.
- `asset_type` — pipe, vessel, tank, weld, flange, etc.
- `component` — component name
- `inspection_method` — UT, RT, MT, PT, VT, ET, PAUT, TOFD, etc.
- `damage_type` — corrosion, erosion, fatigue, creep, SCC, etc.
- `severity` — critical, major, minor, acceptable
- `confidence_min` / `confidence_max` — confidence score range (0-1)
- `inspector_override` — true/false
- `has_adjudication` — true/false
- `search_text` — free text search across multiple fields

## Deploy order

### 1. Run migration
File: `DEPLOY227-migration.sql` in Supabase SQL Editor.
Adds: `material_family`, `asset_type`, `inspection_method`, `damage_type`, `severity`, `material`, `component_name`, `notes` columns to `inspection_cases` (skips any that already exist).
Creates: Performance indexes for all searchable fields.

### 2. Paste function
File: `netlify/functions/case-search.ts`
Endpoint: `POST /api/case-search { action, filters, sort, page, page_size }`

### 3. Update health.ts
Add to CRITICAL_TABLES array:
(No new tables — uses existing inspection_cases)

Add to ENGINE_REGISTRY array:
```
{ name: "case-search", deploy: "DEPLOY227", mode: "deterministic", path: "/api/case-search" }
```

---

## Smoke test

1. Call search with no filters — should return all cases:
```
POST /api/case-search { "action": "search" }
```

2. Call analytics with no filters — should return breakdowns:
```
POST /api/case-search { "action": "analytics" }
```

3. Call filter_options — should return distinct values:
```
POST /api/case-search { "action": "filter_options" }
```

4. Test a filter:
```
POST /api/case-search { "action": "search", "filters": { "status": "open" } }
```

5. Test pagination:
```
POST /api/case-search { "action": "search", "page": 1, "page_size": 5 }
```

---

## Architecture

- **No new tables** — queries existing `inspection_cases` table with new indexes.
- **New columns** — adds material_family, asset_type, inspection_method, damage_type, severity, component_name, notes (if not already present).
- **All filters optional** — any combination works, all AND'd together.
- **Pagination** — default 25 per page, max 100. Returns total count and page info.
- **Analytics** — aggregates in-memory after filtering. For <10,000 cases this is fast. For larger datasets, would need SQL aggregation.
- **filter_options** — pulls distinct values from the database so the UI can build dropdown menus dynamically.
