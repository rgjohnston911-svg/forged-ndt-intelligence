-- ============================================================================
-- DEPLOY353: Tier Access Control + AI Chat System
-- 4D NDT Intelligence Platform
-- Owner: Richard Johnston
-- Date: 2026-05-01
-- ============================================================================

-- 1. Add tier to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier text DEFAULT 'assistant'
  CHECK (tier IN ('assistant', 'pro', 'platform'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier_updated_at timestamptz DEFAULT now();

-- 2. Tier limits configuration
CREATE TABLE IF NOT EXISTS tier_limits (
  tier text PRIMARY KEY,
  display_name text NOT NULL,
  daily_query_limit integer NOT NULL DEFAULT 20,
  monthly_superbrain_limit integer NOT NULL DEFAULT 0,
  max_active_cases integer NOT NULL DEFAULT 0,
  max_conversations integer NOT NULL DEFAULT 50,
  batch_enabled boolean NOT NULL DEFAULT false,
  api_access boolean NOT NULL DEFAULT false,
  image_analysis boolean NOT NULL DEFAULT false,
  export_pdf boolean NOT NULL DEFAULT false,
  export_docx boolean NOT NULL DEFAULT false,
  fleet_analytics boolean NOT NULL DEFAULT false,
  engine_access_count integer NOT NULL DEFAULT 15,
  created_at timestamptz DEFAULT now()
);

INSERT INTO tier_limits (tier, display_name, daily_query_limit, monthly_superbrain_limit, max_active_cases, max_conversations, batch_enabled, api_access, image_analysis, export_pdf, export_docx, fleet_analytics, engine_access_count)
VALUES
  ('assistant', 'AI Assistant', 20, 0, 0, 50, false, false, false, true, false, false, 15),
  ('pro', 'AI Pro Assistant', 500, 10, 100, -1, false, false, true, true, true, false, 85),
  ('platform', 'Platform', -1, -1, -1, -1, true, true, true, true, true, true, 144)
ON CONFLICT (tier) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  daily_query_limit = EXCLUDED.daily_query_limit,
  monthly_superbrain_limit = EXCLUDED.monthly_superbrain_limit,
  max_active_cases = EXCLUDED.max_active_cases,
  max_conversations = EXCLUDED.max_conversations,
  batch_enabled = EXCLUDED.batch_enabled,
  api_access = EXCLUDED.api_access,
  image_analysis = EXCLUDED.image_analysis,
  export_pdf = EXCLUDED.export_pdf,
  export_docx = EXCLUDED.export_docx,
  fleet_analytics = EXCLUDED.fleet_analytics,
  engine_access_count = EXCLUDED.engine_access_count;

-- 3. Usage tracking
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tier text NOT NULL,
  endpoint text NOT NULL,
  action text,
  response_ms integer,
  tokens_used integer,
  called_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_day
  ON usage_tracking (user_id, called_at);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_tier
  ON usage_tracking (tier, called_at);

-- 4. Conversations (chat history)
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  tier text NOT NULL DEFAULT 'assistant',
  message_count integer DEFAULT 0,
  last_message_at timestamptz,
  pinned boolean DEFAULT false,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user
  ON conversations (user_id, updated_at DESC);

-- 5. Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  engine_calls jsonb DEFAULT '[]',
  tokens_used integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON chat_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user
  ON chat_messages (user_id, created_at DESC);

-- 6. Saved assessments (exportable results)
CREATE TABLE IF NOT EXISTS saved_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES conversations(id),
  title text NOT NULL,
  assessment_type text,
  input_data jsonb NOT NULL DEFAULT '{}',
  result_data jsonb NOT NULL DEFAULT '{}',
  exported boolean DEFAULT false,
  export_format text,
  exported_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_assessments_user
  ON saved_assessments (user_id, created_at DESC);

-- 7. Engine access control map
CREATE TABLE IF NOT EXISTS engine_tier_access (
  engine_name text NOT NULL,
  min_tier text NOT NULL CHECK (min_tier IN ('assistant', 'pro', 'platform')),
  access_mode text DEFAULT 'full' CHECK (access_mode IN ('full', 'readonly', 'limited', 'educational')),
  PRIMARY KEY (engine_name)
);

-- Populate engine access map
-- Assistant tier engines (15)
INSERT INTO engine_tier_access (engine_name, min_tier, access_mode) VALUES
  ('health', 'assistant', 'readonly'),
  ('physics-sufficiency-engine', 'assistant', 'limited'),
  ('universal-code-authority', 'assistant', 'readonly'),
  ('live-code-authority', 'assistant', 'readonly'),
  ('inspection-effectiveness-engine', 'assistant', 'limited'),
  ('api-standards-authority', 'assistant', 'readonly'),
  ('nde-image-analysis', 'assistant', 'educational'),
  ('formula-engine', 'assistant', 'full'),
  ('method-capability', 'assistant', 'full'),
  ('risk-calculator', 'assistant', 'full'),
  ('corrosion-rate-calculator', 'assistant', 'full'),
  ('remaining-life-calculator', 'assistant', 'full'),
  ('pod-calculator', 'assistant', 'limited'),
  ('damage-mechanism-reference', 'assistant', 'readonly'),
  ('code-edition-lookup', 'assistant', 'readonly')
ON CONFLICT (engine_name) DO UPDATE SET min_tier = EXCLUDED.min_tier, access_mode = EXCLUDED.access_mode;

-- Pro tier engines (add the ones that require pro)
INSERT INTO engine_tier_access (engine_name, min_tier, access_mode) VALUES
  ('comprehensive-assessment', 'pro', 'full'),
  ('differential-diagnosis', 'pro', 'full'),
  ('decision-spine', 'pro', 'full'),
  ('contradiction-engine', 'pro', 'full'),
  ('evidence-contract-engine', 'pro', 'full'),
  ('authority-lock-system', 'pro', 'full'),
  ('weld-acceptance-authority', 'pro', 'full'),
  ('coatings-intelligence-authority', 'pro', 'full'),
  ('corrosion-loop', 'pro', 'full'),
  ('fatigue-vibration-proof', 'pro', 'full'),
  ('mechanism-causality-engine', 'pro', 'full'),
  ('uncertainty-boundary-engine', 'pro', 'full'),
  ('sour-service-corrosion', 'pro', 'full'),
  ('mic-intelligence-engine', 'pro', 'full'),
  ('process-condition-authority', 'pro', 'full'),
  ('refinery-mechanism-authority', 'pro', 'full'),
  ('refinery-code-authority-router', 'pro', 'full'),
  ('cfi-engine', 'pro', 'full'),
  ('repair-pathway-engine', 'pro', 'full'),
  ('decision-liability-engine', 'pro', 'full'),
  ('predictive-remaining-life', 'pro', 'full'),
  ('outcome-tracking', 'pro', 'readonly'),
  ('tri-model-reasoning', 'pro', 'limited'),
  ('nde-image-analysis', 'pro', 'full')
ON CONFLICT (engine_name) DO UPDATE SET min_tier = EXCLUDED.min_tier, access_mode = EXCLUDED.access_mode;

-- Platform tier engines (everything else defaults to platform)
INSERT INTO engine_tier_access (engine_name, min_tier, access_mode) VALUES
  ('multi-asset-cascade', 'platform', 'full'),
  ('interaction-mesh-core', 'platform', 'full'),
  ('convergence-reporter', 'platform', 'full'),
  ('root-cause-prevention', 'platform', 'full'),
  ('cross-case-patterns', 'platform', 'full'),
  ('fleet-exposure', 'platform', 'full'),
  ('subsea-structures-orchestrator', 'platform', 'full'),
  ('marine-vessel-orchestrator', 'platform', 'full'),
  ('floating-platform-assessment', 'platform', 'full'),
  ('executive-decision-engine', 'platform', 'full'),
  ('neurosymbolic-reasoning', 'platform', 'full'),
  ('conformal-prediction', 'platform', 'full'),
  ('active-inspection-optimizer', 'platform', 'full'),
  ('physics-constrained-inference', 'platform', 'full'),
  ('causal-discovery', 'platform', 'full'),
  ('multi-agent-debate', 'platform', 'full'),
  ('anomaly-fingerprint', 'platform', 'full'),
  ('physics-learning', 'platform', 'full'),
  ('self-calibrating-digital-twin', 'platform', 'full'),
  ('regression-test-authority', 'platform', 'full'),
  ('decision-proof-recorder', 'platform', 'full'),
  ('batch-processing-gateway', 'platform', 'full'),
  ('tri-model-reasoning-background', 'platform', 'full'),
  ('superbrain-report-background', 'platform', 'full')
ON CONFLICT (engine_name) DO UPDATE SET min_tier = EXCLUDED.min_tier, access_mode = EXCLUDED.access_mode;

-- 8. RLS Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own conversations" ON conversations;
CREATE POLICY "Users see own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own messages" ON chat_messages;
CREATE POLICY "Users see own messages" ON chat_messages
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own assessments" ON saved_assessments;
CREATE POLICY "Users see own assessments" ON saved_assessments
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own usage" ON usage_tracking;
CREATE POLICY "Users see own usage" ON usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

-- tier_limits and engine_tier_access are readable by all authenticated users
ALTER TABLE tier_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read tier limits" ON tier_limits;
CREATE POLICY "Anyone can read tier limits" ON tier_limits
  FOR SELECT USING (true);

ALTER TABLE engine_tier_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read engine access" ON engine_tier_access;
CREATE POLICY "Anyone can read engine access" ON engine_tier_access
  FOR SELECT USING (true);
