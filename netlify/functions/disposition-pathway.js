// ============================================================================
// DEPLOY180 - DISPOSITION PATHWAY ENGINE v1.2
// File: netlify/functions/disposition-pathway.js
// NO TYPESCRIPT - PURE JAVASCRIPT - NO TEMPLATE LITERALS - var ONLY
// ============================================================================
//
// DEPLOY180: Consequence undetermined gate -- when decision-core reports
//   consequence_undetermined=true on HIGH/CRITICAL assets, disposition holds
//   for engineering review. The engine cannot issue a disposition when it does
//   not know what the consequences of failure are.
//
// DEPLOY176 SCOPE (per locked config):
//   1. HARD CONFIDENCE GATE
//      IF consequence_tier IN (HIGH, CRITICAL) AND reality_confidence_overall < 0.60
//      -> disposition = HOLD_FOR_INPUT_ENFORCEMENT
//      Runs as Tier 1.75 (after active physical emergencies, before routine).
//
//   2. HOLD_FOR_INPUT_ENFORCEMENT disposition mode (PROVISIONAL model)
//      Per locked config: failure narrative, contradiction matrix, mechanism
//      hypotheses remain VISIBLE. Final disposition + inspector action card
//      are BLOCKED. Frontend handles render-time PROVISIONAL banner.
//      DPR emits: empty actions[], required_evidence_ledger,
//      required_inspection_plan, enforcement_metadata.
//
//   3. MECHANISM_EVIDENCE_CONTRACT
//      Static universal table keyed by decision-core mechanism IDs.
//      All 17 MECH_DEFS covered (no subset). Each entry lists confirmation
//      evidence, rule-out evidence, severity quantifiers.
//
//   4. MECHANISM_METHOD_MAP
//      Static universal table keyed by decision-core mechanism IDs.
//      All 17 MECH_DEFS covered. Each entry lists mechanism-specific NDE
//      methods with physics basis - NOT generic "add PAUT + UT".
//
//   5. STRUCTURAL ESCALATION PATH
//      IF fmd.structural_path.active === true AND capacity_loss_state !== "none"
//      -> disposition = IMMEDIATE_STRUCTURAL_INTEGRITY_REVIEW
//      Runs as Tier 1.5 (after active physical emergencies, BEFORE the
//      confidence gate, because confirmed structural instability is a
//      stronger signal than generic evidence insufficiency).
//
// LOCKED CONFIG:
//   - Threshold: 0.60 on HIGH + CRITICAL only (ELEVATED not included)
//   - Decision-core internal gate stays at 0.58 (intentional asymmetry:
//     detect early at 0.58, decide carefully at 0.60)
//   - Report mode: PROVISIONAL - reasoning visible, disposition blocked
//   - Coverage: all 17 MECH_DEFS mechanisms, no subset
//
// FRONTEND COORDINATION:
//   v16.6l still sends the v1.0 fields. v1.1 accepts new optional fields:
//   - reality_confidence_overall (number 0-1)
//   - structural_path (object from fmd.structural_path)
//   - validated_mechanisms (array from damage_reality.validated_mechanisms)
//   All three default to null-safe values and gate logic degrades gracefully.
//   Safe to deploy BEFORE frontend patch (zero regression on current frontend).
//
// CARRIES FORWARD ALL v1.0 BEHAVIOR:
//   - Tier 1 IMMEDIATE_ACTION (EXCEEDS envelope, brittle fracture)
//   - Tier 2 HOLD_FOR_DATA (unknown reality state)
//   - Tier 3 MARGINAL envelope branches (cracking + corrosion paths)
//   - Tier 4 WITHIN envelope branches (cracking + interaction + standard)
//   - Fallback ENGINEERING_ASSESSMENT
//   - Consequence modifier (CRITICAL urgency bump)
//   - Low confidence modifier (CONTINUE_SERVICE -> MONITOR upgrade)
// ============================================================================

var handler = async function(event) {
  "use strict";

  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");

    // ========================================================================
    // DEPLOY171.7: DOMAIN REFUSAL SHORT-CIRCUIT
    // ========================================================================
    var domainRefused = false;
    if (body.domain_not_supported === true) { domainRefused = true; }
    if (body.decision_core && body.decision_core.domain_not_supported === true) { domainRefused = true; }
    if (domainRefused) {
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          domain_not_supported: true,
          refusal_reason: "Upstream decision-core refused this asset domain. Disposition pathway not evaluated.",
          pathway: "DOMAIN_NOT_SUPPORTED",
          pathway_basis: "Asset class outside supported domain set. No disposition logic executed.",
          disposition: "domain_not_supported",
          conditions: [],
          required_actions: [],
          pressure_reduction: null,
          monitoring_plan: null,
          engine_version: "disposition-pathway-v1.0-deploy174"
        })
      };
    }

    // v1.0 fields
    var safeEnvelope = (body.safe_envelope || "").toUpperCase().trim();
    var governingMode = (body.governing_failure_mode || "").toUpperCase().trim();
    var governingSeverity = (body.governing_severity || "").toUpperCase().trim();
    var realityState = (body.reality_state || "").toUpperCase().trim();
    var dispositionBlocked = body.disposition_blocked || false;
    var interactionFlag = body.interaction_flag || false;
    var interactionType = (body.interaction_type || "").toUpperCase().trim();
    var brittleFractureRisk = body.brittle_fracture_risk || false;
    var wallLossPercent = body.wall_loss_percent || 0;
    var operatingRatio = body.operating_ratio || 0;
    var pressureReductionRequired = body.pressure_reduction_required || 0;
    var hasCracking = body.has_cracking || false;
    var confidenceBand = (body.confidence_band || "").toUpperCase().trim();
    var consequenceTier = (body.consequence_tier || "").toUpperCase().trim();

    // DEPLOY176 NEW FIELDS (all optional, null-safe)
    var realityConfidenceOverall = typeof body.reality_confidence_overall === "number" ? body.reality_confidence_overall : null;
    var structuralPath = body.structural_path || null;
    var validatedMechanisms = body.validated_mechanisms || [];

    // DEPLOY174: INDETERMINATE MECHANISM ESCALATION INPUT
    var indeterminateMechanisms = body.indeterminate_mechanisms || [];
    var indeterminateCount = indeterminateMechanisms.length;
    var hasHighSeverityIndeterminate = false;
    for (var imi = 0; imi < indeterminateMechanisms.length; imi++) {
      var imSev = (indeterminateMechanisms[imi].severity || "").toLowerCase();
      if (imSev === "critical" || imSev === "high") { hasHighSeverityIndeterminate = true; break; }
    }

    // DEPLOY180: CONSEQUENCE UNDETERMINED INPUT
    var consequenceUndetermined = body.consequence_undetermined || false;
    var undeterminedImpacts = body.undetermined_impacts || [];

    // ====================================================================
    // DEPLOY176: MECHANISM_EVIDENCE_CONTRACT
    // Keyed by decision-core MECH_DEFS IDs. All 17 mechanisms covered.
    // ====================================================================

    var MECHANISM_EVIDENCE_CONTRACT = {

      "fatigue_mechanical": {
        mechanism_name: "Mechanical Fatigue",
        confirmation_evidence: [
          "Crack morphology characterization (transgranular, beachmark features)",
          "Crack location correlated with stress concentration (weld toe, nozzle, geometric transition)",
          "Stress cycle history (number of cycles, stress range in ksi)",
          "Fractographic evidence of progressive cycle-by-cycle growth"
        ],
        rule_out_evidence: [
          "Crack morphology shows branching (suggests SCC, not fatigue)",
          "No cyclic loading source identified in service history",
          "Alternative mechanism explains observed location and morphology"
        ],
        severity_quantifiers: [
          "Crack length (inches)",
          "Crack through-wall depth (inches)",
          "Applied stress range delta sigma (ksi)",
          "Cycles per day or per operating event"
        ]
      },

      "fatigue_thermal": {
        mechanism_name: "Thermal Fatigue",
        confirmation_evidence: [
          "Thermal cycle history (startup/shutdown count, transient events)",
          "Crack at thermal restraint location (support, guide, fixed anchor)",
          "Temperature differential across component during cycle",
          "Surface crack network morphology at restraint points"
        ],
        rule_out_evidence: [
          "No thermal cycling in service history",
          "Cracks not associated with restraint or thermal gradient locations",
          "Isothermal operation confirmed"
        ],
        severity_quantifiers: [
          "Temperature differential delta T (F)",
          "Cycle count (number of thermal transients)",
          "Crack depth at deepest indication (inches)",
          "Material thermal expansion coefficient + restraint condition"
        ]
      },

      "fatigue_vibration": {
        mechanism_name: "Vibration Fatigue",
        confirmation_evidence: [
          "Vibration measurement (velocity or acceleration) at or near resonance",
          "Crack at stress concentration in vibrating span",
          "Cycle accumulation rate from vibration frequency"
        ],
        rule_out_evidence: [
          "Vibration below fatigue endurance threshold",
          "No crack at predicted high-stress node location",
          "Dynamic analysis shows component below resonance"
        ],
        severity_quantifiers: [
          "Vibration velocity (in/sec peak)",
          "Dominant frequency (Hz)",
          "Estimated cycles per day",
          "Stress amplitude from modal analysis (ksi)"
        ]
      },

      "general_corrosion": {
        mechanism_name: "General Corrosion",
        confirmation_evidence: [
          "UT grid thickness survey at critical measurement locations (CMLs)",
          "Historical thickness readings showing progressive thinning",
          "Corrosion rate calculation (mils per year) from nominal and current readings",
          "Operating environment chemistry confirmed corrosive"
        ],
        rule_out_evidence: [
          "Stable thickness over multiple inspection cycles",
          "Non-corrosive environment confirmed",
          "Observed loss pattern is localized (points to pitting or erosion instead)"
        ],
        severity_quantifiers: [
          "Nominal wall thickness (inches)",
          "Current minimum wall thickness (inches)",
          "Wall loss percentage",
          "Corrosion rate (mpy) from short-term and long-term history"
        ]
      },

      "pitting": {
        mechanism_name: "Pitting Corrosion",
        confirmation_evidence: [
          "Visual + pit gauge measurement of pit depth and density",
          "Coating breakdown or paint damage correlated with pit locations",
          "Localized corrosive agent (chlorides, CO2) in water phase",
          "PAUT or profile UT characterization of pit cluster depth"
        ],
        rule_out_evidence: [
          "Loss pattern is uniform (general corrosion instead)",
          "No localized corrosive agent present",
          "Surface appearance shows mechanical damage, not corrosion"
        ],
        severity_quantifiers: [
          "Maximum pit depth (inches)",
          "Pit density (pits per square foot)",
          "Remaining ligament thickness (inches)",
          "Ratio of pit depth to wall thickness"
        ]
      },

      "scc_chloride": {
        mechanism_name: "Chloride Stress Corrosion Cracking",
        confirmation_evidence: [
          "Branching crack morphology characteristic of SCC (metallographic)",
          "Material is austenitic stainless or duplex (susceptible)",
          "Chloride presence confirmed in process or external environment",
          "Surface tensile stress confirmed (residual or applied)"
        ],
        rule_out_evidence: [
          "Material is carbon steel or ferritic (not susceptible)",
          "Chloride-free environment confirmed",
          "Crack morphology is linear, not branching (fatigue or mechanical)"
        ],
        severity_quantifiers: [
          "Crack depth and length (inches)",
          "Chloride concentration (ppm) in contact medium",
          "Operating temperature (critical above 140F for austenitic)",
          "Material grade and sensitization state"
        ]
      },

      "scc_caustic": {
        mechanism_name: "Caustic Stress Corrosion Cracking",
        confirmation_evidence: [
          "Intergranular crack morphology (metallographic replica)",
          "Caustic (NaOH) or amine exposure confirmed",
          "Tensile stress in crack region",
          "Operating temperature in caustic embrittlement range"
        ],
        rule_out_evidence: [
          "No caustic or amine exposure",
          "Transgranular morphology (fatigue or chloride SCC instead)",
          "Temperature below caustic embrittlement threshold"
        ],
        severity_quantifiers: [
          "Crack depth (inches)",
          "Caustic concentration (weight percent NaOH)",
          "Operating temperature (F)",
          "Residual stress state at weld HAZ"
        ]
      },

      "ssc_sulfide": {
        mechanism_name: "Sulfide Stress Cracking",
        confirmation_evidence: [
          "Hardness survey of base metal and weld HAZ (NACE MR0175 limits)",
          "H2S partial pressure in service fluid",
          "Material grade verification against NACE MR0175 / ISO 15156",
          "Crack location at hardened weld HAZ or cold-worked zone"
        ],
        rule_out_evidence: [
          "Hardness below NACE MR0175 limit (22 HRC equivalent)",
          "H2S partial pressure below NACE threshold (0.05 psia)",
          "Material is NACE-compliant across full scope"
        ],
        severity_quantifiers: [
          "Hardness maximum (HRC or Vickers) at base metal, HAZ, weld",
          "H2S partial pressure (psia)",
          "Water phase pH",
          "Crack depth and orientation (inches)"
        ]
      },

      "hic": {
        mechanism_name: "Hydrogen Induced Cracking",
        confirmation_evidence: [
          "Stepwise internal crack morphology on metallographic section",
          "Through-wall or straight beam UT showing mid-wall cracking",
          "H2S exposure history and wet sour service confirmation",
          "Base material susceptibility (high sulfur, high manganese, inclusions)"
        ],
        rule_out_evidence: [
          "HIC-resistant material confirmed (low sulfur, clean steel)",
          "Dry H2S service (no aqueous phase)",
          "No internal cracks on volumetric inspection"
        ],
        severity_quantifiers: [
          "Crack length ratio (CLR per NACE TM0284)",
          "Crack thickness ratio (CTR)",
          "Crack sensitivity ratio (CSR)",
          "H2S exposure duration (years)"
        ]
      },

      "co2_corrosion": {
        mechanism_name: "CO2 (Sweet) Corrosion",
        confirmation_evidence: [
          "UT grid at bottom-of-line and flow transition points",
          "Water phase + CO2 partial pressure confirmed",
          "Operating temperature in corrosion susceptibility range",
          "Characteristic mesa attack or localized thinning pattern"
        ],
        rule_out_evidence: [
          "No water phase (dry gas service)",
          "CO2 partial pressure below corrosion threshold",
          "Corrosion-resistant alloy in service"
        ],
        severity_quantifiers: [
          "CO2 partial pressure (psia)",
          "Water cut (percent)",
          "Operating temperature (F)",
          "Current minimum wall thickness (inches)"
        ]
      },

      "creep": {
        mechanism_name: "Creep Damage",
        confirmation_evidence: [
          "Metallographic replication scored on Neubauer scale (A/B/C/D/E)",
          "Hardness reduction mapping vs original specification",
          "Documented time at temperature within creep range",
          "Sustained tensile stress confirmed in component",
          "Dimensional survey showing permanent distortion or swelling"
        ],
        rule_out_evidence: [
          "Operating temperature below material creep threshold",
          "Short duration at elevated temperature (fire event, not creep)",
          "Hardness and microstructure unchanged from original"
        ],
        severity_quantifiers: [
          "Cumulative time at temperature (hours) vs Larson-Miller parameter",
          "Applied stress (ksi) vs rupture allowable",
          "Replication grade (Neubauer A through E)",
          "Hardness reduction (percent from original)"
        ]
      },

      "brittle_fracture": {
        mechanism_name: "Brittle Fracture",
        confirmation_evidence: [
          "Operating temperature below material MDMT (minimum design metal temperature)",
          "Charpy V-notch data showing insufficient toughness at operating temperature",
          "Pre-existing flaw detected by NDE",
          "Applied stress above critical value per fracture mechanics"
        ],
        rule_out_evidence: [
          "Operating temperature above MDMT with margin",
          "Material toughness confirmed adequate (CVN data)",
          "No flaws detected by volumetric inspection",
          "Upper-shelf behavior confirmed at service temperature"
        ],
        severity_quantifiers: [
          "Operating temperature vs MDMT (delta F)",
          "Charpy energy at service temperature (ft-lb)",
          "Detected flaw size (inches)",
          "Applied stress intensity (ksi sqrt in) vs material KIC"
        ]
      },

      "erosion": {
        mechanism_name: "Erosion / Erosion-Corrosion",
        confirmation_evidence: [
          "UT thickness mapping at elbows, tees, and flow transitions",
          "Flow velocity calculation vs erosional threshold (API RP 14E)",
          "Characteristic directional wear pattern (horseshoe, grooved)",
          "Solids or droplet presence in flow stream"
        ],
        rule_out_evidence: [
          "Flow velocity well below erosional velocity",
          "Wall loss pattern not directional (general corrosion instead)",
          "Clean single-phase flow without solids or droplets"
        ],
        severity_quantifiers: [
          "Actual flow velocity (ft/sec)",
          "Erosional velocity threshold C factor (API RP 14E)",
          "Solids loading (ppm or pounds per barrel)",
          "Minimum wall thickness at eroded zone (inches)"
        ]
      },

      "overload_buckling": {
        mechanism_name: "Mechanical Overload / Buckling",
        confirmation_evidence: [
          "Dimensional survey documenting permanent deformation",
          "Impact event or overpressure event in service history",
          "Visible distortion, denting, or out-of-round at affected location",
          "Applied stress exceeded yield or buckling critical load"
        ],
        rule_out_evidence: [
          "No deformation detected on dimensional check",
          "No overload or impact event documented",
          "Applied loads below yield capacity with margin"
        ],
        severity_quantifiers: [
          "Deformation magnitude (inches out of design)",
          "Ovality percentage at round sections",
          "Applied stress (ksi) vs yield strength",
          "Residual stress state post-event"
        ]
      },

      "fire_damage": {
        mechanism_name: "Fire / Thermal Damage",
        confirmation_evidence: [
          "Hardness mapping per API 579 Part 11 (post-fire FFS)",
          "Metallographic examination of grain structure and phase transformation",
          "Peak temperature estimation from paint char, metal color, adjacent damage",
          "Fire duration documented from incident report",
          "PMI (Positive Material Identification) to verify alloy not altered"
        ],
        rule_out_evidence: [
          "No fire event documented",
          "Hardness and microstructure unchanged from original",
          "Peak temperature below material threshold (typically 800F for CS)"
        ],
        severity_quantifiers: [
          "Peak temperature estimate (F)",
          "Duration at peak temperature (minutes)",
          "Hardness change vs original specification",
          "Heat zone classification per API 579 Part 11 (Zone I-IV)"
        ]
      },

      "cui": {
        mechanism_name: "Corrosion Under Insulation",
        confirmation_evidence: [
          "Insulation strip-back + visual + UT at suspect zones",
          "Wet or damaged insulation jacket confirmed",
          "Operating temperature within CUI susceptibility range (0-350F)",
          "Profile UT or pulsed eddy current screening showing wall loss",
          "Corrosion products visible on external surface under insulation"
        ],
        rule_out_evidence: [
          "Intact insulation jacket with no moisture ingress",
          "Operating temperature outside CUI range (above 350F continuously)",
          "No wall loss on screening or verification UT"
        ],
        severity_quantifiers: [
          "Wall loss percentage at affected zone",
          "Extent of affected area (square feet)",
          "Remaining wall thickness (inches)",
          "Estimated duration of moisture ingress (years)"
        ]
      },

      "hydrogen_damage": {
        mechanism_name: "High Temperature Hydrogen Attack (HTHA)",
        confirmation_evidence: [
          "Nelson Curve operating point check (API 941)",
          "Advanced UT backscatter attenuation or velocity ratio technique",
          "Metallographic replication per API 941 Appendix B",
          "Time at temperature and hydrogen partial pressure history",
          "Fissuring or decarburization detected at internal surface"
        ],
        rule_out_evidence: [
          "Operating point below Nelson Curve with margin",
          "Material upgrade confirmed (2.25Cr-1Mo or higher)",
          "No fissuring detected on metallographic examination"
        ],
        severity_quantifiers: [
          "Hydrogen partial pressure (psia)",
          "Operating temperature (F)",
          "Time at temperature (years)",
          "Nelson Curve position (delta F below curve)",
          "Fissure depth if detected (inches)"
        ]
      }

    };

    // ====================================================================
    // DEPLOY176: MECHANISM_METHOD_MAP
    // Keyed by decision-core MECH_DEFS IDs. All 17 mechanisms covered.
    // Mechanism-specific NDE - NOT generic "add PAUT + UT".
    // ====================================================================

    var MECHANISM_METHOD_MAP = {

      "fatigue_mechanical": {
        mechanism_name: "Mechanical Fatigue",
        required_methods: [
          {
            method: "PAUT sectorial scan at stress concentrations",
            physics_basis: "Multi-angle beam steering detects planar cracks at weld toes and nozzle junctions regardless of orientation"
          },
          {
            method: "TOFD for crack depth sizing",
            physics_basis: "Diffracted wave timing provides high-accuracy through-wall depth measurement needed for Paris Law remaining life calculation"
          },
          {
            method: "MT (wet fluorescent) at surface at weld toes",
            physics_basis: "Magnetic flux leakage detects surface-breaking cracks at the most probable initiation sites"
          }
        ]
      },

      "fatigue_thermal": {
        mechanism_name: "Thermal Fatigue",
        required_methods: [
          {
            method: "TOFD depth sizing at thermal restraint points",
            physics_basis: "Thermal fatigue cracks initiate at restraint zones; accurate depth sizing required for fracture mechanics assessment"
          },
          {
            method: "PT (visible dye) at surface crack network zones",
            physics_basis: "Capillary action reveals surface crack networks characteristic of thermal fatigue"
          },
          {
            method: "PAUT sectorial scan at branch connections and nozzle HAZ",
            physics_basis: "Beam steering scans stress concentrations where thermal gradients create peak stress"
          }
        ]
      },

      "fatigue_vibration": {
        mechanism_name: "Vibration Fatigue",
        required_methods: [
          {
            method: "Vibration measurement + modal analysis",
            physics_basis: "Quantifies actual cycle rate and stress amplitude needed for fatigue life prediction"
          },
          {
            method: "MT at vibrating span stress concentrations",
            physics_basis: "Surface crack detection at dynamic stress concentration points (connections, supports)"
          },
          {
            method: "PAUT at high-stress nodes from modal analysis",
            physics_basis: "Volumetric inspection of peak-stress locations identified by vibration analysis"
          }
        ]
      },

      "general_corrosion": {
        mechanism_name: "General Corrosion",
        required_methods: [
          {
            method: "UT grid thickness survey at CMLs",
            physics_basis: "Through-wall transit time directly measures remaining wall; grid pattern detects uniform loss"
          },
          {
            method: "Historical thickness trending",
            physics_basis: "Corrosion rate (mpy) calculation requires multiple data points across service time"
          }
        ]
      },

      "pitting": {
        mechanism_name: "Pitting Corrosion",
        required_methods: [
          {
            method: "Visual + pit gauge measurement",
            physics_basis: "Direct measurement of pit depth, density, and distribution"
          },
          {
            method: "PAUT or profile UT for pit cluster characterization",
            physics_basis: "Beam-steered ultrasonic scanning quantifies pit depth where visual access is limited"
          }
        ]
      },

      "scc_chloride": {
        mechanism_name: "Chloride Stress Corrosion Cracking",
        required_methods: [
          {
            method: "PT (dye penetrant) on prepared surface",
            physics_basis: "Capillary action reveals branching surface crack morphology characteristic of SCC"
          },
          {
            method: "Metallographic replication at suspect zones",
            physics_basis: "Confirms transgranular branching morphology specific to chloride SCC"
          },
          {
            method: "PAUT for subsurface extent mapping",
            physics_basis: "SCC may extend well beyond surface-visible length; PAUT maps subsurface propagation"
          }
        ]
      },

      "scc_caustic": {
        mechanism_name: "Caustic Stress Corrosion Cracking",
        required_methods: [
          {
            method: "WFMT (wet fluorescent magnetic particle) at weld HAZ",
            physics_basis: "High sensitivity to surface intergranular cracks in carbon steel caustic service"
          },
          {
            method: "PT as backup on non-ferromagnetic sections",
            physics_basis: "Capillary action reveals intergranular surface cracking"
          },
          {
            method: "Metallographic replication for morphology confirmation",
            physics_basis: "Confirms intergranular pattern distinguishing caustic SCC from chloride SCC or fatigue"
          }
        ]
      },

      "ssc_sulfide": {
        mechanism_name: "Sulfide Stress Cracking",
        required_methods: [
          {
            method: "Hardness mapping per NACE MR0175 (HRC or Vickers)",
            physics_basis: "Hardness above 22 HRC equivalent is the primary SSC susceptibility indicator"
          },
          {
            method: "WFMT at weld HAZ and cold-worked zones",
            physics_basis: "Identifies surface cracks at hardness peak locations"
          },
          {
            method: "PMI (Positive Material Identification) of base and weld metal",
            physics_basis: "Confirms NACE-compliant material grade through the repair and fabrication history"
          }
        ]
      },

      "hic": {
        mechanism_name: "Hydrogen Induced Cracking",
        required_methods: [
          {
            method: "Straight beam UT or TOFD volumetric scan",
            physics_basis: "HIC is mid-wall stepwise cracking invisible to surface methods; volumetric inspection required"
          },
          {
            method: "Metallographic sectioning at UT indications",
            physics_basis: "Confirms stepwise morphology characteristic of HIC and quantifies CLR/CTR/CSR per NACE TM0284"
          },
          {
            method: "Base material HIC susceptibility testing (if replacement considered)",
            physics_basis: "NACE TM0284 test quantifies material resistance for sour service qualification"
          }
        ]
      },

      "co2_corrosion": {
        mechanism_name: "CO2 (Sweet) Corrosion",
        required_methods: [
          {
            method: "UT grid at bottom-of-line and flow transitions",
            physics_basis: "CO2 corrosion concentrates at water-accumulating zones; grid pattern detects localized thinning"
          },
          {
            method: "Profile RT at fittings and transitions",
            physics_basis: "Radiographic profile reveals mesa attack and localized thinning not captured by simple thickness readings"
          }
        ]
      },

      "creep": {
        mechanism_name: "Creep Damage",
        required_methods: [
          {
            method: "Metallographic replication per Neubauer scale",
            physics_basis: "Direct visualization of creep cavitation grades damage from isolated cavities (A) to micro-cracks (E)"
          },
          {
            method: "Hardness mapping across component length",
            physics_basis: "Creep softening causes measurable hardness reduction correlating with damage accumulation"
          },
          {
            method: "Dimensional survey for permanent strain",
            physics_basis: "Creep strain exceeds 1% in late stages and is directly measurable via dimensional change"
          }
        ]
      },

      "brittle_fracture": {
        mechanism_name: "Brittle Fracture",
        required_methods: [
          {
            method: "Charpy V-notch testing per ASME Section VIII Div 1 UG-84",
            physics_basis: "Direct measurement of material toughness at lowest anticipated operating temperature"
          },
          {
            method: "PAUT volumetric scan for pre-existing flaws",
            physics_basis: "Brittle fracture requires a pre-existing flaw above critical size; PAUT detects and sizes"
          },
          {
            method: "MDMT recalculation per ASME VIII Div 1 UCS-66",
            physics_basis: "Recomputes minimum design metal temperature based on current loading and material state"
          }
        ]
      },

      "erosion": {
        mechanism_name: "Erosion / Erosion-Corrosion",
        required_methods: [
          {
            method: "UT grid mapping at elbows, tees, reducers",
            physics_basis: "Erosion is directional and concentrated at flow transitions; grid pattern captures wear profile"
          },
          {
            method: "Profile UT for directional wear pattern",
            physics_basis: "Scanning reveals characteristic horseshoe or grooved wear patterns distinguishing erosion from uniform corrosion"
          },
          {
            method: "Flow velocity calculation vs API RP 14E C factor",
            physics_basis: "Quantitative check of operating velocity against erosional threshold"
          }
        ]
      },

      "overload_buckling": {
        mechanism_name: "Mechanical Overload / Buckling",
        required_methods: [
          {
            method: "Dimensional survey / laser scan / total station",
            physics_basis: "Direct measurement of permanent deformation, ovality, and straightness"
          },
          {
            method: "PAUT at cold-worked deformation zones",
            physics_basis: "Detects cracks initiated during yield-level overload events"
          },
          {
            method: "PMI if overload may have affected heat-treated material",
            physics_basis: "Confirms material has not been altered by thermal transient during overload"
          }
        ]
      },

      "fire_damage": {
        mechanism_name: "Fire / Thermal Damage",
        required_methods: [
          {
            method: "Hardness survey per API 579 Part 11",
            physics_basis: "Maps post-fire strength reduction across affected zones (Brinell or Vickers)"
          },
          {
            method: "Metallographic replication for microstructural assessment",
            physics_basis: "Identifies phase transformation, grain coarsening, and sensitization not visible to NDE"
          },
          {
            method: "PMI across full affected zone",
            physics_basis: "Confirms material identity is unchanged by fire exposure"
          },
          {
            method: "Dimensional survey for thermal distortion",
            physics_basis: "Fire events may induce permanent distortion changing support loads and nozzle geometry"
          }
        ]
      },

      "cui": {
        mechanism_name: "Corrosion Under Insulation",
        required_methods: [
          {
            method: "Insulation strip-back at critical locations (dead legs, low points, penetrations)",
            physics_basis: "Visual + UT direct access is the most reliable CUI characterization"
          },
          {
            method: "Profile UT over stripped zones",
            physics_basis: "Quantifies wall loss extent and pattern at exposed surface"
          },
          {
            method: "Pulsed Eddy Current (PEC) screening for zones that cannot be stripped",
            physics_basis: "PEC measures average wall thickness through insulation without removal - screening tool to prioritize strip-back"
          }
        ]
      },

      "hydrogen_damage": {
        mechanism_name: "High Temperature Hydrogen Attack (HTHA)",
        required_methods: [
          {
            method: "Advanced UT backscatter attenuation (velocity ratio technique)",
            physics_basis: "HTHA fissuring scatters ultrasonic energy before producing discrete reflections; backscatter attenuation detects pre-crack damage"
          },
          {
            method: "TOFD volumetric scan",
            physics_basis: "Detects discrete fissuring at base metal and HAZ once damage has progressed beyond backscatter-only stage"
          },
          {
            method: "Metallographic replication per API 941 Appendix B",
            physics_basis: "Direct microstructural examination grades decarburization and fissuring severity"
          },
          {
            method: "Nelson Curve operating point verification",
            physics_basis: "Confirms whether current service is below the material susceptibility line per API 941"
          }
        ]
      }

    };

    // ====================================================================
    // DEPLOY176: HELPER - BUILD REQUIRED EVIDENCE LEDGER
    // ====================================================================
    // Walks validated_mechanisms. For any mechanism with reality_state in
    // { unverified, possible, probable }, looks up MECHANISM_EVIDENCE_CONTRACT
    // and emits a ledger entry. "confirmed" mechanisms are excluded from
    // the ledger (already confirmed) but included in the inspection plan.

    var buildRequiredEvidenceLedger = function(mechanisms) {
      var ledger = [];
      if (!mechanisms || !mechanisms.length) return ledger;
      for (var li = 0; li < mechanisms.length; li++) {
        var lm = mechanisms[li];
        if (!lm || !lm.id) continue;
        var lstate = (lm.reality_state || "").toLowerCase();
        if (lstate === "confirmed") continue; // already confirmed, no evidence needed
        var contract = MECHANISM_EVIDENCE_CONTRACT[lm.id];
        if (!contract) continue;
        ledger.push({
          mechanism_id: lm.id,
          mechanism_name: contract.mechanism_name,
          reality_state: lstate || "unverified",
          reality_score: typeof lm.reality_score === "number" ? lm.reality_score : null,
          confirmation_evidence: contract.confirmation_evidence,
          rule_out_evidence: contract.rule_out_evidence,
          severity_quantifiers: contract.severity_quantifiers
        });
      }
      return ledger;
    };

    // ====================================================================
    // DEPLOY176: HELPER - BUILD REQUIRED INSPECTION PLAN
    // ====================================================================
    // Walks all validated_mechanisms (including confirmed, for severity
    // quantification). Looks up MECHANISM_METHOD_MAP, aggregates unique
    // methods per mechanism. Each mechanism appears as its own block so
    // the inspector sees WHY each method is required.

    var buildRequiredInspectionPlan = function(mechanisms) {
      var plan = [];
      if (!mechanisms || !mechanisms.length) return plan;
      for (var pi = 0; pi < mechanisms.length; pi++) {
        var pm = mechanisms[pi];
        if (!pm || !pm.id) continue;
        var mmap = MECHANISM_METHOD_MAP[pm.id];
        if (!mmap) continue;
        plan.push({
          mechanism_id: pm.id,
          mechanism_name: mmap.mechanism_name,
          reality_state: (pm.reality_state || "").toLowerCase() || "unverified",
          reality_score: typeof pm.reality_score === "number" ? pm.reality_score : null,
          methods: mmap.required_methods
        });
      }
      return plan;
    };

    // ====================================================================
    // DISPOSITION DECISION TREE
    // ====================================================================

    var disposition = "ENGINEERING_ASSESSMENT";
    var actions = [];
    var interval = "";
    var conditions = [];
    var escalationTriggers = [];
    var dispositionBasis = "";
    var urgency = "STANDARD";
    var temporaryControls = [];
    var requiredEvidenceLedger = null;
    var requiredInspectionPlan = null;
    var enforcementMetadata = null;

    // ----------------------------------------------------------------
    // TIER 1: IMMEDIATE ACTION (highest priority - active physical emergencies)
    // ----------------------------------------------------------------

    if (safeEnvelope === "EXCEEDS") {
      disposition = "IMMEDIATE_ACTION";
      urgency = "EMERGENCY";
      dispositionBasis = "Operating pressure EXCEEDS calculated MAOP - immediate intervention required";
      actions.push({
        priority: 1,
        action: "REDUCE OPERATING PRESSURE",
        detail: "Immediate pressure reduction of " + pressureReductionRequired + " psi to achieve 80% of governing MAOP",
        who: "Operations / Control Room",
        timeframe: "IMMEDIATE"
      });
      actions.push({
        priority: 2,
        action: "ENGINEERING ASSESSMENT",
        detail: "Mandatory FFS assessment per API 579-1 before resuming normal operations",
        who: "Level III Inspector / Integrity Engineer",
        timeframe: "Within 24 hours"
      });
      actions.push({
        priority: 3,
        action: "ESTABLISH SAFE ZONE",
        detail: "Implement exclusion zone and leak monitoring around affected area",
        who: "HSE / Operations",
        timeframe: "IMMEDIATE"
      });
      temporaryControls.push("Pressure cap at 80% of calculated MAOP until engineering assessment complete");
      temporaryControls.push("Continuous leak monitoring");
      temporaryControls.push("Exclusion zone around affected area");
      escalationTriggers.push("Any pressure exceedance above reduced limit");
      escalationTriggers.push("Any indication of leak or weep");
      escalationTriggers.push("Discovery of additional damage during assessment");
    }

    else if (brittleFractureRisk) {
      disposition = "IMMEDIATE_ACTION";
      urgency = "EMERGENCY";
      dispositionBasis = "Brittle fracture risk identified - failure mode produces sudden catastrophic failure with no leak-before-break warning";
      actions.push({
        priority: 1,
        action: "PRESSURE REDUCTION OR SHUTDOWN",
        detail: "Reduce operating pressure to minimum safe level or shut down if hardness/material verification cannot be completed",
        who: "Operations / Engineering",
        timeframe: "IMMEDIATE"
      });
      actions.push({
        priority: 2,
        action: "MATERIAL VERIFICATION",
        detail: "Hardness testing of base metal + HAZ per NACE MR0175. PMI of material grade.",
        who: "Level II/III Inspector",
        timeframe: "Within 24 hours"
      });
      actions.push({
        priority: 3,
        action: "CRACK CHARACTERIZATION",
        detail: "TOFD or PAUT to determine crack dimensions for API 579-1 Part 9 assessment",
        who: "Level II UT/PAUT Technician",
        timeframe: "Within 48 hours"
      });
      temporaryControls.push("Operating pressure reduced to minimum");
      temporaryControls.push("No thermal or pressure cycling permitted");
      temporaryControls.push("Continuous monitoring for propagation");
      escalationTriggers.push("Hardness exceeds NACE MR0175 limits");
      escalationTriggers.push("Crack growth detected on follow-up");
      escalationTriggers.push("Material does not meet sour service requirements");
    }

    // ----------------------------------------------------------------
    // DEPLOY176 TIER 1.5: STRUCTURAL ESCALATION PATH
    // Fires when FMD structural_path is active with capacity loss.
    // Runs BEFORE the confidence gate because confirmed structural
    // instability is a stronger signal than evidence insufficiency.
    // ----------------------------------------------------------------

    else if (structuralPath && structuralPath.active === true &&
             structuralPath.capacity_loss_state &&
             String(structuralPath.capacity_loss_state).toLowerCase() !== "none") {
      disposition = "IMMEDIATE_STRUCTURAL_INTEGRITY_REVIEW";
      urgency = "EMERGENCY";
      var capacityState = String(structuralPath.capacity_loss_state);
      var structuralIndicators = (structuralPath.indicators && structuralPath.indicators.join) ? structuralPath.indicators.join(", ") : "deformation indicators present";
      dispositionBasis = "Structural instability active with capacity loss state: " + capacityState + ". " +
        "Indicators: " + structuralIndicators + ". " +
        "This is a confirmed physical condition requiring immediate structural engineering review, not an evidence-gathering problem. " +
        "The pressure boundary integrity depends on a structure that has already deviated from its designed load path.";
      actions.push({
        priority: 1,
        action: "STRUCTURAL DIMENSIONAL SURVEY",
        detail: "Laser scan / total station survey quantifying displacement magnitude, tilt, and geometry deviation from design. Document at all affected support points, attachments, and pipe rack nodes.",
        who: "Structural Engineer + Survey Technician",
        timeframe: "IMMEDIATE (within 24 hours)"
      });
      actions.push({
        priority: 2,
        action: "ANCHOR BOLT + BASEPLATE INSPECTION",
        detail: "Measure anchor bolt uplift, check for bolt elongation or yield, inspect baseplate grout condition and weld integrity. Document any gap between baseplate and foundation.",
        who: "Structural Engineer + Level II Inspector",
        timeframe: "Within 48 hours"
      });
      actions.push({
        priority: 3,
        action: "NOZZLE LOAD RECALCULATION",
        detail: "Recalculate nozzle loads at all connected pressure boundary components per WRC 452 / ASME B31.3 Appendix D. Compare against original design allowables. Quantify overstress.",
        who: "Piping / Stress Engineer",
        timeframe: "Within 72 hours"
      });
      actions.push({
        priority: 4,
        action: "OPERATING RESTRICTION ENFORCEMENT",
        detail: "Establish and enforce operating restrictions: pressure cap at current level, no startup/shutdown cycling, no new pressure excursions until structural review complete.",
        who: "Operations + Engineering",
        timeframe: "IMMEDIATE"
      });
      actions.push({
        priority: 5,
        action: "ROOT CAUSE: STRUCTURAL vs MECHANISM",
        detail: "Determine whether structural instability is driven by section loss (corrosion), support failure, foundation settlement, thermal restraint, or overload. Root cause drives repair strategy.",
        who: "Structural Engineer + Materials Engineer",
        timeframe: "Within 14 days"
      });
      temporaryControls.push("Operating pressure cap at current level - no increases permitted");
      temporaryControls.push("No startup/shutdown cycling without structural engineer approval");
      temporaryControls.push("No new pressure excursions or thermal transients");
      temporaryControls.push("Continuous monitoring for further movement or settlement");
      temporaryControls.push("Pipe rack access restricted to essential personnel only");
      escalationTriggers.push("Additional displacement or settlement detected");
      escalationTriggers.push("Any pressure or thermal excursion");
      escalationTriggers.push("Anchor bolt yield confirmed");
      escalationTriggers.push("Nozzle loads exceed allowable on recalculation");
      escalationTriggers.push("Adjacent support or attachment failure");
      enforcementMetadata = {
        gate: "structural_escalation",
        mode: "EMERGENCY_STRUCTURAL_REVIEW",
        capacity_loss_state: capacityState,
        structural_active: true,
        structural_indicators: structuralPath.indicators || [],
        rationale: "FMD structural_path reports active instability with capacity loss. This is an authentic physical emergency, not a data gap."
      };
    }

    // ----------------------------------------------------------------
    // DEPLOY176 TIER 1.75: HARD CONFIDENCE GATE
    // Fires when consequence tier is HIGH or CRITICAL AND overall reality
    // confidence is below 0.60. PROVISIONAL mode per locked config:
    // frontend keeps reasoning visible, DPR blocks final disposition.
    // ----------------------------------------------------------------

    else if ((consequenceTier === "HIGH" || consequenceTier === "CRITICAL") &&
             realityConfidenceOverall !== null &&
             realityConfidenceOverall < 0.60) {
      disposition = "HOLD_FOR_INPUT_ENFORCEMENT";
      urgency = "ENFORCEMENT_BLOCK";

      var confStr = (Math.round(realityConfidenceOverall * 100) / 100).toFixed(2);
      dispositionBasis = "HARD CONFIDENCE GATE ACTIVE. " +
        "Consequence tier " + consequenceTier + " with overall reality confidence " + confStr + " " +
        "falls below the 0.60 enforcement threshold. " +
        "No final disposition is permitted. This report is provisional: reasoning remains visible, " +
        "but pass/fail, repair/replace, and continue-service judgments are blocked until the required " +
        "inputs below are collected and the case is re-evaluated. " +
        "This is forced-reality enforcement, not a system failure.";

      // actions[] deliberately left empty under PROVISIONAL mode

      requiredEvidenceLedger = buildRequiredEvidenceLedger(validatedMechanisms);
      requiredInspectionPlan = buildRequiredInspectionPlan(validatedMechanisms);

      conditions.push("PROVISIONAL - NOT A DISPOSITION. Reasoning visible, final decision blocked pending required data collection.");
      conditions.push("Failure narrative, contradiction matrix, and mechanism hypotheses remain visible on this report as UNVERIFIED working analysis.");
      conditions.push("Inspector action card is suppressed. No action directive is issued.");
      conditions.push("Re-run this assessment after the required evidence is collected to obtain a full disposition.");

      temporaryControls.push("Current operating conditions maintained. No change to operations is implied or authorized by this report.");
      temporaryControls.push("Enhanced monitoring during data collection period.");

      escalationTriggers.push("Any observed change in condition during data collection");
      escalationTriggers.push("Any leak, weep, or seep indication");
      escalationTriggers.push("Any pressure or thermal excursion outside normal operating window");
      escalationTriggers.push("Discovery of additional damage during required inspection");

      enforcementMetadata = {
        gate: "hard_confidence",
        mode: "PROVISIONAL",
        threshold: 0.60,
        confidence_at_gate: realityConfidenceOverall,
        consequence_tier: consequenceTier,
        required_inputs_count: requiredEvidenceLedger ? requiredEvidenceLedger.length : 0,
        required_methods_count: requiredInspectionPlan ? requiredInspectionPlan.length : 0,
        rationale: "consequence_tier in (HIGH, CRITICAL) AND reality_confidence_overall < 0.60",
        decision_core_internal_gate: 0.58,
        enforcement_layer_gate: 0.60,
        asymmetry_note: "Decision-core detects signals at 0.58. Enforcement layer decides at 0.60. Detect early, decide carefully."
      };
    }


    // ----------------------------------------------------------------
    // DEPLOY180 TIER 1.8: CONSEQUENCE UNDETERMINED GATE
    // When the consequence model could not determine one or more impact
    // dimensions (human, environmental, operational) on a HIGH/CRITICAL
    // asset, disposition holds. The engine cannot issue go/no-go when
    // it does not know what failure consequences are.
    // ----------------------------------------------------------------

    else if (consequenceUndetermined && (consequenceTier === "HIGH" || consequenceTier === "CRITICAL")) {
      disposition = "HOLD_FOR_INPUT_ENFORCEMENT";
      urgency = "ENFORCEMENT_BLOCK";

      var undImpactStr = undeterminedImpacts.join(", ");
      dispositionBasis = "CONSEQUENCE UNDETERMINED GATE ACTIVE. " +
        "Decision-core could not classify " + undeterminedImpacts.length + " impact dimension(s) (" +
        undImpactStr + ") on " + consequenceTier + " asset from available evidence. " +
        "Disposition is blocked until impact dimensions are classified. " +
        "The absence of evidence is not evidence of low consequence.";

      conditions.push("CONSEQUENCE UNDETERMINED - Disposition blocked pending impact classification.");
      conditions.push("Undetermined impacts: " + undImpactStr);
      conditions.push("Provide evidence to classify: process fluid hazard, personnel proximity, environmental sensitivity, operational criticality.");

      temporaryControls.push("Current operating conditions maintained pending impact assessment.");
      temporaryControls.push("Enhanced monitoring and personnel awareness during assessment period.");

      escalationTriggers.push("Any leak, weep, or release indication");
      escalationTriggers.push("Any observed change in damage condition");
      escalationTriggers.push("Discovery of hazardous process fluid not previously identified");

      enforcementMetadata = {
        gate: "consequence_undetermined",
        mode: "ENFORCEMENT_BLOCK",
        consequence_tier: consequenceTier,
        undetermined_impacts: undeterminedImpacts,
        undetermined_count: undeterminedImpacts.length,
        required_action: "Classify impact dimensions: " + undImpactStr
      };
    }

    // ----------------------------------------------------------------
    // TIER 2: HOLD FOR DATA (unknown state blocks disposition)
    // ----------------------------------------------------------------

    else if (dispositionBlocked || realityState === "UNKNOWN") {
      disposition = "HOLD_FOR_DATA";
      urgency = "EXPEDITED";
      dispositionBasis = "Reality state is UNKNOWN - insufficient data to support confident disposition. Additional inspection required before any decision.";

      if (safeEnvelope === "MARGINAL") {
        actions.push({
          priority: 1,
          action: "PRECAUTIONARY PRESSURE REDUCTION",
          detail: "Reduce operating pressure by " + (pressureReductionRequired > 0 ? pressureReductionRequired + " psi" : "10-15%") + " as precautionary measure while data is gathered",
          who: "Operations",
          timeframe: "Within 4 hours"
        });
        temporaryControls.push("Precautionary pressure reduction in effect");
      }

      actions.push({
        priority: safeEnvelope === "MARGINAL" ? 2 : 1,
        action: "GATHER MISSING DATA",
        detail: "Complete all minimum data requirements identified by Unknown State Engine before re-evaluation",
        who: "Inspection Team",
        timeframe: safeEnvelope === "MARGINAL" ? "Within 48 hours" : "Within 7 days"
      });
      actions.push({
        priority: safeEnvelope === "MARGINAL" ? 3 : 2,
        action: "RE-EVALUATE WITH COMPLETE DATA",
        detail: "Re-run full pipeline assessment once minimum data requirements are satisfied",
        who: "Level III Inspector / Integrity Engineer",
        timeframe: "After data collection complete"
      });

      temporaryControls.push("Current operating conditions maintained with enhanced monitoring");
      escalationTriggers.push("Any change in observed condition (new leaks, growth, etc.)");
      escalationTriggers.push("Operating conditions change (pressure excursion, temperature change)");
      conditions.push("Disposition cannot be finalized until reality state advances to KNOWN or PARTIALLY_KNOWN");
    }

    // ----------------------------------------------------------------
    // TIER 3: SAFE ENVELOPE MARGINAL + KNOWN STATE
    // ----------------------------------------------------------------

    else if (safeEnvelope === "MARGINAL" && (realityState === "KNOWN" || realityState === "CONFIRMED" || realityState === "PROBABLE" || realityState === "PARTIALLY_KNOWN")) {

      if (hasCracking || governingMode === "CRACKING" || governingMode === "COMPOUND") {
        disposition = "ENGINEERING_ASSESSMENT";
        urgency = "PRIORITY";
        dispositionBasis = "Marginal safe envelope with cracking present - engineering assessment required to determine if continued operation is acceptable";

        actions.push({
          priority: 1,
          action: "CRACK SIZING AND CHARACTERIZATION",
          detail: "TOFD or PAUT to determine crack length, depth, and orientation for API 579-1 Part 9",
          who: "Level II UT/PAUT Technician",
          timeframe: "Within 7 days"
        });
        actions.push({
          priority: 2,
          action: "FFS ASSESSMENT",
          detail: "API 579-1 Level 2 or Level 3 assessment to determine acceptability for continued service",
          who: "Integrity Engineer",
          timeframe: "Within 14 days"
        });
        actions.push({
          priority: 3,
          action: "DEFINE MONITORING PLAN",
          detail: "Establish crack monitoring intervals based on FFS results and crack growth projections",
          who: "Integrity Engineer",
          timeframe: "After FFS assessment"
        });

        temporaryControls.push("Pressure cap at current operating level - no increases permitted");
        temporaryControls.push("No thermal cycling or startup/shutdown without engineering approval");
        escalationTriggers.push("Any crack growth detected");
        escalationTriggers.push("Operating pressure must increase");
        escalationTriggers.push("New mechanisms discovered");
      } else {
        disposition = "MONITOR";
        urgency = "ELEVATED";
        dispositionBasis = "Marginal safe envelope with corrosion-only damage and known reality state. Monitoring with defined interval and conditions.";

        actions.push({
          priority: 1,
          action: "ESTABLISH MONITORING BASELINE",
          detail: "Grid UT survey to establish thickness baseline at critical measurement locations (CMLs)",
          who: "Level II UT Technician",
          timeframe: "Within 30 days"
        });
        actions.push({
          priority: 2,
          action: "CALCULATE CORROSION RATE",
          detail: "Determine short-term and long-term corrosion rates from historical thickness data",
          who: "Integrity Engineer",
          timeframe: "After baseline established"
        });
        actions.push({
          priority: 3,
          action: "SET RE-INSPECTION INTERVAL",
          detail: "Define interval per API 510/570/653 based on corrosion rate and remaining life calculation",
          who: "Level III Inspector",
          timeframe: "After corrosion rate determined"
        });

        interval = "6 months (initial monitoring interval - adjust based on corrosion rate)";
        temporaryControls.push("Pressure cap at current operating level");
        escalationTriggers.push("Corrosion rate exceeds predicted value");
        escalationTriggers.push("Wall loss reaches code minimum retirement thickness");
        escalationTriggers.push("New damage mechanisms appear");
        conditions.push("Continued operation acceptable only if monitoring confirms stable or declining corrosion rate");
      }
    }

    // ----------------------------------------------------------------
    // TIER 4: WITHIN SAFE ENVELOPE
    // ----------------------------------------------------------------

    else if (safeEnvelope === "WITHIN") {

      if (hasCracking || governingMode === "CRACKING") {
        disposition = "ENGINEERING_ASSESSMENT";
        urgency = "STANDARD";
        dispositionBasis = "Within safe envelope but cracking detected - engineering assessment required per API 579-1 Part 9. Cracking failure modes cannot be dispositioned by pressure envelope alone.";

        actions.push({
          priority: 1,
          action: "CRACK CHARACTERIZATION",
          detail: "Size all detected cracks using TOFD or PAUT. Determine orientation, length, and through-wall depth.",
          who: "Level II UT/PAUT Technician",
          timeframe: "Within 30 days"
        });
        actions.push({
          priority: 2,
          action: "ROOT CAUSE DETERMINATION",
          detail: "Identify cracking mechanism (fatigue, SCC, HIC, etc.) and driving environment/stress conditions",
          who: "Integrity Engineer / Metallurgist",
          timeframe: "Within 30 days"
        });
        actions.push({
          priority: 3,
          action: "FFS ASSESSMENT",
          detail: "API 579-1 Part 9 assessment based on crack dimensions, material toughness, and loading",
          who: "Integrity Engineer",
          timeframe: "Within 60 days"
        });

        interval = "Per FFS assessment results";
        escalationTriggers.push("Crack growth on follow-up inspection");
        escalationTriggers.push("Root cause indicates active/ongoing mechanism");
        conditions.push("Continued operation pending FFS results showing crack is subcritical with adequate remaining life");
      }
      else if (interactionFlag && interactionType === "SYNERGY") {
        disposition = "MONITOR";
        urgency = "ELEVATED";
        dispositionBasis = "Within safe envelope but synergistic mechanism interaction detected. Close monitoring required to detect acceleration.";

        actions.push({
          priority: 1,
          action: "ENHANCED MONITORING",
          detail: "Increase inspection frequency to detect any acceleration from mechanism interaction",
          who: "Level II Inspector",
          timeframe: "Establish within 30 days"
        });
        actions.push({
          priority: 2,
          action: "ROOT CAUSE INVESTIGATION",
          detail: "Investigate and confirm mechanism interaction. Consider laboratory analysis.",
          who: "Integrity Engineer / Metallurgist",
          timeframe: "Within 60 days"
        });

        interval = "3-6 months (elevated due to mechanism interaction)";
        escalationTriggers.push("Corrosion rate acceleration detected");
        escalationTriggers.push("New damage indications appear between intervals");
        conditions.push("Continue service with enhanced monitoring. Escalate if synergistic acceleration confirmed.");
      }
      else {
        disposition = "CONTINUE_SERVICE";
        urgency = "ROUTINE";
        dispositionBasis = "Within safe envelope with corrosion-only damage, no cracking, no mechanism interaction, and known reality state. Standard inspection interval applies.";

        actions.push({
          priority: 1,
          action: "CONTINUE NORMAL INSPECTION PROGRAM",
          detail: "Follow existing inspection plan per API 510/570/653. Update thickness data at next scheduled inspection.",
          who: "Level II Inspector",
          timeframe: "Per existing schedule"
        });
        actions.push({
          priority: 2,
          action: "TREND CORROSION DATA",
          detail: "Update corrosion rate trending with new data points. Verify rate is stable or declining.",
          who: "Integrity Engineer",
          timeframe: "At next inspection"
        });

        interval = "Per API 510/570/653 calculated interval (typically 2-5 years based on corrosion rate)";
        escalationTriggers.push("Corrosion rate increases significantly");
        escalationTriggers.push("New damage mechanism identified");
        escalationTriggers.push("Operating conditions change (new service, higher pressure, etc.)");
        conditions.push("Standard continued service. Re-evaluate if any escalation trigger fires.");
      }
    }

    // ----------------------------------------------------------------
    // FALLBACK: No safe envelope data
    // ----------------------------------------------------------------

    else {
      disposition = "ENGINEERING_ASSESSMENT";
      urgency = "PRIORITY";
      dispositionBasis = "Insufficient data to determine safe operating envelope. Engineering assessment required before disposition.";

      actions.push({
        priority: 1,
        action: "COMPLETE ASSESSMENT DATA",
        detail: "Gather wall thickness, flaw sizing, operating conditions, and material data needed for FFS evaluation",
        who: "Inspection Team",
        timeframe: "Within 14 days"
      });
      actions.push({
        priority: 2,
        action: "FFS ASSESSMENT",
        detail: "Perform API 579-1 fitness-for-service evaluation once data is complete",
        who: "Integrity Engineer",
        timeframe: "After data collection"
      });

      temporaryControls.push("Maintain current operating conditions - no increases");
      escalationTriggers.push("Any observed deterioration");
    }

    // ====================================================================
    // CONSEQUENCE MODIFIER (preserved from v1.0)
    // NOTE: does NOT apply to DEPLOY176 enforcement paths (structural
    // escalation + confidence gate) - those already have EMERGENCY /
    // ENFORCEMENT_BLOCK urgency and their own escalation logic.
    // ====================================================================

    if (disposition !== "HOLD_FOR_INPUT_ENFORCEMENT" &&
        disposition !== "IMMEDIATE_STRUCTURAL_INTEGRITY_REVIEW") {

      if (consequenceTier === "CRITICAL" && urgency !== "EMERGENCY") {
        urgency = "PRIORITY";
        temporaryControls.push("CRITICAL consequence tier: all timeframes compressed by 50%");
        escalationTriggers.push("Any deviation from disposition actions triggers immediate re-evaluation");
      }

      // Low confidence modifier (preserved v1.0 behavior for non-enforcement paths)
      if (confidenceBand === "LOW" || confidenceBand === "UNRESOLVED") {
        conditions.push("LOW confidence band: disposition is provisional pending improved data quality");
        if (disposition === "CONTINUE_SERVICE") {
          disposition = "MONITOR";
          dispositionBasis = dispositionBasis + " [UPGRADED from CONTINUE_SERVICE due to LOW confidence]";
          interval = "Reduced interval (50% of standard) due to low confidence";
        }
      }
    }

    // ====================================================================
    // RESPONSE
    // ====================================================================

    var result = {
      disposition: disposition,
      urgency: urgency,
      disposition_basis: dispositionBasis,
      actions: actions,
      interval: interval,
      conditions: conditions,
      temporary_controls: temporaryControls,
      escalation_triggers: escalationTriggers,
      required_evidence_ledger: requiredEvidenceLedger,
      required_inspection_plan: requiredInspectionPlan,
      enforcement_metadata: enforcementMetadata,
      inputs_used: {
        safe_envelope: safeEnvelope,
        governing_failure_mode: governingMode,
        governing_severity: governingSeverity,
        reality_state: realityState,
        disposition_blocked: dispositionBlocked,
        interaction_flag: interactionFlag,
        brittle_fracture_risk: brittleFractureRisk,
        has_cracking: hasCracking,
        wall_loss_percent: wallLossPercent,
        operating_ratio: operatingRatio,
        consequence_tier: consequenceTier,
        confidence_band: confidenceBand,
        reality_confidence_overall: realityConfidenceOverall,
        structural_path_active: structuralPath ? !!structuralPath.active : false,
        structural_capacity_loss_state: structuralPath ? (structuralPath.capacity_loss_state || null) : null,
        validated_mechanisms_count: validatedMechanisms ? validatedMechanisms.length : 0,
        indeterminate_mechanisms_count: indeterminateCount,
        indeterminate_escalation: hasHighSeverityIndeterminate && (consequenceTier === "HIGH" || consequenceTier === "CRITICAL"),
        consequence_undetermined: consequenceUndetermined,
        undetermined_impacts: undeterminedImpacts
      },
      metadata: {
        engine: "disposition-pathway",
        version: "1.2",
        deploy: "DEPLOY180",
        features: {
          hard_confidence_gate: true,
          hard_confidence_threshold: 0.60,
          hard_confidence_applies_to: ["HIGH", "CRITICAL"],
          structural_escalation_path: true,
          provisional_mode: true,
          mechanism_evidence_contract: true,
          mechanism_method_map: true,
          mechanism_coverage: 17
        },
        timestamp: new Date().toISOString()
      }
    };

    return { statusCode: 200, headers: headers, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: "Disposition pathway error: " + (err.message || String(err)) }) };
  }
};

module.exports = { handler: handler };
