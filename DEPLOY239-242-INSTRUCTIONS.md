# DEPLOY239-242: Industry Verticals Batch 2

## Files to Deploy

### New Functions (paste into `netlify/functions/`)
1. **aerospace-vertical.ts** (DEPLOY239) — FAA/EASA damage tolerance, 9 mechanisms, 5 structure categories
2. **power-generation.ts** (DEPLOY240) — Gas/steam/wind turbines, boilers, HRSG, 16 mechanisms, 8 component types
3. **maritime-offshore.ts** (DEPLOY241) — ABS/DNV/Lloyd's, hull/offshore/subsea, 12 mechanisms, 6 survey types
4. **civil-infrastructure.ts** (DEPLOY242) — AASHTO/ACI/FHWA, bridges/tunnels/dams, 15 mechanisms, 6 structure types

### Updated Files (replace existing)
5. **health.ts** — ENGINE_REGISTRY updated with 4 new engines (35 total)
6. **public/system-check.html** — 4 new test lines, subtitle updated to 35 engines

## Deploy Order
1. Paste all 4 new function files into `netlify/functions/`
2. Replace `health.ts` and `system-check.html`
3. Push — Netlify auto-deploys

## Smoke Tests

After deploy, run System Check page. Should show 35 PASS.

Manual verification:

```
POST /api/aerospace-vertical
{ "action": "get_registry" }
→ 9 mechanisms, 5 structure categories

POST /api/power-generation
{ "action": "get_registry" }
→ 16 mechanisms, 8 component types

POST /api/maritime-offshore
{ "action": "get_registry" }
→ 12 mechanisms, 6 survey types

POST /api/civil-infrastructure
{ "action": "get_registry" }
→ 15 mechanisms, 6 structure types
```

## Engine Summary After This Batch

| Engine | Deploy | Mechanisms | Domain |
|--------|--------|------------|--------|
| Chemical/Process | DEPLOY237 | 20 API 571 | Refineries, petrochemical |
| Nuclear | DEPLOY238 | 8 + 4 ISI classes | Nuclear power, ASME XI |
| Aerospace | DEPLOY239 | 9 + 5 structure cats | FAA/EASA, aircraft |
| Power Generation | DEPLOY240 | 16 + 8 component types | Gas/steam/wind turbines |
| Maritime/Offshore | DEPLOY241 | 12 + 6 survey types | Ships, platforms, subsea |
| Civil Infrastructure | DEPLOY242 | 15 + 6 structure types | Bridges, tunnels, dams |

**Total: 35 engines across 6 industry verticals**

## What's Next
- Space Systems vertical
- Robotics/Automation Integration
- Human Intelligence Layer (inspector performance)
- Medical/Bio vertical (last priority)
