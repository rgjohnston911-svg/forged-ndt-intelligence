// @ts-nocheck
// ═══════════════════════════════════════════════════════════════════════
// FORGED 4D NDT PLATFORM — BLIND VALIDATION SUITE
// 50 Fresh Cases — Cross-Domain Consistency Test
//
// Purpose: Validate platform accuracy on UNSEEN scenarios across all
//          domains. These cases were NOT used during engine tuning.
//
// Pipeline per case:
//   1. comprehensive-assessment (orchestrator) -> mechanisms + disposition
//   2. run_survival -> time horizons
//   3. run_classification -> reliability_class + authority_lock
//   Score against 8-criteria rubric (0-100 per case, 0-5000 total)
//
// Domain coverage:
//   B01-B10: Fixed Equipment (vessels, exchangers, piping)
//   B11-B20: Refinery / Chemical Plant
//   B21-B30: Subsea Infrastructure
//   B31-B40: Pipeline (onshore & offshore)
//   B41-B45: Marine Vessel
//   B46-B50: Floating / Production / Power Generation
// ═══════════════════════════════════════════════════════════════════════

var https = require('https');
var http = require('http');
var url = require('url');

var BASE_URL = process.env.FORGED_URL || 'https://4dndt.netlify.app';

// ── 50 BLIND TEST CASES ─────────────────────────────────────────────

var TEST_CASES = [

  // ══════════════════════════════════════════════════════════════════
  // DOMAIN 1: FIXED EQUIPMENT (B01–B10)
  // ══════════════════════════════════════════════════════════════════

  // B01: Air cooler header box — pitting under deposits
  {
    id: 'BLIND_01_AIRCOOLER_PITTING',
    asset: 'air cooler header box',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: false,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 0.375,
      tmm: 0.290,
      visual: 'Under-deposit pitting on tube sheet face, scale accumulation',
      ut: 'Scattered pitting max 0.085 in deep, thinning to 0.290 in avg',
      pit_depth: 0.085,
      mechanism: 'general_corrosion',
      crack_orientation: 'none',
      morphology: 'volumetric',
      crack_location: 'base_metal',
      wall_loss_pattern: 'pitting',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded'
    },
    ground_truth: ['general_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 1.8, scale: 5.0, mechanism: 'general_corrosion' },
    critical_note: 'Straightforward under-deposit pitting in air cooler. Single mechanism.'
  },

  // B02: Column tray support ring — erosion at liquid redistribution
  {
    id: 'BLIND_02_COLUMN_TRAY_EROSION',
    asset: 'distillation column tray support ring',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: false,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 0.500,
      tmm: 0.410,
      visual: 'Localized thinning at tray downcomer impingement zone',
      ut: 'Thinning to 0.410 in at impingement, 0.48 in elsewhere',
      mechanism: 'erosion_corrosion',
      morphology: 'general_thinning',
      crack_location: 'base_metal',
      wall_loss_pattern: 'localized',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      flow_velocity: '12 ft/s'
    },
    ground_truth: ['erosion_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.0, scale: 4.5, mechanism: 'erosion_corrosion' },
    critical_note: 'Erosion at tray downcomer impingement. Moderate wall loss.'
  },

  // B03: Heat exchanger channel — galvanic + MIC in cooling water
  {
    id: 'BLIND_03_HX_CHANNEL_GALVANIC_MIC',
    asset: 'heat exchanger channel head',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A285 Gr.C',
      tnom: 0.625,
      tmm: 0.440,
      visual: 'Tubercles and biofilm at tube-to-tubesheet junction, dissimilar metal interface',
      ut: 'General thinning 0.44 in with localized pitting to 0.35 in near tubesheet',
      pit_depth: 0.185,
      mechanism: 'galvanic_corrosion',
      morphology: 'volumetric',
      crack_location: 'base_metal',
      wall_loss_pattern: 'pitting',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'near_weld',
      surface_condition: 'fouled',
      service_fluid: 'cooling water with biological growth'
    },
    ground_truth: ['galvanic_corrosion', 'MIC'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.2, scale: 3.5, mechanism: 'galvanic_corrosion' },
    critical_note: 'Competing galvanic at dissimilar metal joint plus MIC from biofilm.'
  },

  // B04: Pressure vessel manway — bolt hole cracking
  {
    id: 'BLIND_04_MANWAY_BOLT_CRACK',
    asset: 'pressure vessel manway flange',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 1.500,
      tmm: 1.480,
      visual: 'Linear indication at bolt hole, radial from hole edge',
      mt: 'Confirmed crack 0.75 in long radiating from bolt hole',
      mechanism: 'mechanical_fatigue',
      crack_orientation: 'circumferential',
      morphology: 'planar',
      crack_location: 'base_metal',
      wall_loss_pattern: 'none',
      coating_condition: 'intact',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'clean'
    },
    ground_truth: ['mechanical_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 3.0, scale: 4.0, mechanism: 'mechanical_fatigue' },
    critical_note: 'Fatigue crack at stress concentration (bolt hole). Pressure cycling.'
  },

  // B05: Deaerator vessel — oxygen pitting + cracking
  {
    id: 'BLIND_05_DEAERATOR_OXYGEN',
    asset: 'deaerator vessel',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 0.750,
      tmm: 0.610,
      visual: 'Pitting clusters at waterline, linear indications near welds',
      ut: 'General thinning 0.61 in with deep pits to 0.50 in at waterline',
      mt: 'Two linear indications 2 in and 3 in at weld toe',
      pit_depth: 0.250,
      mechanism: 'oxygen_pitting',
      crack_orientation: 'transverse',
      morphology: 'volumetric',
      crack_location: 'weld_toe',
      wall_loss_pattern: 'pitting',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'near_weld',
      surface_condition: 'corroded',
      service_fluid: 'boiler feedwater with dissolved oxygen'
    },
    ground_truth: ['oxygen_pitting', 'mechanical_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.3, scale: 3.0, mechanism: 'oxygen_pitting' },
    critical_note: 'Deaerator with oxygen pitting initiating fatigue cracks at weld toes.'
  },

  // B06: Fin-fan cooler tube — external atmospheric corrosion
  {
    id: 'BLIND_06_FINFAN_ATMOSPHERIC',
    asset: 'fin-fan cooler tube bundle',
    domain: 'fixed',
    equipment_type: 'piping',
    high_risk: false,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'A179',
      tnom: 0.120,
      tmm: 0.095,
      visual: 'External rust and fin deterioration, tube OD pitting',
      ut: 'Average wall 0.095 in, localized thin spots at 0.080 in',
      mechanism: 'atmospheric_corrosion',
      morphology: 'volumetric',
      crack_location: 'od_surface',
      wall_loss_pattern: 'general',
      coating_condition: 'failed',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded'
    },
    ground_truth: ['atmospheric_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 1.6, scale: 4.0, mechanism: 'atmospheric_corrosion' },
    critical_note: 'External atmospheric attack on thin-wall fin-fan tubes.'
  },

  // B07: Pressure vessel shell — hydrogen blistering
  {
    id: 'BLIND_07_VESSEL_HIC',
    asset: 'pressure vessel in wet H2S service',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 1.000,
      tmm: 0.980,
      visual: 'Surface blisters 1-3 in diameter on ID surface',
      ut: 'Laminar indications at mid-wall, blister confirmation',
      mechanism: 'HIC',
      crack_orientation: 'parallel_to_plate',
      morphology: 'stepwise_blistering',
      crack_location: 'mid_wall',
      wall_loss_pattern: 'none',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'clean',
      service_fluid: 'sour water with 500 ppm H2S'
    },
    ground_truth: ['HIC'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.5, scale: 3.5, mechanism: 'HIC' },
    critical_note: 'HIC blistering in sour service vessel. Classic presentation.'
  },

  // B08: Vessel skirt attachment weld — thermal fatigue
  {
    id: 'BLIND_08_SKIRT_THERMAL_FATIGUE',
    asset: 'vessel skirt-to-shell attachment weld',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 0.875,
      tmm: 0.860,
      visual: 'Circumferential cracking at skirt attachment weld',
      mt: 'Multiple circumferential cracks 4-8 in long in HAZ',
      mechanism: 'thermal_fatigue',
      crack_orientation: 'circumferential',
      morphology: 'transgranular',
      crack_location: 'HAZ',
      wall_loss_pattern: 'none',
      coating_condition: 'intact',
      cp_status: 'not_applicable',
      weld_proximity: 'at_weld',
      surface_condition: 'clean'
    },
    ground_truth: ['thermal_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.8, scale: 3.2, mechanism: 'thermal_fatigue' },
    critical_note: 'Thermal fatigue at skirt attachment from startup/shutdown cycling.'
  },

  // B09: Steam drum — caustic gouging
  {
    id: 'BLIND_09_STEAM_DRUM_CAUSTIC',
    asset: 'boiler steam drum',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 1.250,
      tmm: 1.050,
      visual: 'Localized gouging at tube attachment welds, smooth hemispherical pits',
      ut: 'Localized thinning at tube-to-drum welds, min 1.05 in',
      mechanism: 'caustic_cracking',
      morphology: 'intergranular',
      crack_location: 'weld_toe',
      wall_loss_pattern: 'localized',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'at_weld',
      surface_condition: 'corroded',
      service_fluid: 'boiler water pH 11.5 with caustic treatment'
    },
    ground_truth: ['caustic_cracking', 'general_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.1, scale: 4.0, mechanism: 'caustic_cracking' },
    critical_note: 'Caustic gouging at tube attachments with general thinning. High-pH environment.'
  },

  // B10: Pressure vessel with weld overlay disbondment
  {
    id: 'BLIND_10_OVERLAY_DISBOND',
    asset: 'clad pressure vessel with overlay disbondment',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: true,
    weak_data: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 2.000,
      tmm: 1.950,
      visual: 'Bulging observed at weld overlay, possible disbondment',
      ut: 'Lack of bond signal at overlay-to-base interface over 6 in x 4 in area',
      mechanism: 'hydrogen_embrittlement',
      morphology: 'planar',
      crack_location: 'mid_wall',
      wall_loss_pattern: 'none',
      coating_condition: 'intact',
      cp_status: 'not_applicable',
      weld_proximity: 'in_weld',
      surface_condition: 'clean',
      service_fluid: 'hydrogen-rich process gas at 650F'
    },
    ground_truth: ['hydrogen_embrittlement'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.0, scale: 3.0, mechanism: 'hydrogen_embrittlement' },
    critical_note: 'Overlay disbondment in hydrogen service. Possible HE at interface.'
  },

  // ══════════════════════════════════════════════════════════════════
  // DOMAIN 2: REFINERY / CHEMICAL PLANT (B11–B20)
  // ══════════════════════════════════════════════════════════════════

  // B11: Crude unit atmospheric tower — high-temp sulfidation
  {
    id: 'BLIND_11_CRUDE_SULFIDATION',
    asset: 'crude unit atmospheric tower shell',
    domain: 'refinery',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 1.000,
      tmm: 0.780,
      visual: 'Uniform dark sulfide scale on ID, thinning measured by UT grid',
      ut: 'Uniform thinning 0.78 in, consistent with corrosion rate 8 mpy',
      mechanism: 'sulfidation',
      morphology: 'general_thinning',
      crack_location: 'id_surface',
      wall_loss_pattern: 'general',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      service_fluid: 'crude oil with 2.5% sulfur'
    },
    ground_truth: ['sulfidation'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 1.9, scale: 3.8, mechanism: 'sulfidation' },
    critical_note: 'High-temperature sulfidation in crude tower. Steady corrosion rate.'
  },

  // B12: FCC reactor cyclone — erosion + high-temp oxidation
  {
    id: 'BLIND_12_FCC_CYCLONE_EROSION',
    asset: 'FCC reactor cyclone',
    domain: 'refinery',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A387 Gr.11',
      tnom: 0.500,
      tmm: 0.320,
      visual: 'Severe erosive wear on cyclone cone, thinning at catalyst impingement',
      ut: 'Minimum wall 0.32 in at cone, 0.48 in at barrel',
      mechanism: 'erosion_corrosion',
      morphology: 'general_thinning',
      crack_location: 'base_metal',
      wall_loss_pattern: 'localized',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      flow_velocity: '45 ft/s'
    },
    ground_truth: ['erosion_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.5, scale: 2.5, mechanism: 'erosion_corrosion' },
    critical_note: 'Severe catalyst erosion in FCC cyclone. High velocity impingement.'
  },

  // B13: Amine regenerator reboiler — amine cracking + general corrosion
  {
    id: 'BLIND_13_AMINE_REBOILER',
    asset: 'amine regenerator reboiler',
    domain: 'refinery',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A106 Gr.B',
      tnom: 0.500,
      tmm: 0.430,
      visual: 'Cracking at tube-to-tubesheet welds, general thinning on shell side',
      mt: 'Branching cracks at multiple tube welds, max 1.5 in long',
      ut: 'Shell thinning to 0.43 in',
      mechanism: 'amine_cracking',
      crack_orientation: 'circumferential',
      morphology: 'branched',
      crack_location: 'weld_toe',
      wall_loss_pattern: 'general',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'at_weld',
      surface_condition: 'corroded',
      service_fluid: 'rich MDEA amine solution',
      amine_concentration: 'moderate'
    },
    ground_truth: ['amine_cracking', 'general_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.4, scale: 2.8, mechanism: 'amine_cracking' },
    critical_note: 'Amine cracking at reboiler tube welds with concurrent general corrosion.'
  },

  // B14: Hydroprocessor reactor — HTHA at elevated temperature
  {
    id: 'BLIND_14_HYDRO_REACTOR_HTHA',
    asset: 'hydroprocessor reactor vessel',
    domain: 'refinery',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 4.000,
      tmm: 3.980,
      visual: 'No visible external damage',
      ut: 'Backwall echo attenuation detected in lower shell course',
      tofd: 'Micro-fissuring detected at mid-wall in 3 locations',
      mechanism: 'HTHA',
      morphology: 'intergranular',
      crack_location: 'mid_wall',
      wall_loss_pattern: 'none',
      coating_condition: 'intact',
      cp_status: 'not_applicable',
      weld_proximity: 'near_weld',
      surface_condition: 'clean',
      service_fluid: 'hydrogen at 2200 psig and 850F'
    },
    ground_truth: ['HTHA'],
    expected_class: 'REPAIR_REPLACE',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 1.5, scale: 1.5, mechanism: 'HTHA' },
    critical_note: 'HTHA in hydroprocessor above Nelson curve. Critical safety concern.'
  },

  // B15: Alkylation unit — HF acid corrosion
  {
    id: 'BLIND_15_ALKYLATION_HF',
    asset: 'HF alkylation acid settler vessel',
    domain: 'refinery',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 0.750,
      tmm: 0.580,
      visual: 'Localized thinning at liquid-vapor interface, smooth profile',
      ut: 'Min wall 0.58 in at interface zone, 0.72 in elsewhere',
      mechanism: 'chemical_attack',
      morphology: 'general_thinning',
      crack_location: 'id_surface',
      wall_loss_pattern: 'localized',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      service_fluid: 'hydrofluoric acid 70% concentration'
    },
    ground_truth: ['chemical_attack'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.0, scale: 3.0, mechanism: 'chemical_attack' },
    critical_note: 'HF acid corrosion at liquid-vapor interface. High consequence.'
  },

  // B16: Reformer furnace tube — creep + carburization
  {
    id: 'BLIND_16_REFORMER_CREEP',
    asset: 'reformer furnace tube',
    domain: 'refinery',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'Cr-Mo alloy (HP Modified)',
      tnom: 0.500,
      tmm: 0.490,
      visual: 'Tube bulging and OD oxidation scale, 2% diametral expansion',
      ut: 'Wall average 0.49 in, slight thinning at hottest zone',
      mechanism: 'creep',
      morphology: 'intergranular',
      crack_location: 'od_surface',
      wall_loss_pattern: 'general',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'near_weld',
      surface_condition: 'corroded',
      service_fluid: 'steam methane reforming gas at 1650F'
    },
    ground_truth: ['creep'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 1.8, scale: 2.5, mechanism: 'creep' },
    critical_note: 'Creep bulging in reformer tube. High temperature service.'
  },

  // B17: Crude overhead condenser — under-deposit + chloride
  {
    id: 'BLIND_17_OVERHEAD_CONDENSER',
    asset: 'crude overhead condenser shell',
    domain: 'refinery',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 0.625,
      tmm: 0.480,
      visual: 'NH4Cl salt deposits on ID, localized pitting under deposits',
      ut: 'Scattered pitting to 0.15 in deep, general thinning to 0.48 in',
      pit_depth: 0.145,
      mechanism: 'under_deposit_corrosion',
      morphology: 'volumetric',
      crack_location: 'id_surface',
      wall_loss_pattern: 'pitting',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'fouled',
      service_fluid: 'overhead vapors with HCl and NH4Cl'
    },
    ground_truth: ['under_deposit_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.1, scale: 3.5, mechanism: 'under_deposit_corrosion' },
    critical_note: 'Ammonium chloride fouling causing under-deposit corrosion in overhead.'
  },

  // B18: Naphthenic acid attack in vacuum tower
  {
    id: 'BLIND_18_VAC_TOWER_NAPHTHENIC',
    asset: 'vacuum distillation tower transfer line',
    domain: 'refinery',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'A106 Gr.B',
      tnom: 0.500,
      tmm: 0.310,
      visual: 'Streamlined erosive thinning pattern following flow, sharp-edged pits',
      ut: 'Min wall 0.31 in at elbow intrados, corrosion rate 25 mpy',
      mechanism: 'naphthenic_acid_corrosion',
      morphology: 'general_thinning',
      crack_location: 'id_surface',
      wall_loss_pattern: 'localized',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      service_fluid: 'heavy vacuum gas oil TAN 3.2 mg KOH/g'
    },
    ground_truth: ['naphthenic_acid_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.3, scale: 2.0, mechanism: 'naphthenic_acid_corrosion' },
    critical_note: 'High TAN naphthenic acid attack in vacuum transfer line.'
  },

  // B19: Reactor effluent air cooler — polythionic acid SCC during shutdown
  {
    id: 'BLIND_19_REAC_POLYTHIONIC',
    asset: 'reactor effluent air cooler (stainless)',
    domain: 'refinery',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: '304 SS',
      tnom: 0.120,
      tmm: 0.115,
      visual: 'Intergranular cracking visible at tube-to-header welds after shutdown',
      mt: 'Multiple IG cracks in HAZ, branching pattern',
      mechanism: 'polythionic_acid_scc',
      crack_orientation: 'transverse',
      morphology: 'intergranular',
      crack_location: 'HAZ',
      wall_loss_pattern: 'none',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'near_weld',
      surface_condition: 'corroded'
    },
    ground_truth: ['polythionic_acid_scc'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.6, scale: 3.0, mechanism: 'polythionic_acid_scc' },
    critical_note: 'Shutdown-induced polythionic acid SCC in sensitized stainless steel.'
  },

  // B20: Sour water stripper — SSC + SOHIC combination
  {
    id: 'BLIND_20_SOUR_STRIPPER_SSC',
    asset: 'sour water stripper column',
    domain: 'refinery',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 0.875,
      tmm: 0.850,
      visual: 'Surface blisters with associated cracking at weld HAZ',
      ut: 'Stepwise cracking detected linking HIC blisters through-wall',
      mechanism: 'SSC',
      crack_orientation: 'transverse',
      morphology: 'stepwise_blistering',
      crack_location: 'HAZ',
      wall_loss_pattern: 'none',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'near_weld',
      surface_condition: 'clean',
      service_fluid: 'sour water with 3000 ppm H2S',
      hardness_haz: 260
    },
    ground_truth: ['SSC', 'SOHIC'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.4, scale: 2.5, mechanism: 'SSC' },
    critical_note: 'SSC plus SOHIC in sour water stripper. Hard HAZ exacerbates cracking.'
  },

  // ══════════════════════════════════════════════════════════════════
  // DOMAIN 3: SUBSEA INFRASTRUCTURE (B21–B30)
  // ══════════════════════════════════════════════════════════════════

  // B21: Subsea manifold valve body — external corrosion + CP degradation
  {
    id: 'BLIND_21_MANIFOLD_VALVE',
    asset: 'subsea manifold valve body',
    domain: 'subsea',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 2.000,
      tmm: 1.850,
      visual: 'External pitting on valve body, anode consumption 85%',
      ut: 'Wall thinning to 1.85 in at pitting zone',
      mechanism: 'general_corrosion',
      morphology: 'volumetric',
      crack_location: 'od_surface',
      wall_loss_pattern: 'pitting',
      coating_condition: 'failed',
      cp_status: 'marginal',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      water_depth_m: 150
    },
    ground_truth: ['general_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 1.8, scale: 5.0, mechanism: 'general_corrosion' },
    critical_note: 'Subsea valve body with CP degradation. Marginal protection remaining.'
  },

  // B22: Subsea jumper spool — fatigue at connection
  {
    id: 'BLIND_22_JUMPER_FATIGUE',
    asset: 'subsea jumper spool connector',
    domain: 'subsea',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'piping',
      material: 'API 5L X65',
      tnom: 0.750,
      tmm: 0.740,
      visual: 'Crack indication at hub connector weld',
      mt: 'Circumferential crack 2 in long at connector weld toe',
      mechanism: 'mechanical_fatigue',
      crack_orientation: 'circumferential',
      morphology: 'transgranular',
      crack_location: 'weld_toe',
      wall_loss_pattern: 'none',
      coating_condition: 'intact',
      cp_status: 'adequate',
      weld_proximity: 'at_weld',
      surface_condition: 'clean',
      water_depth_m: 800
    },
    ground_truth: ['mechanical_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 3.0, scale: 4.0, mechanism: 'mechanical_fatigue' },
    critical_note: 'Fatigue at subsea jumper connector from thermal/pressure cycling.'
  },

  // B23: Subsea flowline — internal CO2 corrosion + sand erosion
  {
    id: 'BLIND_23_FLOWLINE_CO2_SAND',
    asset: 'subsea production flowline',
    domain: 'subsea',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'piping',
      material: 'API 5L X65',
      tnom: 0.625,
      tmm: 0.440,
      visual: 'ILI detected internal metal loss at 6 o-clock position',
      ut: 'Thinning to 0.44 in at low points, sand and corrosion product',
      mechanism: 'CO2_corrosion',
      morphology: 'general_thinning',
      crack_location: 'id_surface',
      wall_loss_pattern: 'localized',
      coating_condition: 'intact',
      cp_status: 'adequate',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      service_fluid: 'wet gas with CO2 partial pressure 45 psi and sand',
      water_depth_m: 350
    },
    ground_truth: ['CO2_corrosion', 'erosion_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.2, scale: 3.0, mechanism: 'CO2_corrosion' },
    critical_note: 'Internal CO2 corrosion with sand erosion in subsea flowline.'
  },

  // B24: Subsea pipeline end termination — stress concentration fatigue
  {
    id: 'BLIND_24_PLET_STRESS',
    asset: 'subsea PLET weld',
    domain: 'subsea',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: false,
    weak_data: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'piping',
      material: 'API 5L X65',
      tnom: 1.000,
      tmm: 0.990,
      visual: 'ROV inspection shows crack at PLET-to-pipeline transition weld',
      mt: 'Crack 3 in long at weld toe, through coating',
      mechanism: 'mechanical_fatigue',
      crack_orientation: 'circumferential',
      morphology: 'transgranular',
      crack_location: 'weld_toe',
      wall_loss_pattern: 'none',
      coating_condition: 'damaged',
      cp_status: 'adequate',
      weld_proximity: 'at_weld',
      surface_condition: 'clean',
      water_depth_m: 1200
    },
    ground_truth: ['mechanical_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.8, scale: 5.0, mechanism: 'mechanical_fatigue' },
    critical_note: 'Fatigue crack at PLET transition weld from pipeline movement loading.'
  },

  // B25: Subsea riser caisson — splash zone corrosion + fatigue
  {
    id: 'BLIND_25_CAISSON_SPLASH',
    asset: 'subsea riser caisson splash zone',
    domain: 'subsea',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'piping',
      material: 'API 5L Gr.B',
      tnom: 0.500,
      tmm: 0.310,
      visual: 'Heavy corrosion and pitting in splash zone, coating fully degraded',
      ut: 'Min wall 0.31 in in splash zone, 0.46 in below waterline',
      mechanism: 'general_corrosion',
      crack_orientation: 'none',
      morphology: 'volumetric',
      crack_location: 'od_surface',
      wall_loss_pattern: 'general',
      coating_condition: 'failed',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      water_depth_m: 0
    },
    ground_truth: ['general_corrosion', 'mechanical_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.0, scale: 2.5, mechanism: 'general_corrosion' },
    critical_note: 'Splash zone corrosion with wave-induced fatigue loading on thinned wall.'
  },

  // B26: Subsea tree block — external MIC in seabed burial zone
  {
    id: 'BLIND_26_TREE_MIC',
    asset: 'subsea christmas tree valve block',
    domain: 'subsea',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: true,
    weak_data: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'pressure_vessel',
      material: 'A516 Gr.70',
      tnom: 3.000,
      tmm: 2.850,
      visual: 'Anaerobic biofilm on external surfaces near mudline',
      ut: 'Localized external pitting max 0.15 in deep',
      pit_depth: 0.150,
      mechanism: 'MIC',
      morphology: 'volumetric',
      crack_location: 'od_surface',
      wall_loss_pattern: 'pitting',
      coating_condition: 'damaged',
      cp_status: 'marginal',
      weld_proximity: 'away_from_weld',
      surface_condition: 'fouled',
      water_depth_m: 90
    },
    ground_truth: ['MIC'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 1.7, scale: 6.0, mechanism: 'MIC' },
    critical_note: 'MIC attack on subsea tree near mudline with anaerobic conditions.'
  },

  // B27: Subsea umbilical — fatigue at I/J tube
  {
    id: 'BLIND_27_UMBILICAL_FATIGUE',
    asset: 'subsea umbilical I/J tube',
    domain: 'subsea',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'piping',
      material: 'Duplex 2205',
      tnom: 0.120,
      tmm: 0.115,
      visual: 'Crack at bellmouth transition detected during pullout inspection',
      ut: 'Through-wall crack 40% depth at tube OD',
      mechanism: 'mechanical_fatigue',
      crack_orientation: 'circumferential',
      morphology: 'transgranular',
      crack_location: 'od_surface',
      wall_loss_pattern: 'none',
      coating_condition: 'intact',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'clean',
      water_depth_m: 600
    },
    ground_truth: ['mechanical_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 3.2, scale: 3.5, mechanism: 'mechanical_fatigue' },
    critical_note: 'Umbilical fatigue at stress concentration point (bellmouth).'
  },

  // B28: Subsea pipeline repair clamp — external corrosion
  {
    id: 'BLIND_28_REPAIR_CLAMP_CORR',
    asset: 'subsea pipeline repair clamp',
    domain: 'subsea',
    equipment_type: 'piping',
    high_risk: false,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'piping',
      material: 'A516 Gr.70',
      tnom: 1.500,
      tmm: 1.380,
      visual: 'General corrosion on clamp exterior, anode wastage',
      ut: 'Uniform thinning to 1.38 in',
      mechanism: 'general_corrosion',
      morphology: 'volumetric',
      crack_location: 'od_surface',
      wall_loss_pattern: 'general',
      coating_condition: 'degraded',
      cp_status: 'marginal',
      weld_proximity: 'near_weld',
      surface_condition: 'corroded',
      water_depth_m: 200
    },
    ground_truth: ['general_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 1.6, scale: 6.0, mechanism: 'general_corrosion' },
    critical_note: 'External corrosion on subsea repair clamp with marginal CP.'
  },

  // B29: Subsea wellhead conductor — fatigue from VIV
  {
    id: 'BLIND_29_CONDUCTOR_VIV',
    asset: 'subsea wellhead conductor pipe',
    domain: 'subsea',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'piping',
      material: 'API 5L X52',
      tnom: 1.000,
      tmm: 0.980,
      visual: 'Circumferential crack at conductor-to-wellhead connection',
      mt: 'Full circumferential crack 360 deg, max depth 0.25 in',
      mechanism: 'mechanical_fatigue',
      crack_orientation: 'circumferential',
      morphology: 'transgranular',
      crack_location: 'weld_toe',
      wall_loss_pattern: 'none',
      coating_condition: 'intact',
      cp_status: 'adequate',
      weld_proximity: 'at_weld',
      surface_condition: 'clean',
      water_depth_m: 450
    },
    ground_truth: ['mechanical_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.5, scale: 3.0, mechanism: 'mechanical_fatigue' },
    critical_note: 'VIV-induced fatigue crack at wellhead conductor connection.'
  },

  // B30: Subsea pipeline crossing — mechanical damage + corrosion
  {
    id: 'BLIND_30_CROSSING_DAMAGE',
    asset: 'subsea pipeline at crossing location',
    domain: 'subsea',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'piping',
      material: 'API 5L X60',
      tnom: 0.750,
      tmm: 0.620,
      visual: 'Dent and gouge at pipeline crossing, coating stripped',
      ut: 'Wall loss at gouge to 0.62 in, dent depth 3% OD',
      mechanism: 'general_corrosion',
      morphology: 'volumetric',
      crack_location: 'od_surface',
      wall_loss_pattern: 'localized',
      coating_condition: 'failed',
      cp_status: 'marginal',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      water_depth_m: 120
    },
    ground_truth: ['general_corrosion', 'mechanical_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.2, scale: 3.5, mechanism: 'general_corrosion' },
    critical_note: 'Mechanical damage at crossing with subsequent corrosion and fatigue risk.'
  },

  // ══════════════════════════════════════════════════════════════════
  // DOMAIN 4: PIPELINE — ONSHORE & OFFSHORE (B31–B40)
  // ══════════════════════════════════════════════════════════════════

  // B31: Onshore gas pipeline — SCC near compressor station
  {
    id: 'BLIND_31_GAS_PIPELINE_SCC',
    asset: 'onshore gas pipeline near compressor station',
    domain: 'fixed',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'API 5L X52',
      tnom: 0.375,
      tmm: 0.370,
      visual: 'Colony of axial cracks in external coating disbondment area',
      mt: 'Multiple axial SCC colonies, max 4 in long',
      mechanism: 'chloride_scc',
      crack_orientation: 'axial',
      morphology: 'transgranular',
      crack_location: 'od_surface',
      wall_loss_pattern: 'none',
      coating_condition: 'disbonded',
      cp_status: 'shielded',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded'
    },
    ground_truth: ['chloride_scc'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.5, scale: 4.0, mechanism: 'chloride_scc' },
    critical_note: 'Near-neutral pH SCC under disbonded coating with CP shielding.'
  },

  // B32: Crude oil pipeline — internal corrosion at low point
  {
    id: 'BLIND_32_CRUDE_INTERNAL_CORR',
    asset: 'crude oil gathering pipeline low point',
    domain: 'fixed',
    equipment_type: 'piping',
    high_risk: false,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'API 5L Gr.B',
      tnom: 0.312,
      tmm: 0.220,
      visual: 'ILI detected internal metal loss at pipeline low point',
      ut: 'Thinning to 0.22 in at 6 o-clock, general wall 0.30 in',
      mechanism: 'general_corrosion',
      morphology: 'volumetric',
      crack_location: 'id_surface',
      wall_loss_pattern: 'localized',
      coating_condition: 'intact',
      cp_status: 'adequate',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      service_fluid: 'crude oil with 2% water cut'
    },
    ground_truth: ['general_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 1.8, scale: 4.0, mechanism: 'general_corrosion' },
    critical_note: 'Water dropout internal corrosion at pipeline low point.'
  },

  // B33: Natural gas pipeline — external corrosion at road crossing
  {
    id: 'BLIND_33_ROAD_CROSSING_CORR',
    asset: 'natural gas pipeline at road crossing',
    domain: 'fixed',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'API 5L X42',
      tnom: 0.312,
      tmm: 0.210,
      visual: 'External corrosion on pipe exposed during excavation',
      ut: 'Min wall 0.21 in, 33% wall loss',
      mechanism: 'general_corrosion',
      morphology: 'volumetric',
      crack_location: 'od_surface',
      wall_loss_pattern: 'general',
      coating_condition: 'failed',
      cp_status: 'inadequate',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded'
    },
    ground_truth: ['general_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 1.9, scale: 3.0, mechanism: 'general_corrosion' },
    critical_note: 'External corrosion at road crossing with failed CP and coating.'
  },

  // B34: Sour gas pipeline — SSC at girth weld
  {
    id: 'BLIND_34_SOUR_GIRTH_SSC',
    asset: 'sour gas pipeline girth weld',
    domain: 'fixed',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'API 5L X60',
      tnom: 0.500,
      tmm: 0.495,
      visual: 'Crack at girth weld root',
      ut: 'Root crack 0.08 in deep, 3 in long',
      mechanism: 'SSC',
      crack_orientation: 'circumferential',
      morphology: 'transgranular',
      crack_location: 'weld_root',
      wall_loss_pattern: 'none',
      coating_condition: 'intact',
      cp_status: 'adequate',
      weld_proximity: 'in_weld',
      surface_condition: 'clean',
      service_fluid: 'sour gas 8000 ppm H2S',
      hardness_haz: 270
    },
    ground_truth: ['SSC'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.8, scale: 3.5, mechanism: 'SSC' },
    critical_note: 'SSC at sour gas pipeline girth weld root. Hard weld metal.'
  },

  // B35: Water injection pipeline — oxygen pitting
  {
    id: 'BLIND_35_WATER_INJ_PITTING',
    asset: 'water injection pipeline',
    domain: 'fixed',
    equipment_type: 'piping',
    high_risk: false,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'API 5L Gr.B',
      tnom: 0.375,
      tmm: 0.280,
      visual: 'Internal pitting along bottom of pipe',
      ut: 'Scattered pitting max 0.095 in deep, 0.28 in min wall',
      pit_depth: 0.095,
      mechanism: 'oxygen_pitting',
      morphology: 'volumetric',
      crack_location: 'id_surface',
      wall_loss_pattern: 'pitting',
      coating_condition: 'intact',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      service_fluid: 'treated seawater injection with residual O2'
    },
    ground_truth: ['oxygen_pitting'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 1.7, scale: 5.0, mechanism: 'oxygen_pitting' },
    critical_note: 'Oxygen pitting in water injection line. Residual dissolved oxygen.'
  },

  // B36: Multi-phase flowline — slug-induced fatigue + CO2
  {
    id: 'BLIND_36_SLUG_FATIGUE_CO2',
    asset: 'multi-phase production flowline',
    domain: 'fixed',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'API 5L X52',
      tnom: 0.500,
      tmm: 0.380,
      visual: 'Vibration marks on pipe supports, internal corrosion at bends',
      ut: 'Thinning at elbows to 0.38 in, pipe body 0.47 in',
      mechanism: 'CO2_corrosion',
      morphology: 'general_thinning',
      crack_location: 'id_surface',
      wall_loss_pattern: 'localized',
      coating_condition: 'intact',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      service_fluid: 'multi-phase with CO2 and slug flow',
      vibration_amplitude: '0.3 in/s RMS'
    },
    ground_truth: ['CO2_corrosion', 'mechanical_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.1, scale: 3.0, mechanism: 'CO2_corrosion' },
    critical_note: 'CO2 corrosion plus slug-induced vibration fatigue in multi-phase line.'
  },

  // B37: Pipeline pig trap — erosion at barrel
  {
    id: 'BLIND_37_PIG_TRAP_EROSION',
    asset: 'pipeline pig launcher barrel',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: false,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A106 Gr.B',
      tnom: 0.500,
      tmm: 0.410,
      visual: 'Internal erosion wear at barrel inlet transition',
      ut: 'Thinning to 0.41 in at inlet, 0.49 in at barrel',
      mechanism: 'erosion_corrosion',
      morphology: 'general_thinning',
      crack_location: 'id_surface',
      wall_loss_pattern: 'localized',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'near_weld',
      surface_condition: 'corroded'
    },
    ground_truth: ['erosion_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.0, scale: 5.0, mechanism: 'erosion_corrosion' },
    critical_note: 'Erosion at pig launcher inlet from pig passage and sand.'
  },

  // B38: Pipeline valve — body corrosion + packing leak
  {
    id: 'BLIND_38_VALVE_BODY_CORR',
    asset: 'mainline block valve body',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: false,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A216 WCB',
      tnom: 1.250,
      tmm: 1.100,
      visual: 'External corrosion on valve body, rust staining from packing area',
      ut: 'Body wall thinning to 1.10 in',
      mechanism: 'general_corrosion',
      morphology: 'volumetric',
      crack_location: 'od_surface',
      wall_loss_pattern: 'general',
      coating_condition: 'failed',
      cp_status: 'inadequate',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded'
    },
    ground_truth: ['general_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 1.7, scale: 6.0, mechanism: 'general_corrosion' },
    critical_note: 'External corrosion on buried valve body with coating failure.'
  },

  // B39: Pipeline — wrinkle bend fatigue
  {
    id: 'BLIND_39_WRINKLE_BEND',
    asset: 'vintage pipeline wrinkle bend',
    domain: 'fixed',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: false,
    weak_data: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'API 5L Gr.B',
      tnom: 0.312,
      tmm: 0.300,
      visual: 'Wrinkle bend with surface crack at wrinkle peak',
      mt: 'Axial crack 1.5 in at wrinkle peak',
      mechanism: 'mechanical_fatigue',
      crack_orientation: 'axial',
      morphology: 'transgranular',
      crack_location: 'od_surface',
      wall_loss_pattern: 'none',
      coating_condition: 'degraded',
      cp_status: 'adequate',
      weld_proximity: 'away_from_weld',
      surface_condition: 'clean'
    },
    ground_truth: ['mechanical_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.5, scale: 4.0, mechanism: 'mechanical_fatigue' },
    critical_note: 'Fatigue at vintage wrinkle bend stress concentration.'
  },

  // B40: Pipeline casing — annular corrosion
  {
    id: 'BLIND_40_CASING_ANNULAR',
    asset: 'pipeline casing at road crossing',
    domain: 'fixed',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: false,
    weak_data: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'API 5L X42',
      tnom: 0.375,
      tmm: 0.230,
      visual: 'Carrier pipe external corrosion where casing spacer failed',
      ut: 'Thinning to 0.23 in at spacer contact zone',
      mechanism: 'general_corrosion',
      morphology: 'volumetric',
      crack_location: 'od_surface',
      wall_loss_pattern: 'localized',
      coating_condition: 'failed',
      cp_status: 'shielded',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded'
    },
    ground_truth: ['general_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.0, scale: 2.5, mechanism: 'general_corrosion' },
    critical_note: 'Annular corrosion in pipeline casing with CP shielding.'
  },

  // ══════════════════════════════════════════════════════════════════
  // DOMAIN 5: MARINE VESSEL (B41–B45)
  // ══════════════════════════════════════════════════════════════════

  // B41: Tanker cargo tank — coating breakdown + pitting
  {
    id: 'BLIND_41_TANKER_CARGO',
    asset: 'crude oil tanker cargo tank',
    domain: 'marine',
    equipment_type: 'pressure_vessel',
    high_risk: false,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'pressure_vessel',
      material: 'AH36',
      tnom: 0.625,
      tmm: 0.510,
      visual: 'Coating breakdown on deck head, heavy pitting and scale',
      ut: 'Deck head thinning to 0.51 in, web frames 0.59 in',
      mechanism: 'general_corrosion',
      morphology: 'volumetric',
      crack_location: 'id_surface',
      wall_loss_pattern: 'general',
      coating_condition: 'failed',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      structural_zone: 'deck'
    },
    ground_truth: ['general_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 1.8, scale: 4.0, mechanism: 'general_corrosion' },
    critical_note: 'Coating breakdown and general corrosion in tanker cargo tank.'
  },

  // B42: Bulk carrier hold frame — fatigue crack at bracket toe
  {
    id: 'BLIND_42_BULK_CARRIER_FATIGUE',
    asset: 'bulk carrier hold frame bracket',
    domain: 'marine',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'pressure_vessel',
      material: 'AH32',
      tnom: 0.500,
      tmm: 0.490,
      visual: 'Crack at bracket toe of hold frame, propagating into web',
      mt: 'Crack 6 in long at bracket-to-web connection',
      mechanism: 'mechanical_fatigue',
      crack_orientation: 'transverse',
      morphology: 'transgranular',
      crack_location: 'weld_toe',
      wall_loss_pattern: 'none',
      coating_condition: 'intact',
      cp_status: 'not_applicable',
      weld_proximity: 'at_weld',
      surface_condition: 'clean',
      structural_zone: 'side_shell'
    },
    ground_truth: ['mechanical_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.8, scale: 3.5, mechanism: 'mechanical_fatigue' },
    critical_note: 'Structural fatigue crack at hold frame bracket in bulk carrier.'
  },

  // B43: Container ship hatch coaming — fatigue + corrosion
  {
    id: 'BLIND_43_CONTAINER_HATCH',
    asset: 'container ship hatch coaming corner',
    domain: 'marine',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'pressure_vessel',
      material: 'DH36',
      tnom: 0.750,
      tmm: 0.680,
      visual: 'Crack at hatch coaming corner with rust staining, coating peeling',
      mt: 'Corner crack 4 in extending into deck plating',
      ut: 'Deck plating thinned to 0.68 in around crack',
      mechanism: 'mechanical_fatigue',
      crack_orientation: 'transverse',
      morphology: 'transgranular',
      crack_location: 'weld_toe',
      wall_loss_pattern: 'localized',
      coating_condition: 'failed',
      cp_status: 'not_applicable',
      weld_proximity: 'at_weld',
      surface_condition: 'corroded',
      structural_zone: 'deck'
    },
    ground_truth: ['mechanical_fatigue', 'general_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.5, scale: 3.0, mechanism: 'mechanical_fatigue' },
    critical_note: 'Hatch coaming corner fatigue crack with corrosion thinning.'
  },

  // B44: LNG carrier membrane tank — thermal stress cracking
  {
    id: 'BLIND_44_LNG_MEMBRANE',
    asset: 'LNG carrier membrane containment',
    domain: 'marine',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: false,
    weak_data: true,
    evidence: {
      domain: 'marine',
      equipment_type: 'pressure_vessel',
      material: '304L SS',
      tnom: 0.047,
      tmm: 0.045,
      visual: 'Linear indication at membrane weld in corner area',
      pt: 'Confirmed crack at membrane corner weld, 2 in long',
      mechanism: 'thermal_fatigue',
      crack_orientation: 'transverse',
      morphology: 'transgranular',
      crack_location: 'weld_toe',
      wall_loss_pattern: 'none',
      coating_condition: 'intact',
      cp_status: 'not_applicable',
      weld_proximity: 'at_weld',
      surface_condition: 'clean',
      structural_zone: 'bottom'
    },
    ground_truth: ['thermal_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.8, scale: 4.0, mechanism: 'thermal_fatigue' },
    critical_note: 'Thermal cycling crack at LNG membrane corner. Cryogenic service.'
  },

  // B45: Ship rudder — cavitation erosion
  {
    id: 'BLIND_45_RUDDER_CAVITATION',
    asset: 'ship rudder blade',
    domain: 'marine',
    equipment_type: 'pressure_vessel',
    high_risk: false,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'pressure_vessel',
      material: 'A131 Gr.A',
      tnom: 0.500,
      tmm: 0.370,
      visual: 'Cavitation damage on rudder blade trailing edge, rough pitted surface',
      ut: 'Material loss to 0.37 in at trailing edge',
      mechanism: 'cavitation',
      morphology: 'volumetric',
      crack_location: 'od_surface',
      wall_loss_pattern: 'localized',
      coating_condition: 'failed',
      cp_status: 'marginal',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      structural_zone: 'stern'
    },
    ground_truth: ['cavitation'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.0, scale: 4.0, mechanism: 'cavitation' },
    critical_note: 'Cavitation erosion on rudder blade trailing edge.'
  },

  // ══════════════════════════════════════════════════════════════════
  // DOMAIN 6: FLOATING / PRODUCTION / POWER GEN (B46–B50)
  // ══════════════════════════════════════════════════════════════════

  // B46: FPSO process piping — CO2 corrosion + sand erosion
  {
    id: 'BLIND_46_FPSO_PROCESS_CO2',
    asset: 'FPSO topsides production piping',
    domain: 'floating',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'floating',
      equipment_type: 'piping',
      material: 'API 5L X52',
      tnom: 0.375,
      tmm: 0.250,
      visual: 'Internal thinning at elbow, sand accumulation',
      ut: 'Min wall 0.25 in at elbow intrados',
      mechanism: 'CO2_corrosion',
      morphology: 'general_thinning',
      crack_location: 'id_surface',
      wall_loss_pattern: 'localized',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      service_fluid: 'wet production fluid with CO2 and sand',
      platform_type: 'fpso'
    },
    ground_truth: ['CO2_corrosion', 'erosion_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.3, scale: 2.0, mechanism: 'CO2_corrosion' },
    critical_note: 'CO2 corrosion plus sand erosion in FPSO production piping.'
  },

  // B47: Semisubmersible column — fatigue at ring stiffener
  {
    id: 'BLIND_47_SEMI_COLUMN_FATIGUE',
    asset: 'semisubmersible column ring stiffener',
    domain: 'floating',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'floating',
      equipment_type: 'pressure_vessel',
      material: 'DH36',
      tnom: 1.500,
      tmm: 1.480,
      visual: 'Crack at ring stiffener-to-shell weld in splash zone',
      mt: 'Circumferential crack 8 in at stiffener weld toe',
      mechanism: 'mechanical_fatigue',
      crack_orientation: 'circumferential',
      morphology: 'transgranular',
      crack_location: 'weld_toe',
      wall_loss_pattern: 'none',
      coating_condition: 'damaged',
      cp_status: 'adequate',
      weld_proximity: 'at_weld',
      surface_condition: 'clean',
      platform_type: 'semi_submersible'
    },
    ground_truth: ['mechanical_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.8, scale: 4.0, mechanism: 'mechanical_fatigue' },
    critical_note: 'Wave-induced fatigue at semisubmersible column ring stiffener.'
  },

  // B48: TLP tendon — corrosion-fatigue interaction
  {
    id: 'BLIND_48_TLP_TENDON',
    asset: 'TLP tendon connector',
    domain: 'floating',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'floating',
      equipment_type: 'piping',
      material: 'API 5L X80',
      tnom: 1.250,
      tmm: 1.200,
      visual: 'Pitting at connector thread root with potential fatigue initiation',
      mt: 'Crack-like indication at thread root 0.5 in',
      mechanism: 'mechanical_fatigue',
      crack_orientation: 'circumferential',
      morphology: 'transgranular',
      crack_location: 'base_metal',
      wall_loss_pattern: 'pitting',
      coating_condition: 'damaged',
      cp_status: 'adequate',
      weld_proximity: 'away_from_weld',
      surface_condition: 'corroded',
      platform_type: 'tlp'
    },
    ground_truth: ['mechanical_fatigue', 'general_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.5, scale: 3.5, mechanism: 'mechanical_fatigue' },
    critical_note: 'Corrosion-fatigue at TLP tendon connector thread root.'
  },

  // B49: Gas turbine exhaust duct — creep + thermal fatigue
  {
    id: 'BLIND_49_GT_EXHAUST_CREEP',
    asset: 'gas turbine exhaust transition duct',
    domain: 'power_generation',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'A387 Gr.22',
      tnom: 0.375,
      tmm: 0.360,
      visual: 'Distortion and cracking at expansion joint-to-duct weld',
      mt: 'Multiple cracks in HAZ at expansion joint, max 3 in',
      mechanism: 'creep',
      crack_orientation: 'circumferential',
      morphology: 'intergranular',
      crack_location: 'HAZ',
      wall_loss_pattern: 'none',
      coating_condition: 'absent',
      cp_status: 'not_applicable',
      weld_proximity: 'at_weld',
      surface_condition: 'corroded',
      service_fluid: 'exhaust gas at 1100F'
    },
    ground_truth: ['creep', 'thermal_fatigue'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.0, scale: 2.5, mechanism: 'creep' },
    critical_note: 'Creep and thermal fatigue at gas turbine exhaust expansion joint.'
  },

  // B50: Condenser waterbox — galvanic + MIC in seawater cooling
  {
    id: 'BLIND_50_CONDENSER_GALVANIC',
    asset: 'power plant condenser waterbox',
    domain: 'power_generation',
    equipment_type: 'pressure_vessel',
    high_risk: false,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'A285 Gr.C',
      tnom: 0.500,
      tmm: 0.360,
      visual: 'Accelerated corrosion at CS-to-CuNi tubesheet interface, biofilm',
      ut: 'Thinning to 0.36 in near tubesheet, 0.47 in remote',
      mechanism: 'galvanic_corrosion',
      morphology: 'volumetric',
      crack_location: 'base_metal',
      wall_loss_pattern: 'localized',
      coating_condition: 'failed',
      cp_status: 'not_applicable',
      weld_proximity: 'near_weld',
      surface_condition: 'fouled',
      service_fluid: 'seawater cooling with biological growth'
    },
    ground_truth: ['galvanic_corrosion', 'MIC'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.0, scale: 3.0, mechanism: 'galvanic_corrosion' },
    critical_note: 'Galvanic attack at CS/CuNi interface plus MIC from seawater biofouling.'
  }

];

// ═══════════════════════════════════════════════════════════════════════
// INFRASTRUCTURE — copied from golden-suite for standalone execution
// ═══════════════════════════════════════════════════════════════════════

function callEngine(path, payload, callback) {
  var parsed = url.parse(BASE_URL);
  var body = JSON.stringify(payload);
  var opts = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: path,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    timeout: 30000
  };

  var transport = parsed.protocol === 'https:' ? https : http;
  var req = transport.request(opts, function(res) {
    var chunks = [];
    res.on('data', function(c) { chunks.push(c); });
    res.on('end', function() {
      try {
        var data = JSON.parse(Buffer.concat(chunks).toString());
        callback(null, data);
      } catch (e) {
        callback(new Error('Parse error: ' + e.message), null);
      }
    });
  });
  req.on('error', function(e) { callback(e, null); });
  req.on('timeout', function() { req.destroy(); callback(new Error('Timeout'), null); });
  req.write(body);
  req.end();
}

// ── ASSET CONTEXT ENRICHMENT ────────────────────────────────────────

function inferMaterialFamily(mat) {
  var m = mat.toLowerCase();
  if (m.indexOf('a106') !== -1 || m.indexOf('a285') !== -1 || m.indexOf('a234') !== -1 ||
      m.indexOf('a516') !== -1 || m.indexOf('carbon') !== -1 || m.indexOf('api 5l') !== -1 ||
      m.indexOf('astm a') !== -1 || m.indexOf('a333') !== -1 || m.indexOf('a131') !== -1 ||
      m.indexOf('ah32') !== -1 || m.indexOf('ah36') !== -1 || m.indexOf('dh36') !== -1 ||
      m.indexOf('a216') !== -1 || m.indexOf('a179') !== -1) return 'carbon_steel';
  if (m.indexOf('austenitic') !== -1 || m.indexOf('304') !== -1 || m.indexOf('316') !== -1) return 'austenitic_stainless';
  if (m.indexOf('duplex') !== -1 || m.indexOf('2205') !== -1) return 'duplex_stainless';
  if (m.indexOf('cr-mo') !== -1 || m.indexOf('p11') !== -1 || m.indexOf('p22') !== -1 ||
      m.indexOf('a387') !== -1) return 'low_alloy_steel';
  return null;
}

function isCarbonSteel(mat) { return inferMaterialFamily(mat) === 'carbon_steel'; }

function hasWaterPhase(ev) {
  var sf = (ev.service_fluid || '').toLowerCase();
  var ac = (ev.amine_concentration || '').toLowerCase();
  return sf.indexOf('water') !== -1 || sf.indexOf('steam') !== -1 || sf.indexOf('amine') !== -1 ||
         sf.indexOf('aqueous') !== -1 || sf.indexOf('wet') !== -1 || sf.indexOf('condensat') !== -1 ||
         sf.indexOf('seawater') !== -1 || ac.length > 0;
}

function hasH2S(ev) {
  var sf = (ev.service_fluid || '').toLowerCase();
  var ac = (ev.amine_concentration || '').toLowerCase();
  return sf.indexOf('h2s') !== -1 || sf.indexOf('sour') !== -1 || sf.indexOf('amine') !== -1 || ac.length > 0;
}

// ── PIPELINE ────────────────────────────────────────────────────────

function runPipeline(tc, callback) {
  var ddeDomain = tc.domain;
  if (ddeDomain === 'power_generation' || ddeDomain === 'chemical_plant' || ddeDomain === 'refinery') {
    ddeDomain = 'fixed';
  }

  var orchPayload = {
    action: 'assess',
    asset_context: {
      domain: ddeDomain,
      equipment_type: tc.equipment_type,
      asset_id: tc.id,
      material: tc.evidence.material || '',
      tnom: tc.evidence.tnom,
      tmm: tc.evidence.tmm,
      material_family: inferMaterialFamily(tc.evidence.material || ''),
      carbon_steel: isCarbonSteel(tc.evidence.material || ''),
      water_phase_present: hasWaterPhase(tc.evidence),
      steam_or_wet: hasWaterPhase(tc.evidence),
      service_contains_h2s: hasH2S(tc.evidence),
      hardness_above_22hrc: (tc.evidence.hardness_haz || 0) >= 250
    },
    observed_evidence: tc.evidence,
    ffs_data: {}
  };

  callEngine('/api/comprehensive-assessment', orchPayload, function(err1, orchResp) {
    var orchRaw = null;
    var orchOk = false;
    var disposition = 'UNKNOWN';
    var topMechanism = 'UNKNOWN';
    var recommendations = [];

    if (!err1 && orchResp) {
      orchRaw = orchResp;
      orchOk = true;
      if (orchResp.interpreted) {
        disposition = orchResp.interpreted.overall_disposition || 'UNKNOWN';
        topMechanism = orchResp.interpreted.top_mechanism || 'UNKNOWN';
        if (orchResp.interpreted.primary_recommendation) {
          recommendations.push(orchResp.interpreted.primary_recommendation);
        }
      }
      if (orchResp.deterministic && orchResp.deterministic.disposition) {
        if (orchResp.deterministic.disposition.recommendations) {
          recommendations = recommendations.concat(orchResp.deterministic.disposition.recommendations);
        }
      }
    }

    var survPayload = {
      action: 'run_survival',
      model_type: tc.survival.model_type,
      model_params: { shape: tc.survival.shape, scale: tc.survival.scale },
      time_horizons_years: [1, 3, 5, 10, 20],
      mechanism: tc.survival.mechanism
    };

    callEngine('/api/uncertainty-reliability-core', survPayload, function(err2, survResp) {
      var survivalOk = false;
      var timeHorizons = null;
      var failProbs = {};

      if (!err2 && survResp && survResp.data) {
        survivalOk = true;
        var sd = survResp.data.deterministic || survResp.data;
        if (sd.time_horizons) {
          timeHorizons = sd.time_horizons;
          if (sd.time_horizons['1y']) failProbs['1yr'] = sd.time_horizons['1y'].failure_probability;
          if (sd.time_horizons['3y']) failProbs['3yr'] = sd.time_horizons['3y'].failure_probability;
          if (sd.time_horizons['5y']) failProbs['5yr'] = sd.time_horizons['5y'].failure_probability;
        }
      }

      var classPayload = {
        action: 'run_classification',
        survival_results: timeHorizons ? { time_horizons: timeHorizons } : {},
        conformal_confidence: 0.80,
        mc_p05_remaining: null,
        mechanism: tc.survival.mechanism
      };

      callEngine('/api/uncertainty-reliability-core', classPayload, function(err3, classResp) {
        var classOk = false;
        var reliabilityClass = 'UNKNOWN';
        var authorityLock = false;

        if (!err3 && classResp && classResp.data) {
          classOk = true;
          reliabilityClass = classResp.data.reliability_class || 'UNKNOWN';
          authorityLock = classResp.data.authority_lock_required || false;
        }

        callback({
          orch_ok: orchOk,
          orch_error: err1 ? err1.message : null,
          disposition: disposition,
          top_mechanism: topMechanism,
          recommendations: recommendations,
          orch_raw: orchRaw,
          survival_ok: survivalOk,
          survival_error: err2 ? err2.message : null,
          fail_probs: failProbs,
          time_horizons: timeHorizons,
          class_ok: classOk,
          class_error: err3 ? err3.message : null,
          reliability_class: reliabilityClass,
          authority_lock: authorityLock
        });
      });
    });
  });
}

// ── SCORING ENGINE ──────────────────────────────────────────────────

function scoreCase(tc, result) {
  var scores = {};
  var deductions = [];
  var autoFail = false;
  var autoFailReasons = [];

  function responseContains(keyword) {
    var raw = JSON.stringify(result.orch_raw || '').toLowerCase();
    return raw.indexOf(keyword.toLowerCase()) !== -1;
  }

  function recsContain(keyword) {
    var recsStr = (result.recommendations || []).join(' ').toLowerCase();
    var dispStr = JSON.stringify(result.orch_raw || '').toLowerCase();
    return recsStr.indexOf(keyword.toLowerCase()) !== -1 || dispStr.indexOf(keyword.toLowerCase()) !== -1;
  }

  // 1. MECHANISM IDENTIFICATION (0-20)
  var mechScore = 0;
  var mechFound = 0;
  var mechTotal = tc.ground_truth.length;
  var mechMissed = [];

  for (var g = 0; g < tc.ground_truth.length; g++) {
    var mech = tc.ground_truth[g];
    var variants = getMechanismVariants(mech);
    var found = false;
    for (var v = 0; v < variants.length; v++) {
      if (responseContains(variants[v])) { found = true; break; }
    }
    if (found) { mechFound++; }
    else { mechMissed.push(mech); }
  }
  mechScore = Math.round((mechFound / mechTotal) * 20);
  if (mechMissed.length > 0) {
    for (var md = 0; md < mechMissed.length; md++) {
      deductions.push('Missed mechanism: ' + mechMissed[md] + ' (-20)');
    }
  }
  scores['1_mechanism_id'] = mechScore;

  // 2. MULTI-MECHANISM RETENTION (0-15)
  if (tc.ground_truth.length >= 2) {
    scores['2_multi_mechanism'] = mechFound >= 2 ? 15 : (mechFound === 1 ? 8 : 0);
  } else {
    scores['2_multi_mechanism'] = 15;
  }

  // 3. TIMELINE / 4D REASONING (0-15)
  scores['3_timeline_4d'] = (result.survival_ok && result.time_horizons) ? 15 : 0;

  // 4. EVIDENCE WEIGHTING (0-15)
  var evidenceScore = 0;
  if (result.orch_ok) evidenceScore += 5;
  if (result.orch_raw && result.orch_raw.deterministic && result.orch_raw.deterministic.stages) {
    var stages = result.orch_raw.deterministic.stages;
    if (stages.dde && stages.dde.success) evidenceScore += 5;
    if (stages.ffs && stages.ffs.success) evidenceScore += 3;
    if (stages.cfi && stages.cfi.success) evidenceScore += 2;
  } else {
    if (result.orch_ok) evidenceScore += 10;
  }
  scores['4_evidence_weight'] = evidenceScore;

  // 5. UNCERTAINTY HANDLING (0-10)
  var uncScore = 0;
  if (result.orch_raw && (result.orch_raw.deterministic || result.orch_raw.proof_trace)) {
    uncScore += 5;
  }
  if (result.survival_ok && result.fail_probs['1yr'] !== undefined) {
    uncScore += 5;
  }
  scores['5_uncertainty'] = uncScore;

  // 6. DECISION QUALITY (0-10)
  var classMatch = checkClassMatch(result.reliability_class, tc.expected_class);
  if (classMatch === 'exact') scores['6_decision_quality'] = 10;
  else if (classMatch === 'adjacent') scores['6_decision_quality'] = 6;
  else { scores['6_decision_quality'] = 0; autoFail = true; autoFailReasons.push('Class mismatch: ' + result.reliability_class + ' vs expected ' + tc.expected_class); }

  // 7. AUTHORITY LOCK (0-10)
  scores['7_authority_lock'] = (result.authority_lock === tc.expected_lock) ? 10 : 0;

  // 8. ACTIONS (0-5)
  scores['8_actions'] = (result.recommendations && result.recommendations.length > 0) ? 5 : (result.orch_ok ? 3 : 0);

  var finalScore = 0;
  var keys = Object.keys(scores);
  for (var k = 0; k < keys.length; k++) finalScore += scores[keys[k]];

  return {
    case_id: tc.id,
    domain: tc.domain,
    final_score: finalScore,
    scores: scores,
    mechanisms_found: mechFound,
    mechanisms_total: mechTotal,
    mechanisms_missed: mechMissed,
    reliability_class: result.reliability_class,
    expected_class: tc.expected_class,
    authority_lock: result.authority_lock,
    expected_lock: tc.expected_lock,
    disposition: result.disposition,
    auto_fail: autoFail,
    auto_fail_reasons: autoFailReasons,
    deductions: deductions
  };
}

// ── MECHANISM VARIANTS MAP ──────────────────────────────────────────

function getMechanismVariants(mechanism) {
  var map = {
    'general_corrosion': ['general_corrosion', 'general corrosion', 'uniform corrosion', 'wall thinning', 'corrosion', 'thinning'],
    'mechanical_fatigue': ['mechanical_fatigue', 'fatigue', 'fatigue_crack', 'cyclic', 'vibration', 'HCF', 'LCF'],
    'thermal_fatigue': ['thermal_fatigue', 'thermal fatigue', 'thermal cycling', 'thermal stress', 'startup'],
    'chloride_scc': ['chloride_scc', 'chloride scc', 'chloride stress', 'cl-scc', 'chloride', 'austenitic_scc'],
    'SSC': ['SSC', 'ssc', 'sulfide stress', 'sulfide_stress_cracking', 'h2s cracking', 'sour'],
    'HIC': ['HIC', 'hic', 'hydrogen induced', 'hydrogen_induced_cracking', 'blistering', 'blister'],
    'SOHIC': ['SOHIC', 'sohic', 'stress oriented', 'stress_oriented_hic', 'stepwise'],
    'HTHA': ['HTHA', 'htha', 'high temperature hydrogen', 'hydrogen attack', 'nelson'],
    'creep': ['creep', 'creep damage', 'stress rupture', 'bulging', 'void coalescence'],
    'MIC': ['MIC', 'mic', 'microbiologically', 'microbial', 'bacterial', 'anaerobic', 'biofilm', 'biofouling', 'SRB', 'biocorrosion', 'microbio'],
    'CUI': ['CUI', 'cui', 'corrosion under insulation', 'under insulation'],
    'erosion_corrosion': ['erosion_corrosion', 'erosion', 'impingement', 'velocity', 'sand', 'scallop'],
    'cavitation': ['cavitation', 'cavitation damage', 'vapor collapse', 'bubble collapse'],
    'galvanic_corrosion': ['galvanic_corrosion', 'galvanic', 'dissimilar metal', 'bimetallic'],
    'hydrogen_embrittlement': ['hydrogen_embrittlement', 'hydrogen embrittlement', 'HE', 'hydrogen damage', 'disbond'],
    'caustic_cracking': ['caustic_cracking', 'caustic cracking', 'caustic scc', 'caustic', 'gouging'],
    'amine_cracking': ['amine_cracking', 'amine cracking', 'amine stress corrosion', 'amine scc', 'amine', 'dea', 'mea', 'mdea', 'amine unit', 'amine service'],
    'sulfidation': ['sulfidation', 'sulfidic corrosion', 'sulfidic', 'sulfide corrosion', 'high temperature sulfidation'],
    'naphthenic_acid_corrosion': ['naphthenic_acid_corrosion', 'naphthenic', 'naphthenic acid', 'tan', 'total acid number'],
    'polythionic_acid_scc': ['polythionic_acid_scc', 'polythionic', 'pta scc', 'sensitized', 'shutdown cracking'],
    'CO2_corrosion': ['CO2_corrosion', 'co2', 'sweet corrosion', 'carbon dioxide', 'mesa'],
    'oxygen_pitting': ['oxygen_pitting', 'oxygen pitting', 'pitting', 'dissolved oxygen', 'tank_top_pitting'],
    'atmospheric_corrosion': ['atmospheric_corrosion', 'atmospheric', 'weathering', 'external corrosion'],
    'under_deposit_corrosion': ['under_deposit_corrosion', 'under deposit', 'deposit', 'fouling', 'scale'],
    'chemical_attack': ['chemical_attack', 'chemical attack', 'acid corrosion', 'acid attack', 'hf'],
    'weld_lack_of_fusion': ['weld_lack_of_fusion', 'lack of fusion', 'LOF', 'lof', 'fusion defect'],
    'flow_accelerated_corrosion': ['flow_accelerated_corrosion', 'flow accelerated corrosion', 'fac', 'flow-accelerated', 'erosion_corrosion', 'wet steam'],
    'reheat_cracking': ['reheat_cracking', 'reheat cracking', 'reheat', 'stress relief', 'pwht']
  };
  return map[mechanism] || [mechanism.replace(/_/g, ' '), mechanism];
}

// ── CLASS MATCH ─────────────────────────────────────────────────────

function checkClassMatch(actual, expected) {
  if (actual === expected) return 'exact';
  var aliasMap = { 'ROUTINE': 'ROUTINE_MONITORING', 'CRITICAL': 'IMMEDIATE_ACTION', 'OPERATING_REVIEW': 'INCREASE_INSPECTION' };
  var normActual = aliasMap[actual] || actual;
  var normExpected = aliasMap[expected] || expected;
  if (normActual === normExpected) return 'exact';

  var classOrder = ['LOW_RISK', 'ROUTINE_MONITORING', 'MONITOR', 'INCREASE_INSPECTION', 'OPERATING_REVIEW', 'ENGINEERING_REVIEW', 'REPAIR_REPLACE', 'IMMEDIATE_ACTION', 'HOLD_FOR_INPUT'];
  var actualIdx = classOrder.indexOf(actual);
  var expectedIdx = classOrder.indexOf(expected);

  if ((expected === 'IMMEDIATE_ACTION' || expected === 'CRITICAL') && actual === 'REPAIR_REPLACE') return 'adjacent';
  if (actual === 'IMMEDIATE_ACTION' && expected === 'REPAIR_REPLACE') return 'adjacent';
  if ((expected === 'ROUTINE_MONITORING' || expected === 'ROUTINE') && (actual === 'MONITOR' || actual === 'INCREASE_INSPECTION')) return 'adjacent';
  if ((actual === 'ROUTINE_MONITORING' || actual === 'ROUTINE') && (expected === 'MONITOR' || expected === 'INCREASE_INSPECTION')) return 'adjacent';
  if (expected === 'OPERATING_REVIEW' && (actual === 'INCREASE_INSPECTION' || actual === 'ENGINEERING_REVIEW')) return 'adjacent';
  if (actual === 'OPERATING_REVIEW' && (expected === 'INCREASE_INSPECTION' || expected === 'ENGINEERING_REVIEW')) return 'adjacent';
  if (expected === 'ENGINEERING_REVIEW' && actual === 'REPAIR_REPLACE') return 'adjacent';
  if (actual === 'ENGINEERING_REVIEW' && expected === 'REPAIR_REPLACE') return 'adjacent';

  if (actualIdx !== -1 && expectedIdx !== -1) {
    if (actualIdx > expectedIdx && (actualIdx - expectedIdx) <= 2) return 'adjacent';
    if (Math.abs(actualIdx - expectedIdx) <= 1) return 'adjacent';
  }
  return 'wrong';
}

// ── RUNNER ───────────────────────────────────────────────────────────

function runAll(cases, idx, results, finalCb) {
  if (idx >= cases.length) return finalCb(results);
  var tc = cases[idx];
  console.log('\n[' + (idx + 1) + '/' + cases.length + '] ══════════════════════════════════════════════');
  console.log('  Case: ' + tc.id);
  console.log('  Domain: ' + tc.domain);
  console.log('  Asset: ' + tc.asset);
  console.log('  Ground Truth: ' + tc.ground_truth.join(', '));
  console.log('  Expected: class=' + tc.expected_class + ' lock=' + tc.expected_lock);
  console.log('  Running pipeline...');

  runPipeline(tc, function(pipeResult) {
    var scored = scoreCase(tc, pipeResult);
    results.push(scored);
    var icon = scored.auto_fail ? 'AUTO-FAIL' : (scored.final_score >= 70 ? 'PASS' : 'FAIL');
    console.log('  [' + icon + '] Score: ' + scored.final_score + '/100');
    console.log('    Mechanism ID: ' + scored.scores['1_mechanism_id'] + '/20 (found ' + scored.mechanisms_found + '/' + scored.mechanisms_total + ')');
    console.log('    Multi-Mech:   ' + scored.scores['2_multi_mechanism'] + '/15');
    console.log('    Timeline 4D:  ' + scored.scores['3_timeline_4d'] + '/15');
    console.log('    Evidence Wt:  ' + scored.scores['4_evidence_weight'] + '/15');
    console.log('    Uncertainty:  ' + scored.scores['5_uncertainty'] + '/10');
    console.log('    Decision:     ' + scored.scores['6_decision_quality'] + '/10');
    console.log('    Auth Lock:    ' + scored.scores['7_authority_lock'] + '/10');
    console.log('    Actions:      ' + scored.scores['8_actions'] + '/5');
    console.log('    Class: ' + scored.reliability_class + ' (expected ' + scored.expected_class + ')');
    console.log('    Lock: ' + scored.authority_lock + ' (expected ' + scored.expected_lock + ')');
    console.log('    Disposition: ' + scored.disposition);
    if (scored.mechanisms_missed.length > 0) console.log('    MISSED: ' + scored.mechanisms_missed.join(', '));
    if (scored.auto_fail) console.log('    AUTO-FAIL REASONS: ' + scored.auto_fail_reasons.join('; '));
    if (scored.deductions.length > 0) console.log('    DEDUCTIONS: ' + scored.deductions.join('; '));
    runAll(cases, idx + 1, results, finalCb);
  });
}

// ── SCORECARD ───────────────────────────────────────────────────────

function printScorecard(results) {
  console.log('\n\n════════════════════════════════════════════════════════════════');
  console.log('FORGED 4D NDT — BLIND VALIDATION SCORECARD');
  console.log('50 Unseen Cases — Cross-Domain Consistency Test');
  console.log('════════════════════════════════════════════════════════════════\n');

  var totalScore = 0;
  var failures = [];
  var autoFails = [];
  var topFailureModes = {};

  // Domain tracking
  var domainScores = {};
  var domainCounts = {};

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    totalScore += r.final_score;
    if (r.final_score < 70) failures.push(r.case_id + ' (' + r.final_score + ')');
    if (r.auto_fail) autoFails.push(r.case_id + ': ' + r.auto_fail_reasons.join('; '));
    for (var mm = 0; mm < r.mechanisms_missed.length; mm++) {
      var missed = r.mechanisms_missed[mm];
      topFailureModes[missed] = (topFailureModes[missed] || 0) + 1;
    }
    // Track by domain
    var dom = r.domain;
    domainScores[dom] = (domainScores[dom] || 0) + r.final_score;
    domainCounts[dom] = (domainCounts[dom] || 0) + 1;
  }

  var avgScore = Math.round((totalScore / results.length) * 10) / 10;
  var maxTotal = results.length * 100;

  var rating = 'BELOW_THRESHOLD';
  if (avgScore >= 90) rating = 'TIER_1_VALIDATED';
  else if (avgScore >= 80) rating = 'TIER_2_STRONG';
  else if (avgScore >= 70) rating = 'TIER_3_FUNCTIONAL';
  else if (avgScore >= 60) rating = 'TIER_4_DEVELOPING';

  console.log('── AGGREGATE RESULTS ──────────────────────────────────────────\n');
  console.log('  Total Score:        ' + totalScore + ' / ' + maxTotal);
  console.log('  Average Score:      ' + avgScore + ' / 100');
  console.log('  Cases Passed (70+): ' + (results.length - failures.length) + ' / ' + results.length);
  console.log('  Auto-Fails:         ' + autoFails.length);
  console.log('');

  // Per-criteria averages
  var criteriaNames = ['1_mechanism_id', '2_multi_mechanism', '3_timeline_4d', '4_evidence_weight', '5_uncertainty', '6_decision_quality', '7_authority_lock', '8_actions'];
  var criteriaMax = [20, 15, 15, 15, 10, 10, 10, 5];
  var criteriaLabels = ['Mechanism Identification', 'Multi-Mechanism Retention', 'Timeline (4D Reasoning)', 'Evidence Weighting', 'Uncertainty Handling', 'Decision Quality', 'Authority Lock Correctness', 'Action Recommendations'];

  console.log('── CRITERIA AVERAGES ──────────────────────────────────────────\n');
  for (var c = 0; c < criteriaNames.length; c++) {
    var critSum = 0;
    for (var j = 0; j < results.length; j++) critSum += (results[j].scores[criteriaNames[c]] || 0);
    var critAvg = Math.round((critSum / results.length) * 10) / 10;
    var critPct = Math.round((critAvg / criteriaMax[c]) * 100);
    console.log('  ' + criteriaLabels[c] + ': ' + critAvg + '/' + criteriaMax[c] + ' (' + critPct + '%)');
  }

  // Domain breakdown
  console.log('\n── DOMAIN CONSISTENCY ─────────────────────────────────────────\n');
  var domKeys = Object.keys(domainScores).sort();
  for (var d = 0; d < domKeys.length; d++) {
    var dk = domKeys[d];
    var domAvg = Math.round((domainScores[dk] / domainCounts[dk]) * 10) / 10;
    var domRating = domAvg >= 90 ? 'STRONG' : (domAvg >= 80 ? 'GOOD' : (domAvg >= 70 ? 'ADEQUATE' : 'WEAK'));
    console.log('  ' + dk + ': ' + domAvg + '/100 avg (' + domainCounts[dk] + ' cases) [' + domRating + ']');
  }

  // Failures
  if (failures.length > 0) {
    console.log('\n── FAILURES (<70) ────────────────────────────────────────────\n');
    for (var f = 0; f < failures.length; f++) console.log('  ' + failures[f]);
  }

  // Missed mechanisms
  var missedKeys = Object.keys(topFailureModes);
  if (missedKeys.length > 0) {
    console.log('\n── MOST MISSED MECHANISMS ────────────────────────────────────\n');
    missedKeys.sort(function(a, b) { return topFailureModes[b] - topFailureModes[a]; });
    for (var mk = 0; mk < missedKeys.length; mk++) {
      console.log('  ' + missedKeys[mk] + ': missed ' + topFailureModes[missedKeys[mk]] + 'x');
    }
  }

  // Per-case summary
  console.log('\n── PER-CASE SUMMARY ──────────────────────────────────────────\n');
  for (var s = 0; s < results.length; s++) {
    var rs = results[s];
    var sIcon = rs.auto_fail ? 'FAIL*' : (rs.final_score >= 90 ? 'ELITE' : (rs.final_score >= 80 ? 'PASS+' : (rs.final_score >= 70 ? 'PASS' : 'FAIL')));
    console.log('  [' + sIcon + '] ' + rs.case_id);
    console.log('         domain=' + rs.domain + ' score=' + rs.final_score + ' class=' + rs.reliability_class + ' lock=' + rs.authority_lock + ' mech=' + rs.mechanisms_found + '/' + rs.mechanisms_total);
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  FINAL RATING: ' + rating);
  console.log('  Average: ' + avgScore + '/100 | Total: ' + totalScore + '/' + maxTotal);
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log('── JSON OUTPUT ───────────────────────────────────────────────\n');
  var output = {
    total_score: totalScore,
    max_score: maxTotal,
    average_score: avgScore,
    failures: failures,
    auto_fails: autoFails,
    top_failure_modes: topFailureModes,
    final_rating: rating,
    cases_passed: results.length - failures.length,
    cases_total: results.length,
    domain_averages: {}
  };
  for (var da = 0; da < domKeys.length; da++) {
    output.domain_averages[domKeys[da]] = Math.round((domainScores[domKeys[da]] / domainCounts[domKeys[da]]) * 10) / 10;
  }
  console.log(JSON.stringify(output, null, 2));
}

// ── MAIN ────────────────────────────────────────────────────────────

console.log('════════════════════════════════════════════════════════════════');
console.log('FORGED 4D NDT — BLIND VALIDATION SUITE');
console.log('50 Unseen Cases — Cross-Domain Consistency Test');
console.log('Target: ' + BASE_URL);
console.log('Pipeline: orchestrator -> survival -> classification');
console.log('Scoring: 8 criteria, 100 pts/case');
console.log('════════════════════════════════════════════════════════════════');

runAll(TEST_CASES, 0, [], function(results) {
  printScorecard(results);
});
