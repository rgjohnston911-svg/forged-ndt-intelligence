# DEPLOY231 — Compliance Matrix Engine

Evaluates regulatory compliance for each case. Maps inspection activities to standard requirements (API 579, API 510, API 570, ASME PCC-2, ASME B31.3, ISO 24817), checks which requirements are met, and produces a compliance score.

## What it does

Four actions:

1. **evaluate** — Evaluates a case against all applicable standards. Auto-detects which standards apply based on asset type, code sets, and inspection method. Checks each requirement and returns met/not_met/needs_review status.

2. **get_requirements** — Returns all requirements for a specific standard.

3. **get_case_compliance** — Same as evaluate (always returns fresh evaluation).

4. **get_summary** — Returns available standards and their requirement counts.

### Compliance levels:
- **compliant** — 90%+ requirements met, no critical gaps
- **partially_compliant** — 70-89% requirements met, no critical gaps
- **non_compliant** — Below 70% or any critical requirement not met

### Standards included:
- API 579-1 (Fitness-For-Service) — 7 requirements
- ASME PCC-2 (Repair of Pressure Equipment) — 5 requirements
- ASME B31.3 (Process Piping) — 5 requirements
- API 510 (Pressure Vessel Inspection) — 6 requirements
- API 570 (Piping Inspection) — 6 requirements
- ISO 24817 (Composite Repairs) — 4 requirements

## Deploy order

### 1. Paste function
File: `netlify/functions/compliance-matrix.ts`
Endpoint: `POST /api/compliance-matrix { action, case_id, standard }`

No migration needed — reads existing tables.

### 2. Update health.ts ENGINE_REGISTRY
Add before closing `]`:
```
{ name: "compliance-matrix", deploy: "DEPLOY231", mode: "deterministic", path: "/api/compliance-matrix" }
```

---

## Smoke test

1. Evaluate a real case:
```
POST /api/compliance-matrix { "action": "evaluate", "case_id": "<real-case-id>" }
```

2. Get standards summary:
```
POST /api/compliance-matrix { "action": "get_summary" }
```

3. Get specific standard requirements:
```
POST /api/compliance-matrix { "action": "get_requirements", "standard": "API-579" }
```

---

## Architecture

- **Auto-detection** — Determines applicable standards from case asset_type, code_sets, and inspection method.
- **Live evaluation** — Always evaluates fresh against current case data. No stale cached results.
- **Requirement categories** — inspection, assessment, documentation, material, personnel, repair, testing, quality, scheduling.
- **Critical tracking** — Requirements marked as critical. Any critical gap = non_compliant regardless of score.
- **Extensible** — Add new standards by adding to STANDARDS_REGISTRY object.
