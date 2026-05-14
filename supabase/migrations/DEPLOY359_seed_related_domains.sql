-- ============================================================
-- DEPLOY359 — Sprint 4 Polish 2 (Fix 2): seed related_domains for
--             all 34 cd_degradation_mechanisms rows
--
-- WHY THIS MIGRATION EXISTS:
--   Sprint 4 Polish (Fix F) widened the causal chain engine's
--   domain_match scorer to compare mechanism.related_domains against
--   a union of asset-side tokens (asset.domain + asset.asset_type +
--   tokens extracted from asset.service_environment +
--   asset.location_description). The code is correct, but the
--   matcher never fired in production because the DEPLOY355 seed
--   inserted cd_degradation_mechanisms rows with related_domains
--   defaulted to '[]'::jsonb — leaving every fit_score capped at 0.5
--   (severity_envelope + mechanism_already_cited contributions only).
--
--   This migration populates related_domains for all 34 seeded
--   mechanisms with engineering-defensible domain lists, drawn from
--   the union of the AssetDomain enum (pipeline, subsea, marine,
--   marine_vessel, pressure_equipment, structural, coatings,
--   corrosion, welding, power_generation, industrial,
--   port_infrastructure, diving) and the Fix F ENVIRONMENT_TOKENS
--   list (atmospheric, buried, onshore, offshore, splash, immersed,
--   underwater, subterranean). Tokens are chosen so the matcher
--   fires on BOTH direct asset.domain matches AND on tokens
--   extracted from asset.service_environment / location_description.
--
--   Mappings reviewed and approved with collaborator before commit.
--   Philosophy: inclusive — false positives slightly over-rank a
--   candidate; false negatives drag down ALL fit scores.
--
-- HOW TO APPLY:
--   Same manual path as DEPLOY356 / DEPLOY357 / DEPLOY358. Idempotent
--   — every UPDATE is unconditional, can be re-applied safely.
-- ============================================================

-- ---------- Corrosion mechanisms (7) ----------
UPDATE cd_degradation_mechanisms
   SET related_domains = '["pipeline","pressure_equipment","subsea","marine","structural","industrial","coatings","corrosion","atmospheric","buried","marine_vessel","port_infrastructure"]'::jsonb
 WHERE mechanism_key = 'general_corrosion';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["pipeline","pressure_equipment","subsea","marine","industrial","coatings","corrosion","marine_vessel","port_infrastructure"]'::jsonb
 WHERE mechanism_key = 'pitting_corrosion';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["pipeline","pressure_equipment","subsea","marine","industrial","coatings","corrosion","marine_vessel"]'::jsonb
 WHERE mechanism_key = 'crevice_corrosion';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["subsea","marine","pipeline","coatings","corrosion","marine_vessel","port_infrastructure"]'::jsonb
 WHERE mechanism_key = 'galvanic_corrosion';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["pipeline","subsea","marine","industrial","corrosion","buried","marine_vessel","port_infrastructure"]'::jsonb
 WHERE mechanism_key = 'microbiologically_influenced_corrosion';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["pressure_equipment","pipeline","industrial","corrosion","power_generation"]'::jsonb
 WHERE mechanism_key = 'corrosion_under_insulation';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["pipeline","pressure_equipment","industrial","marine","corrosion","power_generation"]'::jsonb
 WHERE mechanism_key = 'erosion_corrosion';

-- ---------- Coating mechanisms (4) ----------
UPDATE cd_degradation_mechanisms
   SET related_domains = '["coatings","subsea","marine","pipeline","pressure_equipment","structural","marine_vessel","port_infrastructure"]'::jsonb
 WHERE mechanism_key = 'coating_blistering';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["coatings","subsea","marine","pipeline","pressure_equipment","structural","marine_vessel","port_infrastructure"]'::jsonb
 WHERE mechanism_key = 'coating_holiday';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["coatings","subsea","marine","pipeline","pressure_equipment","structural","marine_vessel","port_infrastructure"]'::jsonb
 WHERE mechanism_key = 'coating_disbondment';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["coatings","subsea","marine","pipeline","pressure_equipment","structural","corrosion","marine_vessel"]'::jsonb
 WHERE mechanism_key = 'underfilm_corrosion';

-- ---------- CP-related (2) ----------
UPDATE cd_degradation_mechanisms
   SET related_domains = '["subsea","marine","pipeline","buried","corrosion","coatings","port_infrastructure"]'::jsonb
 WHERE mechanism_key = 'cathodic_protection_failure';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["subsea","marine","pipeline","buried","corrosion","port_infrastructure","marine_vessel"]'::jsonb
 WHERE mechanism_key = 'anode_depletion';

-- ---------- Environmental / loading (3) ----------
UPDATE cd_degradation_mechanisms
   SET related_domains = '["subsea","marine","marine_vessel","port_infrastructure","structural","diving"]'::jsonb
 WHERE mechanism_key = 'marine_growth_loading';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["subsea","marine","port_infrastructure","structural","buried","marine_vessel"]'::jsonb
 WHERE mechanism_key = 'scour';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["structural","pipeline","buried","port_infrastructure","industrial"]'::jsonb
 WHERE mechanism_key = 'settlement';

-- ---------- Fatigue & cracking (3) ----------
UPDATE cd_degradation_mechanisms
   SET related_domains = '["pipeline","pressure_equipment","structural","marine","welding","subsea","power_generation","marine_vessel"]'::jsonb
 WHERE mechanism_key = 'fatigue_cracking';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["welding","pipeline","pressure_equipment","structural","marine","subsea","marine_vessel"]'::jsonb
 WHERE mechanism_key = 'weld_toe_cracking';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["welding","pipeline","pressure_equipment","industrial","subsea","corrosion"]'::jsonb
 WHERE mechanism_key = 'hydrogen_cracking';

-- ---------- Weld defects (3) ----------
UPDATE cd_degradation_mechanisms
   SET related_domains = '["welding","pipeline","pressure_equipment","structural"]'::jsonb
 WHERE mechanism_key = 'lack_of_fusion';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["welding","pipeline","pressure_equipment","structural"]'::jsonb
 WHERE mechanism_key = 'undercut';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["welding","pipeline","pressure_equipment","structural"]'::jsonb
 WHERE mechanism_key = 'porosity';

-- ---------- Mechanical damage (5) ----------
UPDATE cd_degradation_mechanisms
   SET related_domains = '["pipeline","pressure_equipment","structural","subsea","marine","port_infrastructure","marine_vessel"]'::jsonb
 WHERE mechanism_key = 'impact_damage';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["subsea","marine","port_infrastructure","pipeline","structural","marine_vessel","diving"]'::jsonb
 WHERE mechanism_key = 'dropped_object_damage';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["marine","subsea","port_infrastructure","marine_vessel","structural","pipeline"]'::jsonb
 WHERE mechanism_key = 'vessel_strike_damage';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["pipeline","pressure_equipment","industrial","marine","subsea","structural"]'::jsonb
 WHERE mechanism_key = 'abrasion_damage';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["pipeline","pressure_equipment","marine","marine_vessel","industrial","power_generation"]'::jsonb
 WHERE mechanism_key = 'cavitation_damage';

-- ---------- Thermal / pressure (2) ----------
UPDATE cd_degradation_mechanisms
   SET related_domains = '["pressure_equipment","pipeline","industrial","power_generation"]'::jsonb
 WHERE mechanism_key = 'thermal_cycling';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["pressure_equipment","pipeline","industrial","power_generation"]'::jsonb
 WHERE mechanism_key = 'pressure_cycling';

-- ---------- Concrete (4) ----------
UPDATE cd_degradation_mechanisms
   SET related_domains = '["structural","marine","port_infrastructure","industrial"]'::jsonb
 WHERE mechanism_key = 'concrete_spalling';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["structural","marine","port_infrastructure","buried","corrosion","industrial"]'::jsonb
 WHERE mechanism_key = 'rebar_corrosion';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["structural","marine","port_infrastructure","subsea","splash","atmospheric"]'::jsonb
 WHERE mechanism_key = 'chloride_attack';

UPDATE cd_degradation_mechanisms
   SET related_domains = '["structural","marine","port_infrastructure","onshore","atmospheric"]'::jsonb
 WHERE mechanism_key = 'freeze_thaw_damage';

-- ---------- Unknown (1) ----------
-- Single token that won't match any real asset — explicitly opts out
-- of domain scoring rather than wildcard-matching everything.
UPDATE cd_degradation_mechanisms
   SET related_domains = '["unknown"]'::jsonb
 WHERE mechanism_key = 'unknown_mechanism';

-- ---------- Verification --------------------------------------
-- After applying, every row should report a non-empty related_domains.
-- Sanity check (run manually post-apply):
--
--   SELECT mechanism_key, jsonb_array_length(related_domains) AS n
--   FROM cd_degradation_mechanisms
--   ORDER BY mechanism_key;
--
-- Expect 34 rows with n >= 1.
-- --------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
