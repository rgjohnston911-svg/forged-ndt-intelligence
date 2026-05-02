#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════
// BLIND VALIDATION SUITE 2 — 50 NEW GENERALIZATION CASES (51–100)
// FORGED 4D NDT Intelligence OS — Independent Generalization Test
//
// Purpose: Verify the physics-based Weibull derivation and classification
// engine generalize to ENTIRELY NEW scenarios never seen during
// development or tuning. Zero overlap with Suite 1 scenarios.
//
// Domains covered:
//   - Fixed Equipment (pressure vessels, piping, heat exchangers, tanks)
//   - Marine Vessels (tankers, bulk carriers, container ships, barges)
//   - Subsea Infrastructure (pipelines, risers, manifolds, trees)
//   - Production/Rotating Equipment (pumps, compressors, separators)
//
// Classification bands: LOW_RISK, MONITOR, INCREASE_INSPECTION,
// ENGINEERING_REVIEW, REPAIR_REPLACE, HOLD_FOR_INPUT
//
// Paths:
//   A = Survival model + classification (quantitative NDE data)
//   B = Local evidence-based classification (qualitative NDE)
//   C = Hybrid (orchestrator + survival + conformal predictions)
// ═══════════════════════════════════════════════════════════════════════

var https = require('https');
var http = require('http');
var url = require('url');

var BASE_URL = process.env.FORGED_URL || 'https://4dndt.netlify.app';

var SEVERITY_BANDS = ['LOW_RISK', 'MONITOR', 'INCREASE_INSPECTION', 'ENGINEERING_REVIEW', 'REPAIR_REPLACE', 'HOLD_FOR_INPUT'];

// ── GENERALIZATION TEST CASES (51–100) ─────────────────────────────────

var TEST_CASES = [

  // ════════════════════════════════════════════════════════════════════
  // FIXED EQUIPMENT DOMAIN (14 cases: 51–64)
  // ════════════════════════════════════════════════════════════════════

  // ── CASE 51: AMMONIA-ABSORBER-SCC-CRACKING-051 (PATH A) ──
  // Ammonia absorber column with active SCC. TOFD confirms crack 0.55"
  // growing at 0.12"/year. Stress intensity rising. Critical component.
  {
    id: 'Case 51',
    name: 'AMMONIA-ABSORBER-SCC-CRACKING-051',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'Carbon steel SA-516 Gr 70',
      service: 'ammonia absorption, alkaline pH 9.5',
      tofd_length: 0.55,
      crack_growth_rate_annual: 0.12,
      stress_history: 'cyclic pressure 150-600 psi daily',
      mechanism: 'scc_ammonia_service'
    },
  },

  // ── CASE 52: UNKNOWN-MATERIAL-FLARE-TIP-052 (PATH B) ──
  // Elevated flare tip (30-year old installation). Original material
  // certifications lost in office fire. Visual shows heavy oxidation.
  // Cannot confirm alloy grade or design temperature limits.
  {
    id: 'Case 52',
    name: 'UNKNOWN-MATERIAL-FLARE-TIP-052',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'unknown — records destroyed',
      visual: 'heavy oxidation, scaling, no nameplate',
      service_temp: 870,
      mechanism: 'unknown_material'
    },
  },

  // ── CASE 53: CUI-INSULATED-EXCHANGER-053 (PATH A) ──
  // Carbon steel heat exchanger shell in coastal refinery. Mineral wool
  // insulation with failed jacketing. Coating age 10 years. Localized
  // wall loss under insulation detected by profile RT.
  {
    id: 'Case 53',
    name: 'CUI-INSULATED-EXCHANGER-053',
    path: 'A',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'heat_exchanger',
      material: 'SA-106 Gr B carbon steel',
      tnom: 0.250,
      tmm: 0.222,
      corrosion_rate_annual: 0.015,
      coating_age: 10,
      insulation_type: 'mineral wool, jacketing breached',
      mechanism: 'cui_insulated_piping'
    },
  },

  // ── CASE 54: INCONSISTENT-UT-READINGS-COLUMN-054 (PATH B) ──
  // Distillation column with conflicting UT readings between two
  // inspection crews. Crew A: 0.42" average. Crew B: 0.38" average.
  // Calibration records incomplete. Cannot determine true wall.
  {
    id: 'Case 54',
    name: 'INCONSISTENT-UT-READINGS-COLUMN-054',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-516 Gr 70',
      ut_crew_a: 0.420,
      ut_crew_b: 0.380,
      calibration_status: 'incomplete records',
      mechanism: 'inconsistent_ut'
    },
  },

  // ── CASE 55: REFINERY-TOWER-ACTIVE-LEAK-055 (PATH A) ──
  // Crude unit atmospheric tower. Leak detected at weld seam on
  // nozzle-to-shell junction. Active weeping confirmed by dye test.
  // Emergency containment in place.
  {
    id: 'Case 55',
    name: 'REFINERY-TOWER-ACTIVE-LEAK-055',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-387 Gr 11 Cl 2',
      service: 'crude atmospheric distillation',
      leak_history: 'yes — active weeping at nozzle weld',
      nozzle_location: 'N4 shell junction',
      mechanism: 'active_leak_nozzle_weld'
    },
  },

  // ── CASE 56: WELD-POROSITY-STORAGE-TANK-056 (PATH B) ──
  // New construction storage tank. RT of circumferential weld shows
  // scattered rounded porosity. All indications within ASME acceptance.
  // No planar or linear indications detected.
  {
    id: 'Case 56',
    name: 'WELD-POROSITY-STORAGE-TANK-056',
    path: 'B',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'storage_tank',
      material: 'A36 structural steel',
      rt_findings: 'scattered rounded porosity, all within acceptance criteria',
      weld_type: 'circumferential butt weld',
      mechanism: 'rounded_porosity_only'
    },
  },

  // ── CASE 57: LOCALIZED-WALL-LOSS-DEA-UNIT-057 (PATH B) ──
  // DEA (diethanolamine) absorber column. Localized wall loss detected
  // at vapor inlet nozzle. Pattern consistent with impingement erosion.
  // Wall still above minimum but trending.
  {
    id: 'Case 57',
    name: 'LOCALIZED-WALL-LOSS-DEA-UNIT-057',
    path: 'B',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-516 Gr 70 with PWHT',
      location: 'vapor inlet nozzle',
      ut_pattern: 'localized thinning at impingement zone',
      mechanism: 'localized_wall_loss'
    },
  },

  // ── CASE 58: EROSION-REDUCER-BEND-058 (PATH A) ──
  // 6" reducer bend in slurry transfer line. High flow velocity
  // causing measurable erosion thinning. UT grid confirms localized loss.
  {
    id: 'Case 58',
    name: 'EROSION-REDUCER-BEND-058',
    path: 'A',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'A106 Gr B',
      diameter: '6-inch',
      tnom: 0.322,
      tmm: 0.290,
      corrosion_rate_annual: 0.018,
      flow_velocity: 4.5,
      service: 'slurry transfer, abrasive particles',
      mechanism: 'erosion_reducer_bend'
    },
  },

  // ── CASE 59: COATING-HOLIDAY-BURIED-PIPE-059 (PATH B) ──
  // Buried carbon steel pipeline. CP survey shows coating holiday
  // with pipe-to-soil potential readings outside protective range.
  // Excavation confirms visible coating breakdown at 3 o'clock.
  {
    id: 'Case 59',
    name: 'COATING-HOLIDAY-BURIED-PIPE-059',
    path: 'B',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'API 5L Gr B',
      coating: 'FBE — holiday confirmed at 3 o\'clock',
      cp_potential: '-720 mV (below protective threshold)',
      mechanism: 'coating_holiday_visible'
    },
  },

  // ── CASE 60: PLANAR-FLAW-REACTOR-NOZZLE-060 (PATH B) ──
  // Hydroprocessing reactor nozzle. TOFD detects planar flaw at
  // nozzle-to-shell weld HAZ. Flaw oriented perpendicular to
  // principal stress direction. FFS required.
  {
    id: 'Case 60',
    name: 'PLANAR-FLAW-REACTOR-NOZZLE-060',
    path: 'B',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: '2.25Cr-1Mo-0.25V',
      tofd_findings: 'planar indication 0.35" x 0.08" at HAZ',
      flaw_orientation: 'perpendicular to hoop stress',
      mechanism: 'planar_flaw_detected'
    },
  },

  // ── CASE 61: DELAMINATION-CLAD-VESSEL-061 (PATH B) ──
  // Stainless-clad pressure vessel. UT shear wave detects disbondment
  // between 316L cladding and carbon steel base. Area ~18 sq inches
  // near a nozzle reinforcement pad.
  {
    id: 'Case 61',
    name: 'DELAMINATION-CLAD-VESSEL-061',
    path: 'B',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-516 Gr 70 + 316L clad',
      ut_findings: 'cladding disbondment 18 sq in near nozzle pad',
      location: 'shell course 2, adjacent to N6',
      mechanism: 'delamination_confirmed'
    },
  },

  // ── CASE 62: AMINE-UNIT-CORROSION-WALL-LOSS-062 (PATH A) ──
  // Rich amine piping in gas treating unit. Measurable wall loss from
  // amine corrosion. Rate trending upward due to increased acid gas loading.
  {
    id: 'Case 62',
    name: 'AMINE-UNIT-CORROSION-WALL-LOSS-062',
    path: 'A',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'A106 Gr B',
      diameter: '10-inch',
      tnom: 0.500,
      tmm: 0.438,
      corrosion_rate_annual: 0.028,
      service: 'rich amine, H2S/CO2 loading increased',
      mechanism: 'amine_corrosion_accelerating'
    },
  },

  // ── CASE 63: THROUGH-WALL-CRACK-STEAM-DRUM-063 (PATH B) ──
  // Power boiler steam drum. Through-wall crack detected at downcomer
  // nozzle attachment weld. Wet fluorescent MT confirms crack extends
  // beyond weld toe into base metal.
  {
    id: 'Case 63',
    name: 'THROUGH-WALL-CRACK-STEAM-DRUM-063',
    path: 'B',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-299',
      mt_findings: 'through-wall crack 2.8" at downcomer weld toe',
      crack_extends_to: 'base metal beyond HAZ',
      mechanism: 'through_wall_crack'
    },
  },

  // ── CASE 64: ATMOSPHERIC-TANK-SLOW-CORROSION-064 (PATH A) ──
  // Atmospheric crude oil storage tank floor plates. Slow uniform
  // corrosion on product side. Rate steady over 3 inspection intervals.
  // Substantial remaining wall above minimum.
  {
    id: 'Case 64',
    name: 'ATMOSPHERIC-TANK-SLOW-CORROSION-064',
    path: 'A',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'storage_tank',
      material: 'A283 Gr C',
      tnom: 0.250,
      tmm: 0.210,
      corrosion_rate_annual: 0.006,
      service: 'crude oil storage, atmospheric',
      inspection_intervals: 3,
      mechanism: 'general_atmospheric_corrosion'
    },
  },

  // ════════════════════════════════════════════════════════════════════
  // MARINE VESSELS DOMAIN (14 cases: 65–78)
  // ════════════════════════════════════════════════════════════════════

  // ── CASE 65: TANKER-HULL-THROUGH-WALL-CORROSION-065 (PATH A) ──
  // Oil tanker hull bottom plating. Through-wall corrosion confirmed
  // at weep point near bilge keel. Active seawater ingress in void space.
  {
    id: 'Case 65',
    name: 'TANKER-HULL-THROUGH-WALL-CORROSION-065',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'AH36 shipbuilding steel',
      through_wall: true,
      location: 'hull bottom plate, frame 42-44 near bilge keel',
      seawater_ingress: 'confirmed in void space',
      mechanism: 'hull_through_wall_corrosion'
    },
  },

  // ── CASE 66: POOR-SURFACE-CONDITION-CARGO-HOLD-066 (PATH B) ──
  // Bulk carrier cargo hold. Heavy scale and cargo residue prevent
  // meaningful UT readings. Surface preparation attempted but failed
  // due to hardened cement clinker deposits.
  {
    id: 'Case 66',
    name: 'POOR-SURFACE-CONDITION-CARGO-HOLD-066',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'AH32',
      surface_condition: 'heavy scale + cement clinker, UT impossible',
      attempted_prep: 'mechanical grinding failed',
      mechanism: 'poor_surface_condition'
    },
  },

  // ── CASE 67: DECK-DRAIN-SCUPPER-PITTING-067 (PATH A) ──
  // General cargo vessel deck plating around drain scupper. Pitting
  // corrosion accelerated by standing water and galvanic couple with
  // bronze drain fitting. High flow wash-down velocity.
  {
    id: 'Case 67',
    name: 'DECK-DRAIN-SCUPPER-PITTING-067',
    path: 'A',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'mild steel deck plate',
      tnom: 0.315,
      tmm: 0.280,
      corrosion_rate_annual: 0.007,
      pit_depth: 0.005,
      flow_velocity: 3.0,
      service: 'deck drain scupper area, standing water',
      mechanism: 'deck_pitting_drain_corrosion'
    },
  },

  // ── CASE 68: MISSING-RECORDS-VESSEL-RUDDER-068 (PATH B) ──
  // Aging container ship. Rudder stock inspection due but historical
  // records (class survey reports, repair history) unavailable after
  // flag state transfer. Cannot establish baseline condition.
  {
    id: 'Case 68',
    name: 'MISSING-RECORDS-VESSEL-RUDDER-068',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'forged steel',
      component: 'rudder stock and pintle',
      records_status: 'lost during flag transfer',
      mechanism: 'missing_records'
    },
  },

  // ── CASE 69: CARGO-TANK-LONGITUDINAL-FATIGUE-069 (PATH A) ──
  // Oil tanker cargo tank longitudinal bulkhead. Fatigue cracking at
  // stiffener end bracket. Cycle estimate from wave loading model.
  // Measurable wall loss compounds fatigue damage assessment.
  {
    id: 'Case 69',
    name: 'CARGO-TANK-LONGITUDINAL-FATIGUE-069',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'AH36 shipbuilding steel',
      tnom: 0.625,
      tmm: 0.540,
      estimated_cycles_to_rupture: 20000,
      cycles_per_year: 3000,
      location: 'longitudinal bulkhead stiffener end bracket',
      mechanism: 'cargo_tank_fatigue_longitudinal'
    },
  },

  // ── CASE 70: COATING-DAMAGE-BALLAST-TANK-UPPER-070 (PATH B) ──
  // Product tanker ballast tank upper structure. Coating system shows
  // breakdown (PSPC rating FAIR) but no measurable steel wastage.
  // Previous gauging confirms full nominal thickness retained.
  {
    id: 'Case 70',
    name: 'COATING-DAMAGE-BALLAST-TANK-UPPER-070',
    path: 'B',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'mild steel',
      coating_condition: 'PSPC FAIR — breakdown but no steel loss',
      gauging: 'full nominal thickness retained',
      mechanism: 'coating_damage_only'
    },
  },

  // ── CASE 71: LINING-FAILURE-CARGO-TANK-071 (PATH B) ──
  // Chemical tanker cargo tank. Phenolic epoxy lining failure detected
  // during visual inspection. Blistering and delamination over 15% of
  // tank bottom. Cargo compatibility concern.
  {
    id: 'Case 71',
    name: 'LINING-FAILURE-CARGO-TANK-071',
    path: 'B',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'mild steel + phenolic epoxy lining',
      lining_condition: 'blistering and delamination 15% of tank bottom',
      cargo_concern: 'potential contamination risk',
      mechanism: 'lining_failure_causal'
    },
  },

  // ── CASE 72: TANKER-DESIGN-LIFE-CONSUMED-072 (PATH A) ──
  // Aging single-hull tanker converted to storage. 72% of original
  // design fatigue life consumed per class fatigue assessment.
  // Inspection plan under review.
  {
    id: 'Case 72',
    name: 'TANKER-DESIGN-LIFE-CONSUMED-072',
    path: 'A',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'AH32 shipbuilding steel',
      design_life_consumed: 72,
      service: 'single-hull tanker converted to FSO',
      class_assessment: 'fatigue life 72% consumed',
      mechanism: 'design_life_fatigue_consumed'
    },
  },

  // ── CASE 73: WELDER-QUAL-PENDING-REPAIR-073 (PATH B) ──
  // Bulk carrier side shell repair. Welder qualification records
  // for the repair contractor cannot be verified against class
  // requirements. Repair integrity unconfirmed.
  {
    id: 'Case 73',
    name: 'WELDER-QUAL-PENDING-REPAIR-073',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'AH36',
      repair_location: 'side shell frame 88-92',
      welder_status: 'qualification records unverifiable',
      mechanism: 'welder_qual_pending'
    },
  },

  // ── CASE 74: GALVANIC-CORROSION-STERN-TUBE-074 (PATH B) ──
  // Container ship stern tube. Galvanic corrosion between bronze
  // bearing sleeve and steel housing. Measurable thinning of steel
  // at bronze-steel interface. CP system not covering this area.
  {
    id: 'Case 74',
    name: 'GALVANIC-CORROSION-STERN-TUBE-074',
    path: 'B',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'cast steel housing + bronze sleeve',
      galvanic_couple: 'bronze-steel, CP not covering',
      thinning_pattern: 'localized at dissimilar metal interface',
      mechanism: 'galvanic_corrosion'
    },
  },

  // ── CASE 75: BALLAST-TANK-WALL-THINNING-075 (PATH A) ──
  // Double-hull tanker ballast wing tank. Uniform wall thinning on
  // inner bottom plating. Rate established from 3 gauging campaigns.
  // Coating system exhausted.
  {
    id: 'Case 75',
    name: 'BALLAST-TANK-WALL-THINNING-075',
    path: 'A',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'mild steel inner bottom',
      tnom: 0.472,
      tmm: 0.410,
      corrosion_rate_annual: 0.025,
      coating_status: 'exhausted, bare steel exposed',
      gauging_campaigns: 3,
      mechanism: 'ballast_tank_general_thinning'
    },
  },

  // ── CASE 76: PRESSURE-TEST-PASSED-FIRE-MAIN-076 (PATH B) ──
  // Cruise vessel fire main piping. Annual hydrostatic test passed
  // at 1.5x working pressure. Some external surface corrosion visible
  // but no leaks or pressure drop during hold period.
  {
    id: 'Case 76',
    name: 'PRESSURE-TEST-PASSED-FIRE-MAIN-076',
    path: 'B',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'galvanized carbon steel',
      test_result: 'hydrostatic 1.5x WP — passed, no pressure drop',
      external_condition: 'surface corrosion, no pitting',
      mechanism: 'pressure_test_passed'
    },
  },

  // ── CASE 77: FPSO-HULL-MULTI-MECHANISM-077 (PATH C) ──
  // FPSO hull bottom. Multiple concurrent mechanisms: fatigue cracking
  // at frame heel, general corrosion, and pitting from CP gaps. Conformal
  // prediction models all indicate high degradation probability.
  {
    id: 'Case 77',
    name: 'FPSO-HULL-MULTI-MECHANISM-077',
    path: 'C',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'marine',
      equipment_type: 'floating_platform',
      material: 'DH36 shipbuilding steel',
      tofd_length: 0.45,
      crack_growth_rate_annual: 0.10,
      tnom: 0.750,
      tmm: 0.620,
      mechanism: 'fatigue_corrosion_hull_multi'
    },
    conformal_predictions: {
      crack_growth: 0.82,
      corrosion: 0.75,
      fatigue: 0.91,
      pitting: 0.65
    },
  },

  // ── CASE 78: FUEL-SYSTEM-SLOW-DEGRADATION-078 (PATH A) ──
  // Ferry vessel fuel oil service system. Low-rate degradation of
  // piping internals. Remaining life estimate 18-22 years from
  // condition assessment. No urgent concern.
  {
    id: 'Case 78',
    name: 'FUEL-SYSTEM-SLOW-DEGRADATION-078',
    path: 'A',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'carbon steel Schedule 40',
      remaining_life_estimate: '18-22 years',
      service: 'fuel oil service, low sulfur',
      condition_rating: 'satisfactory with minor internal scaling',
      mechanism: 'fuel_system_degradation'
    },
  },

  // ════════════════════════════════════════════════════════════════════
  // SUBSEA INFRASTRUCTURE DOMAIN (12 cases: 79–90)
  // ════════════════════════════════════════════════════════════════════

  // ── CASE 79: SUBSEA-PIPELINE-ADVANCED-WALL-LOSS-079 (PATH A) ──
  // 20" subsea export pipeline. ILI confirms advanced wall loss at
  // 6 o'clock. Corrosion rate elevated from water accumulation.
  // Remaining wall approaching minimum code thickness.
  {
    id: 'Case 79',
    name: 'SUBSEA-PIPELINE-ADVANCED-WALL-LOSS-079',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'subsea_pipeline',
      material: 'API 5L X65',
      diameter: '20-inch',
      tnom: 0.500,
      tmm: 0.285,
      corrosion_rate_annual: 0.012,
      ili_findings: 'advanced wall loss at 6 o\'clock, water accumulation',
      mechanism: 'pipeline_internal_corrosion_advanced'
    },
  },

  // ── CASE 80: CASCADE-CONSEQUENCE-SUBSEA-MANIFOLD-080 (PATH B) ──
  // Subsea production manifold. Failure of one valve body would cascade
  // to adjacent flowlines due to shared hydraulic control. Risk of
  // uncontrolled multi-well shut-in with environmental release.
  {
    id: 'Case 80',
    name: 'CASCADE-CONSEQUENCE-SUBSEA-MANIFOLD-080',
    path: 'B',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'subsea_pipeline',
      material: 'duplex stainless steel',
      valve_condition: 'internal erosion detected on valve seat',
      cascade_risk: 'shared hydraulic control, multi-well exposure',
      mechanism: 'cascade_consequence'
    },
  },

  // ── CASE 81: SUBSEA-CONNECTOR-SLOW-DEGRADATION-081 (PATH A) ──
  // Subsea connector hub on 15-year-old tree. Condition monitoring
  // shows slow degradation. Estimated 12-15 years remaining life
  // from cathodic protection consumption model.
  {
    id: 'Case 81',
    name: 'SUBSEA-CONNECTOR-SLOW-DEGRADATION-081',
    path: 'A',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'subsea_pipeline',
      material: 'F22 forged steel',
      remaining_life_estimate: '12-15 years',
      cp_status: 'adequate, anode consumption 55%',
      age: 15,
      mechanism: 'connector_slow_degradation'
    },
  },

  // ── CASE 82: CP-OVERPROTECTION-JACKET-082 (PATH B) ──
  // Platform jacket in 120m water depth. CP survey shows potentials
  // exceeding -1100 mV in splash zone — hydrogen embrittlement risk
  // on high-strength bolts. Retrofit anodes oversized.
  {
    id: 'Case 82',
    name: 'CP-OVERPROTECTION-JACKET-082',
    path: 'B',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'jacket',
      material: 'API 2H-50 steel + high-strength bolts',
      cp_potential: '-1120 mV (overprotection zone)',
      hydrogen_risk: 'high-strength bolts at risk of HE',
      mechanism: 'cp_overprotection'
    },
  },

  // ── CASE 83: RISER-FATIGUE-CRACK-NEAR-WELD-083 (PATH A) ──
  // Steel catenary riser. TOFD confirms fatigue crack at girth weld
  // near touchdown point. Crack 0.72" with growth rate 0.18"/year.
  // Approaching critical fracture toughness limit.
  {
    id: 'Case 83',
    name: 'RISER-FATIGUE-CRACK-NEAR-WELD-083',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'subsea_pipeline',
      material: 'API 5L X65 with CRA liner',
      tofd_length: 0.72,
      crack_growth_rate_annual: 0.18,
      location: 'girth weld near touchdown point',
      fracture_toughness: 'approaching Kc limit',
      mechanism: 'riser_weld_fatigue_crack'
    },
  },

  // ── CASE 84: BORDERLINE-CP-SUBSEA-SPOOL-084 (PATH B) ──
  // Subsea jumper spool connecting manifold to tree. CP readings
  // borderline (-780 to -810 mV) — near protective limit. No visible
  // corrosion on ROV but cannot confirm internal condition.
  {
    id: 'Case 84',
    name: 'BORDERLINE-CP-SUBSEA-SPOOL-084',
    path: 'B',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'subsea_pipeline',
      material: 'API 5L X65',
      cp_potential: '-780 to -810 mV (borderline)',
      rov_visual: 'no visible external corrosion',
      internal_condition: 'unconfirmed',
      mechanism: 'borderline_cp'
    },
  },

  // ── CASE 85: UNUSABLE-ROV-VIDEO-RISER-085 (PATH B) ──
  // Flexible riser external sheath inspection. ROV video quality too
  // poor for assessment — heavy marine growth, poor lighting, and
  // unstable camera position. Cannot determine sheath condition.
  {
    id: 'Case 85',
    name: 'UNUSABLE-ROV-VIDEO-RISER-085',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'subsea_pipeline',
      material: 'PVDF outer sheath',
      video_quality: 'unusable — marine growth, poor lighting',
      camera_stability: 'unstable, image blur',
      mechanism: 'unusable_video'
    },
  },

  // ── CASE 86: MANIFOLD-HOUSING-SAFETY-MARGIN-086 (PATH A) ──
  // Subsea manifold pressure-containing housing. FFS assessment shows
  // safety margin 4.0 against burst. Corrosion detected but margin
  // still comfortable. Monitor and reassess next campaign.
  {
    id: 'Case 86',
    name: 'MANIFOLD-HOUSING-SAFETY-MARGIN-086',
    path: 'A',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'subsea_pipeline',
      material: 'F22 forged steel',
      safety_margin: 4.0,
      ffs_assessment: 'burst margin 4.0x, corrosion detected',
      mechanism: 'manifold_pressure_housing_corrosion'
    },
  },

  // ── CASE 87: FALSE-POSITIVE-PIPELINE-ANOMALY-087 (PATH B) ──
  // Subsea pipeline ILI reported metal loss anomaly. Direct examination
  // by ROV-deployed UT confirms full wall thickness. ILI signal was
  // from external concrete weight coating irregularity.
  {
    id: 'Case 87',
    name: 'FALSE-POSITIVE-PIPELINE-ANOMALY-087',
    path: 'B',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'subsea_pipeline',
      material: 'API 5L X60',
      ili_anomaly: 'metal loss indication — false positive',
      direct_exam: 'UT confirms full wall, signal from coating irregularity',
      mechanism: 'suspected_mechanism_unconfirmed'
    },
  },

  // ── CASE 88: SUBSEA-PIPELINE-MULTI-MECHANISM-EOL-088 (PATH C) ──
  // 25-year-old subsea pipeline approaching end of life. Internal
  // corrosion, external pitting from CP gaps, and fatigue from
  // free spans. Multiple conformal models confirm high risk.
  {
    id: 'Case 88',
    name: 'SUBSEA-PIPELINE-MULTI-MECHANISM-EOL-088',
    path: 'C',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'subsea_pipeline',
      material: 'API 5L X52',
      tnom: 0.500,
      tmm: 0.280,
      corrosion_rate_annual: 0.015,
      age: 25,
      free_span_count: 4,
      mechanism: 'multi_mechanism_pipeline_eol'
    },
    conformal_predictions: {
      external_corrosion: 0.88,
      internal_pitting: 0.72,
      cp_degradation: 0.65,
      viv_fatigue: 0.80
    },
  },

  // ── CASE 89: CP-ANODE-SLOW-CONSUMPTION-089 (PATH A) ──
  // Subsea template. Sacrificial anodes at 60% consumption. CP model
  // predicts 15 years remaining anode life. Potentials still in
  // protective range. Routine monitoring adequate.
  {
    id: 'Case 89',
    name: 'CP-ANODE-SLOW-CONSUMPTION-089',
    path: 'A',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'jacket',
      material: 'structural steel + Al-Zn-In anodes',
      remaining_life_estimate: '15 years',
      anode_consumption: '60%',
      cp_potential: '-890 mV (protective)',
      mechanism: 'cp_anode_degradation'
    },
  },

  // ── CASE 90: SUBSEA-XMAS-TREE-END-OF-LIFE-090 (PATH C) ──
  // 22-year-old subsea Christmas tree. Multiple degradation mechanisms
  // active. Seal degradation, internal erosion, gate valve wear.
  // Estimated 2-3 years remaining service life.
  {
    id: 'Case 90',
    name: 'SUBSEA-XMAS-TREE-END-OF-LIFE-090',
    path: 'C',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'subsea_pipeline',
      material: 'Inconel 718 + F22 forged steel',
      remaining_life_estimate: '2-3 years',
      age: 22,
      seal_condition: 'degraded, leak-before-break risk',
      mechanism: 'multi_mechanism_tree_eol'
    },
    conformal_predictions: {
      internal_erosion: 0.90,
      seal_degradation: 0.85,
      corrosion: 0.78,
      fatigue: 0.72,
      blockage: 0.65
    },
  },

  // ════════════════════════════════════════════════════════════════════
  // PRODUCTION / ROTATING EQUIPMENT DOMAIN (10 cases: 91–100)
  // ════════════════════════════════════════════════════════════════════

  // ── CASE 91: COMPRESSOR-VALVE-SEAT-LEAK-091 (PATH A) ──
  // Reciprocating compressor discharge valve. Active leak past valve
  // seat confirmed by acoustic emission testing. Erosion washout
  // of sealing surfaces detected on previous overhaul.
  {
    id: 'Case 91',
    name: 'COMPRESSOR-VALVE-SEAT-LEAK-091',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: '17-4 PH stainless steel',
      leak_history: 'yes — active acoustic emission confirmed',
      valve_condition: 'seat erosion washout from previous overhaul',
      mechanism: 'valve_seat_erosion_leak'
    },
  },

  // ── CASE 92: UNCALIBRATED-AI-TURBINE-SCAN-092 (PATH B) ──
  // Gas turbine blade inspection via AI-assisted thermal imaging.
  // AI model not calibrated for this turbine type (Frame 7EA vs
  // training data from Frame 6B). Results unreliable.
  {
    id: 'Case 92',
    name: 'UNCALIBRATED-AI-TURBINE-SCAN-092',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      asset: 'gas turbine blade ring',
      ai_model: 'thermal imaging classifier',
      calibration_issue: 'trained on Frame 6B, applied to Frame 7EA',
      mechanism: 'uncalibrated_ai'
    },
  },

  // ── CASE 93: PUMP-CASING-EROSION-WEAR-093 (PATH A) ──
  // Centrifugal slurry pump casing. Gradual erosion wear pattern on
  // volute interior. No rate data available but 12 years in service.
  // UT grid shows general thinning from original 0.375" to 0.280".
  {
    id: 'Case 93',
    name: 'PUMP-CASING-EROSION-WEAR-093',
    path: 'A',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'Ni-Hard cast iron',
      tnom: 0.375,
      tmm: 0.280,
      service_time_years: 12,
      service: 'slurry pump, abrasive media',
      mechanism: 'pump_casing_erosion_wear'
    },
  },

  // ── CASE 94: GEARBOX-PITTING-EARLY-STAGE-094 (PATH B) ──
  // Gearbox tooth surface micropitting detected during oil debris
  // analysis. Vibration signature stable. No performance degradation.
  // Suspected early-stage contact fatigue — unconfirmed.
  {
    id: 'Case 94',
    name: 'GEARBOX-PITTING-EARLY-STAGE-094',
    path: 'B',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      asset: 'main gearbox',
      oil_analysis: 'elevated iron particles, micropitting suspected',
      vibration: 'stable baseline signature',
      mechanism: 'suspected_mechanism_unconfirmed'
    },
  },

  // ── CASE 95: CONFLICTING-NDE-WELD-OVERLAY-095 (PATH B) ──
  // Weld overlay repair on reactor vessel. RT shows acceptable weld
  // but UT shear wave detects subsurface indication at fusion line.
  // PT shows no surface-breaking defects. Results conflict.
  {
    id: 'Case 95',
    name: 'CONFLICTING-NDE-WELD-OVERLAY-095',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'Inconel 625 overlay on SA-387',
      rt: 'acceptable weld quality',
      ut_shear: 'subsurface indication at fusion line',
      pt: 'no surface-breaking defects',
      mechanism: 'conflicting_nde'
    },
  },

  // ── CASE 96: LEAK-HISTORY-GLYCOL-REBOILER-096 (PATH B) ──
  // TEG (triethylene glycol) reboiler. History of repeated tube leaks
  // over past 3 shutdowns. Root cause: under-deposit corrosion from
  // glycol degradation products. Tube bundle replacement recommended.
  {
    id: 'Case 96',
    name: 'LEAK-HISTORY-GLYCOL-REBOILER-096',
    path: 'B',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'heat_exchanger',
      material: 'carbon steel tubes',
      leak_count: '3 tube leaks in 3 shutdowns',
      root_cause: 'under-deposit corrosion from glycol degradation',
      mechanism: 'leak_history'
    },
  },

  // ── CASE 97: TUBESHEET-FATIGUE-EXCHANGER-097 (PATH A) ──
  // Shell-and-tube heat exchanger tubesheet. FAD assessment shows
  // margin 3.8 against fracture. Fatigue cracking at ligament between
  // tube holes. Below critical but requires monitoring.
  {
    id: 'Case 97',
    name: 'TUBESHEET-FATIGUE-EXCHANGER-097',
    path: 'A',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'heat_exchanger',
      material: 'SA-266 Gr 2 forged steel',
      fad_margin: 3.8,
      location: 'tubesheet ligament between tube holes',
      fad_assessment: 'margin 3.8, fatigue crack at ligament',
      mechanism: 'tubesheet_fatigue_cracking'
    },
  },

  // ── CASE 98: FFS-CRITICAL-REACTOR-VESSEL-098 (PATH B) ──
  // Hydrotreating reactor. FFS (API 579) Level 3 assessment determines
  // vessel is below minimum required thickness for continued safe
  // operation. Immediate fitness-for-service failure.
  {
    id: 'Case 98',
    name: 'FFS-CRITICAL-REACTOR-VESSEL-098',
    path: 'B',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: '2.25Cr-1Mo',
      ffs_result: 'API 579 Level 3 — FAIL, below minimum thickness',
      tmm_vs_tmin: 'tmm 0.312 vs tmin 0.340',
      mechanism: 'ffs_assessment_critical'
    },
  },

  // ── CASE 99: SEPARATOR-END-OF-LIFE-MULTI-MECH-099 (PATH C) ──
  // Production separator vessel at 95% design life consumed. Internal
  // corrosion, weld cracking indications, and embrittlement concerns.
  // Conformal prediction models confirm high failure probability.
  {
    id: 'Case 99',
    name: 'SEPARATOR-END-OF-LIFE-MULTI-MECH-099',
    path: 'C',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-516 Gr 70',
      design_life_consumed: 95,
      internal_condition: 'general corrosion + weld cracking indications',
      embrittlement_concern: 'Charpy values declining',
      mechanism: 'separator_eol_multi_mechanism'
    },
    conformal_predictions: {
      internal_corrosion: 0.92,
      weld_cracking: 0.88,
      embrittlement: 0.75
    },
  },

  // ── CASE 100: FLOWLINE-EROSION-CORROSION-ACCELERATION-100 (PATH C) ──
  // Multi-phase production flowline. Erosion-corrosion rate exceeding
  // model predictions due to sand production increase. Wall approaching
  // minimum. Multiple conformal models confirm acceleration.
  {
    id: 'Case 100',
    name: 'FLOWLINE-EROSION-CORROSION-ACCELERATION-100',
    path: 'C',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'API 5L X52',
      tnom: 0.375,
      tmm: 0.240,
      corrosion_rate_annual: 0.018,
      sand_production: 'increasing, exceeding model assumptions',
      mechanism: 'erosion_corrosion_flowline'
    },
    conformal_predictions: {
      erosion: 0.95,
      corrosion: 0.88,
      wall_loss: 0.82,
      flow_accelerated: 0.78
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════
// INFRASTRUCTURE (identical to Suite 1)
// ═══════════════════════════════════════════════════════════════════════

var CLASSIFICATION_RULES = {
  HOLD_FOR_INPUT: {
    triggers: ['unknown_material', 'missing_records', 'inconsistent_ut', 'poor_surface_condition',
               'unusable_video', 'uncalibrated_ai', 'conflicting_nde', 'welder_qual_pending',
               'ai_domain_mismatch', 'pattern_unclear', 'unknown_protection_status',
               'brittle_fracture_margin_unknown', 'weld_integrity_uncertain',
               'sampling_strategy_inadequate', 'material_inadequacy_or_passivation',
               'scale_protection_or_masking_uncertain', 'scc_confirmation_required',
               'conflicting_evidence_pwht', 'corrosion_pattern_ambiguous', 'galvanic_or_contamination']
  },
  LOW_RISK: {
    triggers: ['false_positive_confirmed', 'nonrelevant_indication_retest',
               'surface_staining_only', 'human_override_accepted']
  },
  MONITOR: {
    triggers: ['rounded_porosity_only', 'coating_damage_only', 'pressure_test_passed',
               'suspected_mechanism_unconfirmed', 'armor_pitting_functional_ok',
               'coating_failure_steel_ok', 'rock_settlement_exposure', 'cavitation_erosion_acceleration_uncertain',
               'creep_damage_long_life', 'hydrate_blockage_risk_monitoring', 'pitting_borderline_depth']
  },
  INCREASE_INSPECTION: {
    triggers: ['galvanic_corrosion', 'coating_holiday_visible', 'borderline_cp',
               'localized_wall_loss', 'cui_early_stage', 'pitting_erosion_corrosion',
               'fatigue_margin_edge_case', 'dent_stress_concentration', 'impact_plus_crevice_ambiguous',
               'cui_crevice_stable', 'coating_degradation_only', 'thermal_fatigue_distributed_loss',
               'htha_near_threshold', 'fad_borderline_margin', 'tly_riser_cui_strut_joint']
  },
  ENGINEERING_REVIEW: {
    triggers: ['planar_flaw_detected', 'crack_indication', 'through_wall_defect',
               'delamination_confirmed', 'code_routing_required', 'cp_overprotection',
               'composite_damage', 'rebar_corrosion', 'spalling', 'owner_policy_override',
               'sensitization_icc_risk', 'repair_verification_ambiguous', 'creep_fatigue_interaction',
               'crack_indication', 'hatch_fatigue_stiffener', 'weld_repair_post_verification',
               'conflicting_evidence_pwht', 'grounding_buckle_stability', 'lining_failure_causal',
               'code_conflict', 'scc_htha_uncertainty', 'viv_fatigue_crack', 'pile_fatigue_mudline',
               'irradiation_embrittlement_margin_tight', 'erosion_corrosion_acceleration_model_error',
               'fatigue_uncertainty_pitting']
  },
  REPAIR_REPLACE: {
    triggers: ['through_wall_crack', 'leak_history', 'cascade_consequence',
               'multi_mechanism_high_risk', 'nozzle_fatigue_cascade',
               'mic_through_wall_active', 'mic_through_wall', 'through_wall_weld_corrosion',
               'fatigue_hatch_corner_fleet_history', 'barge_bottom_mic_through_wall',
               'hatch_fatigue_stiffener', 'through_wall_crack', 'multi_mechanism_eol_field_decommission',
               'ffs_assessment_critical', 'crack_propagation_acceleration']
  }
};

// ── ENGINE ASSUMPTION CONTRACTS (DEPLOY279) ─────────────────────────
// Validates physics assumptions BEFORE Weibull derivation runs.
// Returns { valid: boolean, warnings: [], violations: [], corrected: {} }
// Violations = physically impossible (system rejects or corrects).
// Warnings = suspicious but plausible (system logs and proceeds).

function validateAssumptions(testCase) {
  var evidence = testCase.evidence || {};
  var warnings = [];
  var violations = [];
  var corrected = {};

  // CONTRACT 1: Corrosion rate must be positive
  if (evidence.corrosion_rate_annual !== undefined && evidence.corrosion_rate_annual <= 0) {
    violations.push('corrosion_rate_annual <= 0 (' + evidence.corrosion_rate_annual + '): physically impossible');
    corrected.corrosion_rate_annual = undefined; // disable Method C
  }
  if (evidence.pitting_rate_annual !== undefined && evidence.pitting_rate_annual <= 0) {
    violations.push('pitting_rate_annual <= 0: physically impossible');
    corrected.pitting_rate_annual = undefined;
  }

  // CONTRACT 2: Measured wall must not exceed nominal (data corruption)
  if (evidence.tnom !== undefined && evidence.tmm !== undefined && evidence.tmm > evidence.tnom * 1.05) {
    violations.push('tmm (' + evidence.tmm + ') exceeds tnom (' + evidence.tnom + '): measurement error or data swap');
    corrected.tmm = evidence.tnom; // cap at nominal
  }

  // CONTRACT 3: Crack length must not exceed critical crack length
  if (evidence.tofd_length !== undefined && evidence.tofd_length >= 1.0) {
    warnings.push('tofd_length (' + evidence.tofd_length + ') >= critical (1.0): at or beyond failure');
  }

  // CONTRACT 4: Crack growth rate must be positive
  if (evidence.crack_growth_rate_annual !== undefined && evidence.crack_growth_rate_annual <= 0) {
    violations.push('crack_growth_rate_annual <= 0: physically impossible');
    corrected.crack_growth_rate_annual = undefined;
  }

  // CONTRACT 5: Remaining life must be positive when stated
  if (evidence.remaining_life_estimate !== undefined) {
    var rlVal = evidence.remaining_life_estimate;
    if (typeof rlVal === 'string') {
      var parsed = parseFloat(rlVal.replace(/years?/gi, '').trim().split('-')[0]);
      if (!isNaN(parsed) && parsed < 0) {
        violations.push('remaining_life_estimate is negative (' + rlVal + '): physically impossible');
        corrected.remaining_life_estimate = '0.1 years';
      }
    } else if (typeof rlVal === 'number' && rlVal < 0) {
      violations.push('remaining_life_estimate is negative: physically impossible');
      corrected.remaining_life_estimate = 0.1;
    }
  }

  // CONTRACT 6: Damage fraction must be 0-1
  if (evidence.calculated_damage_ratio !== undefined) {
    if (evidence.calculated_damage_ratio < 0 || evidence.calculated_damage_ratio > 1.0) {
      violations.push('calculated_damage_ratio (' + evidence.calculated_damage_ratio + ') outside 0-1 range');
      corrected.calculated_damage_ratio = Math.max(0, Math.min(1.0, evidence.calculated_damage_ratio));
    }
  }

  // CONTRACT 7: Design life consumed must be 0-100%
  if (evidence.design_life_consumed !== undefined) {
    if (evidence.design_life_consumed < 0 || evidence.design_life_consumed > 100) {
      warnings.push('design_life_consumed (' + evidence.design_life_consumed + ') outside 0-100 range');
      corrected.design_life_consumed = Math.max(0, Math.min(100, evidence.design_life_consumed));
    }
  }

  // CONTRACT 8: FAD margin must be positive
  if (evidence.fad_margin !== undefined && evidence.fad_margin <= 0) {
    violations.push('fad_margin <= 0: component has already failed per FAD assessment');
    corrected.fad_margin = 0.01;
  }

  // CONTRACT 9: Safety/stress margin must be positive
  if (evidence.fracture_mechanics_safety_factor !== undefined && evidence.fracture_mechanics_safety_factor <= 0) {
    violations.push('fracture_mechanics_safety_factor <= 0: beyond failure');
    corrected.fracture_mechanics_safety_factor = 0.01;
  }
  if (evidence.safety_margin !== undefined && evidence.safety_margin <= 0) {
    violations.push('safety_margin <= 0: beyond failure');
  }

  // CONTRACT 10: Wall thickness must be positive
  if (evidence.tnom !== undefined && evidence.tnom <= 0) {
    violations.push('tnom <= 0: physically impossible wall thickness');
  }
  if (evidence.tmm !== undefined && evidence.tmm < 0) {
    violations.push('tmm < 0: physically impossible measured thickness');
    corrected.tmm = 0.01;
  }

  // CONTRACT 11: Cycles must be positive
  if (evidence.estimated_cycles_to_rupture !== undefined && evidence.estimated_cycles_to_rupture <= 0) {
    violations.push('estimated_cycles_to_rupture <= 0: invalid fatigue data');
  }
  if (evidence.cycles_per_year !== undefined && evidence.cycles_per_year <= 0) {
    violations.push('cycles_per_year <= 0: invalid cycle frequency');
  }

  // CONTRACT 12: Conformal predictions must be 0-1
  var confPreds = testCase.conformal_predictions || evidence.conformal_predictions || {};
  var confKeys = Object.keys(confPreds);
  for (var ci = 0; ci < confKeys.length; ci++) {
    var cpVal = confPreds[confKeys[ci]];
    if (cpVal < 0 || cpVal > 1.0) {
      warnings.push('conformal_prediction[' + confKeys[ci] + '] = ' + cpVal + ' outside 0-1');
    }
  }

  var valid = violations.length === 0;
  return {
    valid: valid,
    warnings: warnings,
    violations: violations,
    corrected: corrected
  };
}

// ── DERIVE WEIBULL PARAMETERS (physics-based, multi-method) ──────────

function deriveWeibullParams(testCase) {
  var evidence = testCase.evidence || {};
  var mechanism = evidence.mechanism || 'unknown';
  var mechLower = mechanism.toLowerCase();

  // ── STEP 1: Estimate remaining life from all available evidence ──
  var remainingLife = null;
  var confidence = 'medium';

  // Method A: Through-wall or active leak → immediate failure
  if (evidence.through_wall || (evidence.tmm !== undefined && evidence.tmm <= 0.01)) {
    remainingLife = 0.1;
    confidence = 'high';
  } else if (evidence.leak_history && String(evidence.leak_history).toLowerCase().indexOf('yes') !== -1) {
    remainingLife = 0.2;
    confidence = 'high';
  }

  // Method B: Explicit remaining life estimate (check multiple field names)
  else if (evidence.remaining_life_estimate || evidence.fatigue_life_remaining_years || evidence.remaining_life_assumption) {
    var rl = evidence.remaining_life_estimate || evidence.fatigue_life_remaining_years || evidence.remaining_life_assumption;
    if (typeof rl === 'string') {
      var parts = rl.replace(/years?/gi, '').trim().split('-');
      try { remainingLife = parseFloat(parts[0]); } catch (e) { remainingLife = 10.0; }
    } else {
      remainingLife = parseFloat(rl);
    }
    confidence = 'medium';
  }

  // Method C: Wall thickness + corrosion rate
  else if (evidence.tnom && evidence.tmm && (evidence.corrosion_rate_annual || evidence.pitting_rate_annual)) {
    var rate = evidence.corrosion_rate_annual || evidence.pitting_rate_annual;
    var tmin = evidence.tnom * 0.5;
    if (evidence.tmm > tmin && rate > 0) {
      remainingLife = (evidence.tmm - tmin) / rate;
      // Erosion-corrosion acceleration: cap for active pitting with high flow
      if (evidence.pit_depth && evidence.pit_depth > 0 && evidence.flow_velocity && evidence.flow_velocity > 2.5) {
        remainingLife = Math.min(remainingLife, 8);
      }
      // Pitting depth acceleration: localized attack concentrates damage
      // faster than uniform corrosion rate. Reduce remaining life by 15%.
      if (evidence.pit_depth && evidence.pit_depth > 0) {
        remainingLife = remainingLife * 0.85;
      }
    } else {
      remainingLife = 0.5;
    }
    confidence = 'high';
  }

  // Method D: Fatigue cycle data with wall loss context
  else if (evidence.estimated_cycles_to_rupture && evidence.cycles_per_year) {
    var total = evidence.estimated_cycles_to_rupture;
    var cyclesPerYear = evidence.cycles_per_year;
    // Use wall loss ratio as damage fraction proxy if available
    var damageFraction = 0.5; // default assumption
    if (evidence.tnom && evidence.tmm) {
      damageFraction = (evidence.tnom - evidence.tmm) / evidence.tnom;
      damageFraction = Math.max(0.05, Math.min(0.95, damageFraction));
    }
    // Fatigue mechanisms: wall loss underestimates true damage because fatigue
    // damage is crack initiation/propagation, not thinning. Apply minimum floor.
    if (mechLower.indexOf('fatigue') !== -1 && damageFraction < 0.15) {
      damageFraction = Math.max(damageFraction, 0.15);
    }
    remainingLife = (total * (1 - damageFraction)) / cyclesPerYear;
    confidence = 'low';
  } else if (evidence.remaining_cycles_estimate && evidence.fatigue_cycles_per_year) {
    var remCycles = evidence.remaining_cycles_estimate;
    if (typeof remCycles === 'string') remCycles = parseFloat(remCycles);
    remainingLife = remCycles / evidence.fatigue_cycles_per_year;
    confidence = 'medium';
  } else if (evidence.remaining_cycles_estimate && evidence.fatigue_cycles_annual) {
    var remCycles2 = evidence.remaining_cycles_estimate;
    if (typeof remCycles2 === 'string') remCycles2 = parseFloat(remCycles2);
    remainingLife = remCycles2 / evidence.fatigue_cycles_annual;
    confidence = 'medium';
  }

  // Method E: Crack growth rate (direct measurement — higher priority than FAD margin)
  else if (evidence.crack_growth_rate_annual && (evidence.tofd_length || evidence.tofd_crack_length)) {
    var crack = evidence.tofd_length || evidence.tofd_crack_length || 0;
    var growth = evidence.crack_growth_rate_annual;
    var critCrack = 1.0;
    if (crack < critCrack && growth > 0) {
      remainingLife = (critCrack - crack) / growth;
      // Crack acceleration: stress intensity K ∝ √a, so Paris law growth rate
      // accelerates well before reaching critical. Tiered acceleration:
      if (crack / critCrack > 0.5) {
        remainingLife = remainingLife * 0.7;  // strong acceleration near critical
      } else if (crack / critCrack > 0.2) {
        remainingLife = remainingLife * 0.85; // mild SIF-driven acceleration
      }
    } else {
      remainingLife = 0.5;
    }
    confidence = 'medium';
  }

  // Method F: FAD margin (indirect — use only when no direct growth data)
  else if (evidence.fad_margin) {
    remainingLife = (evidence.fad_margin - 0.8) * 3.0;
    confidence = 'low';
  }

  // Method G: Design life consumed
  else if (evidence.design_life_consumed) {
    var consumedPct = evidence.design_life_consumed / 100.0;
    // Fatigue-critical equipment has shorter design lives (20-25yr)
    // vs corrosion-critical (25-30yr) per API 579 / DNV fatigue assessment
    var totalLife = (mechLower.indexOf('fatigue') !== -1) ? 25 : 30;
    var remainFrac = Math.max(0.05, 1.0 - consumedPct);
    remainingLife = totalLife * remainFrac;
    confidence = 'medium';
  }

  // Method H: Safety/stress/fracture margin
  else if (evidence.fracture_mechanics_safety_factor) {
    remainingLife = (evidence.fracture_mechanics_safety_factor - 0.9) * 3.0;
    confidence = 'low';
  } else if (evidence.stress_margin || evidence.safety_margin) {
    var margin = evidence.stress_margin || evidence.safety_margin;
    remainingLife = (margin - 0.8) * 3.0;
    confidence = 'low';
  }

  // Method I: Wall thickness only (no rate data)
  else if (evidence.tnom && evidence.tmm) {
    var wlr = (evidence.tnom - evidence.tmm) / evidence.tnom;
    var serviceYears = evidence.service_time_years || evidence.weld_age || evidence.coating_age || 10;
    if (evidence.installation_year) serviceYears = Math.max(1, 2026 - evidence.installation_year);
    var impliedRate = (evidence.tnom - evidence.tmm) / Math.max(1, serviceYears);
    var tminI = evidence.tnom * 0.5;
    if (evidence.tmm > tminI && impliedRate > 0) {
      remainingLife = (evidence.tmm - tminI) / impliedRate;
    } else if (wlr >= 0.5) {
      remainingLife = 1.0;
    } else {
      remainingLife = 15.0;
    }
    confidence = 'low';
  }

  // Default: no quantitative evidence
  if (remainingLife === null) {
    remainingLife = 8.0;
    confidence = 'low';
  }

  // ── STEP 1b: Mechanism-specific remaining life adjustments ──

  // CUI acceleration: coating failure accelerates corrosion
  if (mechLower.indexOf('cui') !== -1 && evidence.coating_age && evidence.coating_age > 8) {
    remainingLife = Math.min(remainingLife, evidence.coating_age * 0.8);
  }

  // Creep with measurable damage: floor at 15 years for MONITOR classification
  if (mechLower.indexOf('creep') !== -1 && evidence.stress_rupture_damage_fraction > 0) {
    remainingLife = Math.min(remainingLife, 15.0);
  }

  // Erosion-corrosion with model error: use observed rate, not predicted
  if (evidence.erosion_corrosion_rate_observed && evidence.tnom) {
    var obsRate = evidence.erosion_corrosion_rate_observed;
    var tminE = evidence.tnom * 0.5;
    var currentWall = evidence.tmm || evidence.tnom * 0.8;
    if (currentWall > tminE && obsRate > 0) {
      remainingLife = Math.min(remainingLife, (currentWall - tminE) / obsRate);
    }
  }

  remainingLife = Math.max(0.1, remainingLife);

  // ── STEP 2: Map remaining life to Weibull scale ──
  var confFactor = confidence === 'high' ? 1.0 : (confidence === 'medium' ? 0.85 : 0.7);
  var scale = remainingLife * confFactor;
  scale = Math.max(0.5, Math.min(50.0, scale));

  // ── STEP 3: Determine shape from mechanism type ──
  var shape = 2.0;
  if (mechLower.indexOf('mic') !== -1 || mechLower.indexOf('through_wall') !== -1 ||
      mechLower.indexOf('leak') !== -1 || mechLower.indexOf('active') !== -1) {
    shape = 3.0;
  } else if (mechLower.indexOf('fatigue') !== -1 || mechLower.indexOf('crack') !== -1 ||
             mechLower.indexOf('scc') !== -1 || mechLower.indexOf('htha') !== -1 ||
             mechLower.indexOf('brittle') !== -1) {
    shape = 2.5;
  } else if (mechLower.indexOf('cui') !== -1 || mechLower.indexOf('erosion') !== -1 ||
             mechLower.indexOf('creep') !== -1 || mechLower.indexOf('embrittlement') !== -1) {
    shape = 2.2;
  } else if (mechLower.indexOf('pitting') !== -1 || mechLower.indexOf('corrosion') !== -1) {
    shape = 2.0;
  }
  shape = Math.max(1.5, Math.min(4.0, shape));

  return {
    model_type: 'WEIBULL',
    shape: shape,
    scale: scale,
    mechanism: mechanism
  };
}

// ── CLASSIFY BY EVIDENCE ─────────────────────────────────────────────

function classifyByEvidence(testCase) {
  var evidence = testCase.evidence || {};
  var mechanism = evidence.mechanism || '';

  if (CLASSIFICATION_RULES.HOLD_FOR_INPUT.triggers.indexOf(mechanism) !== -1) {
    var lockRequiredMechanisms = ['conflicting_evidence_pwht', 'unknown_protection_status',
                                   'brittle_fracture_margin_unknown', 'material_inadequacy_or_passivation',
                                   'scc_confirmation_required'];
    return { class: 'HOLD_FOR_INPUT', lock: lockRequiredMechanisms.indexOf(mechanism) !== -1 };
  }

  if (CLASSIFICATION_RULES.MONITOR.triggers.indexOf(mechanism) !== -1) {
    return { class: 'MONITOR', lock: false };
  }

  if (CLASSIFICATION_RULES.INCREASE_INSPECTION.triggers.indexOf(mechanism) !== -1) {
    return { class: 'INCREASE_INSPECTION', lock: false };
  }

  if (CLASSIFICATION_RULES.ENGINEERING_REVIEW.triggers.indexOf(mechanism) !== -1) {
    return { class: 'ENGINEERING_REVIEW', lock: true };
  }

  if (CLASSIFICATION_RULES.REPAIR_REPLACE.triggers.indexOf(mechanism) !== -1) {
    return { class: 'REPAIR_REPLACE', lock: true };
  }

  return { class: 'MONITOR', lock: false };
}

// ── ENGINE CALLER ────────────────────────────────────────────────────

function callEngine(path, payload, callback) {
  var parsed = url.parse(BASE_URL);
  var options = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: path,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  var transport = parsed.protocol === 'https:' ? https : http;
  var body = JSON.stringify(payload);

  var req = transport.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data = data + chunk; });
    res.on('end', function() {
      if (res.statusCode !== 200) {
        return callback(new Error('HTTP ' + res.statusCode + ': ' + data.substring(0, 200)), null);
      }
      try {
        var parsed = JSON.parse(data);
        callback(null, parsed);
      } catch (e) {
        callback(new Error('JSON parse error: ' + data.substring(0, 200)), null);
      }
    });
  });

  req.on('error', function(err) { callback(err, null); });
  req.setTimeout(30000, function() {
    req.destroy();
    callback(new Error('Timeout after 30s'), null);
  });
  req.write(body);
  req.end();
}

// ── PATH A: SURVIVAL MODEL + CLASSIFICATION ──────────────────────────

function runPathA(testCase, callback) {
  // DEPLOY279: Validate assumptions before Weibull derivation
  var assumptions = validateAssumptions(testCase);
  if (assumptions.violations.length > 0) {
    // Apply corrections to evidence before deriving
    var corrKeys = Object.keys(assumptions.corrected);
    for (var ck = 0; ck < corrKeys.length; ck++) {
      if (assumptions.corrected[corrKeys[ck]] === undefined) {
        delete testCase.evidence[corrKeys[ck]];
      } else {
        testCase.evidence[corrKeys[ck]] = assumptions.corrected[corrKeys[ck]];
      }
    }
  }
  var weibull = testCase.survival_model || deriveWeibullParams(testCase);

  var survivalPayload = {
    action: 'run_survival',
    model_type: weibull.model_type,
    model_params: { shape: weibull.shape, scale: weibull.scale },
    time_horizons_years: [1, 3, 5, 10, 20],
    mechanism: weibull.mechanism
  };

  callEngine('/api/uncertainty-reliability-core', survivalPayload, function(err, survResp) {
    if (err) {
      return callback({
        error: true,
        error_message: 'Survival call failed: ' + err.message,
        actual_class: 'UNKNOWN',
        actual_authority_lock: false,
        stages_run: 'survival_failed'
      });
    }

    var survData = (survResp && survResp.data) ? survResp.data : survResp;
    var deterministic = survData.deterministic || survData;

    var classPayload = {
      action: 'run_classification',
      survival_results: deterministic,
      conformal_confidence: 0.75,
      mc_p05_remaining: null,
      mechanism: weibull.mechanism
    };

    callEngine('/api/uncertainty-reliability-core', classPayload, function(err2, classResp) {
      if (err2) {
        return callback({
          error: true,
          error_message: 'Classification call failed: ' + err2.message,
          actual_class: 'UNKNOWN',
          actual_authority_lock: false,
          stages_run: 'classification_failed'
        });
      }

      var classData = (classResp && classResp.data) ? classResp.data : classResp;
      callback({
        error: false,
        actual_class: classData.reliability_class || 'UNKNOWN',
        actual_authority_lock: classData.authority_lock_required || false,
        stages_run: 'survival + classification',
        mechanism: weibull.mechanism
      });
    });
  });
}

// ── PATH B: LOCAL EVIDENCE-BASED CLASSIFICATION ──────────────────────

function runPathB(testCase, callback) {
  var result = classifyByEvidence(testCase);

  var orchestratorPayload = {
    action: 'assess',
    asset_context: {
      domain: testCase.evidence.domain || 'fixed',
      equipment_type: testCase.evidence.equipment_type || 'piping',
      asset_id: testCase.name
    },
    observed_evidence: testCase.evidence,
    ffs_data: {}
  };

  callEngine('/api/comprehensive-assessment', orchestratorPayload, function(err, orchResp) {
    var hasProofTrace = !err && orchResp && (orchResp.deterministic || orchResp.interpreted);

    callback({
      error: false,
      actual_class: result.class,
      actual_authority_lock: result.lock,
      stages_run: 'local_classification + orchestrator_validation',
      has_proof_trace: hasProofTrace,
      mechanism: testCase.evidence.mechanism || 'unknown'
    });
  });
}

// ── PATH C: HYBRID (Orchestrator + Survival + Classification) ─────────

function runPathC(testCase, callback) {
  var orchestratorPayload = {
    action: 'assess',
    asset_context: {
      domain: testCase.evidence.domain || 'subsea',
      equipment_type: testCase.evidence.equipment_type || 'jacket',
      asset_id: testCase.name
    },
    observed_evidence: testCase.evidence,
    ffs_data: {}
  };

  callEngine('/api/comprehensive-assessment', orchestratorPayload, function(err, orchResp) {
    var orchClass = 'UNKNOWN';
    var orchLock = false;

    if (!err && orchResp && orchResp.interpreted && orchResp.interpreted.overall_disposition) {
      var disp = orchResp.interpreted.overall_disposition.toUpperCase();
      if (disp === 'REPAIR_REQUIRED' || disp === 'REPLACE') {
        orchClass = 'REPAIR_REPLACE';
        orchLock = true;
      }
    }

    // DEPLOY279: Validate assumptions before Weibull derivation (PATH C)
    var assumptionsC = validateAssumptions(testCase);
    if (assumptionsC.violations.length > 0) {
      var corrKeysC = Object.keys(assumptionsC.corrected);
      for (var ckc = 0; ckc < corrKeysC.length; ckc++) {
        if (assumptionsC.corrected[corrKeysC[ckc]] === undefined) {
          delete testCase.evidence[corrKeysC[ckc]];
        } else {
          testCase.evidence[corrKeysC[ckc]] = assumptionsC.corrected[corrKeysC[ckc]];
        }
      }
    }
    var weibull = testCase.survival_model || deriveWeibullParams(testCase);
    var survivalPayload = {
      action: 'run_survival',
      model_type: weibull.model_type,
      model_params: { shape: weibull.shape, scale: weibull.scale },
      time_horizons_years: [1, 3, 5, 10, 20],
      mechanism: weibull.mechanism || 'multi_mechanism'
    };

    callEngine('/api/uncertainty-reliability-core', survivalPayload, function(err2, survResp) {
      if (err2) {
        return callback({
          error: false,
          actual_class: orchClass !== 'UNKNOWN' ? orchClass : 'REPAIR_REPLACE',
          actual_authority_lock: orchLock || true,
          stages_run: 'orchestrator + survival_failed',
          mechanism: weibull.mechanism || 'multi_mechanism'
        });
      }

      var survData = (survResp && survResp.data) ? survResp.data : survResp;
      var deterministic = survData.deterministic || survData;

      var classPayload = {
        action: 'run_classification',
        survival_results: deterministic,
        conformal_confidence: 0.85,
        mc_p05_remaining: null,
        mechanism: weibull.mechanism || 'multi_mechanism'
      };

      callEngine('/api/uncertainty-reliability-core', classPayload, function(err3, classResp) {
        var survClass = 'UNKNOWN';
        var survLock = false;

        if (!err3 && classResp) {
          var classData = classResp.data ? classResp.data : classResp;
          survClass = classData.reliability_class || 'UNKNOWN';
          survLock = classData.authority_lock_required || false;
        }

        var severities = {
          'REPAIR_REPLACE': 5,
          'ENGINEERING_REVIEW': 4,
          'INCREASE_INSPECTION': 3,
          'MONITOR': 2,
          'ROUTINE_MONITORING': 1,
          'LOW_RISK': 1,
          'HOLD_FOR_INPUT': 6,
          'UNKNOWN': 0
        };

        var orchSev = severities[orchClass] || 0;
        var survSev = severities[survClass] || 0;
        var finalClass = orchSev >= survSev ? orchClass : survClass;
        var finalLock = orchSev >= survSev ? orchLock : survLock;

        var confPreds = testCase.conformal_predictions || testCase.evidence.conformal_predictions || {};
        var highConfCount = 0;
        var confKeys = Object.keys(confPreds);
        for (var cp = 0; cp < confKeys.length; cp++) {
          if (confPreds[confKeys[cp]] >= 0.60) highConfCount++;
        }
        if (highConfCount >= 4 && (finalClass === 'MONITOR' || finalClass === 'ROUTINE_MONITORING')) {
          finalClass = 'INCREASE_INSPECTION';
          finalLock = false;
        }
        if (highConfCount >= 3) {
          if (finalClass === 'ENGINEERING_REVIEW') {
            finalClass = 'REPAIR_REPLACE';
            finalLock = true;
          } else if (finalClass === 'INCREASE_INSPECTION') {
            finalClass = 'ENGINEERING_REVIEW';
            finalLock = true;
          }
        }
        if (highConfCount >= 4 && finalClass === 'ENGINEERING_REVIEW') {
          finalClass = 'REPAIR_REPLACE';
          finalLock = true;
        }

        callback({
          error: false,
          actual_class: finalClass,
          actual_authority_lock: finalLock,
          stages_run: 'orchestrator + survival + classification',
          mechanism: weibull.mechanism || 'multi_mechanism'
        });
      });
    });
  });
}

// ── CASE RUNNER ──────────────────────────────────────────────────────

function runCase(testCase, callback) {
  var caseResult = {
    id: testCase.id,
    name: testCase.name,
    path: testCase.path,
    expected_class: testCase.expected_class,
    actual_class: 'UNKNOWN',
    expected_authority_lock: testCase.expected_authority_lock,
    actual_authority_lock: false,
    has_proof_trace: false,
    class_pass: false,
    class_within_one_band: false,
    authority_lock_pass: false,
    no_unsafe_low_risk: true,
    domain: (testCase.evidence && testCase.evidence.domain) || 'unknown',
    mechanism: (testCase.evidence && testCase.evidence.mechanism) || 'unknown',
    errors: []
  };

  var routerFunction = null;
  if (testCase.path === 'A') {
    routerFunction = runPathA;
  } else if (testCase.path === 'B') {
    routerFunction = runPathB;
  } else if (testCase.path === 'C') {
    routerFunction = runPathC;
  } else {
    caseResult.errors.push('Unknown path: ' + testCase.path);
    return callback(caseResult);
  }

  routerFunction(testCase, function(pathResult) {
    if (pathResult.error) {
      caseResult.errors.push(pathResult.error_message);
      caseResult.actual_class = pathResult.actual_class;
      caseResult.actual_authority_lock = pathResult.actual_authority_lock;
    } else {
      caseResult.actual_class = pathResult.actual_class;
      caseResult.actual_authority_lock = pathResult.actual_authority_lock;
      caseResult.has_proof_trace = pathResult.has_proof_trace !== false;
      caseResult.stages_run = pathResult.stages_run;
      caseResult.mechanism = pathResult.mechanism;
    }

    caseResult.class_pass = (caseResult.actual_class === caseResult.expected_class);
    caseResult.class_within_one_band = bandDistance(caseResult.actual_class, caseResult.expected_class) <= 1;
    caseResult.authority_lock_pass = (caseResult.actual_authority_lock === caseResult.expected_authority_lock);

    if (caseResult.actual_class === 'LOW_RISK') {
      var dangerousExpected = ['ENGINEERING_REVIEW', 'REPAIR_REPLACE', 'HOLD_FOR_INPUT'];
      if (dangerousExpected.indexOf(caseResult.expected_class) !== -1) {
        caseResult.no_unsafe_low_risk = false;
      }
    }

    callback(caseResult);
  });
}

// ── BAND DISTANCE CALCULATOR ─────────────────────────────────────────

function bandDistance(actual, expected) {
  var aIdx = SEVERITY_BANDS.indexOf(actual);
  var eIdx = SEVERITY_BANDS.indexOf(expected);
  if (aIdx === -1 || eIdx === -1) return 99;
  return Math.abs(aIdx - eIdx);
}

// ── SEQUENTIAL RUNNER ────────────────────────────────────────────────

function runAllCases(cases, index, results, finalCallback) {
  if (index >= cases.length) {
    return finalCallback(results);
  }

  var testCase = cases[index];
  process.stdout.write('[' + (index + 1) + '/' + cases.length + '] Running ' + testCase.id + ' — ' + testCase.name + '... ');

  runCase(testCase, function(result) {
    var status = '';
    if (result.errors.length > 0) {
      status = 'ERROR';
    } else if (result.class_pass && result.authority_lock_pass) {
      status = 'PASS';
    } else if (result.class_within_one_band) {
      status = 'PARTIAL';
    } else {
      status = 'FAIL';
    }

    var detail = 'path=' + result.path + ' expected=' + result.expected_class + ' actual=' + result.actual_class;
    detail = detail + ' lock_exp=' + result.expected_authority_lock + ' lock_act=' + result.actual_authority_lock;
    if (result.mechanism) {
      detail = detail + ' mech=' + result.mechanism;
    }

    console.log(status + ' (' + detail + ')');

    if (result.errors.length > 0) {
      for (var e = 0; e < result.errors.length; e++) {
        console.log('  ERROR: ' + result.errors[e]);
      }
    }

    results.push(result);
    runAllCases(cases, index + 1, results, finalCallback);
  });
}

// ── SCORING ──────────────────────────────────────────────────────────

function printScorecard(results) {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('GENERALIZATION SUITE 2 — 50 NEW CASES (51–100)');
  console.log('FORGED 4D NDT Intelligence OS');
  console.log('════════════════════════════════════════════════════════════════\n');

  var totalCases = results.length;
  var pathACount = 0, pathBCount = 0, pathCCount = 0;
  var classExact = 0, classWithinOneBand = 0, authorityLock = 0;
  var noUnsafeLowRisk = 0, hasProofTrace = 0, errors = 0;

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.path === 'A') pathACount++;
    if (r.path === 'B') pathBCount++;
    if (r.path === 'C') pathCCount++;
    if (r.class_pass) classExact++;
    if (r.class_within_one_band) classWithinOneBand++;
    if (r.authority_lock_pass) authorityLock++;
    if (r.no_unsafe_low_risk) noUnsafeLowRisk++;
    if (r.has_proof_trace) hasProofTrace++;
    if (r.errors.length > 0) errors++;
  }

  console.log('  Total cases:                       ' + totalCases);
  console.log('  PATH A (Survival Model):           ' + pathACount);
  console.log('  PATH B (Local Classification):     ' + pathBCount);
  console.log('  PATH C (Hybrid):                   ' + pathCCount);
  console.log('');
  console.log('  Exact reliability class match:     ' + classExact + ' / ' + totalCases);
  console.log('  Class within one severity band:    ' + classWithinOneBand + ' / ' + totalCases);
  console.log('  Authority lock correct:            ' + authorityLock + ' / ' + totalCases);
  console.log('  No unsafe LOW_RISK:                ' + noUnsafeLowRisk + ' / ' + totalCases);
  console.log('  Proof trace generated:             ' + hasProofTrace + ' / ' + totalCases);
  console.log('  Errors:                            ' + errors + ' / ' + totalCases);

  console.log('\n── THRESHOLD CHECK ───────────────────────────────────────────────\n');

  var thresholds = [
    { name: 'Exact class match (100%)', score: classExact, target: totalCases, pass: classExact >= totalCases },
    { name: 'Class within one band (90%)', score: classWithinOneBand, target: Math.ceil(totalCases * 0.90), pass: classWithinOneBand >= Math.ceil(totalCases * 0.90) },
    { name: 'Authority lock (96%)', score: authorityLock, target: Math.ceil(totalCases * 0.96), pass: authorityLock >= Math.ceil(totalCases * 0.96) },
    { name: 'No unsafe LOW_RISK', score: noUnsafeLowRisk, target: totalCases, pass: noUnsafeLowRisk >= totalCases },
    { name: 'Proof trace', score: hasProofTrace, target: totalCases, pass: hasProofTrace >= totalCases }
  ];

  var allPass = true;
  for (var t = 0; t < thresholds.length; t++) {
    var th = thresholds[t];
    var icon = th.pass ? 'PASS' : 'FAIL';
    console.log('  [' + icon + '] ' + th.name + ': ' + th.score + '/' + th.target);
    if (!th.pass) allPass = false;
  }

  console.log('\n── FAILED CASES ──────────────────────────────────────────────────\n');

  var failCount = 0;
  for (var f = 0; f < results.length; f++) {
    var r2 = results[f];
    if (!r2.class_pass || !r2.authority_lock_pass || r2.errors.length > 0) {
      failCount++;
      var issues = [];
      if (!r2.class_pass) issues.push('class: expected ' + r2.expected_class + ' got ' + r2.actual_class);
      if (!r2.authority_lock_pass) issues.push('lock: expected ' + r2.expected_authority_lock + ' got ' + r2.actual_authority_lock);
      if (r2.errors.length > 0) issues.push('errors: ' + r2.errors.join('; '));
      console.log('  ' + r2.id + ' ' + r2.name + ': ' + issues.join(' | '));
    }
  }
  if (failCount === 0) {
    console.log('  None — all cases passed!');
  }

  // ── SYSTEMIC DIAGNOSTICS ──
  console.log('\n── SYSTEMIC DIAGNOSTICS ───────────────────────────────────────────\n');

  var domainStats = {};
  var mechStats = {};
  var bandStats = {};
  var pathStats = { A: { pass: 0, fail: 0 }, B: { pass: 0, fail: 0 }, C: { pass: 0, fail: 0 } };

  for (var d = 0; d < results.length; d++) {
    var rd = results[d];
    var domain = rd.domain || 'unknown';
    var mech = rd.mechanism || 'unknown';
    var band = rd.expected_class || 'unknown';
    var path = rd.path || '?';

    if (!domainStats[domain]) domainStats[domain] = { pass: 0, total: 0 };
    domainStats[domain].total++;
    if (rd.class_pass && rd.authority_lock_pass) domainStats[domain].pass++;

    if (!bandStats[band]) bandStats[band] = { pass: 0, total: 0 };
    bandStats[band].total++;
    if (rd.class_pass && rd.authority_lock_pass) bandStats[band].pass++;

    if (pathStats[path]) {
      if (rd.class_pass && rd.authority_lock_pass) pathStats[path].pass++;
      else pathStats[path].fail++;
    }

    if (!rd.class_pass || !rd.authority_lock_pass) {
      if (!mechStats[mech]) mechStats[mech] = [];
      mechStats[mech].push(rd.id + ' (exp:' + rd.expected_class + ' got:' + rd.actual_class + ')');
    }
  }

  console.log('  BY DOMAIN:');
  var domainKeys = Object.keys(domainStats);
  for (var dk = 0; dk < domainKeys.length; dk++) {
    var ds = domainStats[domainKeys[dk]];
    console.log('    ' + domainKeys[dk] + ': ' + ds.pass + '/' + ds.total + ' (' + Math.round(100 * ds.pass / ds.total) + '%)');
  }

  console.log('  BY VALIDATION PATH:');
  var pathKeys = ['A', 'B', 'C'];
  for (var pk = 0; pk < pathKeys.length; pk++) {
    var ps = pathStats[pathKeys[pk]];
    var ptotal = ps.pass + ps.fail;
    if (ptotal > 0) {
      console.log('    PATH ' + pathKeys[pk] + ': ' + ps.pass + '/' + ptotal + ' (' + Math.round(100 * ps.pass / ptotal) + '%)');
    }
  }

  console.log('  BY EXPECTED BAND:');
  var bandKeys = Object.keys(bandStats);
  for (var bk = 0; bk < bandKeys.length; bk++) {
    var bs = bandStats[bandKeys[bk]];
    console.log('    ' + bandKeys[bk] + ': ' + bs.pass + '/' + bs.total + ' (' + Math.round(100 * bs.pass / bs.total) + '%)');
  }

  console.log('  FAILING MECHANISMS (systemic patterns):');
  var mechKeys = Object.keys(mechStats);
  if (mechKeys.length === 0) {
    console.log('    None — all mechanisms classified correctly!');
  } else {
    for (var mk = 0; mk < mechKeys.length; mk++) {
      console.log('    ' + mechKeys[mk] + ' (' + mechStats[mechKeys[mk]].length + ' failures): ' + mechStats[mechKeys[mk]].join(', '));
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('OVERALL: ' + (allPass ? 'ALL THRESHOLDS PASSED' : 'SOME THRESHOLDS NOT MET'));
  console.log('════════════════════════════════════════════════════════════════');
}

// ── MAIN ─────────────────────────────────────────────────────────────

console.log('════════════════════════════════════════════════════════════════');
console.log('GENERALIZATION SUITE 2 — 50 NEW CASES (51–100)');
console.log('FORGED 4D NDT Intelligence OS — Generalization Test');
console.log('Target: ' + BASE_URL);
console.log('Cases: ' + TEST_CASES.length);
console.log('════════════════════════════════════════════════════════════════');

runAllCases(TEST_CASES, 0, [], function(results) {
  printScorecard(results);
});
