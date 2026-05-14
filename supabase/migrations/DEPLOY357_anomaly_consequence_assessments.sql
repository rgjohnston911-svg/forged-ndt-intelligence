-- ============================================================
-- DEPLOY357 — Sprint 4C per-anomaly consequence assessments
--
-- WHY THIS TABLE EXISTS (NOT cd_asset_consequence_profiles):
--   cd_asset_consequence_profiles (DEPLOY355) is an asset-LEVEL
--   inherent-consequence baseline: 6 integer-1..5 columns
--   (safety/environmental/operational/financial/regulatory/reputation)
--   keyed UNIQUE (org_id, asset_id). It holds "if this asset failed,
--   how bad would it be in the abstract" — a static RBI baseline.
--
--   Sprint 4C produces PER-ANOMALY consequence assessments — what
--   *this specific* wall-loss/cracking/etc. event means in terms of
--   safety, cost, downtime, environmental, and regulatory impact RIGHT
--   NOW, plus the recommended action tier. That's a different object:
--   one row per anomaly per deliberation, not one row per asset.
--
--   So this migration adds a new dedicated table rather than altering
--   or repurposing the existing asset baseline.
-- ============================================================

CREATE TABLE IF NOT EXISTS cd_anomaly_consequence_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  anomaly_id uuid NOT NULL,
  asset_id uuid,
  deliberation_id uuid,
  overall_tier text NOT NULL CHECK (overall_tier IN (
    'negligible','low','moderate','high','severe','catastrophic'
  )),
  recommended_action_tier text NOT NULL CHECK (recommended_action_tier IN (
    'monitor','engineering_review','urgent_assessment',
    'immediate_remediation','cease_operation'
  )),
  total_confidence numeric NOT NULL DEFAULT 0
    CHECK (total_confidence >= 0 AND total_confidence <= 1),
  time_to_consequence_days numeric,
  time_to_consequence_confidence text CHECK (
    time_to_consequence_confidence IS NULL OR
    time_to_consequence_confidence IN ('low','medium','high')
  ),
  -- Full ConsequenceProfile (categories array, reasoning, citations,
  -- contributing factors) lives here for inspection and downstream UI.
  profile_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cd_anom_cons_lookup
  ON cd_anomaly_consequence_assessments (org_id, anomaly_id);
CREATE INDEX IF NOT EXISTS idx_cd_anom_cons_delib
  ON cd_anomaly_consequence_assessments (org_id, deliberation_id);

ALTER TABLE cd_anomaly_consequence_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cd_anomaly_consequence_assessments FORCE ROW LEVEL SECURITY;
CREATE POLICY "cd_anom_cons_tenant_isolation" ON cd_anomaly_consequence_assessments
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

NOTIFY pgrst, 'reload schema';
