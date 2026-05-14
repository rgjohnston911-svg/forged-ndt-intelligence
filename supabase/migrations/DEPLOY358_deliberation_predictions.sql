-- ============================================================
-- DEPLOY358 — Sprint 4D per-deliberation prediction records
--
-- WHY THIS TABLE EXISTS (NOT cd_prediction_outcomes):
--   cd_prediction_outcomes (DEPLOY355) is a per-anomaly +
--   per-prediction-aspect log keyed by anomaly_id + a 4-value
--   prediction_type CHECK enum (forecast_critical_date /
--   severity_classification / mechanism_attribution /
--   consequence_score). Each row holds a single typed prediction
--   in a generic predicted_value jsonb.
--
--   Sprint 4D wants ONE row per DELIBERATION with the full set of
--   structured predictions flattened into named columns (consensus,
--   consequence tier, recommended action, time-to-consequence,
--   total confidence) plus operator-reported actual_outcome and
--   calibration_delta jsonb. Different concept; different shape.
--   The existing prediction_type CHECK enum doesn't accept a
--   "deliberation_outcome" type and the table has no deliberation_id.
--
--   Following the Sprint 4C.1 lesson: prefer a small migration over
--   compressing into the wrong shape. cd_prediction_outcomes stays
--   for its design purpose (no production code references it today).
-- ============================================================

CREATE TABLE IF NOT EXISTS cd_deliberation_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  -- One prediction per deliberation. Capture is idempotent in the
  -- application layer (predictionCapture.ts checks before insert);
  -- the UNIQUE constraint here is belt-and-suspenders.
  deliberation_id uuid NOT NULL UNIQUE,
  anomaly_id uuid NOT NULL REFERENCES cd_asset_anomalies(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES cd_asset_nodes(id) ON DELETE CASCADE,
  predicted_at timestamptz NOT NULL DEFAULT now(),

  -- ----- Predicted values (sourced from the deliberation outputs) -----
  -- primary_mechanism: pulled from cd_causal_chains for this anomaly
  -- (latest row's primary mechanism). Nullable because the causal
  -- chain engine may have been skipped or returned ok:false.
  primary_mechanism text,
  -- consensus_level: directly from cd_deliberation_log row. NOT NULL
  -- because the capture step skips unresolved deliberations entirely.
  consensus_level text NOT NULL CHECK (consensus_level IN (
    'unanimous','majority_with_dissent','split','unresolved'
  )),
  -- consequence_overall_tier / recommended_action_tier: pulled from
  -- the latest cd_anomaly_consequence_assessments row for this
  -- deliberation. Nullable because the consequence engine may have
  -- failed (failure logged to arbitration_rules_applied.consequence_engine_error)
  -- and we still want to capture the partial prediction.
  consequence_overall_tier text CHECK (
    consequence_overall_tier IS NULL OR
    consequence_overall_tier IN (
      'negligible','low','moderate','high','severe','catastrophic'
    )
  ),
  recommended_action_tier text CHECK (
    recommended_action_tier IS NULL OR
    recommended_action_tier IN (
      'monitor','engineering_review','urgent_assessment',
      'immediate_remediation','cease_operation'
    )
  ),
  time_to_consequence_days numeric,
  total_confidence numeric CHECK (
    total_confidence IS NULL OR
    (total_confidence >= 0 AND total_confidence <= 1)
  ),

  -- ----- Operator-reported actual outcome (null until reported) -----
  -- reported_at NOT NULL means an outcome has been recorded; the
  -- application layer uses this to gate calibration aggregation.
  reported_at timestamptz,
  actual_outcome jsonb,
  -- calibration_delta computed at outcome-report time. Fields:
  --   mechanism_match: 'correct'|'incorrect'|'unknown'
  --   consequence_tier_delta: integer offset along the 6-tier scale
  --   time_to_consequence_error_days: numeric (predicted − actual)
  --   action_tier_alignment: 'matched'|'over_predicted'|'under_predicted'|'unknown'
  --   computed_at: timestamptz
  calibration_delta jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Common access patterns:
--   1. "Show me the latest predictions for an org" → (org_id, predicted_at DESC)
--   2. "Show me the prediction for a given anomaly" → (org_id, anomaly_id)
--   3. "What came out of deliberation X" → covered by the UNIQUE
--      constraint on deliberation_id which creates a unique btree.
--   4. Calibration queries filter on reported_at IS NOT NULL — a
--      partial index keeps that fast as the table grows.
CREATE INDEX IF NOT EXISTS idx_cd_delib_pred_org_pred_at
  ON cd_deliberation_predictions (org_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_cd_delib_pred_org_anom
  ON cd_deliberation_predictions (org_id, anomaly_id);
CREATE INDEX IF NOT EXISTS idx_cd_delib_pred_reported
  ON cd_deliberation_predictions (org_id, reported_at)
  WHERE reported_at IS NOT NULL;

ALTER TABLE cd_deliberation_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cd_deliberation_predictions FORCE ROW LEVEL SECURITY;
CREATE POLICY "cd_delib_pred_tenant_isolation" ON cd_deliberation_predictions
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

NOTIFY pgrst, 'reload schema';
