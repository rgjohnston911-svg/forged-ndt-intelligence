-- ============================================================
-- DEPLOY360 — Sprint 5 Phase A.0: seed pressure-vessel weld-toe
--             indication anomaly (the second canonical case after
--             the subsea pipeline corrosion case at a01/a02).
--
-- WHY THIS MIGRATION EXISTS:
--   Sprint 5 widens the cross-domain demonstration corpus from one
--   anomaly (subsea pipeline external wall loss) to three, so the
--   cross-domain memory backbone and causal-chain engine can be
--   exercised across domains that exercise different mechanism
--   families. This migration seeds the pressure-equipment case:
--   a 35mm linear surface-breaking indication at the weld toe of a
--   nozzle-to-shell weld on a sour-service crude surge drum.
--   Mechanism families this anomaly should activate downstream:
--   hydrogen_cracking (NACE MR0175 sour service), weld_toe_cracking.
--
--   The row shapes (column tuples, jsonb envelopes, reliability_weight
--   / confidence calibration, captured_at offsets) mirror the existing
--   a01/a02/e01-e03 production seed EXACTLY. No new enum values are
--   introduced; every CHECK constraint value comes from DEPLOY355.
--
-- HOW TO APPLY:
--   Same manual path as DEPLOY356 / DEPLOY357 / DEPLOY358 / DEPLOY359
--   (paste into the Supabase SQL editor under the service-role
--   connection). Idempotent — INSERT ... ON CONFLICT (id) DO NOTHING
--   so a re-apply is safe. DOES NOT touch the existing a01/a02 rows.
--
-- THIS PR DOES NOT APPLY THE SEED. Phase A.1 handles application.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Asset: V-301 Crude Atmospheric Surge Drum
--    asset_id = 00000000-0000-0000-0000-000000000a03
-- ------------------------------------------------------------
INSERT INTO cd_asset_nodes (
  id, org_id, asset_key, asset_name, domain, asset_type, asset_subtype,
  parent_asset_id, location_description, gps_lat, gps_lon,
  material, material_grade, coating_system, design_code, service_environment,
  operating_conditions, owner, operator, client,
  install_date, design_life_years, expected_service_life_end,
  criticality, status, metadata_jsonb
) VALUES (
  '00000000-0000-0000-0000-000000000a03',
  '713dcec2-69db-43e2-a367-457a1fe6d943',
  'PV-V301-001',
  'V-301 Crude Atmospheric Surge Drum',
  'pressure_equipment',
  'pressure_vessel',
  'surge_drum',
  NULL,
  'Refinery Beta, Crude Distillation Unit (CDU), Unit 11, onshore',
  NULL,
  NULL,
  'carbon_steel',
  'ASME SA-516 Grade 70',
  'Internal: solvent-borne phenolic epoxy 250um DFT; External: organic zinc-rich primer + epoxy intermediate + aliphatic polyurethane topcoat',
  'ASME BPVC Section VIII Division 1',
  'onshore_sour_service_h2s',
  '{"fluid": "crude_with_h2s_3pct", "operating_temp_c": 75, "operating_pressure_psig": 145, "h2s_partial_pressure_kpa": 33, "nace_mr0175_classification": "sour_service"}'::jsonb,
  'Operator Beta Refining LLC',
  'Operator Beta Refining LLC',
  'Operator Beta Refining LLC',
  '2003-08-22',
  30,
  NULL,
  'high',
  'active',
  '{"vessel_id_inches": 138, "shell_thickness_nominal_mm": 25.4, "tan_to_tan_length_m": 9.0, "design_pressure_psig": 200, "design_temp_c": 120, "joint_efficiency": 1.0}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Anomaly: linear weld-toe indication on N2 nozzle-to-shell weld
--    anomaly_id = 00000000-0000-0000-0000-000000000a04
-- ------------------------------------------------------------
INSERT INTO cd_asset_anomalies (
  id, org_id, asset_id, inspection_event_id, domain, anomaly_type,
  mechanism_key, severity, location_description, position_jsonb,
  description, measurement_jsonb, evidence_jsonb,
  original_field_language, normalized_language_jsonb,
  recommended_action, authority_status, prior_anomaly_id,
  forecast_jsonb, consequence_jsonb, causal_chain_jsonb, status
) VALUES (
  '00000000-0000-0000-0000-000000000a04',
  '713dcec2-69db-43e2-a367-457a1fe6d943',
  '00000000-0000-0000-0000-000000000a03',
  NULL,
  'pressure_equipment',
  'linear_weld_toe_indication',
  NULL,
  'cat_3_major',
  'External weld toe, 12 o''clock position at nozzle N2 (250mm OD outlet) to shell weld, north side of vessel',
  '{"nozzle_id": "N2", "weld_id": "shell_to_nozzle_N2", "circumferential_oclock": 12, "indication_length_mm": 35, "depth_from_od_mm": 4.5, "axial_offset_from_weld_toe_mm": 2}'::jsonb,
  'AUT phased-array scan during scheduled internal inspection campaign identified a 35mm linear indication at the 12 o''clock weld toe of the 250mm-diameter N2 nozzle-to-shell weld. Indication is surface-breaking, confirmed by follow-up MT examination. Maximum amplitude 62% DAC, indication depth 4.5mm from OD. Vessel is in H2S sour service per NACE MR0175 with H2S partial pressure 33 kPa.',
  '{"indication_length_mm": 35, "max_amplitude_dac_pct": 62, "indication_depth_mm": 4.5, "scan_method": "aut_phased_array", "aut_step_size_pct": 50}'::jsonb,
  '{"evidence_types": ["aut_phased_array_scan", "mt_surface_inspection", "nace_classification_record"], "primary_evidence_count": 3}'::jsonb,
  NULL,
  '{"locale": "en_US", "normalized": "Linear surface-breaking indication at nozzle-to-shell weld toe, 35mm length, sour service (NACE MR0175)"}'::jsonb,
  NULL,
  'hold_for_review',
  NULL,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  'open'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Evidence rows (3) — all linked to anomaly a04
-- ------------------------------------------------------------

-- e04: AUT phased-array scan (the primary detection)
INSERT INTO cd_evidence_items (
  id, org_id, linked_entity_type, linked_entity_id,
  evidence_type, source, reliability_weight,
  captured_at, captured_by, storage_path, sha256_hex,
  raw_text, structured_jsonb, confidence,
  human_verified, verified_by, verified_at
) VALUES (
  '00000000-0000-0000-0000-000000000e04',
  '713dcec2-69db-43e2-a367-457a1fe6d943',
  'anomaly',
  '00000000-0000-0000-0000-000000000a04',
  'measurement',
  'measured',
  0.95,
  '2026-04-15T09:18:00+00:00',
  NULL,
  NULL,
  NULL,
  'AUT phased-array scan across the N2 nozzle-to-shell weld, 12 o''clock region. 64-element 5MHz phased-array probe, 50% step size, 0-70 degree sectorial scan. Linear surface-breaking indication detected at the toe, length 35mm, max amplitude 62% DAC, depth 4.5mm from OD. Operator Level III ASNT TC-1A. Reference block calibration per ASME V Article 4.',
  '{"max_amplitude_dac_pct": 62, "method": "aut_phased_array", "indication_length_mm": 35, "depth_from_od_mm": 4.5, "probe_frequency_mhz": 5, "scan_angle_range_deg": "0-70", "step_size_pct": 50}'::jsonb,
  0.93,
  true,
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- e05: MT surface confirmation
INSERT INTO cd_evidence_items (
  id, org_id, linked_entity_type, linked_entity_id,
  evidence_type, source, reliability_weight,
  captured_at, captured_by, storage_path, sha256_hex,
  raw_text, structured_jsonb, confidence,
  human_verified, verified_by, verified_at
) VALUES (
  '00000000-0000-0000-0000-000000000e05',
  '713dcec2-69db-43e2-a367-457a1fe6d943',
  'anomaly',
  '00000000-0000-0000-0000-000000000a04',
  'photo',
  'observed',
  0.85,
  '2026-04-15T11:45:00+00:00',
  NULL,
  NULL,
  NULL,
  'Wet fluorescent MT examination of N2 weld toe region, 12 o''clock, following AUT detection. Yoke method, AC current 4 amps, fluorescent particle suspension. Linear indication confirmed surface-breaking, length approximately 33mm (consistent with AUT 35mm), oriented parallel to the weld toe. Photographic documentation under UV-A illumination per ASTM E709.',
  '{"method": "mt_wet_fluorescent", "indication_visible": true, "surface_breaking_confirmed": true, "indication_length_mm": 33, "magnetization_method": "yoke", "current_amps": 4, "particle_type": "wet_fluorescent_aerosol"}'::jsonb,
  0.90,
  true,
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- e06: NACE MR0175 sour service classification document
INSERT INTO cd_evidence_items (
  id, org_id, linked_entity_type, linked_entity_id,
  evidence_type, source, reliability_weight,
  captured_at, captured_by, storage_path, sha256_hex,
  raw_text, structured_jsonb, confidence,
  human_verified, verified_by, verified_at
) VALUES (
  '00000000-0000-0000-0000-000000000e06',
  '713dcec2-69db-43e2-a367-457a1fe6d943',
  'anomaly',
  '00000000-0000-0000-0000-000000000a04',
  'authority_reference',
  'reported',
  0.95,
  '2026-04-15T16:20:00+00:00',
  NULL,
  NULL,
  NULL,
  'NACE MR0175 / ISO 15156 classification record for V-301. H2S partial pressure in process gas calculated at 33 kPa (well above the 0.345 kPa sour-service threshold). Vessel falls within NACE MR0175 sour-service domain; carbon steel SA-516 Gr 70 is acceptable provided hardness < 22 HRC at weldments. Most recent hardness survey (2024) on the N2 weldment reported max 19 HRC, within acceptance.',
  '{"method": "authority_classification", "classification": "sour_service", "h2s_partial_pressure_kpa_actual": 33, "h2s_threshold_kpa": 0.345, "material_acceptance": "acceptable_subject_to_hardness", "applicable_clause": "NACE_MR0175_ISO_15156_Part_2", "hardness_survey_year": 2024, "hardness_survey_max_hrc": 19}'::jsonb,
  0.98,
  true,
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- Verification (run manually post-apply):
--
--   SELECT id, asset_name, domain, criticality
--     FROM cd_asset_nodes
--    WHERE id = '00000000-0000-0000-0000-000000000a03';
--   -- Expect 1 row
--
--   SELECT id, asset_id, anomaly_type, severity, authority_status
--     FROM cd_asset_anomalies
--    WHERE id = '00000000-0000-0000-0000-000000000a04';
--   -- Expect 1 row, asset_id = a03
--
--   SELECT id, evidence_type, source, reliability_weight
--     FROM cd_evidence_items
--    WHERE linked_entity_type = 'anomaly'
--      AND linked_entity_id = '00000000-0000-0000-0000-000000000a04'
--    ORDER BY id;
--   -- Expect 3 rows (e04, e05, e06)
-- ------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
