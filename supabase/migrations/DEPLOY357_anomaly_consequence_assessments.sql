-- ============================================================
-- DEPLOY357 — Sprint 4C per-anomaly consequence assessments
--
-- Sprint 4C.1 rewrite: tightened to match the EXACT shape the
-- consequence engine writes (see src/lib/cross-domain/consequenceEngine.ts
-- INSERT block, ~line 746). The original Sprint 4C version of this
-- file was authored alongside the engine but never applied to
-- production Supabase; the engine's INSERT failed at runtime with a
-- "relation does not exist" error captured in
-- arbitration_rules_applied.consequence_engine_error on deliberation
-- ad1c1a9b-20df-443d-a5fb-77bf734ae479.
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
-- COLUMN-BY-COLUMN MAP TO THE ENGINE'S INSERT (engine doesn't write
-- created_at / updated_at — those are DB-managed defaults):
--   id                                ← randomUUID
--   org_id                            ← caller's org_id
--   anomaly_id                        ← profile.anomaly_id  (NOT NULL)
--   asset_id                          ← profile.asset_id    (NOT NULL)
--   deliberation_id                   ← deliberation_id ?? null
--   overall_tier                      ← profile.overall_tier (6-enum)
--   recommended_action_tier           ← profile.recommended_action_tier (5-enum)
--   total_confidence                  ← profile.total_confidence (0..1)
--   time_to_consequence_days          ← profile.time_to_consequence.estimated_days (nullable)
--   time_to_consequence_confidence    ← profile.time_to_consequence.confidence (3-enum, NOT NULL)
--   profile_jsonb                     ← the entire ConsequenceProfile object
-- ============================================================

CREATE TABLE IF NOT EXISTS cd_anomaly_consequence_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  -- FKs follow the sibling cd_asset_consequence_profiles + cd_prediction_outcomes
  -- conventions: NOT NULL + CASCADE for required relationships (the
  -- assessment is meaningless without its anomaly and its asset).
  anomaly_id uuid NOT NULL REFERENCES cd_asset_anomalies(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES cd_asset_nodes(id) ON DELETE CASCADE,
  -- deliberation_id has no FK because cd_deliberation_log is not
  -- referenced by FK anywhere else in DEPLOY355 (it's a log table).
  -- Soft reference only.
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
  -- estimated_days is nullable: engine returns null when insufficient
  -- inputs (no remaining_wall_mm / nominal_wall_mm / progression rate).
  time_to_consequence_days numeric,
  -- confidence is non-null in the engine's type contract — always one
  -- of 'low'|'medium'|'high', set even in the null-days branch.
  time_to_consequence_confidence text NOT NULL CHECK (
    time_to_consequence_confidence IN ('low','medium','high')
  ),
  -- Full ConsequenceProfile (categories array, reasoning, citations,
  -- contributing factors) for inspection / downstream UI / audit.
  profile_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Primary access pattern: "give me the latest assessments for an
-- anomaly within an org" — covered by this composite. created_at DESC
-- so PostgreSQL can serve `ORDER BY created_at DESC LIMIT 1` index-only.
CREATE INDEX IF NOT EXISTS idx_cd_anom_cons_org_anom_created
  ON cd_anomaly_consequence_assessments (org_id, anomaly_id, created_at DESC);

-- Secondary access pattern: "what assessments came out of deliberation X".
CREATE INDEX IF NOT EXISTS idx_cd_anom_cons_delib
  ON cd_anomaly_consequence_assessments (org_id, deliberation_id);

ALTER TABLE cd_anomaly_consequence_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cd_anomaly_consequence_assessments FORCE ROW LEVEL SECURITY;
CREATE POLICY "cd_anom_cons_tenant_isolation" ON cd_anomaly_consequence_assessments
  FOR ALL USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

NOTIFY pgrst, 'reload schema';
