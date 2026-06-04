// netlify/functions/inspection-effectiveness.js
// FORGED NDT Intelligence OS - Inspection Effectiveness Engine
// Version: v2.0.0
// Purpose: Classify the effectiveness of NDE techniques against the resolved
//          dominant damage mechanism per API 581 Annex 2.C effectiveness logic.
//          v2.0.0 adds field quality modifiers, POD band, false negative risk,
//          can_support_final_disposition flag, and API standards reference layer.
//
// Pure JavaScript only: no TypeScript, no template literals, var only,
// string concatenation only, module.exports pattern.
//
// I/O Contract
// ------------
// INPUT (event.body JSON):
//   {
//     damage_mechanism: "CL_SCC",
//     techniques_performed: ["UT_T", "VT"],
//     coverage: "partial",
//     access_side: "external",
//     surface_prep: "as_received",
//     domain: "fixed",
//     equipment_type: "pressure_vessel",
//     // --- v2.0.0 Field Quality Inputs ---
//     inspection_access_quality: "restricted",
//     surface_condition: "corroded",
//     temperature_at_inspection: 285,
//     coating_removed: false,
//     insulation_removed: false,
//     calibration_quality: "verified",
//     technician_cert_level: "Level_II",
//     scan_plan_adequacy: "partial"
//   }
//
// OUTPUT (200 JSON):
//   {
//     effectiveness_rating: "C",
//     raw_rating: "A",
//     field_adjusted_rating: "C",
//     confidence_modifier: -0.2,
//     rating_basis: "....",
//     field_penalties_applied: [...],
//     probability_of_detection_band: { low: 0.45, mid: 0.60, high: 0.72 },
//     false_negative_risk: "MODERATE",
//     can_support_final_disposition: false,
//     disposition_blockers: ["..."],
//     complementary_required: ["WFMT","PT","ECT"],
//     authority_flag: "INSPECTION_MISMATCH",
//     applicable_standards: [...],
//     best_technique_used: "UT_T",
//     dm_in_table: true,
//     version: "v2.0.0"
//   }
//
// Integration:
//   FMD -> inspection-effectiveness -> Reality Challenge / Evidence Provenance / Disposition
// =============================================================================


// =============================================================================
// SECTION 1 - EFFECTIVENESS TABLE (API 581 Annex 2.C aligned)
// =============================================================================
// Ratings: A = Highly Effective, B = Usually Effective, C = Fairly Effective,
//          D = Poorly Effective, E = Ineffective
//
// Technique codes (canonical):
//   VT             Visual
//   UT_T           UT thickness gauging (manual)
//   AUT            Automated UT (corrosion mapping)
//   PAUT_C         Phased Array - corrosion / volumetric
//   PAUT_S         Phased Array - surface / cracking
//   TOFD           Time-of-Flight Diffraction
//   PAUT_TFM       Phased Array Total Focusing Method
//   AUT_TOFD_BACKSCATTER   AUT with TOFD + backscatter (HTHA-specific)
//   VELOCITY_RATIO_UT      UT velocity ratio (HTHA-specific)
//   PROFILE_RT     Profile radiography
//   RT             Conventional radiography
//   IRIS           Internal Rotary Inspection (tubes)
//   PEC            Pulsed Eddy Current
//   GWUT           Guided Wave UT
//   ECT            Eddy Current
//   MT             Magnetic Particle (dry)
//   WFMT           Wet Fluorescent Magnetic Particle
//   PT             Liquid Penetrant
//   AET            Acoustic Emission Testing
//   REPLICATION    Field metallographic replication
//   HARDNESS       In-situ hardness testing
//   IR_THERMOGRAPHY   Infrared thermography

var EFFECTIVENESS_TABLE = {
  GENERAL_THINNING: {
    morphology: "uniform_wall_loss",
    location: "internal",
    techniques: {
      UT_T: "A", AUT: "A", PROFILE_RT: "A", IRIS: "A",
      PAUT_C: "B", RT: "B", PEC: "B",
      GWUT: "C",
      VT: "D",
      PT: "E", MT: "E", WFMT: "E", ECT: "E"
    }
  },
  LOCALIZED_THINNING: {
    morphology: "pitting_or_MIC",
    location: "internal",
    techniques: {
      AUT: "A", PAUT_C: "A", IRIS: "A",
      PROFILE_RT: "B", RT: "B",
      UT_T: "C", PEC: "C",
      GWUT: "D", VT: "D",
      PT: "E", MT: "E"
    }
  },
  MIC: {
    morphology: "pitting_under_deposit_biofilm",
    location: "internal_stagnant",
    techniques: {
      AUT: "A", PAUT_C: "A", IRIS: "A",
      PROFILE_RT: "B", RT: "B",
      UT_T: "C", PEC: "C",
      GWUT: "D", VT: "D",
      PT: "E", MT: "E"
    },
    note: "MIC produces localized pitting morphologically similar to other pitting mechanisms. Positive MIC identification requires supplemental biological testing (ATP, SRB culture, deposit analysis). NDE effectiveness rates detection of the resulting wall loss, not the biological activity itself."
  },
  EXTERNAL_CORROSION: {
    morphology: "uniform_or_pitted_external_loss",
    location: "external",
    techniques: {
      VT: "A", UT_T: "A", AUT: "A",
      PAUT_C: "B", PROFILE_RT: "B",
      PEC: "B", PT: "C", MT: "C",
      GWUT: "C",
      ECT: "D"
    }
  },
  CUI: {
    morphology: "external_corrosion_under_insulation",
    location: "external_under_insulation",
    techniques: {
      VT: "A", UT_T: "A",
      PROFILE_RT: "B", PEC: "B", IR_THERMOGRAPHY: "B",
      GWUT: "C",
      AUT: "C",
      PT: "D", MT: "D"
    },
    note: "Effectiveness assumes insulation is removed at the inspection location. Without insulation removal, drop one rating step. Per API 583.",
    insulation_sensitive: true
  },
  CL_SCC: {
    morphology: "surface_breaking_cracking",
    location: "internal_or_external",
    techniques: {
      WFMT: "A", PT: "A", ECT: "A",
      PAUT_S: "B", TOFD: "B",
      RT: "C",
      VT: "D",
      UT_T: "E", PEC: "E", AUT: "E"
    },
    note: "Cl-SCC in austenitic stainless is non-magnetic; MT/WFMT only effective if ferritic/duplex phase present. PT and ECT are primary."
  },
  CAUSTIC_SCC: {
    morphology: "surface_breaking_cracking",
    location: "internal_or_external",
    techniques: {
      WFMT: "A", MT: "A",
      PT: "B", PAUT_S: "B", TOFD: "B",
      ECT: "C", RT: "C",
      VT: "D",
      UT_T: "E"
    }
  },
  AMINE_SCC: {
    morphology: "surface_breaking_cracking_HAZ",
    location: "internal_weld_HAZ",
    techniques: {
      WFMT: "A",
      PAUT_S: "B", TOFD: "B", PT: "B", MT: "B",
      RT: "C", ECT: "C",
      VT: "D",
      UT_T: "E"
    },
    note: "Amine SCC concentrates in weld HAZ. PWHT condition modifies susceptibility, not detectability."
  },
  SSC: {
    morphology: "surface_breaking_cracking_hard_zones",
    location: "internal_weld_HAZ",
    techniques: {
      WFMT: "A", MT: "A",
      PT: "B", PAUT_S: "B", TOFD: "B", HARDNESS: "B",
      RT: "C",
      VT: "D",
      UT_T: "E"
    }
  },
  HIC: {
    morphology: "subsurface_blistering_stepwise_cracking",
    location: "internal_through_thickness",
    techniques: {
      AUT: "A", PAUT_C: "A", TOFD: "A",
      RT: "B",
      UT_T: "C",
      VT: "D",
      PT: "E", MT: "E", WFMT: "E"
    }
  },
  HTHA: {
    morphology: "subsurface_fissuring_decarburization",
    location: "internal_through_thickness",
    techniques: {
      AUT_TOFD_BACKSCATTER: "B", PAUT_TFM: "B", VELOCITY_RATIO_UT: "B",
      AET: "C", REPLICATION: "C",
      TOFD: "C",
      UT_T: "D", RT: "D",
      VT: "E", MT: "E", PT: "E"
    },
    note: "API 941/581: no single technique is A-rated for HTHA. Multi-technique strategy is required for credible detection."
  },
  FATIGUE_CRACKING: {
    morphology: "surface_or_subsurface_cracking",
    location: "stress_concentration",
    techniques: {
      WFMT: "A", PT: "A",
      PAUT_S: "B", TOFD: "B", ECT: "B",
      MT: "B",
      RT: "C",
      VT: "D",
      UT_T: "E"
    }
  },
  BRITTLE_FRACTURE: {
    morphology: "pre_existing_flaw_propagation",
    location: "any_flaw_location",
    techniques: {
      PAUT_S: "A", TOFD: "A",
      WFMT: "B", PT: "B", MT: "B",
      RT: "B",
      AUT: "B",
      VT: "C",
      UT_T: "D"
    },
    note: "Brittle fracture is a failure event, not a progressive damage mechanism. Rating reflects detection of pre-existing flaws that could initiate fracture under upset conditions."
  },
  EROSION_CORROSION: {
    morphology: "directional_wall_loss",
    location: "internal_flow_path",
    techniques: {
      AUT: "A", PAUT_C: "A", PROFILE_RT: "A", IRIS: "A",
      UT_T: "B", RT: "B",
      PEC: "C",
      VT: "D"
    }
  },
  CREEP: {
    morphology: "subsurface_voiding_cavitation",
    location: "high_temperature_HAZ",
    techniques: {
      REPLICATION: "A", HARDNESS: "B",
      PAUT_TFM: "B", TOFD: "B",
      WFMT: "C", PT: "C",
      VT: "D",
      UT_T: "D"
    },
    note: "Creep damage progresses from voids to fissures to macro-cracks. Replication is gold standard early-stage; PAUT/TOFD picks up later-stage macro-cracking."
  },
  UNDER_DEPOSIT_CORROSION: {
    morphology: "localized_under_deposit",
    location: "internal_low_flow",
    techniques: {
      AUT: "A", PAUT_C: "A", IRIS: "A",
      PROFILE_RT: "B", RT: "B",
      UT_T: "C", PEC: "C",
      VT: "D",
      GWUT: "D"
    },
    note: "Under-deposit corrosion often co-occurs with MIC. Deposits must be characterized to distinguish mechanism."
  },
  CO2_CORROSION: {
    morphology: "mesa_attack_or_flow_induced",
    location: "internal_flow_path",
    techniques: {
      AUT: "A", PAUT_C: "A", PROFILE_RT: "A",
      UT_T: "B", RT: "B", IRIS: "B",
      PEC: "C",
      VT: "D",
      GWUT: "D"
    }
  },
  H2S_CORROSION: {
    morphology: "sulfide_attack_pitting",
    location: "internal",
    techniques: {
      AUT: "A", PAUT_C: "A",
      UT_T: "B", PROFILE_RT: "B", HARDNESS: "B",
      RT: "C",
      VT: "D",
      PT: "E", MT: "E"
    }
  },
  ATMOSPHERIC_CORROSION: {
    morphology: "external_surface_degradation",
    location: "external",
    techniques: {
      VT: "A", UT_T: "A",
      AUT: "B", PAUT_C: "B",
      PROFILE_RT: "C",
      PEC: "C",
      GWUT: "D"
    }
  }
};


// =============================================================================
// SECTION 2 - SUPPORT MAPS
// =============================================================================

var RATING_RANK = { A: 5, B: 4, C: 3, D: 2, E: 1, UNKNOWN: 0 };
var RANK_TO_RATING = { 5: "A", 4: "B", 3: "C", 2: "D", 1: "E", 0: "UNKNOWN" };

var COVERAGE_DOWNGRADE_STEPS = {
  extensive: 0,
  usual: 0,
  partial: 1,
  minimal: 2,
  unknown: 1
};

// Confidence modifier applied to FMD confidence. Negative = reduce confidence.
var RATING_TO_CONFIDENCE_MOD = {
  A: 0.0,
  B: -0.1,
  C: -0.2,
  D: -0.4,
  E: -0.6,
  UNKNOWN: -0.3
};


// =============================================================================
// SECTION 3 - FIELD QUALITY MODIFIER TABLES (v2.0.0)
// =============================================================================
// Each factor maps to a penalty in rating steps (0 = no penalty, positive = downgrade)
// Some factors can provide a bonus (-1 step = upgrade one rank)

// Inspection access quality
var ACCESS_QUALITY_PENALTY = {
  unrestricted: 0,       // full scaffold, open access, ideal
  adequate: 0,           // standard access, minor limitations
  restricted: 1,         // limited reach, rope access, confined space
  severely_restricted: 2, // minimal access, remote only
  unknown: 1
};

// Surface condition at inspection location
var SURFACE_CONDITION_PENALTY = {
  clean_blasted: -1,     // BONUS: Sa 2.5 / NACE SP0290 white metal
  ground_smooth: 0,      // ground weld cap, smooth parent metal
  wire_brushed: 0,       // hand tool cleaned
  light_scale: 1,        // light mill scale or surface oxide
  corroded: 1,           // visible corrosion products
  heavy_scale: 2,        // heavy scale, laminations, severe pitting surface
  as_received: 1,        // no prep performed
  unknown: 1
};

// Temperature at time of inspection (affects coupling, probe performance)
// Returns penalty steps based on temperature in Fahrenheit
function getTemperaturePenalty(tempF) {
  if (tempF === null || tempF === undefined) return 0;
  if (tempF < 32) return 2;    // below freezing - coupling issues, technician limitations
  if (tempF < 50) return 1;    // cold - reduced coupling efficiency
  if (tempF <= 150) return 0;  // optimal range
  if (tempF <= 250) return 0;  // elevated but within standard probe limits
  if (tempF <= 400) return 1;  // high temp probes required, reduced accuracy
  if (tempF <= 600) return 2;  // special high-temp procedures, significant accuracy reduction
  return 3;                     // extreme - most techniques severely compromised
}

// Coating removal (relevant for external inspection)
var COATING_PENALTY = {
  removed: 0,            // coating stripped at inspection points
  partially_removed: 1,  // spot removal only
  not_removed: 2,        // inspected through coating
  not_applicable: 0,     // internal inspection or no coating present
  unknown: 1
};

// Insulation removal (critical for CUI per API 583)
var INSULATION_PENALTY = {
  removed: 0,            // insulation stripped for inspection
  partially_removed: 1,  // window cuts or spot removal
  not_removed: 2,        // inspected through insulation (PEC, IR only credible)
  not_applicable: 0,     // no insulation present
  unknown: 1
};

// Calibration quality
var CALIBRATION_PENALTY = {
  traceable: -1,         // BONUS: NIST-traceable, documented cal block
  verified: 0,           // field-verified on known reference
  field_check: 0,        // basic field check performed
  expired: 1,            // calibration out of date
  not_verified: 2,       // no calibration verification performed
  unknown: 1
};

// Technician certification level per ASNT SNT-TC-1A / ISO 9712
var CERT_LEVEL_PENALTY = {
  Level_III: -1,         // BONUS: Level III directing inspection
  Level_II: 0,           // standard qualified examiner
  Level_I: 1,            // trainee under supervision
  uncertified: 2,        // no formal certification
  unknown: 1
};

// Technique complexity vs cert level cross-check
// Advanced techniques require Level II minimum for credible results
var ADVANCED_TECHNIQUES = {
  PAUT_C: true, PAUT_S: true, PAUT_TFM: true,
  TOFD: true, AUT: true, AUT_TOFD_BACKSCATTER: true,
  VELOCITY_RATIO_UT: true, AET: true, REPLICATION: true,
  PEC: true, GWUT: true, ECT: true, IRIS: true
};

// Scan plan adequacy
var SCAN_PLAN_PENALTY = {
  comprehensive: -1,     // BONUS: engineered scan plan with full coverage map
  adequate: 0,           // standard procedure followed
  partial: 1,            // scan plan covers some but not all critical areas
  ad_hoc: 2,             // no formal scan plan, inspector discretion only
  not_documented: 2,     // scan plan exists but not documented
  unknown: 1
};


// =============================================================================
// SECTION 4 - POD BAND AND FALSE NEGATIVE TABLES (v2.0.0)
// =============================================================================
// Probability of Detection bands mapped from field-adjusted effectiveness rating
// Based on published POD studies and API 581 Table 7.3 guidance
// low = conservative estimate, mid = expected, high = optimistic

var POD_BANDS = {
  A: { low: 0.80, mid: 0.90, high: 0.95 },
  B: { low: 0.60, mid: 0.75, high: 0.85 },
  C: { low: 0.40, mid: 0.55, high: 0.70 },
  D: { low: 0.20, mid: 0.35, high: 0.50 },
  E: { low: 0.05, mid: 0.15, high: 0.30 },
  UNKNOWN: { low: 0.10, mid: 0.25, high: 0.40 }
};

// False negative risk categories
// NEGLIGIBLE = can rely on negative finding
// LOW = acceptable for routine decisions
// MODERATE = supplemental inspection recommended
// HIGH = cannot rely on negative finding
// VERY_HIGH = inspection essentially uninformative

var FALSE_NEGATIVE_THRESHOLDS = {
  A: "NEGLIGIBLE",
  B: "LOW",
  C: "MODERATE",
  D: "HIGH",
  E: "VERY_HIGH",
  UNKNOWN: "HIGH"
};


// =============================================================================
// SECTION 5 - API STANDARDS REFERENCE LAYER (v2.0.0)
// =============================================================================

var STANDARDS_BY_DOMAIN = {
  fixed: {
    primary: [
      { code: "API 510", title: "Pressure Vessel Inspection Code", scope: "In-service inspection of pressure vessels" },
      { code: "API 570", title: "Piping Inspection Code", scope: "In-service inspection of piping systems" },
      { code: "API 653", title: "Tank Inspection Code", scope: "Aboveground storage tank inspection, repair, alteration" }
    ],
    rbi: [
      { code: "API RP 580", title: "Risk-Based Inspection", scope: "RBI program structure and methodology" },
      { code: "API RP 581", title: "RBI Technology", scope: "Quantitative RBI methodology, consequence and probability" }
    ],
    damage: [
      { code: "API RP 571", title: "Damage Mechanisms", scope: "Damage mechanisms affecting fixed equipment in refining" }
    ],
    fitness: [
      { code: "API 579-1/ASME FFS-1", title: "Fitness-for-Service", scope: "FFS assessment for in-service equipment" }
    ],
    corrosion: [
      { code: "API 583", title: "Corrosion Under Insulation", scope: "CUI and corrosion under fireproofing" },
      { code: "API 584", title: "Integrity Operating Windows", scope: "IOW establishment and monitoring" },
      { code: "API RP 651", title: "CP for Aboveground Tanks", scope: "Cathodic protection of tank bottoms" },
      { code: "API RP 652", title: "Tank Bottom Linings", scope: "Lining of aboveground tank bottoms" }
    ],
    pressure_relief: [
      { code: "API 520", title: "PRD Sizing and Selection", scope: "Sizing, selection, installation of pressure-relieving devices" },
      { code: "API 521", title: "Pressure-Relieving Systems", scope: "Pressure-relieving and depressuring systems" },
      { code: "API 576", title: "PRD Inspection", scope: "Inspection of pressure-relieving devices" },
      { code: "API 2000", title: "Venting of Tanks", scope: "Venting atmospheric and low-pressure storage tanks" }
    ]
  },
  pipeline: {
    primary: [
      { code: "API 1160", title: "Pipeline Integrity Management", scope: "Managing system integrity for hazardous liquid pipelines" },
      { code: "API 1173", title: "Pipeline SMS", scope: "Pipeline safety management system framework" }
    ],
    welding: [
      { code: "API 1104", title: "Pipeline Welding", scope: "Welding of pipelines and related facilities" }
    ],
    mechanical: [
      { code: "API 1183", title: "Dent Assessment", scope: "Dent and mechanical damage assessment for pipelines" },
      { code: "API RP 1110", title: "Pressure Testing", scope: "Pressure testing of steel pipelines for integrity" }
    ],
    fitness: [
      { code: "API 579-1/ASME FFS-1", title: "Fitness-for-Service", scope: "FFS assessment applicable to pipeline components" }
    ]
  },
  subsea: {
    primary: [
      { code: "API RP 2A-WSD", title: "Offshore Fixed Platforms", scope: "Planning, designing, constructing fixed offshore platforms" },
      { code: "API RP 2SIM", title: "Structural Integrity Management", scope: "SIM of fixed offshore structures" }
    ],
    subsea_equipment: [
      { code: "API 17D", title: "Subsea Wellhead Equipment", scope: "Subsea wellhead and tree equipment design" },
      { code: "API 17J", title: "Unbonded Flexible Pipe", scope: "Specification for unbonded flexible pipe" },
      { code: "API RP 17B", title: "Flexible Pipe RP", scope: "Recommended practice for flexible pipe" },
      { code: "API RP 17TR8", title: "HPHT Design Guidance", scope: "High pressure high temperature design guidance" }
    ],
    mooring: [
      { code: "API RP 2SK", title: "Mooring Design", scope: "Design and analysis of stationkeeping systems" }
    ]
  },
  floating: {
    primary: [
      { code: "API RP 2SIM", title: "Structural Integrity Management", scope: "SIM for floating structures" },
      { code: "API RP 2A-WSD", title: "Offshore Platforms", scope: "Applicable sections for floating platform design" }
    ],
    mooring: [
      { code: "API RP 2SK", title: "Mooring Design", scope: "Stationkeeping systems for floating structures" }
    ],
    subsea_interface: [
      { code: "API 17D", title: "Subsea Wellhead Equipment", scope: "Interface equipment for floating production" },
      { code: "API 17J", title: "Unbonded Flexible Pipe", scope: "Risers and flowlines for floating production" }
    ]
  },
  marine: {
    primary: [
      { code: "API RP 2SIM", title: "Structural Integrity Management", scope: "SIM applicable to marine vessels" }
    ]
  },
  production: {
    primary: [
      { code: "API 510", title: "Pressure Vessel Inspection Code", scope: "Production pressure vessels" },
      { code: "API 570", title: "Piping Inspection Code", scope: "Production piping" }
    ],
    rbi: [
      { code: "API RP 580", title: "Risk-Based Inspection", scope: "RBI for production equipment" },
      { code: "API RP 581", title: "RBI Technology", scope: "Quantitative RBI for production systems" }
    ],
    damage: [
      { code: "API RP 571", title: "Damage Mechanisms", scope: "Damage mechanisms in production service" }
    ],
    fitness: [
      { code: "API 579-1/ASME FFS-1", title: "Fitness-for-Service", scope: "FFS assessment for production equipment" }
    ]
  }
};

// Damage-mechanism-specific standards that apply regardless of domain
var STANDARDS_BY_DM = {
  CUI: [
    { code: "API 583", title: "Corrosion Under Insulation", relevance: "Primary governing standard for CUI assessment" }
  ],
  HTHA: [
    { code: "API 941", title: "Steels for Hydrogen Service", relevance: "Nelson curves and HTHA screening" }
  ],
  CREEP: [
    { code: "API 579-1 Part 10", title: "FFS - Creep Assessment", relevance: "Remaining life assessment for creep damage" }
  ],
  BRITTLE_FRACTURE: [
    { code: "API 579-1 Part 3", title: "FFS - Brittle Fracture", relevance: "Assessment of brittle fracture risk" }
  ],
  GENERAL_THINNING: [
    { code: "API 579-1 Part 4", title: "FFS - General Metal Loss", relevance: "Remaining strength for general thinning" }
  ],
  LOCALIZED_THINNING: [
    { code: "API 579-1 Part 5", title: "FFS - Local Metal Loss", relevance: "Remaining strength for localized thinning" }
  ],
  MIC: [
    { code: "API RP 571 Section 4.3.8", title: "MIC Damage Mechanism", relevance: "MIC identification, susceptibility, inspection" },
    { code: "NACE SP0488", title: "MIC Internal Monitoring", relevance: "Internal corrosion monitoring for MIC" }
  ],
  HIC: [
    { code: "API 579-1 Part 7", title: "FFS - HIC/SOHIC", relevance: "Assessment of hydrogen-induced cracking" },
    { code: "NACE MR0175/ISO 15156", title: "Sour Service Materials", relevance: "Material requirements for H2S service" }
  ],
  SSC: [
    { code: "NACE MR0175/ISO 15156", title: "Sour Service Materials", relevance: "Sulfide stress cracking prevention and assessment" }
  ],
  CL_SCC: [
    { code: "API 579-1 Part 9", title: "FFS - Crack Assessment", relevance: "Crack-like flaw assessment for SCC" }
  ],
  FATIGUE_CRACKING: [
    { code: "API 579-1 Part 9", title: "FFS - Crack Assessment", relevance: "Fatigue crack growth and remaining life" }
  ],
  EROSION_CORROSION: [
    { code: "API RP 571 Section 4.2.14", title: "Erosion/Erosion-Corrosion", relevance: "Erosion-corrosion damage mechanism description" }
  ]
};

// Equipment-type to primary inspection code mapping
var EQUIPMENT_CODE_MAP = {
  pressure_vessel: "API 510",
  heat_exchanger: "API 510",
  reactor: "API 510",
  column: "API 510",
  drum: "API 510",
  boiler: "API 510",
  piping: "API 570",
  pipe: "API 570",
  small_bore: "API 570",
  tank: "API 653",
  storage_tank: "API 653",
  aboveground_tank: "API 653",
  pipeline: "API 1160",
  flowline: "API 570",
  riser: "API 17J",
  flexible_pipe: "API 17J",
  wellhead: "API 17D",
  tree: "API 17D",
  relief_valve: "API 576",
  PRD: "API 576",
  PSV: "API 576",
  mooring: "API RP 2SK",
  jacket: "API RP 2A-WSD",
  platform: "API RP 2A-WSD",
  topside: "API RP 2A-WSD"
};


// =============================================================================
// SECTION 6 - HELPERS
// =============================================================================

function rankBetter(a, b) {
  return (RATING_RANK[a] || 0) > (RATING_RANK[b] || 0);
}

function downgradeRating(rating, steps) {
  var rank = RATING_RANK[rating] || 0;
  if (rank === 0) return "UNKNOWN";
  var newRank = rank - steps;
  if (newRank < 1) newRank = 1;
  if (newRank > 5) newRank = 5;
  return RANK_TO_RATING[newRank];
}

function applyCoverageDowngrade(rating, coverage) {
  var key = (coverage || "unknown").toLowerCase();
  var steps = COVERAGE_DOWNGRADE_STEPS[key];
  if (steps === undefined) steps = 1;
  return downgradeRating(rating, steps);
}

function findComplementaryTechniques(entry, performed, currentRating) {
  if (!entry || !entry.techniques) return [];
  var performedSet = {};
  for (var i = 0; i < performed.length; i++) {
    performedSet[performed[i]] = true;
  }
  var aList = [];
  var bList = [];
  for (var tech in entry.techniques) {
    if (!entry.techniques.hasOwnProperty(tech)) continue;
    if (performedSet[tech]) continue;
    var r = entry.techniques[tech];
    if (r === "A") aList.push(tech);
    else if (r === "B") bList.push(tech);
  }
  var combined = aList.concat(bList);
  // Recommend if current effectiveness is C or worse
  if (RATING_RANK[currentRating] >= RATING_RANK["B"]) return [];
  if (combined.length > 4) combined = combined.slice(0, 4);
  return combined;
}

function ratingToModifier(rating) {
  var mod = RATING_TO_CONFIDENCE_MOD[rating];
  if (mod === undefined) return -0.3;
  return mod;
}


// =============================================================================
// SECTION 7 - FIELD QUALITY MODIFIER CHAIN (v2.0.0)
// =============================================================================

function applyFieldQualityModifiers(rawRating, input, dmEntry) {
  var penalties = [];
  var totalSteps = 0;

  // 1. Inspection access quality
  var accessKey = (input.inspection_access_quality || "unknown").toLowerCase();
  var accessPenalty = ACCESS_QUALITY_PENALTY[accessKey];
  if (accessPenalty === undefined) accessPenalty = 1;
  if (accessPenalty !== 0) {
    penalties.push({
      factor: "inspection_access_quality",
      value: accessKey,
      steps: accessPenalty,
      reason: accessPenalty > 0
        ? "Restricted access reduces technique effectiveness"
        : "Full access enables optimal technique deployment"
    });
    totalSteps = totalSteps + accessPenalty;
  }

  // 2. Surface condition
  var surfaceKey = (input.surface_condition || "unknown").toLowerCase();
  var surfacePenalty = SURFACE_CONDITION_PENALTY[surfaceKey];
  if (surfacePenalty === undefined) surfacePenalty = 1;
  if (surfacePenalty !== 0) {
    penalties.push({
      factor: "surface_condition",
      value: surfaceKey,
      steps: surfacePenalty,
      reason: surfacePenalty > 0
        ? "Surface condition impairs coupling and signal quality"
        : "Prepared surface enhances detection capability"
    });
    totalSteps = totalSteps + surfacePenalty;
  }

  // 3. Temperature at inspection
  var tempPenalty = getTemperaturePenalty(input.temperature_at_inspection);
  if (tempPenalty !== 0) {
    penalties.push({
      factor: "temperature_at_inspection",
      value: input.temperature_at_inspection + "F",
      steps: tempPenalty,
      reason: "Temperature outside optimal range affects probe performance and coupling"
    });
    totalSteps = totalSteps + tempPenalty;
  }

  // 4. Coating removal (applies to external inspection)
  var coatingKey = (input.coating_removed === true) ? "removed"
    : (input.coating_removed === false) ? "not_removed"
    : (typeof input.coating_removed === "string") ? input.coating_removed.toLowerCase()
    : "unknown";
  // Map boolean-ish values
  if (coatingKey === "true") coatingKey = "removed";
  if (coatingKey === "false") coatingKey = "not_removed";
  if (coatingKey === "partial") coatingKey = "partially_removed";
  var coatingPenalty = COATING_PENALTY[coatingKey];
  if (coatingPenalty === undefined) coatingPenalty = 1;
  // Only apply if damage location is external
  var loc = dmEntry ? dmEntry.location : "";
  var isExternal = loc.indexOf("external") !== -1;
  if (coatingPenalty !== 0 && isExternal) {
    penalties.push({
      factor: "coating_removed",
      value: coatingKey,
      steps: coatingPenalty,
      reason: "Coating not fully removed reduces surface inspection effectiveness"
    });
    totalSteps = totalSteps + coatingPenalty;
  }

  // 5. Insulation removal (critical for CUI per API 583)
  var insulKey = (input.insulation_removed === true) ? "removed"
    : (input.insulation_removed === false) ? "not_removed"
    : (typeof input.insulation_removed === "string") ? input.insulation_removed.toLowerCase()
    : "not_applicable";
  if (insulKey === "true") insulKey = "removed";
  if (insulKey === "false") insulKey = "not_removed";
  if (insulKey === "partial") insulKey = "partially_removed";
  var insulPenalty = INSULATION_PENALTY[insulKey];
  if (insulPenalty === undefined) insulPenalty = 1;
  var isInsulSensitive = dmEntry && dmEntry.insulation_sensitive;
  if (insulPenalty !== 0 && isInsulSensitive) {
    penalties.push({
      factor: "insulation_removed",
      value: insulKey,
      steps: insulPenalty,
      reason: "CUI assessment per API 583 requires insulation removal for credible inspection"
    });
    totalSteps = totalSteps + insulPenalty;
  }

  // 6. Calibration quality
  var calKey = (input.calibration_quality || "unknown").toLowerCase();
  var calPenalty = CALIBRATION_PENALTY[calKey];
  if (calPenalty === undefined) calPenalty = 1;
  if (calPenalty !== 0) {
    penalties.push({
      factor: "calibration_quality",
      value: calKey,
      steps: calPenalty,
      reason: calPenalty > 0
        ? "Calibration not verified reduces measurement confidence"
        : "Traceable calibration enhances measurement confidence"
    });
    totalSteps = totalSteps + calPenalty;
  }

  // 7. Technician certification level
  var certKey = (input.technician_cert_level || "unknown");
  // Normalize common variations
  if (certKey === "III" || certKey === "3" || certKey === "Level III" || certKey === "level_iii") certKey = "Level_III";
  if (certKey === "II" || certKey === "2" || certKey === "Level II" || certKey === "level_ii") certKey = "Level_II";
  if (certKey === "I" || certKey === "1" || certKey === "Level I" || certKey === "level_i") certKey = "Level_I";
  var certPenalty = CERT_LEVEL_PENALTY[certKey];
  if (certPenalty === undefined) certPenalty = 1;
  if (certPenalty !== 0) {
    penalties.push({
      factor: "technician_cert_level",
      value: certKey,
      steps: certPenalty,
      reason: certPenalty > 0
        ? "Technician certification below Level II for this technique"
        : "Level III oversight enhances inspection reliability"
    });
    totalSteps = totalSteps + certPenalty;
  }

  // 7b. Advanced technique + cert level cross-check
  if (input.techniques_performed) {
    var hasAdvanced = false;
    for (var i = 0; i < input.techniques_performed.length; i++) {
      if (ADVANCED_TECHNIQUES[input.techniques_performed[i]]) {
        hasAdvanced = true;
        break;
      }
    }
    if (hasAdvanced && (certKey === "Level_I" || certKey === "uncertified")) {
      penalties.push({
        factor: "advanced_technique_cert_mismatch",
        value: certKey + " performing advanced technique",
        steps: 1,
        reason: "Advanced techniques (PAUT, TOFD, AUT, etc.) require minimum Level II certification for credible results per ASNT SNT-TC-1A"
      });
      totalSteps = totalSteps + 1;
    }
  }

  // 8. Scan plan adequacy
  var scanKey = (input.scan_plan_adequacy || "unknown").toLowerCase();
  var scanPenalty = SCAN_PLAN_PENALTY[scanKey];
  if (scanPenalty === undefined) scanPenalty = 1;
  if (scanPenalty !== 0) {
    penalties.push({
      factor: "scan_plan_adequacy",
      value: scanKey,
      steps: scanPenalty,
      reason: scanPenalty > 0
        ? "Scan plan does not adequately cover critical examination areas"
        : "Comprehensive scan plan with engineered coverage map"
    });
    totalSteps = totalSteps + scanPenalty;
  }

  // Apply total penalty (bonuses can offset penalties but never exceed A)
  var adjustedRating = downgradeRating(rawRating, totalSteps);

  return {
    adjusted_rating: adjustedRating,
    penalties_applied: penalties,
    total_penalty_steps: totalSteps,
    raw_rating: rawRating
  };
}


// =============================================================================
// SECTION 8 - POD, FALSE NEGATIVE, AND DISPOSITION (v2.0.0)
// =============================================================================

function computePOD(fieldAdjustedRating) {
  var band = POD_BANDS[fieldAdjustedRating];
  if (!band) band = POD_BANDS["UNKNOWN"];
  return {
    low: band.low,
    mid: band.mid,
    high: band.high,
    rating_basis: fieldAdjustedRating
  };
}

function computeFalseNegativeRisk(fieldAdjustedRating) {
  var risk = FALSE_NEGATIVE_THRESHOLDS[fieldAdjustedRating];
  if (!risk) risk = "HIGH";
  return risk;
}

function evaluateDisposition(fieldAdjustedRating, falseNegativeRisk, input, dmEntry) {
  var blockers = [];
  var canDispose = true;

  // 1. Effectiveness must be B or better
  if (RATING_RANK[fieldAdjustedRating] < RATING_RANK["B"]) {
    canDispose = false;
    blockers.push("Field-adjusted effectiveness (" + fieldAdjustedRating + ") is below B threshold required for disposition");
  }

  // 2. False negative risk must be LOW or NEGLIGIBLE
  if (falseNegativeRisk !== "NEGLIGIBLE" && falseNegativeRisk !== "LOW") {
    canDispose = false;
    blockers.push("False negative risk (" + falseNegativeRisk + ") too high for final disposition");
  }

  // 3. Scan plan must be adequate or better
  var scanKey = (input.scan_plan_adequacy || "unknown").toLowerCase();
  if (scanKey === "ad_hoc" || scanKey === "not_documented" || scanKey === "unknown") {
    canDispose = false;
    blockers.push("Scan plan (" + scanKey + ") insufficient to support disposition - requires documented adequate or comprehensive plan");
  }

  // 4. Technician cert level must be Level II or better
  var certKey = (input.technician_cert_level || "unknown");
  if (certKey === "III" || certKey === "3" || certKey === "Level III" || certKey === "level_iii") certKey = "Level_III";
  if (certKey === "II" || certKey === "2" || certKey === "Level II" || certKey === "level_ii") certKey = "Level_II";
  if (certKey === "I" || certKey === "1" || certKey === "Level I" || certKey === "level_i") certKey = "Level_I";
  if (certKey !== "Level_III" && certKey !== "Level_II") {
    canDispose = false;
    blockers.push("Technician certification (" + certKey + ") below Level II minimum for disposition authority");
  }

  // 5. Calibration must be verified or traceable
  var calKey = (input.calibration_quality || "unknown").toLowerCase();
  if (calKey !== "traceable" && calKey !== "verified") {
    canDispose = false;
    blockers.push("Calibration quality (" + calKey + ") does not meet verification requirements for disposition");
  }

  // 6. For CUI, insulation must be removed
  if (dmEntry && dmEntry.insulation_sensitive) {
    var insulKey = (input.insulation_removed === true) ? "removed"
      : (input.insulation_removed === false) ? "not_removed"
      : (typeof input.insulation_removed === "string") ? input.insulation_removed.toLowerCase()
      : "not_applicable";
    if (insulKey === "true") insulKey = "removed";
    if (insulKey === "false") insulKey = "not_removed";
    if (insulKey !== "removed") {
      canDispose = false;
      blockers.push("CUI assessment requires full insulation removal for disposition per API 583");
    }
  }

  // 7. HTHA special rule - no single technique is A-rated
  if (input.damage_mechanism === "HTHA") {
    // HTHA requires multi-technique confirmation
    var techCount = (input.techniques_performed || []).length;
    if (techCount < 2) {
      canDispose = false;
      blockers.push("HTHA requires multi-technique strategy per API 941/581 - single technique insufficient for disposition");
    }
  }

  return {
    can_support_final_disposition: canDispose,
    disposition_blockers: blockers
  };
}


// =============================================================================
// SECTION 9 - STANDARDS RESOLVER (v2.0.0)
// =============================================================================

function resolveApplicableStandards(domain, equipmentType, damageMechanism) {
  var standards = [];
  var seen = {};

  function addStandard(std, category) {
    var key = std.code;
    if (seen[key]) return;
    seen[key] = true;
    standards.push({
      code: std.code,
      title: std.title,
      category: category,
      scope: std.scope || std.relevance || ""
    });
  }

  // 1. Domain-level standards
  var domainStds = STANDARDS_BY_DOMAIN[domain];
  if (domainStds) {
    for (var cat in domainStds) {
      if (!domainStds.hasOwnProperty(cat)) continue;
      var arr = domainStds[cat];
      for (var i = 0; i < arr.length; i++) {
        addStandard(arr[i], cat);
      }
    }
  }

  // 2. Equipment-type primary code
  if (equipmentType) {
    var eqCode = EQUIPMENT_CODE_MAP[equipmentType.toLowerCase()];
    if (eqCode) {
      addStandard({ code: eqCode, title: "Primary Inspection Code", scope: "Governing inspection code for " + equipmentType }, "equipment_primary");
    }
  }

  // 3. Damage-mechanism-specific standards
  if (damageMechanism) {
    var dmStds = STANDARDS_BY_DM[damageMechanism];
    if (dmStds) {
      for (var j = 0; j < dmStds.length; j++) {
        addStandard(dmStds[j], "damage_mechanism");
      }
    }
  }

  // 4. Always include 581 for effectiveness context
  addStandard({ code: "API RP 581", title: "RBI Technology", scope: "Inspection effectiveness classification basis (Annex 2.C)" }, "effectiveness_basis");

  return standards;
}


// =============================================================================
// SECTION 10 - RATIONALE BUILDER
// =============================================================================

function buildRationale(dm, bestTech, rawRating, adjustedRating, coverage, dmInTable, fieldResult) {
  if (!dmInTable) {
    return "Damage mechanism " + dm + " is not present in the effectiveness table. Effectiveness cannot be classified deterministically.";
  }

  var parts = [];

  // Base technique rating
  if (!bestTech) {
    parts.push("No techniques performed are rated for " + dm + " in API 581 Annex 2.C");
  } else {
    parts.push("Best technique (" + bestTech + ") is rated " + rawRating + " for " + dm + " per API 581 Annex 2.C");
  }

  // Coverage adjustment
  if (rawRating !== adjustedRating) {
    parts.push("Coverage (" + (coverage || "unknown") + ") and field conditions adjusted rating to " + adjustedRating);
  }

  // Field penalty summary
  if (fieldResult && fieldResult.total_penalty_steps !== 0) {
    var penaltyCount = fieldResult.penalties_applied.length;
    parts.push(penaltyCount + " field quality factor" + (penaltyCount > 1 ? "s" : "") + " applied (" + fieldResult.total_penalty_steps + " net step" + (Math.abs(fieldResult.total_penalty_steps) > 1 ? "s" : "") + ")");
  }

  // Interpretation
  if (adjustedRating === "D" || adjustedRating === "E") {
    parts.push("Inspection coverage insufficient for credible damage assessment - complementary NDE required");
  } else if (adjustedRating === "C") {
    parts.push("Detection is fairly effective but not authoritative - complementary NDE recommended for confirmation");
  } else if (adjustedRating === "A") {
    parts.push("Inspection highly effective for this damage mechanism under current field conditions");
  }

  return parts.join(". ") + ".";
}

function setAuthorityFlag(rating, dmInTable, canDispose) {
  if (!dmInTable) return "DM_NOT_IN_TABLE";
  if (rating === "E") return "INSPECTION_INEFFECTIVE";
  if (rating === "D") return "INSPECTION_MISMATCH";
  if (rating === "C") return "INSPECTION_MARGINAL";
  if (!canDispose && (rating === "A" || rating === "B")) return "DISPOSITION_BLOCKED";
  return null;
}


// =============================================================================
// SECTION 11 - CORE CLASSIFIER (v2.0.0)
// =============================================================================

function classifyEffectiveness(input) {
  var dm = input && input.damage_mechanism ? input.damage_mechanism : "";
  var techniques = input && input.techniques_performed ? input.techniques_performed : [];
  var coverage = input && input.coverage ? input.coverage : "unknown";
  var domain = input && input.domain ? input.domain : "fixed";
  var equipmentType = input && input.equipment_type ? input.equipment_type : "";

  var entry = EFFECTIVENESS_TABLE[dm];
  var dmInTable = !!entry;

  // Resolve applicable standards regardless of DM table match
  var applicableStandards = resolveApplicableStandards(domain, equipmentType, dm);

  if (!dmInTable) {
    return {
      effectiveness_rating: "UNKNOWN",
      raw_rating: "UNKNOWN",
      field_adjusted_rating: "UNKNOWN",
      confidence_modifier: ratingToModifier("UNKNOWN"),
      rating_basis: buildRationale(dm, null, "UNKNOWN", "UNKNOWN", coverage, false, null),
      field_penalties_applied: [],
      probability_of_detection_band: computePOD("UNKNOWN"),
      false_negative_risk: computeFalseNegativeRisk("UNKNOWN"),
      can_support_final_disposition: false,
      disposition_blockers: ["Damage mechanism " + dm + " not in effectiveness table - cannot classify"],
      complementary_required: [],
      authority_flag: setAuthorityFlag("UNKNOWN", false, false),
      applicable_standards: applicableStandards,
      best_technique_used: null,
      dm_in_table: false,
      version: "v2.0.0"
    };
  }

  // Step 1: best raw rating among techniques performed
  var bestRating = "E";
  var bestTechnique = null;
  for (var i = 0; i < techniques.length; i++) {
    var t = techniques[i];
    var r = entry.techniques[t];
    if (r && rankBetter(r, bestRating)) {
      bestRating = r;
      bestTechnique = t;
    }
  }
  if (!bestTechnique) {
    bestRating = "E";
  }

  // Step 2: coverage downgrade
  var afterCoverage = applyCoverageDowngrade(bestRating, coverage);

  // Step 3: field quality modifier chain (v2.0.0)
  var fieldResult = applyFieldQualityModifiers(afterCoverage, input, entry);
  var fieldAdjusted = fieldResult.adjusted_rating;

  // Step 4: POD band and false negative risk (v2.0.0)
  var podBand = computePOD(fieldAdjusted);
  var falseNegRisk = computeFalseNegativeRisk(fieldAdjusted);

  // Step 5: disposition evaluation (v2.0.0)
  var disposition = evaluateDisposition(fieldAdjusted, falseNegRisk, input, entry);

  // Step 6: complementary recommendations
  var complementary = findComplementaryTechniques(entry, techniques, fieldAdjusted);

  // Step 7: authority flag
  var flag = setAuthorityFlag(fieldAdjusted, true, disposition.can_support_final_disposition);

  // Step 8: rationale
  var rationale = buildRationale(dm, bestTechnique, bestRating, fieldAdjusted, coverage, true, fieldResult);

  return {
    effectiveness_rating: fieldAdjusted,
    raw_rating: bestRating,
    field_adjusted_rating: fieldAdjusted,
    confidence_modifier: ratingToModifier(fieldAdjusted),
    rating_basis: rationale,
    field_penalties_applied: fieldResult.penalties_applied,
    probability_of_detection_band: podBand,
    false_negative_risk: falseNegRisk,
    can_support_final_disposition: disposition.can_support_final_disposition,
    disposition_blockers: disposition.disposition_blockers,
    complementary_required: complementary,
    authority_flag: flag,
    applicable_standards: applicableStandards,
    best_technique_used: bestTechnique,
    dm_in_table: true,
    version: "v2.0.0"
  };
}


// =============================================================================
// SECTION 12 - NETLIFY HANDLER
// =============================================================================

var handler = async function(event) {
  "use strict";

  var headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: headers,
      body: JSON.stringify({ error: "Method not allowed. Use POST." })
    };
  }

  var input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers: headers,
      body: JSON.stringify({ error: "Invalid JSON body", detail: e.message })
    };
  }

  if (!input.damage_mechanism) {
    return {
      statusCode: 400,
      headers: headers,
      body: JSON.stringify({ error: "Missing required field: damage_mechanism" })
    };
  }

  if (!input.techniques_performed || !(input.techniques_performed instanceof Array)) {
    return {
      statusCode: 400,
      headers: headers,
      body: JSON.stringify({ error: "Missing or invalid techniques_performed (must be an array)" })
    };
  }

  var result;
  try {
    result = classifyEffectiveness(input);
  } catch (e) {
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: "Classifier exception", detail: e.message })
    };
  }

  return {
    statusCode: 200,
    headers: headers,
    body: JSON.stringify(result)
  };
};

module.exports = { handler: handler };

// Export internals for unit testing / regression suite
module.exports._internal = {
  classifyEffectiveness: classifyEffectiveness,
  EFFECTIVENESS_TABLE: EFFECTIVENESS_TABLE,
  STANDARDS_BY_DOMAIN: STANDARDS_BY_DOMAIN,
  STANDARDS_BY_DM: STANDARDS_BY_DM,
  EQUIPMENT_CODE_MAP: EQUIPMENT_CODE_MAP,
  rankBetter: rankBetter,
  downgradeRating: downgradeRating,
  applyCoverageDowngrade: applyCoverageDowngrade,
  applyFieldQualityModifiers: applyFieldQualityModifiers,
  computePOD: computePOD,
  computeFalseNegativeRisk: computeFalseNegativeRisk,
  evaluateDisposition: evaluateDisposition,
  resolveApplicableStandards: resolveApplicableStandards,
  findComplementaryTechniques: findComplementaryTechniques,
  ratingToModifier: ratingToModifier
};
