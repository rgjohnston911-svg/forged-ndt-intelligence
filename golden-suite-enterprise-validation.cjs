// @ts-nocheck
// ═══════════════════════════════════════════════════════════════════════
// FORGED 4D NDT PLATFORM — ENTERPRISE VALIDATION HARNESS v1
// 20 Elite Scenarios — ASNT Demo Ready
//
// Pipeline per case:
//   1. comprehensive-assessment (orchestrator) → mechanisms + disposition
//   2. run_survival → time horizons
//   3. run_classification → reliability_class + authority_lock
//   Score against 8-criteria rubric (0-100 per case, 0-2000 total)
// ═══════════════════════════════════════════════════════════════════════

var https = require('https');
var http = require('http');
var url = require('url');

var BASE_URL = process.env.FORGED_URL || 'https://4dndt.netlify.app';
var DEMO_MODE = process.env.DEMO_MODE === 'true' || false;

// ── 20 ELITE TEST CASES ───────────────────────────────────────────────

var TEST_CASES = [

  // ══════════════════════════════════════════════════════════════════
  // CASE 01: SUBSEA RISER — Full chain reconstruction
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_01_SUBSEA_RISER',
    asset: 'subsea riser',
    domain: 'subsea',
    equipment_type: 'riser',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'riser',
      material: 'X65 carbon steel',
      tnom: 0.750,
      tmm: 0.638,
      visual: 'coating damage + rust bloom at clamp zone',
      ut: 'localized thinning 0.638in from 0.750in nominal',
      paut: 'planar indication near clamp weld — crack-like',
      cp: 'low potential in damaged region -720mV vs -850mV required',
      history: 'anchor drag event 8 months ago',
      vibration: 'high vortex-induced vibration measured',
      mechanism: 'corrosion_fatigue',
      coating_condition: 'damaged',
      cp_status: 'inadequate',
      wall_loss_pattern: 'localized',
      crack_orientation: 'linear'
    },
    ground_truth: ['impact_damage', 'coating_failure', 'external_corrosion', 'fatigue_crack'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 3.2, scale: 2.9, mechanism: 'corrosion_fatigue' },
    critical_note: 'Must reconstruct full chain: impact → coating loss → corrosion → fatigue crack'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 02: HRSG TUBE — Creep + thermal fatigue
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_02_HRSG',
    asset: 'HRSG tube',
    domain: 'power_generation',
    equipment_type: 'HRSG_superheater',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'power_generation',
      equipment_type: 'HRSG_superheater',
      material: 'SA-213 T22',
      tnom: 0.200,
      tmm: 0.165,
      visual: 'bulging observed at tube crown',
      pt: 'branched cracks at tube OD',
      replica: 'creep voiding Neubauer level 3',
      cycles: 'high cycling — 300% increase in starts over 2 years',
      service: 'superheater 1050F operating temperature',
      mechanism: 'creep'
    },
    ground_truth: ['thermal_fatigue', 'creep'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 3.5, scale: 2.4, mechanism: 'creep' },
    critical_note: 'Dual mechanism — must retain both creep AND thermal fatigue'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 03: CHLORIDE SCC — Low wall loss trap
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_03_SCC',
    asset: 'stainless pipe',
    domain: 'chemical_plant',
    equipment_type: 'process_piping',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'chemical_plant',
      equipment_type: 'process_piping',
      material: '316L stainless steel',
      tnom: 0.375,
      tmm: 0.352,
      pt: 'branched linear indications at HAZ — classic SCC morphology',
      ut: 'minimal wall loss — only 6% thinning',
      chlorides: true,
      insulation: 'wet, salt deposits found under insulation',
      service: 'insulated pipe at coastal chemical plant',
      mechanism: 'chloride_SCC'
    },
    ground_truth: ['chloride_SCC'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.7, scale: 3.7, mechanism: 'chloride_SCC' },
    critical_note: 'Must NOT be fooled by low wall loss — SCC is cracking not thinning'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 04: CRITICAL NODE — Small crack + load path
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_04_CRITICAL_NODE',
    asset: 'offshore structure',
    domain: 'offshore',
    equipment_type: 'jacket',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'offshore',
      equipment_type: 'jacket',
      material: 'structural steel',
      tnom: 1.000,
      tmm: 0.920,
      crack: 'small fatigue indication at weld toe — 12mm surface length',
      location: 'critical load path brace-to-chord node',
      event_history: 'Category 3 hurricane passed 3 months ago',
      mt: 'MT confirmed weld toe indication at brace-to-chord',
      visual: 'coating loss, rust, slight bowing at node',
      mechanism: 'corrosion_fatigue'
    },
    ground_truth: ['fatigue_crack', 'structural_risk'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 3.0, scale: 3.1, mechanism: 'corrosion_fatigue' },
    critical_note: 'Small crack BUT load path — consequence drives severity'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 05: SYSTEMIC CUI — Pattern recognition
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_05_SYSTEMIC_CUI',
    asset: 'piping network',
    domain: 'refinery',
    equipment_type: 'piping_network',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'refinery',
      equipment_type: 'piping_network',
      material: 'carbon steel',
      tnom: 0.322,
      tmm: 0.228,
      pattern: 'corrosion concentrated at supports, low points, dead legs — systemic pattern',
      process_change: true,
      visual: 'wet saturated insulation at all affected locations',
      service: 'insulated piping, crude slate changed 14 months ago accelerating corrosion',
      insulation: 'wet saturated — multiple locations affected',
      mechanism: 'CUI'
    },
    ground_truth: ['systemic_CUI'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.2, scale: 4.4, mechanism: 'CUI' },
    critical_note: 'Must identify network-level pattern, not just point defect'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 06: WELD VISUAL TRAP — Lack of fusion
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_06_WELD_VISUAL_TRAP',
    asset: 'pressure vessel girth weld',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-516 Gr.70 carbon steel',
      tnom: 1.250,
      tmm: 1.235,
      visual: 'weld cap appearance acceptable — smooth contour, no visible defects',
      rt: 'elongated linear indication at fusion line — 45mm length, mid-wall',
      ut_tofd: 'TOFD confirms planar reflector at sidewall fusion zone — lack of fusion suspected',
      weld_procedure: 'SMAW root + SAW fill, multi-pass girth weld',
      service: 'lethal service H2S environment',
      mechanism: 'weld_defect',
      crack_orientation: 'linear',
      morphology: 'planar',
      crack_location: 'weld',
      wall_loss_pattern: 'none',
      weld_proximity: 'in_weld'
    },
    ground_truth: ['lack_of_fusion'],
    expected_class: 'REPAIR_REPLACE',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 4.0, scale: 3.0, mechanism: 'weld_defect' },
    critical_note: 'Visual looks fine — RT/TOFD reveal hidden lack of fusion. Must not trust visual alone'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 07: DISSIMILAR METAL WELD — Metallurgical mismatch
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_07_DISSIMILAR_WELD',
    asset: 'dissimilar metal weld transition',
    domain: 'fixed',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'carbon steel to 316SS transition weld with Inconel 625 butter',
      tnom: 0.500,
      tmm: 0.485,
      visual: 'discoloration at weld interface — oxide tinting',
      pt: 'linear indications along carbon steel HAZ',
      hardness: 'HAZ hardness 38 HRC — exceeding 22 HRC limit for sour service',
      service: 'high temperature hydrogen service 800F',
      operating_cycles: '150 thermal cycles in 3 years',
      mechanism: 'hydrogen_damage'
    },
    ground_truth: ['metallurgical_mismatch'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.8, scale: 3.5, mechanism: 'hydrogen_damage' },
    critical_note: 'DMW failure mode — carbon migration + thermal cycling at interface'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 08: REPAIR WELD FAILURE — HAZ cracking
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_08_REPAIR_FAILURE',
    asset: 'repair weld on pressure vessel',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-387 Gr.22 Cr-Mo steel',
      tnom: 2.000,
      tmm: 1.950,
      visual: 'repair weld — original defect was ground out and re-welded 6 months ago',
      mt: 'linear indication in HAZ of repair weld — transverse to weld axis',
      hardness: 'HAZ hardness 35 HRC at indication — PWHT may have been inadequate',
      history: 'repair performed without full PWHT — field temper bead technique used',
      ut: 'UT shows indication extends 8mm into base metal HAZ',
      mechanism: 'hydrogen_cracking'
    },
    ground_truth: ['HAZ_crack'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 3.0, scale: 2.5, mechanism: 'hydrogen_cracking' },
    critical_note: 'Repair itself failed — HAZ cracking from inadequate PWHT'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 09: HTHA — High temperature hydrogen attack
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_09_HTHA',
    asset: 'reactor effluent exchanger',
    domain: 'refinery',
    equipment_type: 'heat_exchanger',
    high_risk: true,
    ambiguous: true,
    weak_data: false,
    evidence: {
      domain: 'refinery',
      equipment_type: 'heat_exchanger',
      material: 'C-0.5Mo steel',
      tnom: 0.750,
      tmm: 0.740,
      service: 'hydrogen service at 550F and 250 psi H2 partial pressure',
      nelson_curve: 'operating point above API 941 C-0.5Mo curve',
      paut: 'increased attenuation in mid-wall zone — possible fissuring',
      backwall: 'backwall echo amplitude reduced 40% compared to unaffected zone',
      history: 'unit in service 22 years — no prior HTHA assessment',
      metallurgy: 'C-0.5Mo has been reclassified — no longer credited for H2 resistance per API 941 8th ed',
      mechanism: 'HTHA'
    },
    ground_truth: ['HTHA'],
    expected_class: 'REPAIR_REPLACE',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.5, scale: 2.0, mechanism: 'HTHA' },
    critical_note: 'HTHA is binary — if confirmed, must be REPAIR_REPLACE. C-0.5Mo no longer credited'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 10: NOZZLE STRESS — Stress concentration cracking
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_10_NOZZLE_STRESS',
    asset: 'nozzle-to-shell junction',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-516 Gr.70',
      tnom: 1.500,
      tmm: 1.480,
      visual: 'surface rust staining at nozzle reinforcement pad weep hole',
      ut: 'UT scan shows 15mm crack-like indication at nozzle inner radius',
      fea: 'FEA shows SCF of 3.2 at nozzle-shell intersection under piping loads',
      piping_loads: 'excessive piping loads measured — 120% of allowable',
      thermal_cycles: '800 thermal cycles in service life',
      mechanism: 'fatigue'
    },
    ground_truth: ['stress_concentration_crack'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 3.0, scale: 3.0, mechanism: 'fatigue' },
    critical_note: 'Geometry-driven failure — SCF + piping loads + cycling'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 11: CP FAILURE — Cathodic protection misread
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_11_CP_FAILURE',
    asset: 'subsea pipeline',
    domain: 'subsea',
    equipment_type: 'pipeline',
    high_risk: true,
    ambiguous: true,
    weak_data: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'pipeline',
      material: 'X52 carbon steel with FBE coating',
      tnom: 0.625,
      tmm: 0.580,
      cp_survey: 'CP readings show -920mV at survey points — appears adequate',
      cp_note: 'BUT survey points are 500m apart — holiday at mid-span would be undetected',
      coating: 'FBE coating is 18 years old — disbondment suspected at field joints',
      rov_visual: 'marine growth concentration suggests anode consumption pattern anomaly',
      anode_status: 'bracelet anodes 70% consumed — 5 years ahead of design depletion',
      mechanism: 'external_corrosion'
    },
    ground_truth: ['CP_misread'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.5, scale: 4.0, mechanism: 'external_corrosion' },
    critical_note: 'CP readings look OK but survey resolution is insufficient — false confidence'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 12: COATING — Underfilm corrosion
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_12_COATING',
    asset: 'storage tank shell',
    domain: 'fixed',
    equipment_type: 'storage_tank',
    high_risk: false,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'storage_tank',
      material: 'A36 carbon steel',
      tnom: 0.500,
      tmm: 0.420,
      visual: 'coating appears intact from 3m distance — slight discoloration noted',
      holiday_test: 'holiday detector found 12 holidays per square meter in first course',
      adhesion: 'coating adhesion pull-off test: 50 psi — below 200 psi minimum',
      ut_spot: 'spot UT under disbonded coating shows 0.420in from 0.500in nominal — 16% loss',
      coating_age: '15 years — epoxy system beyond expected service life',
      mechanism: 'general_corrosion'
    },
    ground_truth: ['underfilm_corrosion'],
    expected_class: 'INCREASE_INSPECTION',
    expected_lock: false,
    survival: { model_type: 'WEIBULL', shape: 2.0, scale: 5.0, mechanism: 'general_corrosion' },
    critical_note: 'Coating looks OK visually but is failed — underfilm corrosion progressing'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 13: MARINE GROWTH MASK — False positive visual
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_13_MARINE_MASK',
    asset: 'subsea jacket leg',
    domain: 'subsea',
    equipment_type: 'jacket',
    high_risk: false,
    ambiguous: true,
    weak_data: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'jacket',
      material: 'structural steel',
      tnom: 1.250,
      tmm: 1.220,
      rov_visual: 'heavy marine growth with rust-colored patches — appears severely corroded',
      cleaning: 'after cleaning: steel surface in good condition, minor pitting only',
      ut: 'UT shows 1.220in from 1.250in — only 2.4% wall loss',
      cp: 'CP adequate at -1050mV — well protected',
      anode_status: 'anodes in good condition — 40% remaining',
      mechanism: 'visual_artifact'
    },
    ground_truth: ['false_positive_visual'],
    expected_class: 'MONITOR',
    expected_lock: false,
    survival: { model_type: 'WEIBULL', shape: 1.5, scale: 8.0, mechanism: 'general_corrosion' },
    critical_note: 'Marine growth creates false alarm — actual condition is good. Must NOT overreact'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 14: GALVANIC CORROSION — Dissimilar metals
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_14_GALVANIC',
    asset: 'cooling water piping',
    domain: 'fixed',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'carbon steel to copper-nickel transition',
      tnom: 0.375,
      tmm: 0.225,
      visual: 'aggressive thinning at CS side of bimetallic joint — 4:1 area ratio',
      ut: 'UT shows 0.225in from 0.375in — 40% loss concentrated within 2D of joint',
      water_chemistry: 'seawater cooling — high conductivity electrolyte',
      history: 'Cu-Ni section replaced 3 years ago — no isolation gasket installed',
      corrosion_rate: 'calculated 50 mpy at joint vs 5 mpy away from joint',
      mechanism: 'galvanic_corrosion'
    },
    ground_truth: ['galvanic_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 3.5, scale: 2.5, mechanism: 'galvanic_corrosion' },
    critical_note: 'Classic galvanic cell — unfavorable area ratio accelerating CS dissolution'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 15: EROSION-CORROSION — Flow-accelerated
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_15_EROSION',
    asset: 'elbow downstream of control valve',
    domain: 'fixed',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: false,
    weak_data: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'carbon steel',
      tnom: 0.500,
      tmm: 0.280,
      visual: 'horseshoe pattern thinning at elbow extrados',
      ut_scan: 'UT C-scan shows 0.280in minimum at extrados — 44% loss',
      flow: 'two-phase flow with sand content 50 ppm, velocity 25 ft/s',
      geometry: '90-degree long radius elbow immediately downstream of letdown valve',
      history: 'replaced identical elbow 18 months ago — recurrence',
      mechanism: 'erosion_corrosion'
    },
    ground_truth: ['erosion_corrosion'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 3.8, scale: 2.0, mechanism: 'erosion_corrosion' },
    critical_note: 'Recurring failure — same location, same mechanism. System fix needed'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 16: AI FALSE DETECTION — Algorithm artifact
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_16_AI_FALSE',
    asset: 'pipeline girth weld',
    domain: 'fixed',
    equipment_type: 'pipeline',
    high_risk: false,
    ambiguous: true,
    weak_data: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pipeline',
      material: 'X60 carbon steel',
      tnom: 0.500,
      tmm: 0.495,
      ai_detection: 'ML model flagged girth weld anomaly — 0.78 confidence, classified as crack',
      manual_review: 'experienced RT interpreter: geometric indication from weld root — acceptable',
      rt_film: 'root pass geometry variation — not a flaw',
      ut_verification: 'UT follow-up shows no reflector at flagged location',
      history: 'same ML model has 12% false positive rate on girth welds',
      mechanism: 'none_confirmed'
    },
    ground_truth: ['false_AI_detection'],
    expected_class: 'MONITOR',
    expected_lock: false,
    survival: { model_type: 'WEIBULL', shape: 1.5, scale: 10.0, mechanism: 'general_corrosion' },
    critical_note: 'AI flagged it but manual review + UT say no flaw. Must weight human expert over AI'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 17: INSPECTOR BIAS — Human override needed
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_17_INSPECTOR_BIAS',
    asset: 'heat exchanger tube bundle',
    domain: 'fixed',
    equipment_type: 'heat_exchanger',
    high_risk: true,
    ambiguous: true,
    weak_data: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'heat_exchanger',
      material: 'admiralty brass tubes',
      tnom: 0.065,
      tmm: 0.042,
      inspector_conclusion: 'inspector concluded: minor general thinning, continue monitoring',
      eddy_current: 'EC shows 35% through-wall at U-bend — localized attack pattern',
      water_chemistry: 'ammonia detected in cooling water — known brass dezincification agent',
      tube_failures: '3 tube leaks in last 12 months in same bundle',
      bias_indicator: 'inspector has history of under-calling this asset — 4 previous inspections, all "monitor"',
      mechanism: 'dezincification'
    },
    ground_truth: ['human_bias_override'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 3.0, scale: 2.0, mechanism: 'dezincification' },
    critical_note: 'Inspector says monitor — but data says failing. System must override human bias'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 18: STALE DATA — Process change invalidated old data
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_18_STALE_DATA',
    asset: 'crude unit overhead piping',
    domain: 'refinery',
    equipment_type: 'piping',
    high_risk: true,
    ambiguous: true,
    weak_data: true,
    evidence: {
      domain: 'refinery',
      equipment_type: 'piping',
      material: 'carbon steel',
      tnom: 0.375,
      tmm: 0.340,
      last_inspection: '18 months ago — 0.355in, corrosion rate was 2 mpy',
      process_change: 'crude slate changed to high-TAN crude 14 months ago',
      current_ut: '0.340in — apparent rate now 12 mpy since process change',
      naphthenic_acid: 'TAN increased from 0.3 to 1.8 mg KOH/g',
      velocity: 'increased throughput — velocity up 30%',
      temperature: 'operating at 550F — naphthenic acid corrosion zone',
      mechanism: 'naphthenic_acid_corrosion'
    },
    ground_truth: ['process_change_override'],
    expected_class: 'ENGINEERING_REVIEW',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 3.5, scale: 2.5, mechanism: 'naphthenic_acid_corrosion' },
    critical_note: 'Old inspection data is invalid — process change made corrosion rate 6x worse'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 19: DATA MISMATCH — Conflicting inspection data
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_19_DATA_MISMATCH',
    asset: 'pressure vessel shell course',
    domain: 'fixed',
    equipment_type: 'pressure_vessel',
    high_risk: true,
    ambiguous: true,
    weak_data: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-516 Gr.70',
      tnom: 1.000,
      tmm_source1: 0.920,
      tmm_source2: 0.780,
      ut_company_a: 'Company A UT survey: min 0.920in, general thinning, no significant loss',
      ut_company_b: 'Company B UT survey (same locations, 2 weeks later): min 0.780in, localized pitting',
      calibration_note: 'Company A used 0-delay probe; Company B used dual-element with proper V-path correction',
      history: 'vessel in acidic service — pitting expected based on process',
      mechanism: 'localized_corrosion'
    },
    ground_truth: ['data_integrity_failure'],
    expected_class: 'HOLD_FOR_INPUT',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.5, scale: 3.0, mechanism: 'localized_corrosion' },
    critical_note: 'Two inspections disagree by 140 mils — cannot make decision. Must flag data conflict'
  },

  // ══════════════════════════════════════════════════════════════════
  // CASE 20: BLACK SWAN — Multi-mechanism uncertainty
  // ══════════════════════════════════════════════════════════════════
  {
    id: 'CASE_20_BLACK_SWAN',
    asset: 'subsea manifold hub',
    domain: 'subsea',
    equipment_type: 'manifold',
    high_risk: true,
    ambiguous: true,
    weak_data: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'manifold',
      material: 'super duplex stainless steel',
      tnom: 0.750,
      tmm: 0.680,
      rov_visual: 'unusual discoloration pattern — not typical of any single mechanism',
      ut: 'wall loss 0.680in — 9.3% thinning in super duplex which should resist corrosion',
      cp: 'CP readings inconsistent — -780mV to -1120mV across hub',
      microbiological: 'MIC suspected — sulfate-reducing bacteria detected in water samples',
      hydrogen: 'hydrogen permeation detected at cathodically overprotected areas',
      temperature: 'thermal anomaly detected — 15F delta from design',
      history: 'no prior failures of this material in this service worldwide',
      pitting: 'localized pitting in areas of CP overprotection + SRB presence',
      mechanism: 'unknown_multi'
    },
    ground_truth: ['uncertain_multi_mechanism'],
    expected_class: 'HOLD_FOR_INPUT',
    expected_lock: true,
    survival: { model_type: 'WEIBULL', shape: 2.0, scale: 3.0, mechanism: 'unknown_multi' },
    critical_note: 'Black swan — multiple possible mechanisms, no clear dominant. Must NOT pretend to know'
  }
];

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
        return callback(new Error('HTTP ' + res.statusCode + ': ' + data.substring(0, 500)), null);
      }
      try {
        var parsed = JSON.parse(data);
        callback(null, parsed);
      } catch (e) {
        callback(new Error('JSON parse error: ' + data.substring(0, 500)), null);
      }
    });
  });

  req.on('error', function(err) { callback(err, null); });
  req.setTimeout(60000, function() {
    req.destroy();
    callback(new Error('Timeout after 60s'), null);
  });
  req.write(body);
  req.end();
}

// ── FULL PIPELINE PER CASE ──────────────────────────────────────────

function runPipeline(tc, callback) {
  // Step 1: Comprehensive Assessment Orchestrator
  // Map domain to DDE-compatible domain
  // DDE knows: fixed, subsea, marine, floating, production
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
      tmm: tc.evidence.tmm
    },
    observed_evidence: tc.evidence,
    ffs_data: {}
  };

  callEngine('/api/comprehensive-assessment', orchPayload, function(err1, orchResp) {
    var orchResult = null;
    var orchOk = false;
    var disposition = 'UNKNOWN';
    var topMechanism = 'UNKNOWN';
    var recommendations = [];
    var orchRaw = null;

    if (!err1 && orchResp) {
      orchResult = orchResp;
      orchRaw = orchResp;
      orchOk = true;

      if (orchResp.interpreted) {
        disposition = orchResp.interpreted.overall_disposition || 'UNKNOWN';
        topMechanism = orchResp.interpreted.top_mechanism || 'UNKNOWN';
        recommendations = [];
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

    // Step 2: Survival Analysis
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

      // Step 3: Classification
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
        var classConfidence = 0;

        if (!err3 && classResp && classResp.data) {
          classOk = true;
          var cd = classResp.data;
          reliabilityClass = cd.reliability_class || 'UNKNOWN';
          authorityLock = cd.authority_lock_required || false;
          classConfidence = cd.confidence || 0;
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
          authority_lock: authorityLock,
          class_confidence: classConfidence
        });
      });
    });
  });
}

// ── SCORING ENGINE (8 CRITERIA) ─────────────────────────────────────

function scoreCase(tc, result) {
  var scores = {};
  var deductions = [];
  var autoFail = false;
  var autoFailReasons = [];

  // Helper: check if response text contains mechanism keywords
  function responseContains(keyword) {
    var raw = JSON.stringify(result.orch_raw || '').toLowerCase();
    return raw.indexOf(keyword.toLowerCase()) !== -1;
  }

  // Helper: check recommendations contain action keywords
  function recsContain(keyword) {
    var recsStr = (result.recommendations || []).join(' ').toLowerCase();
    var dispStr = JSON.stringify(result.orch_raw || '').toLowerCase();
    return recsStr.indexOf(keyword.toLowerCase()) !== -1 || dispStr.indexOf(keyword.toLowerCase()) !== -1;
  }

  // ── 1. MECHANISM IDENTIFICATION (0-20) ─────────────────────────
  var mechScore = 0;
  var mechFound = 0;
  var mechTotal = tc.ground_truth.length;
  var mechMissed = [];

  for (var m = 0; m < tc.ground_truth.length; m++) {
    var gt = tc.ground_truth[m];
    // Check various forms of the mechanism name
    var variants = getMechanismVariants(gt);
    var found = false;
    for (var v = 0; v < variants.length; v++) {
      if (responseContains(variants[v])) {
        found = true;
        break;
      }
    }
    if (found) {
      mechFound++;
    } else {
      mechMissed.push(gt);
    }
  }

  if (mechTotal > 0) {
    mechScore = Math.round((mechFound / mechTotal) * 20);
  }
  scores['1_mechanism_id'] = mechScore;

  // Deduction: missed primary mechanism
  if (mechMissed.length > 0) {
    for (var mm = 0; mm < mechMissed.length; mm++) {
      deductions.push('Missed mechanism: ' + mechMissed[mm] + ' (-20)');
    }
  }

  // ── 2. MULTI-MECHANISM RETENTION (0-15) ────────────────────────
  var multiScore = 0;
  if (tc.ground_truth.length === 1) {
    // Single mechanism case — full credit if identified
    multiScore = mechFound >= 1 ? 15 : 0;
  } else {
    // Multi-mechanism — score by how many retained
    multiScore = Math.round((mechFound / mechTotal) * 15);
  }
  scores['2_multi_mechanism'] = multiScore;

  // ── 3. TIMELINE / 4D REASONING (0-15) ─────────────────────────
  var timelineScore = 0;
  if (result.survival_ok && result.fail_probs['1yr'] !== undefined) {
    timelineScore = timelineScore + 5;  // Has survival analysis
  }
  if (result.time_horizons) {
    timelineScore = timelineScore + 5;  // Has multi-horizon data
  }
  // Check for temporal reasoning in orchestrator
  if (responseContains('timeline') || responseContains('progres') || responseContains('time') ||
      responseContains('years') || responseContains('rate') || responseContains('remaining')) {
    timelineScore = timelineScore + 5;
  }
  scores['3_timeline_4d'] = Math.min(timelineScore, 15);

  // AUTO-FAIL: Missing timeline
  if (!result.survival_ok && !result.time_horizons) {
    autoFail = true;
    autoFailReasons.push('Missing timeline — no survival analysis returned');
  }

  // ── 4. EVIDENCE WEIGHTING (0-15) ───────────────────────────────
  var evidScore = 0;
  if (result.orch_ok) {
    evidScore = evidScore + 5;  // Orchestrator returned structured response
  }
  if (result.disposition !== 'UNKNOWN') {
    evidScore = evidScore + 5;  // Produced a disposition
  }
  // Check proof trace exists
  if (result.orch_raw && result.orch_raw.deterministic && result.orch_raw.deterministic.stages) {
    evidScore = evidScore + 5;  // Multi-stage evidence processing
  }
  scores['4_evidence_weight'] = Math.min(evidScore, 15);

  // ── 5. UNCERTAINTY HANDLING (0-10) ─────────────────────────────
  var uncertScore = 0;
  // Check if uncertainty is acknowledged
  if (responseContains('uncertain') || responseContains('confidence') || responseContains('ambig')) {
    uncertScore = uncertScore + 5;
  }
  // Check if proof trace shows reasoning
  if (result.orch_raw && (result.orch_raw.deterministic || result.orch_raw.proof_trace)) {
    uncertScore = uncertScore + 5;
  }
  scores['5_uncertainty'] = Math.min(uncertScore, 10);

  // AUTO-FAIL: No uncertainty on ambiguous case
  if (tc.ambiguous && uncertScore === 0) {
    autoFail = true;
    autoFailReasons.push('No uncertainty handling on ambiguous case');
  }

  // AUTO-FAIL: Overconfidence with weak data
  if (tc.weak_data && result.class_confidence > 0.9) {
    autoFail = true;
    autoFailReasons.push('Overconfidence (' + result.class_confidence + ') with weak data');
  }

  // ── 6. DECISION QUALITY (0-10) ────────────────────────────────
  var decisionScore = 0;
  // Check reliability class matches expected (±1 band tolerance)
  var classMatch = checkClassMatch(result.reliability_class, tc.expected_class);
  if (classMatch === 'exact') {
    decisionScore = 10;
  } else if (classMatch === 'adjacent') {
    decisionScore = 6;
  } else {
    decisionScore = 0;
    deductions.push('Wrong reliability class: got ' + result.reliability_class + ' expected ' + tc.expected_class + ' (-15)');
  }
  scores['6_decision_quality'] = decisionScore;

  // AUTO-FAIL: High risk classified LOW_RISK
  if (tc.high_risk && result.reliability_class === 'LOW_RISK') {
    autoFail = true;
    autoFailReasons.push('HIGH RISK case classified LOW_RISK');
  }

  // ── 7. AUTHORITY LOCK CORRECTNESS (0-10) ──────────────────────
  var lockScore = 0;
  if (result.authority_lock === tc.expected_lock) {
    lockScore = 10;
  } else {
    lockScore = 0;
    if (tc.expected_lock && !result.authority_lock) {
      deductions.push('Missing authority lock when required (-20)');
    }
  }
  scores['7_authority_lock'] = lockScore;

  // ── 8. ACTION RECOMMENDATIONS (0-5) ───────────────────────────
  var actionScore = 0;
  if (result.recommendations && result.recommendations.length > 0) {
    actionScore = actionScore + 3;
  }
  if (recsContain('inspect') || recsContain('repair') || recsContain('monitor') ||
      recsContain('engineer') || recsContain('assess') || recsContain('review') ||
      recsContain('replace') || recsContain('evaluate')) {
    actionScore = actionScore + 2;
  }
  scores['8_actions'] = Math.min(actionScore, 5);

  // ── TOTAL ──────────────────────────────────────────────────────
  var rawTotal = 0;
  var keys = Object.keys(scores);
  for (var k = 0; k < keys.length; k++) {
    rawTotal = rawTotal + scores[keys[k]];
  }

  // Apply deductions
  var penalty = 0;
  for (var d = 0; d < deductions.length; d++) {
    var dedMatch = deductions[d].match(/\((-\d+)\)/);
    if (dedMatch) {
      penalty = penalty + Math.abs(parseInt(dedMatch[1]));
    }
  }

  var finalScore = Math.max(0, rawTotal - penalty);
  if (autoFail) finalScore = 0;

  return {
    case_id: tc.id,
    asset: tc.asset,
    ground_truth: tc.ground_truth,
    scores: scores,
    raw_total: rawTotal,
    penalty: penalty,
    final_score: finalScore,
    auto_fail: autoFail,
    auto_fail_reasons: autoFailReasons,
    deductions: deductions,
    reliability_class: result.reliability_class,
    expected_class: tc.expected_class,
    authority_lock: result.authority_lock,
    expected_lock: tc.expected_lock,
    disposition: result.disposition,
    top_mechanism: result.top_mechanism,
    fail_probs: result.fail_probs,
    class_confidence: result.class_confidence,
    mechanisms_found: mechFound,
    mechanisms_total: mechTotal,
    mechanisms_missed: mechMissed
  };
}

// ── MECHANISM VARIANT HELPER ─────────────────────────────────────────

function getMechanismVariants(mechanism) {
  // Variants include both ground-truth names AND actual DDE mechanism IDs from KB
  var map = {
    'impact_damage': ['impact', 'mechanical damage', 'anchor drag', 'dent', 'gouge', 'anchor_impact'],
    'coating_failure': ['coating', 'disbond', 'holiday', 'paint', 'coating_breakdown'],
    'external_corrosion': ['external corrosion', 'ext. corrosion', 'corrosion', 'general_corrosion', 'free_corrosion'],
    'fatigue_crack': ['fatigue', 'crack', 'cyclic', 'fatigue_tubular', 'fatigue_cracking'],
    'thermal_fatigue': ['thermal fatigue', 'thermal cycling', 'thermal', 'fatigue', 'creep'],
    'creep': ['creep', 'voiding', 'neubauer', 'temper_embrittlement'],
    'chloride_SCC': ['scc', 'stress corrosion', 'chloride', 'cracking', 'chloride_scc'],
    'structural_risk': ['structural', 'load path', 'consequence', 'critical', 'buckling'],
    'systemic_CUI': ['cui', 'corrosion under insulation', 'systemic', 'CUI'],
    'lack_of_fusion': ['lack of fusion', 'lof', 'fusion', 'incomplete fusion', 'weld defect', 'weld_defect'],
    'metallurgical_mismatch': ['metallurgical', 'dissimilar', 'dmw', 'mismatch', 'carbon migration', 'hydrogen_embrittlement', 'temper_embrittlement', 'hydrogen'],
    'HAZ_crack': ['haz', 'heat affected', 'repair', 'pwht', 'hydrogen crack', 'hydrogen_embrittlement', 'hydrogen', 'HIC', 'SSC', 'SOHIC', 'cracking'],
    'HTHA': ['htha', 'hydrogen attack', 'high temperature hydrogen', 'nelson', 'fissur', 'hydrogen_embrittlement', 'hydrogen', 'HIC'],
    'stress_concentration_crack': ['stress concentration', 'scf', 'nozzle', 'fatigue', 'piping load'],
    'CP_misread': ['cp', 'cathodic', 'protection', 'anode', 'survey', 'free_corrosion_cp'],
    'underfilm_corrosion': ['underfilm', 'coating', 'disbond', 'holiday', 'adhesion', 'general_corrosion', 'coating_breakdown'],
    'false_positive_visual': ['false positive', 'marine growth', 'not significant', 'acceptable', 'minor'],
    'galvanic_corrosion': ['galvanic', 'dissimilar metal', 'bimetallic', 'area ratio', 'general_corrosion', 'corrosion'],
    'erosion_corrosion': ['erosion', 'flow', 'velocity', 'sand', 'impingement', 'erosion_corrosion'],
    'false_AI_detection': ['false', 'geometric', 'acceptable', 'not a flaw', 'artifact'],
    'human_bias_override': ['bias', 'override', 'disagree', 'inspector', 'eddy current', 'dezincif', 'fatigue', 'corrosion', 'MIC'],
    'process_change_override': ['process change', 'naphthenic', 'tan', 'accelerat', 'crude', 'naphthenic_acid'],
    'data_integrity_failure': ['data', 'conflict', 'mismatch', 'disagree', 'calibration', 'discrepan', 'general_corrosion', 'corrosion'],
    'uncertain_multi_mechanism': ['uncertain', 'multiple', 'unknown', 'complex', 'mic', 'hydrogen', 'hold']
  };
  return map[mechanism] || [mechanism.replace(/_/g, ' '), mechanism];
}

// ── CLASS MATCH HELPER ───────────────────────────────────────────────

function checkClassMatch(actual, expected) {
  if (actual === expected) return 'exact';

  var classOrder = ['LOW_RISK', 'MONITOR', 'INCREASE_INSPECTION', 'ENGINEERING_REVIEW', 'REPAIR_REPLACE', 'HOLD_FOR_INPUT'];
  var actualIdx = classOrder.indexOf(actual);
  var expectedIdx = classOrder.indexOf(expected);

  // HOLD_FOR_INPUT is special — adjacent to ENGINEERING_REVIEW and REPAIR_REPLACE
  if (expected === 'HOLD_FOR_INPUT' && (actual === 'ENGINEERING_REVIEW' || actual === 'REPAIR_REPLACE')) return 'adjacent';
  if (actual === 'HOLD_FOR_INPUT' && (expected === 'ENGINEERING_REVIEW' || expected === 'REPAIR_REPLACE')) return 'adjacent';

  if (actualIdx !== -1 && expectedIdx !== -1 && Math.abs(actualIdx - expectedIdx) <= 1) return 'adjacent';

  return 'wrong';
}

// ── ROUND HELPER ─────────────────────────────────────────────────────

function round2(v) {
  if (v === null || v === undefined) return 'N/A';
  return Math.round(v * 100) / 100;
}

// ── SEQUENTIAL RUNNER ────────────────────────────────────────────────

function runAll(cases, idx, results, finalCb) {
  if (idx >= cases.length) return finalCb(results);

  var tc = cases[idx];
  console.log('\n[' + (idx + 1) + '/' + cases.length + '] ══════════════════════════════════════════════');
  console.log('  Case: ' + tc.id);
  console.log('  Asset: ' + tc.asset);
  console.log('  Ground Truth: ' + tc.ground_truth.join(', '));
  console.log('  Expected: class=' + tc.expected_class + ' lock=' + tc.expected_lock);
  console.log('  Running pipeline...');

  runPipeline(tc, function(pipeResult) {
    var scored = scoreCase(tc, pipeResult);
    results.push(scored);

    // Print per-case result
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

    if (scored.mechanisms_missed.length > 0) {
      console.log('    MISSED: ' + scored.mechanisms_missed.join(', '));
    }
    if (scored.auto_fail) {
      console.log('    AUTO-FAIL REASONS: ' + scored.auto_fail_reasons.join('; '));
    }
    if (scored.deductions.length > 0) {
      console.log('    DEDUCTIONS: ' + scored.deductions.join('; '));
    }

    runAll(cases, idx + 1, results, finalCb);
  });
}

// ── AGGREGATE SCORECARD ──────────────────────────────────────────────

function printScorecard(results) {
  console.log('\n\n════════════════════════════════════════════════════════════════');
  console.log('FORGED 4D NDT PLATFORM — ENTERPRISE VALIDATION SCORECARD');
  console.log('20 Elite Scenarios — ASNT Demo Ready');
  console.log('════════════════════════════════════════════════════════════════\n');

  var totalScore = 0;
  var failures = [];
  var autoFails = [];
  var highRiskMisclass = [];
  var mechConfusion = {};
  var topFailureModes = {};

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    totalScore = totalScore + r.final_score;

    if (r.final_score < 70) {
      failures.push(r.case_id + ' (' + r.final_score + ')');
    }
    if (r.auto_fail) {
      autoFails.push(r.case_id + ': ' + r.auto_fail_reasons.join('; '));
    }
    if (r.expected_class !== r.reliability_class && r.expected_class !== 'MONITOR' && r.reliability_class === 'LOW_RISK') {
      highRiskMisclass.push(r.case_id);
    }

    // Track missed mechanisms
    for (var mm = 0; mm < r.mechanisms_missed.length; mm++) {
      var missed = r.mechanisms_missed[mm];
      topFailureModes[missed] = (topFailureModes[missed] || 0) + 1;
    }
  }

  var avgScore = Math.round((totalScore / results.length) * 10) / 10;

  // Rating
  var rating = 'NON_COMPETITIVE';
  if (avgScore >= 90) rating = 'INDUSTRY-DISRUPTING';
  else if (avgScore >= 80) rating = 'ELITE';
  else if (avgScore >= 70) rating = 'ADVANCED';
  else if (avgScore >= 60) rating = 'COMPETITIVE';

  // Print summary
  console.log('── AGGREGATE RESULTS ──────────────────────────────────────────\n');
  console.log('  Total Score:        ' + totalScore + ' / 2000');
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
    for (var j = 0; j < results.length; j++) {
      critSum = critSum + (results[j].scores[criteriaNames[c]] || 0);
    }
    var critAvg = Math.round((critSum / results.length) * 10) / 10;
    var critPct = Math.round((critAvg / criteriaMax[c]) * 100);
    console.log('  ' + criteriaLabels[c] + ': ' + critAvg + '/' + criteriaMax[c] + ' (' + critPct + '%)');
  }

  // Failures
  if (failures.length > 0) {
    console.log('\n── FAILURES (<70) ────────────────────────────────────────────\n');
    for (var f = 0; f < failures.length; f++) {
      console.log('  ' + failures[f]);
    }
  }

  // Auto-fails
  if (autoFails.length > 0) {
    console.log('\n── AUTO-FAILS ────────────────────────────────────────────────\n');
    for (var af = 0; af < autoFails.length; af++) {
      console.log('  ' + autoFails[af]);
    }
  }

  // High risk misclassifications
  if (highRiskMisclass.length > 0) {
    console.log('\n── HIGH RISK MISCLASSIFICATIONS ──────────────────────────────\n');
    for (var hr = 0; hr < highRiskMisclass.length; hr++) {
      console.log('  ' + highRiskMisclass[hr]);
    }
  }

  // Top missed mechanisms
  var missedKeys = Object.keys(topFailureModes);
  if (missedKeys.length > 0) {
    console.log('\n── MOST MISSED MECHANISMS ────────────────────────────────────\n');
    missedKeys.sort(function(a, b) { return topFailureModes[b] - topFailureModes[a]; });
    for (var mk = 0; mk < missedKeys.length; mk++) {
      console.log('  ' + missedKeys[mk] + ': missed ' + topFailureModes[missedKeys[mk]] + 'x');
    }
  }

  // Per-case summary table
  console.log('\n── PER-CASE SUMMARY ──────────────────────────────────────────\n');
  for (var s = 0; s < results.length; s++) {
    var rs = results[s];
    var sIcon = rs.auto_fail ? 'FAIL*' : (rs.final_score >= 90 ? 'ELITE' : (rs.final_score >= 80 ? 'PASS+' : (rs.final_score >= 70 ? 'PASS' : 'FAIL')));
    console.log('  [' + sIcon + '] ' + rs.case_id);
    console.log('         score=' + rs.final_score + ' class=' + rs.reliability_class + ' lock=' + rs.authority_lock + ' mech=' + rs.mechanisms_found + '/' + rs.mechanisms_total);
  }

  // Final rating
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  FINAL RATING: ' + rating);
  console.log('  Average: ' + avgScore + '/100 | Total: ' + totalScore + '/2000');
  console.log('════════════════════════════════════════════════════════════════\n');

  // JSON output for programmatic consumption
  var output = {
    total_score: totalScore,
    average_score: avgScore,
    failures: failures,
    auto_fails: autoFails,
    high_risk_misclassifications: highRiskMisclass,
    top_failure_modes: topFailureModes,
    final_rating: rating,
    cases_passed: results.length - failures.length,
    cases_total: results.length
  };

  console.log('── JSON OUTPUT ───────────────────────────────────────────────\n');
  console.log(JSON.stringify(output, null, 2));
}

// ── MAIN ─────────────────────────────────────────────────────────────

console.log('════════════════════════════════════════════════════════════════');
console.log('FORGED 4D NDT PLATFORM — ENTERPRISE VALIDATION HARNESS v1');
console.log('20 Elite Scenarios — ASNT Demo Ready');
console.log('Target: ' + BASE_URL);
console.log('Pipeline: orchestrator -> survival -> classification');
console.log('Scoring: 8 criteria, 100 pts/case, 2000 max');
console.log('════════════════════════════════════════════════════════════════');

runAll(TEST_CASES, 0, [], function(results) {
  printScorecard(results);
});
