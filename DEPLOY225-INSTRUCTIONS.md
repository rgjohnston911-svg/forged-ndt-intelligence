# DEPLOY225 — Production Hardening

Health check endpoint, structured error codes, and engine registry. Makes the system monitorable and debuggable in production.

## What it does

1. **Health Endpoint** — `GET /api/health` smoke-tests every critical subsystem: database connectivity, table existence, signing key availability, case activity stats, and a full engine registry.

2. **Structured Error Codes** — Standardized error codes (E001-E020) with severity levels (critical, warning) so monitoring tools can alert on specific failure types.

3. **Engine Registry** — Complete catalog of all 19 deployed functions with their DEPLOY version, execution mode (deterministic/ai_assisted/hybrid), and API path.

4. **Quick Mode** — `GET /api/health?quick=1` runs DB-only check for fast uptime monitoring (load balancers, Netlify monitoring, etc).

## Deploy order

### 1. Paste function
File: `netlify/functions/health.ts`
Endpoint: `GET /api/health`

No migration needed. No UI changes.

### 2. Smoke test

Hit the endpoint:
```
GET https://4dndt.netlify.app/api/health
```

Expected response:
- `status`: "healthy" (all checks pass) or "healthy_with_warnings" (non-critical tables missing)
- `engines.total`: 19 functions registered
- `engines.deterministic`: 16 deterministic engines
- `checks`: Array of PASS results for each table and subsystem
- `response_ms`: Total check time in milliseconds

Quick check:
```
GET https://4dndt.netlify.app/api/health?quick=1
```

Returns DB connectivity only, under 500ms.

## Architecture

- No authentication required (health endpoints should be publicly accessible for monitoring)
- Checks run sequentially to avoid overwhelming Supabase with parallel queries
- Tables that don't exist yet (future DEPLOYs) show as warnings, not errors
- Engine registry is hardcoded — update it as new functions are deployed
- Error codes follow a numbering scheme: E001-E009 (database), E010-E019 (security), E020-E029 (configuration)
