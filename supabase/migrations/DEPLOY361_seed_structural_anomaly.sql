-- ============================================================
-- DEPLOY361 — Sprint 5 Phase A.0: seed structural through-thickness
--             fatigue-crack anomaly (the third canonical case after
--             the subsea pipeline corrosion case at a01/a02 and the
--             pressure-vessel weld defect at a03/a04).
--
-- WHY THIS MIGRATION EXISTS:
--   Sprint 5 widens the cross-domain demonstration corpus from one
--   anomaly (subsea pipeline external wall loss) to three. This
--   migration seeds the structural case: a 200mm through-thickness
--   fatigue crack at the toe of a gusset-plate fillet weld on a
--   25-year-old offshore platform pedestal crane base. Mechanism
--   families this anomaly should activate downstream:
--   fatigue_cracking, weld_toe_cracking.
--
--   The row shapes (column tuples, jsonb envelopes, reliability_weight
--   / confidence calibration, captured_at offsets) mirror the existing
--   a01/a02/e01-e03 production seed EXACTLY. No new enum values are
--   introduced; every CHECK constraint value comes from DEPLOY355.
--
-- HOW TO APPLY:
--   Same manual path as DEPLOY356 / DEPLOY357 / DEPLOY358 / DEPLOY359
--   / DEPLOY360 (paste into the Supabase SQL editor under the
--   service-role connection). Idempotent — INSERT ... ON CONFLICT (id)
--   DO NOTHING so a re-apply is safe.
--
-- THIS PR DOES NOT APPLY THE SEED. Phase A.1 handles application.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Asset: Platform Alpha Aft-Deck Pedestal Crane PC-002
--    asset_id = 00000000-0000-0000-0000-000000000a05
-- ------------------------------------------------------------
INSERT INTO cd_asset_nodes (
  id, org_id, asset_key, asset_name, domain, asset_type, asset_subtype,
  parent_asset_id, location_description, gps_lat, gps_lon,
  material, material_grade, coating_system, design_code, service_environment,
  operating_conditions, owner, operator, client,
  install_date, design_life_years, expected_service_life_end,
  criticality, status, metadata_jsonb
) VALUES (
  '00000000-0000-0000-0000-000000000a05',
  '713dcec2-69db-43e2-a367-457a1fe6d943',
  'PC-002-PA',
  'Platform Alpha Aft-Deck Pedestal Crane PC-002',
  'structural',
  'pedestal_crane_base',
  'platform_pedestal',
  NULL,
  'Gulf of Mexico, Platform Alpha aft deck, aft starboard quadrant, splash-zone exposure',
  NULL,
  NULL,
  'carbon_steel',
  'ASTM A572 Grade 50',
  'Inorganic zinc-rich primer 75um + epoxy intermediate 125um + aliphatic polyurethane topcoat 75um; splash-zone segment re-coated 2018',
  'AWS D1.1 / API 2C',
  'offshore_splash_zone_cyclic_loading',
  '{"design_load_tonnes": 50, "cyclic_load_frequency_hz": 0.05, "operating_lift_cycles_per_year": 3500, "service_class": "API_2C_SLE_Class_B", "splash_zone_immersion_pct_time": 15}'::jsonb,
  'Operator Alpha LLC',
  'Operator Alpha LLC',
  'Operator Alpha LLC',
  '1999-06-10',
  25,
  NULL,
  'critical',
  'active',
  '{"pedestal_od_mm": 1500, "wall_thickness_mm": 60, "pedestal_height_m": 4.2, "boom_length_m": 25, "max_radius_m": 30, "swl_tonnes_at_max_radius": 15}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Anomaly: through-thickness fatigue crack at gusset weld toe
--    anomaly_id = 00000000-0000-0000-0000-000000000a06
-- ------------------------------------------------------------
INSERT INTO cd_asset_anomalies (
  id, org_id, asset_id, inspection_event_id, domain, anomaly_type,
  mechanism_key, severity, location_description, position_jsonb,
  description, measurement_jsonb, evidence_jsonb,
  original_field_language, normalized_language_jsonb,
  recommended_action, authority_status, prior_anomaly_id,
  forecast_jsonb, consequence_jsonb, causal_chain_jsonb, status
) VALUES (
  '00000000-0000-0000-0000-000000000a06',
  '713dcec2-69db-43e2-a367-457a1fe6d943',
  '00000000-0000-0000-0000-000000000a05',
  NULL,
  'structural',
  'through_thickness_fatigue_crack',
  NULL,
  'cat_4_critical',
  'Toe of gusset plate G3-W fillet weld, west side of pedestal, 200mm above baseplate',
  '{"gusset_id": "G3_W", "weld_location": "fillet_toe", "height_above_baseplate_mm": 200, "crack_length_mm": 200, "orientation": "transverse_to_principal_stress", "through_thickness": true}'::jsonb,
  'MT inspection during annual structural campaign identified a through-thickness crack at the toe of the western gusset plate (G3-W) fillet weld, 200mm above the baseplate. Crack length 200mm, oriented transverse to the principal stress direction from boom loading. Comparison with prior-year MT records shows 80mm length growth over 12 months. Asset has exceeded original 25-year design life (installed 1999). Service exposure: ~87,500 lift cycles to date at API 2C SLE Class B service.',
  '{"crack_length_mm": 200, "crack_length_prior_year_mm": 120, "annual_growth_rate_mm_per_yr": 80, "mt_indication_intensity": "strong", "through_thickness_confirmed": true, "cumulative_lift_cycles_estimated": 87500}'::jsonb,
  '{"evidence_types": ["mt_surface_inspection", "photographic_documentation", "load_history_record"], "primary_evidence_count": 3}'::jsonb,
  NULL,
  '{"locale": "en_US", "normalized": "Through-thickness fatigue crack at gusset weld toe, 200mm length, transverse to principal stress, critical offshore asset past design life"}'::jsonb,
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
-- 3. Evidence rows (3) — all linked to anomaly a06
-- ------------------------------------------------------------

-- e07: MT surface inspection (the primary detection)
INSERT INTO cd_evidence_items (
  id, org_id, linked_entity_type, linked_entity_id,
  evidence_type, source, reliability_weight,
  captured_at, captured_by, storage_path, sha256_hex,
  raw_text, structured_jsonb, confidence,
  human_verified, verified_by, verified_at
) VALUES (
  '00000000-0000-0000-0000-000000000e07',
  '713dcec2-69db-43e2-a367-457a1fe6d943',
  'anomaly',
  '00000000-0000-0000-0000-000000000a06',
  'measurement',
  'measured',
  0.95,
  '2026-04-18T08:30:00+00:00',
  NULL,
  NULL,
  NULL,
  'Wet visible MT examination of G3-W gusset fillet weld toe region during annual structural campaign. Yoke method, AC current 5 amps, contrast-paint background, red visible particle suspension. Continuous linear indication observed along the weld toe, length 200mm, oriented transverse to the boom axis (principal stress direction). Indication shows particle accumulation along entire length consistent with through-thickness penetration. Operator Level II ASNT TC-1A.',
  '{"method": "mt_wet_visible", "indication_length_mm": 200, "indication_width_mm": 1.5, "magnetization_method": "yoke", "current_amps": 5, "particle_type": "wet_visible_red", "background": "contrast_paint_white", "through_thickness_inferred": true}'::jsonb,
  0.93,
  true,
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- e08: Photographic documentation
INSERT INTO cd_evidence_items (
  id, org_id, linked_entity_type, linked_entity_id,
  evidence_type, source, reliability_weight,
  captured_at, captured_by, storage_path, sha256_hex,
  raw_text, structured_jsonb, confidence,
  human_verified, verified_by, verified_at
) VALUES (
  '00000000-0000-0000-0000-000000000e08',
  '713dcec2-69db-43e2-a367-457a1fe6d943',
  'anomaly',
  '00000000-0000-0000-0000-000000000a06',
  'photo',
  'observed',
  0.85,
  '2026-04-18T09:15:00+00:00',
  NULL,
  NULL,
  NULL,
  'High-resolution photographic documentation of MT indication on G3-W gusset weld toe, captured immediately post-MT. Visible reddish particle line traces full 200mm crack length along the weld toe. Reference scale rule placed adjacent to indication. Image captured at 24MP, daylight + supplemental LED illumination. Crack visible through coating thickness, indicating coating has failed locally along the crack line.',
  '{"method": "photographic_documentation", "crack_visible_in_image": true, "crack_length_measured_mm": 200, "image_resolution_mpix": 24, "scale_reference": "stainless_rule_300mm", "illumination": "daylight_plus_led", "coating_failure_observed": true}'::jsonb,
  0.88,
  true,
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- e09: Load history record (from crane SCADA)
INSERT INTO cd_evidence_items (
  id, org_id, linked_entity_type, linked_entity_id,
  evidence_type, source, reliability_weight,
  captured_at, captured_by, storage_path, sha256_hex,
  raw_text, structured_jsonb, confidence,
  human_verified, verified_by, verified_at
) VALUES (
  '00000000-0000-0000-0000-000000000e09',
  '713dcec2-69db-43e2-a367-457a1fe6d943',
  'anomaly',
  '00000000-0000-0000-0000-000000000a06',
  'sensor_import',
  'imported',
  0.90,
  '2026-04-18T14:50:00+00:00',
  NULL,
  NULL,
  NULL,
  'PC-002 SCADA load history extract covering 1999-06 through 2026-04 (26.8 service years). Cumulative lift cycles: 87,500 (mean 3,265 cycles/yr, peak 4,100 cycles/yr in 2014-2016 drilling campaign). Mean stress range at the G3-W gusset toe per FE model: 95 MPa. Peak stress range during heavy-lift operations: 165 MPa. S-N curve location: AWS D1.1 Table 2.4 Category E (fillet-weld toe transverse loading). Miner damage accumulation at gusset toe: D = 1.42 (exceeds D=1.0 endurance limit by 42%).',
  '{"method": "scada_load_history_extract", "service_hours_total": 87500, "lift_cycles_total": 87500, "mean_stress_range_mpa": 95, "peak_stress_range_mpa": 165, "sn_curve_class": "AWS_D1.1_Category_E", "miner_damage_fraction": 1.42, "exceeds_endurance_limit": true, "data_window_start": "1999-06-10", "data_window_end": "2026-04-18"}'::jsonb,
  0.91,
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
--    WHERE id = '00000000-0000-0000-0000-000000000a05';
--   -- Expect 1 row
--
--   SELECT id, asset_id, anomaly_type, severity, authority_status
--     FROM cd_asset_anomalies
--    WHERE id = '00000000-0000-0000-0000-000000000a06';
--   -- Expect 1 row, asset_id = a05
--
--   SELECT id, evidence_type, source, reliability_weight
--     FROM cd_evidence_items
--    WHERE linked_entity_type = 'anomaly'
--      AND linked_entity_id = '00000000-0000-0000-0000-000000000a06'
--    ORDER BY id;
--   -- Expect 3 rows (e07, e08, e09)
-- ------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
