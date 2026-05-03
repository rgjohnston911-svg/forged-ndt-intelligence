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

-- ============================================================
-- v2.2 ADDITIONS: Edition Registry + Verification Cache + Source Credibility
-- ============================================================

-- Edition registry (persistent, updatable without code deploy)
CREATE TABLE IF NOT EXISTS global_edition_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  current_edition TEXT NOT NULL,
  current_year INTEGER NOT NULL,
  previous_editions TEXT[] DEFAULT '{}',
  superseded_by TEXT,
  withdrawn BOOLEAN DEFAULT false,
  withdrawal_date DATE,
  issuing_body TEXT NOT NULL,
  official_source_url TEXT,
  last_verified DATE NOT NULL,
  verification_source TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(code)
);

-- Verification cache (time-bounded, auto-expires)
CREATE TABLE IF NOT EXISTS global_verification_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  requested_code TEXT NOT NULL,
  requested_edition TEXT,
  edition_status TEXT NOT NULL CHECK (edition_status IN ('VERIFIED_CURRENT', 'VERIFIED_BUT_EDITION_UNKNOWN', 'SUPERSEDED', 'WITHDRAWN', 'CONFLICTING_SOURCES', 'UNVERIFIED', 'LIVE_CHECK_REQUIRED', 'OFFICIAL_SOURCE_NOT_FOUND', 'MANUAL_REVIEW_REQUIRED')),
  edition_lock TEXT NOT NULL CHECK (edition_lock IN ('NO_LOCK', 'WARN_ONLY', 'HOLD_FOR_EDITION_VERIFICATION', 'HOLD_FOR_OFFICIAL_SOURCE', 'BLOCK_SUPERSEDED_AUTHORITY', 'BLOCK_WITHDRAWN_AUTHORITY', 'MANUAL_AUTHORITY_REVIEW')),
  latest_known_edition TEXT,
  superseded_by TEXT,
  source_quality_score NUMERIC(3,2) DEFAULT 0.0,
  authority_freshness_score NUMERIC(3,2) DEFAULT 0.0,
  reasoning TEXT,
  cached_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Source credibility registry
CREATE TABLE IF NOT EXISTS global_source_credibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT UNIQUE NOT NULL,
  quality_score NUMERIC(3,2) NOT NULL CHECK (quality_score >= 0.0 AND quality_score <= 1.0),
  is_official BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Authority decision log (expanded v2.2 audit)
CREATE TABLE IF NOT EXISTS global_authority_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_decision_id TEXT UNIQUE NOT NULL,
  jurisdiction_status TEXT NOT NULL CHECK (jurisdiction_status IN ('CONFIRMED', 'INFERRED', 'UNKNOWN', 'CONFLICTING')),
  country TEXT,
  region_or_state TEXT,
  asset_type TEXT,
  industry_domain TEXT,
  requested_code TEXT,
  requested_edition TEXT,
  primary_authority TEXT,
  decision_lock TEXT NOT NULL CHECK (decision_lock IN ('ALLOW', 'ALLOW_WITH_WARNING', 'HOLD_FOR_AUTHORITY', 'BLOCK')),
  edition_status TEXT,
  edition_lock TEXT,
  final_disposition_allowed BOOLEAN DEFAULT false,
  authority_confidence NUMERIC(3,2) DEFAULT 0.0,
  source_quality_score NUMERIC(3,2) DEFAULT 0.0,
  authority_freshness_score NUMERIC(3,2) DEFAULT 0.0,
  unit_conversion_required BOOLEAN DEFAULT false,
  warning TEXT,
  inspector_message TEXT,
  audit_trace JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_edition_registry_code ON global_edition_registry(code);
CREATE INDEX IF NOT EXISTS idx_edition_registry_withdrawn ON global_edition_registry(withdrawn) WHERE withdrawn = true;
CREATE INDEX IF NOT EXISTS idx_verification_cache_key ON global_verification_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_verification_cache_expires ON global_verification_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_authority_decisions_id ON global_authority_decisions(authority_decision_id);
CREATE INDEX IF NOT EXISTS idx_authority_decisions_code ON global_authority_decisions(requested_code);
CREATE INDEX IF NOT EXISTS idx_authority_decisions_created ON global_authority_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_authority_decisions_lock ON global_authority_decisions(decision_lock);

-- RLS
ALTER TABLE global_edition_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_verification_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_source_credibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_authority_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edition_registry_read" ON global_edition_registry FOR SELECT USING (true);
CREATE POLICY "verification_cache_read" ON global_verification_cache FOR SELECT USING (true);
CREATE POLICY "verification_cache_insert" ON global_verification_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "source_credibility_read" ON global_source_credibility FOR SELECT USING (true);
CREATE POLICY "authority_decisions_insert" ON global_authority_decisions FOR INSERT WITH CHECK (true);
CREATE POLICY "authority_decisions_read" ON global_authority_decisions FOR SELECT USING (true);

-- Seed edition registry
INSERT INTO global_edition_registry (code, current_edition, current_year, previous_editions, issuing_body, official_source_url, last_verified, verification_source, withdrawn, superseded_by) VALUES
  ('API 570', '4th Edition, February 2016 (Addendum 1, April 2021)', 2016, ARRAY['3rd Edition, 2009', '2nd Edition, 1998'], 'American Petroleum Institute', 'https://www.api.org/products-and-services/standards', '2025-03-01', 'API Publications Store', false, NULL),
  ('API 510', '11th Edition, May 2023', 2023, ARRAY['10th Edition, 2014', '9th Edition, 2006'], 'American Petroleum Institute', 'https://www.api.org/products-and-services/standards', '2025-03-01', 'API Publications Store', false, NULL),
  ('API 579-1/ASME FFS-1', '3rd Edition, June 2021', 2021, ARRAY['2nd Edition, 2016', '1st Edition, 2007'], 'API / ASME', 'https://www.api.org/products-and-services/standards', '2025-03-01', 'API Publications Store', false, NULL),
  ('API 1104', '22nd Edition, 2019 (Errata 1, 2020)', 2019, ARRAY['21st Edition, 2013', '20th Edition, 2005'], 'American Petroleum Institute', 'https://www.api.org/products-and-services/standards', '2025-03-01', 'API Publications Store', false, NULL),
  ('ASME BPVC Section VIII', '2023 Edition', 2023, ARRAY['2021 Edition', '2019 Edition'], 'ASME', 'https://www.asme.org/codes-standards/find-codes-standards/bpvc', '2025-03-01', 'ASME Standards Store', false, NULL),
  ('ASME B31.3', '2022 Edition', 2022, ARRAY['2020 Edition', '2018 Edition'], 'ASME', 'https://www.asme.org/codes-standards', '2025-03-01', 'ASME Standards Store', false, NULL),
  ('AWS D1.1', 'AWS D1.1/D1.1M:2020', 2020, ARRAY['D1.1:2015', 'D1.1:2010'], 'American Welding Society', 'https://pubs.aws.org', '2025-03-01', 'AWS Pubs Store', false, NULL),
  ('AWS D1.5', 'AWS D1.5M/D1.5:2020', 2020, ARRAY['D1.5:2015', 'D1.5:2010'], 'American Welding Society', 'https://pubs.aws.org', '2025-03-01', 'AWS Pubs Store', false, NULL),
  ('EN 13445', 'EN 13445:2021 (Parts 1-10)', 2021, ARRAY['EN 13445:2014', 'EN 13445:2009'], 'CEN', 'https://www.en-standard.eu', '2025-03-01', 'CEN/CENELEC', false, NULL),
  ('PED 2014/68/EU', 'Directive 2014/68/EU (effective 2016)', 2014, ARRAY['Directive 97/23/EC (repealed 2016)'], 'European Parliament / Council', 'https://eur-lex.europa.eu', '2025-03-01', 'EUR-Lex', false, NULL),
  ('BS 7910', 'BS 7910:2019+A1:2024', 2019, ARRAY['BS 7910:2013+A1:2015', 'BS 7910:2005'], 'BSI', 'https://shop.bsigroup.com', '2025-03-01', 'BSI Shop', false, NULL),
  ('CSA Z662', 'CSA Z662:2023', 2023, ARRAY['CSA Z662:2019', 'CSA Z662:2015'], 'CSA Group', 'https://www.csagroup.org', '2025-03-01', 'CSA Store', false, NULL),
  ('NORSOK M-001', 'NORSOK M-001:2014 (Ed. 5)', 2014, ARRAY['Rev. 4, 2004', 'Rev. 3, 2002'], 'Standard Norge', 'https://www.standard.no', '2025-03-01', 'Standard Norge', false, NULL),
  ('DNV-ST-F101', 'DNV-ST-F101 (2021)', 2021, ARRAY['DNV-OS-F101 (2013)', 'DNV-OS-F101 (2010)'], 'DNV', 'https://www.dnv.com/rules-standards', '2025-03-01', 'DNV Rules Store', false, NULL),
  ('PED 97/23/EC', 'WITHDRAWN — replaced by PED 2014/68/EU', 1997, ARRAY[]::TEXT[], 'European Parliament', 'https://eur-lex.europa.eu', '2025-03-01', 'EUR-Lex', true, 'PED 2014/68/EU'),
  ('API RP 579', 'SUPERSEDED — replaced by API 579-1/ASME FFS-1', 2000, ARRAY[]::TEXT[], 'API', 'https://www.api.org', '2025-03-01', 'API Publications Store', false, 'API 579-1/ASME FFS-1'),
  ('BS PD 6493', 'WITHDRAWN — replaced by BS 7910', 1991, ARRAY[]::TEXT[], 'BSI', 'https://shop.bsigroup.com', '2025-03-01', 'BSI Shop', true, 'BS 7910'),
  ('DNV-OS-F101', 'SUPERSEDED — replaced by DNV-ST-F101 (2021)', 2013, ARRAY['2010', '2007'], 'DNV', 'https://www.dnv.com', '2025-03-01', 'DNV Rules Store', false, 'DNV-ST-F101')
ON CONFLICT (code) DO NOTHING;

-- Seed source credibility
INSERT INTO global_source_credibility (source_type, quality_score, is_official, notes) VALUES
  ('Official standards body publication store (API, ASME, AWS, BSI, CSA, CEN)', 1.0, true, 'Primary authoritative source'),
  ('Government regulatory gazette (Federal Register, EUR-Lex, gov.br)', 1.0, true, 'Legal authority for regulatory standards'),
  ('Standards body official website (api.org, asme.org, aws.org)', 0.95, true, 'May not reflect latest errata/addenda'),
  ('Class society rules store (DNV, Lloyds, ABS, BV)', 0.95, true, 'Authoritative for classification rules'),
  ('National regulatory body website (OSHA, HSE, PSA, SAMR)', 0.90, true, 'May lag behind publication updates'),
  ('Industry consortium / trade body (NACE, SSPC, NORSOK)', 0.85, true, 'Authoritative for scope-specific standards'),
  ('Licensed distributor (IHS Markit, Techstreet, SAI Global)', 0.85, false, 'Reliable but verify currency'),
  ('Professional reference textbook (published, peer-reviewed)', 0.70, false, 'May reference older editions'),
  ('Company internal specification', 0.60, false, 'Must verify traceability to governing standard'),
  ('Training material / course notes', 0.50, false, 'May be outdated or simplified'),
  ('Industry blog / article (non-peer-reviewed)', 0.30, false, 'Unreliable for edition/applicability claims'),
  ('Generic web search / AI-generated content', 0.10, false, 'NEVER use as authority basis for final disposition'),
  ('Unknown / unverified source', 0.0, false, 'Cannot support any authority decision')
ON CONFLICT (source_type) DO NOTHING;