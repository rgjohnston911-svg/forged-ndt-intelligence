# DEPLOY229 — Trend Analytics Engine

Analyzes patterns across all cases over time. Identifies failure trends, repeat problem components, damage type trends, inspection method effectiveness, and confidence trajectory. Produces an executive summary for management.

## What it does

Six analytics actions:

1. **failure_trends** — Cases over time grouped by disposition, damage type, material, or asset type. Shows if failures are increasing or decreasing.

2. **repeat_offenders** — Identifies components and assets with multiple cases. Flags recurring problems that need preventive action.

3. **damage_trends** — Tracks each damage type over time. Shows which damage mechanisms are increasing, decreasing, or stable.

4. **method_effectiveness** — Per-method stats: total cases, average confidence, override rate, review rate, disposition breakdown. Shows which inspection methods produce the most reliable results.

5. **confidence_trends** — System confidence over time with min/max/avg per period. Answers: "Is the system getting better at making decisions?"

6. **executive_summary** — High-level KPIs: total cases, open cases, 30-day velocity, critical count, override rate, escalation queue health, top dispositions, top damage types.

## Deploy order

### 1. Paste function
File: `netlify/functions/trend-analytics.ts`
Endpoint: `POST /api/trend-analytics { action, period, group_by }`

No migration needed — queries existing tables only.

### 2. Update health.ts ENGINE_REGISTRY
Add to the array (before the closing `]`):
```
{ name: "trend-analytics", deploy: "DEPLOY229", mode: "deterministic", path: "/api/trend-analytics" }
```

### 3. Update system-check.html
Add test:
```
await testEndpoint("DEPLOY229: Trend Analytics", "/api/trend-analytics", { action: "executive_summary" });
```

---

## Smoke test

1. Call executive summary:
```
POST /api/trend-analytics { "action": "executive_summary" }
```
Should return total cases, open cases, confidence, override rate.

2. Call failure trends:
```
POST /api/trend-analytics { "action": "failure_trends", "period": "month", "group_by": "disposition" }
```
Should return monthly data with disposition breakdown.

3. Call method effectiveness:
```
POST /api/trend-analytics { "action": "method_effectiveness" }
```
Should return per-method stats.

---

## Architecture

- **No new tables** — reads from inspection_cases, escalation_queue.
- **Period grouping** — supports month, week, quarter for all time-series actions.
- **Trend detection** — compares last two periods: >20% increase = "increasing", >20% decrease = "decreasing", otherwise "stable".
- **Repeat offenders** — groups by component_name, flags any with 2+ cases.
- **Executive summary** — 30-day velocity compares last 30 days vs previous 30 days as percentage change.
- **Manager-ready** — this is the data layer for the future manager dashboard.
