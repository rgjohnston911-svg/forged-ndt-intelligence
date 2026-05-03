-- DEPLOY353: Global Authority Engine v2 — Jurisdiction Registry + Audit Trail
-- Prevents wrong-code application across international jurisdictions

-- Jurisdiction registry (persistent, updatable without code deploy)
CREATE TABLE IF NOT EXISTS global_jurisdiction_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_key TEXT UNIQUE NOT NULL,
  region TEXT NOT NULL,
  codes TEXT[] NOT NULL DEFAULT '{}',
  regulatory_body TEXT,
  class_societies TEXT[] DEFAULT '{}',
  unit_system TEXT NOT NULL DEFAULT 'Metric' CHECK (unit_system IN ('Imperial', 'Metric', 'Mixed')),
  note TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Standard equivalency crosswalk (persistent, updatable)
CREATE TABLE IF NOT EXISTS global_crosswalk_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  us_code TEXT NOT NULL,
  jurisdiction_key TEXT NOT NULL REFERENCES global_jurisdiction_registry(jurisdiction_key),
  local_equivalent TEXT NOT NULL,
  equivalence_type TEXT NOT NULL CHECK (equivalence_type IN ('FULL', 'PARTIAL', 'NONE')),
  differences TEXT[] DEFAULT '{}',
  usage_rule TEXT NOT NULL CHECK (usage_rule IN ('PRIMARY', 'CSA_PRIMARY', 'SUPPLEMENTAL_ONLY', 'NOT_PRIMARY', 'PROHIBITED')),
  critical_note TEXT,
  edition_year INTEGER,
  verified_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(us_code, jurisdiction_key)
);

-- Authority decision audit trail
CREATE TABLE IF NOT EXISTS global_authority_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID,
  asset_type TEXT NOT NULL,
  jurisdiction_input TEXT NOT NULL,
  jurisdiction_resolved TEXT,
  status TEXT NOT NULL CHECK (status IN ('LOCKED', 'PARTIAL', 'BLOCKED', 'HOLD_FOR_INPUT')),
  confidence TEXT NOT NULL,
  us_codes_requested TEXT[] DEFAULT '{}',
  crosswalk_applied JSONB,
  hard_locks_triggered TEXT[] DEFAULT '{}',
  inspector_message TEXT,
  unit_conversion_required BOOLEAN DEFAULT false,
  audit_trace JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_authority_audit_jurisdiction ON global_authority_audit(jurisdiction_resolved);
CREATE INDEX IF NOT EXISTS idx_authority_audit_status ON global_authority_audit(status);
CREATE INDEX IF NOT EXISTS idx_authority_audit_created ON global_authority_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crosswalk_us_code ON global_crosswalk_registry(us_code);
CREATE INDEX IF NOT EXISTS idx_crosswalk_jurisdiction ON global_crosswalk_registry(jurisdiction_key);

-- Seed jurisdiction registry
INSERT INTO global_jurisdiction_registry (jurisdiction_key, region, codes, regulatory_body, class_societies, unit_system, note) VALUES
  ('canada', 'Canada', ARRAY['CSA Z662', 'CSA B51', 'CSA W59', 'CSA Z245.1'], 'TSSA / ABSA / provincial authorities', ARRAY[]::TEXT[], 'Metric', 'Canadian Standards Association primary; API supplemental only if adopted by owner'),
  ('alberta', 'Canada/Alberta', ARRAY['CSA Z662', 'ABSA', 'CSA B51'], 'ABSA', ARRAY[]::TEXT[], 'Metric', 'Alberta Boilers Safety Association + CSA standards govern'),
  ('germany', 'EU/Germany', ARRAY['PED 2014/68/EU', 'EN 13445', 'AD 2000 Merkblätter', 'BetrSichV'], 'TÜV / ZÜS / BAM', ARRAY['DNV', 'Lloyd''s', 'Bureau Veritas'], 'Metric', 'Pressure Equipment Directive + EN harmonized standards; TÜV oversight'),
  ('eu', 'European Union', ARRAY['PED 2014/68/EU', 'EN 13445', 'EN 12952', 'EN 13480'], 'Notified Bodies (NB) per member state', ARRAY['DNV', 'Lloyd''s', 'Bureau Veritas', 'TÜV'], 'Metric', 'PED + EN harmonized standards govern; ASME not primary; CE marking required'),
  ('uk', 'United Kingdom', ARRAY['BS EN 1090', 'BS 7910', 'PER 1999', 'PSSR 2000'], 'HSE / Competent Authority', ARRAY['Lloyd''s Register', 'DNV'], 'Metric', 'BS EN Eurocodes + Pressure Equipment Regulations post-Brexit; UKCA marking'),
  ('australia', 'Australia/New Zealand', ARRAY['AS/NZS 3788', 'AS 4458', 'AS 2885', 'AS 1210'], 'WorkSafe / state regulators', ARRAY['Lloyd''s', 'DNV', 'Bureau Veritas'], 'Metric', 'Australian/NZ Standards govern; state WorkSafe authorities'),
  ('norway', 'Norway', ARRAY['NORSOK M-001', 'NORSOK M-501', 'DNV-OS-F101', 'DNV-ST-F101'], 'Petroleumstilsynet (PSA)', ARRAY['DNV'], 'Metric', 'NORSOK standards + DNV rules govern offshore; PSA regulatory oversight'),
  ('brazil', 'Brazil', ARRAY['NR-13', 'ABNT NBR 15749', 'ABNT NBR 14842'], 'MTE / ANP / INMETRO', ARRAY['DNV', 'Bureau Veritas', 'ABS'], 'Metric', 'NR-13 regulatory + ABNT national standards; ANP for oil & gas'),
  ('japan', 'Japan', ARRAY['JIS B 8265', 'JIS B 8266', 'METI High Pressure Gas Safety Act'], 'METI / KHK', ARRAY['ClassNK', 'DNV'], 'Metric', 'JIS standards + METI regulations; KHK certification required'),
  ('singapore', 'Singapore', ARRAY['SS CP 79', 'WSH Act', 'SS 531'], 'MOM / WSH Council', ARRAY['ABS', 'Lloyd''s', 'DNV', 'Bureau Veritas'], 'Metric', 'Singapore Standards + Workplace Safety & Health regulations'),
  ('middle_east', 'Middle East', ARRAY['ARAMCO Standards', 'ADNOC Standards', 'QP Standards'], 'Owner engineering authority', ARRAY['ABS', 'Lloyd''s', 'DNV'], 'Mixed', 'Owner/national standards often adopt API with modifications; verify per owner spec'),
  ('korea', 'South Korea', ARRAY['KGS FP 111', 'KOSHA', 'KS B 6750'], 'KGS / KOSHA / MOTIE', ARRAY['Korean Register', 'DNV'], 'Metric', 'Korean Gas Safety + occupational safety standards; KGS certification'),
  ('india', 'India', ARRAY['IS 2825', 'IBR 1950', 'OISD Standards', 'IS 803'], 'DIPP / State Boiler Directorate / OISD', ARRAY['Indian Register of Shipping', 'DNV', 'Lloyd''s'], 'Metric', 'Indian Boiler Regulations + OISD for petroleum; state-level boiler inspectorates'),
  ('china', 'China', ARRAY['GB 150', 'GB/T 20801', 'TSG 21'], 'SAMR / Provincial MSA', ARRAY['CCS', 'DNV', 'Lloyd''s'], 'Metric', 'GB national standards govern; SAMR/TSG regulatory; no foreign code primary'),
  ('offshore_international', 'International Waters', ARRAY['MODU Code', 'SOLAS', 'ISM Code'], 'Flag State / IMO', ARRAY['ABS', 'DNV', 'Lloyd''s', 'Bureau Veritas', 'ClassNK'], 'Metric', 'Flag state + classification society rules govern; IMO conventions apply')
ON CONFLICT (jurisdiction_key) DO NOTHING;

-- RLS policies
ALTER TABLE global_jurisdiction_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_crosswalk_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_authority_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jurisdiction_registry_read" ON global_jurisdiction_registry FOR SELECT USING (true);
CREATE POLICY "crosswalk_registry_read" ON global_crosswalk_registry FOR SELECT USING (true);
CREATE POLICY "authority_audit_insert" ON global_authority_audit FOR INSERT WITH CHECK (true);
CREATE POLICY "authority_audit_read" ON global_authority_audit FOR SELECT USING (true);
