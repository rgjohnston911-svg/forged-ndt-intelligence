# DEPLOY258: Predictive Remaining Life v1.0.0

## What This Does
The capstone engine. Estimates remaining component life from inspection history, degradation rates, process data, and environmental factors. Turns the platform from reactive ("here's what we found") to predictive ("here's what's coming").

"Based on the wall loss rate, operating conditions, and 3 similar assets, this vessel has ~14 months before it drops below minimum thickness."

## 10 Capabilities
1. Predict Life (remaining months, risk level, confidence bounds)
2. Record Condition (point-in-time thickness/measurement readings)
3. Get Condition History (with computed degradation rate)
4. Get Predictions (filter by asset, case, risk level)
5. Get Risk Projection (forward-looking PoF curve)
6. Recommend Schedule (optimized inspection intervals)
7. Get Schedule (upcoming inspections by priority)
8. Get Asset Dashboard (single-asset deep view)
9. Get Fleet Overview (all monitored assets, risk distribution)
10. Full Audit Trail

## Deploy Steps

### Step 1: SQL Migration
Run in Supabase SQL Editor:
- File: `supabase/migrations/DEPLOY258_predictive_remaining_life.sql`
- Creates 6 tables: degradation_models, asset_condition_records, life_predictions, inspection_schedule_recommendations, risk_projections, prl_audit_events
- Seeds 10 industry-standard degradation models (API 581, ASME BPVC, API 941, API 579)
- All tables have RLS with org isolation

### Step 2: Netlify Function
Paste into GitHub:
- File: `netlify/functions/predictive-remaining-life.ts`
- 10 actions: get_registry, predict_life, record_condition, get_condition_history, get_predictions, get_risk_projection, recommend_schedule, get_schedule, get_asset_dashboard, get_fleet_overview

### Step 3: Health Registry
Paste updated file:
- File: `netlify/functions/health.ts`
- Now has 51 engines

### Step 4: System Check
Paste updated file:
- File: `public/system-check.html`
- Now tests 51 endpoints

## Test After Deploy
Visit: https://4dndt.netlify.app/system-check.html
Expected: 51 PASS (Ctrl+Shift+R to hard refresh)

## How It Works
- record_condition: Store thickness/measurement readings over time per asset
- predict_life: Core algorithm —
  1. Gets all condition readings for the asset
  2. Computes observed degradation rate (if 2+ readings exist)
  3. Finds matching degradation model (org-specific or global seed data)
  4. Applies acceleration factors (temperature, pressure, cyclic, environment)
  5. Applies process data factors (from DEPLOY257 integration)
  6. Calculates: remaining = current - minimum; life = remaining / rate
  7. Generates confidence bounds (+/- 20% rate variation)
  8. Builds risk projection curve with probability of failure (S-curve)
  9. Creates inspection schedule recommendation based on risk level
- Risk levels: critical (<6mo), high (<12mo), medium (<36mo), low (<60mo), very_low (60+mo)
- Schedule priorities: urgent (3mo interval), high (6mo), routine (12-24mo), low (36mo)
- Fleet overview: aggregates all assets, sorts by risk, flags urgent inspections

## Seeded Degradation Models
- General corrosion: CS atmospheric (0.1mm/yr), CS marine (0.3), CS chemical (0.25), SS marine (0.05)
- CUI: CS insulated (0.4mm/yr)
- Fatigue cracking: CS cyclic (0.05mm/yr, 2x cyclic factor)
- Erosion: CS high velocity (0.5mm/yr)
- SCC: SS chloride (0.15mm/yr, 2x environment factor)
- Hydrogen damage: CS HIC/SOHIC (0.2mm/yr)
- Creep: CS high temperature (0.08mm/yr, 2.5x temp factor)
