# DEPLOY255: Outcome Tracking Engine v1.0.0

## What This Does
Closes the feedback loop. Records what actually happened after a decision was made, compares predictions vs actuals, and feeds accuracy data back into concept reliability scores, cost model accuracy, and inspection effectiveness. This is what makes the system learn from itself.

## 8 Capabilities
1. Record Actual Outcome (repair confirmed, failure occurred, monitoring stable, etc.)
2. Compare Predictions vs Actuals (did decision core get the disposition right?)
3. Score Cost Accuracy (predicted cost vs actual cost, variance grading)
4. Score Inspection Effectiveness (detection success, sizing accuracy, false calls, missed findings)
5. Score Concept Engine Accuracy (was the governing concept correct? was it useful?)
6. Generate Calibration Recommendations (auto-queues tuning suggestions when accuracy drops)
7. Accuracy Dashboard Metrics (org-wide accuracy aggregates)
8. Outcome Audit Trail (full event log)

## Auto-Calibration Triggers
- Cost variance > 25% → queues cost model review
- Inspection effectiveness < 40% → queues method capability review
- Concept activated but incorrect → queues reliability score reduction

## Deploy Steps

### Step 1: SQL Migration
Run in Supabase SQL Editor:
- File: `supabase/migrations/DEPLOY255_outcome_tracking.sql`
- Creates 7 tables: outcome_records, prediction_accuracy, cost_accuracy, inspection_effectiveness, concept_accuracy, outcome_calibration_queue, outcome_audit_events
- All tables have RLS policies with org isolation
- 1 seed row with reference enums

### Step 2: Netlify Function
Paste into GitHub:
- File: `netlify/functions/outcome-tracking.ts`
- 9 actions: get_registry, record_outcome, compare_predictions, score_cost_accuracy, score_inspection_effectiveness, score_concept_accuracy, get_calibration_queue, get_accuracy_dashboard, get_case_outcome

### Step 3: Health Registry
Paste updated file:
- File: `netlify/functions/health.ts`
- Now has 48 engines in ENGINE_REGISTRY

### Step 4: System Check
Paste updated file:
- File: `public/system-check.html`
- Now tests 48 endpoints

## Test After Deploy
Visit: https://4dndt.netlify.app/system-check.html
Expected: 48 PASS

## Feeds Back Into
- Concept Intelligence v2.1 → reliability scores, drift metrics
- Cost Reasoning Engine → cost model accuracy, assumption tuning
- Decision Core → disposition accuracy, confidence calibration
- Inspection Report → method effectiveness, detection rates
