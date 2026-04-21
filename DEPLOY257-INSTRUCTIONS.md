# DEPLOY257: Process Data Integration v1.0.0

## What This Does
Connects live sensor and process data (temperature, pressure, flow rates, vibration, corrosion rates) to inspection cases. Correlates operating conditions with failure modes so the platform sees what caused the damage, not just what it looks like. "This pipe was running at 450F for 6 months before the crack appeared."

## 10 Capabilities
1. Register Data Sources (sensors, historians, SCADA, DCS, IoT)
2. Ingest Readings (bulk time-series with auto-exceedance detection)
3. List Sources (filter by type, asset, active status)
4. Get Readings (with inline statistics)
5. Detect Exceedances (scan for threshold violations)
6. Correlate Case (link process data to inspection case, compute exposure)
7. Get Exposure Summary (operating condition profiles)
8. Get Exceedance History (filter by severity, type, time range)
9. Get Case Correlations (all process links for a case with assessment)
10. Full Audit Trail

## Deploy Steps

### Step 1: SQL Migration
Run in Supabase SQL Editor:
- File: `supabase/migrations/DEPLOY257_process_data_integration.sql`
- Creates 6 tables: process_data_sources, process_data_readings, process_exceedance_events, process_case_correlations, process_exposure_summaries, process_audit_events
- All tables have RLS with org isolation

### Step 2: Netlify Function
Paste into GitHub:
- File: `netlify/functions/process-data-integration.ts`
- 10 actions: get_registry, register_source, ingest_readings, get_sources, get_readings, detect_exceedances, correlate_case, get_exposure_summary, get_exceedance_history, get_case_correlations

### Step 3: Health Registry
Paste updated file:
- File: `netlify/functions/health.ts`
- Now has 50 engines

### Step 4: System Check
Paste updated file:
- File: `public/system-check.html`
- Now tests 50 endpoints

## Test After Deploy
Visit: https://4dndt.netlify.app/system-check.html
Expected: 50 PASS (Ctrl+Shift+R to hard refresh)

## How It Works
- register_source: Define a sensor with normal/alarm/critical thresholds and unit of measure
- ingest_readings: Bulk insert time-series data, auto-detects exceedances against source thresholds
- detect_exceedances: Scans readings in a time window, classifies violations (critical > alarm > above_normal)
- correlate_case: Finds all sources for a case's asset, analyzes readings in a lookback window, computes operating regime breakdown, scores correlation strength, creates exposure summary
- Severity scoring: Based on exceedance count, time in abnormal regimes, coefficient of variation
- Operating regimes: normal, above/below_normal, alarm_high/low, critical_high/low
- Correlation types: temporal (low score), coincidental (30-60), causal (60+)
