// DEPLOY68 REBUILD — Code Trace Engine v2
// Clause-level citations for findings, methods, disposition, and asset class
// Returns specific code sections, paragraphs, and tables that apply
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

var handler = async function(event: any): Promise<any> {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var findings = body.findings || [];
    var methods = body.methods || [];
    var disposition = body.disposition || "";
    var asset_class = body.asset_class || "pressure_vessel";

    var citations: Array<{
      code: string;
      clause: string;
      requirement: string;
      applies_to: string;
      category: string;
    }> = [];

    // ================================================================
    // FINDING-BASED CITATIONS
    // ================================================================

    var FINDING_CITATIONS: { [key: string]: { [asset: string]: Array<{ code: string; clause: string; req: string }> } } = {

      "crack": {
        "pressure_vessel": [
          { code: "API 510", clause: "Section 7.3.1", req: "Cracks found during inspection shall be evaluated by the inspector and engineer. Determine if crack is service-induced or fabrication-related." },
          { code: "API 579-1/ASME FFS-1", clause: "Part 9, Section 9.2", req: "Assessment of crack-like flaws. Level 1: screening based on crack dimensions vs. reference curves. Level 2: FAD (Failure Assessment Diagram) analysis. Level 3: detailed FEA-based assessment." },
          { code: "API 579-1/ASME FFS-1", clause: "Part 9, Table 9.2", req: "Minimum information required: flaw type, location, orientation, dimensions (2a=depth, 2c=length), material properties, stress state." },
          { code: "ASME PCC-2", clause: "Article 3.3", req: "Weld repair procedures for cracks. Pre-repair NDE, excavation to sound metal, re-weld per qualified WPS, PWHT if required, post-repair NDE." },
          { code: "ASME BPVC Section VIII Div. 1", clause: "UW-51, UW-52", req: "Radiographic and ultrasonic acceptance criteria for welds during repair. Table UW-51 for RT, Appendix 12 for UT." }
        ],
        "process_piping": [
          { code: "API 570", clause: "Section 7.1.4", req: "Cracks in piping components. Evaluate cause (fatigue, SCC, creep). Engineering assessment required for disposition." },
          { code: "API 579-1/ASME FFS-1", clause: "Part 9", req: "Crack-like flaw assessment for piping. Same FAD approach as vessels but with piping-specific stress calculations per ASME B31.3." },
          { code: "ASME B31.3", clause: "Chapter IX, Section 341.3.3", req: "Repair of piping — weld repairs require qualified WPS. Examination per original construction code or as specified by engineer." }
        ],
        "bridge_steel": [
          { code: "AASHTO MBE", clause: "Section 6.6.2", req: "Fatigue evaluation of steel bridge details. Categorize detail per AASHTO LRFD Table 6.6.1.2.3-1. Determine remaining fatigue life." },
          { code: "AWS D1.5", clause: "Chapter 6 (Inspection)", req: "Visual and NDE acceptance criteria for bridge welds. Table 6.1 for visual acceptance. Section 6.11 for UT acceptance criteria." },
          { code: "AWS D1.5", clause: "Chapter 5, Section 5.26", req: "Repair welding of cracks. Remove crack by grinding to sound metal, verify removal by MT/PT, re-weld per qualified WPS." },
          { code: "AASHTO MBE", clause: "Section 7.2.8", req: "Load rating for members with fatigue cracks — reduced section properties at crack location." }
        ],
        "rail_bridge": [
          { code: "AREMA Manual", clause: "Chapter 15, Section 7.3.4", req: "Evaluation of cracks in steel bridge members. Requires railroad bridge engineer assessment." },
          { code: "49 CFR 237", clause: "Section 237.33", req: "FRA requirement: Railroad bridge engineer must determine bridge safe for train operations after damage." },
          { code: "AWS D1.5", clause: "Chapter 5 + 6", req: "Weld repair and inspection per AWS D1.5 Bridge Welding Code." }
        ],
        "structural_steel": [
          { code: "AWS D1.1", clause: "Chapter 6, Table 6.1", req: "UT acceptance criteria for structural steel welds. Clause 6.13 for acceptance/rejection criteria." },
          { code: "API RP 2A", clause: "Section 14.4", req: "Repair of offshore structural members. Welding per AWS D1.1. Engineering approval required for all structural repairs." }
        ],
        "pipeline": [
          { code: "ASME B31.8", clause: "Section 851.4", req: "Evaluation of defects in pipelines. Engineering assessment for cracks." },
          { code: "49 CFR 192", clause: "Section 192.713", req: "Transmission line — repair conditions that could result in a hazardous leak. Immediate repair or pressure reduction." }
        ]
      },

      "wall_thinning": {
        "pressure_vessel": [
          { code: "API 510", clause: "Section 7.4.2", req: "Remaining life calculation: RL = (t_actual - t_required) / corrosion_rate. Set next inspection based on remaining life or half remaining life." },
          { code: "API 510", clause: "Section 7.4.3", req: "Minimum required thickness per ASME VIII Div. 1 formulas (UG-27 for shells, UG-32 for heads, UG-37 for nozzles)." },
          { code: "API 579-1/ASME FFS-1", clause: "Part 4, Section 4.4", req: "Level 1 assessment for general metal loss. Remaining thickness ratio. If t_mm >= 0.5*t_nom and FCA applied, acceptable." },
          { code: "API 579-1/ASME FFS-1", clause: "Part 5, Section 5.4", req: "Level 1/2 assessment for local metal loss. RSF (Remaining Strength Factor) calculation. RSFa = 0.9 default." }
        ],
        "process_piping": [
          { code: "API 570", clause: "Section 7.1.1", req: "Thickness measurements at TMLs per API 574. Calculate corrosion rate (short-term and long-term). Set retirement date." },
          { code: "API 570", clause: "Section 7.1.2", req: "Minimum required wall thickness per ASME B31.3 equation 3a (internal pressure) including mill tolerance and FCA." },
          { code: "API 579-1/ASME FFS-1", clause: "Part 4/5", req: "FFS assessment for piping metal loss. Same Part 4 (general) and Part 5 (local) methods as vessels." }
        ],
        "pipeline": [
          { code: "ASME B31G", clause: "Entire standard", req: "Simplified assessment of corroded pipelines. Calculates safe pressure for corroded pipe based on defect length and depth." },
          { code: "49 CFR 192", clause: "Section 192.485", req: "Remedial measures for transmission lines: repair, replace, or reduce pressure for corrosion defects." }
        ],
        "storage_tank": [
          { code: "API 653", clause: "Section 6.3.2", req: "Shell evaluation — minimum acceptable shell thickness per API 653 equation for each course." },
          { code: "API 653", clause: "Section 6.4", req: "Tank bottom evaluation — minimum bottom plate thickness. Annular ring minimum per Table 6.1." }
        ]
      },

      "wall_thinning_general": {
        "pressure_vessel": [
          { code: "API 510", clause: "Section 7.4.2", req: "Corrosion rate calculation and remaining life determination." },
          { code: "API 579-1/ASME FFS-1", clause: "Part 4", req: "Assessment of general metal loss — remaining thickness ratio approach." }
        ]
      },

      "wall_thinning_local": {
        "pressure_vessel": [
          { code: "API 579-1/ASME FFS-1", clause: "Part 5, Section 5.4", req: "Local metal loss assessment. CTP (Critical Thickness Profile), RSF calculation, Folias factor." }
        ]
      },

      "pitting": {
        "pressure_vessel": [
          { code: "API 579-1/ASME FFS-1", clause: "Part 6, Section 6.4", req: "Level 1: pit depth chart method using RSF_pit. Level 2: detailed pit interaction rules with pit couple spacing." },
          { code: "API 510", clause: "Section 7.3", req: "Pitting assessment — measure pit depth, diameter, density, and remaining ligament." }
        ]
      },

      "hic_blistering": {
        "pressure_vessel": [
          { code: "API 579-1/ASME FFS-1", clause: "Part 7, Section 7.4", req: "Assessment of hydrogen blisters and HIC/SOHIC damage. Level 1: blister diameter/height limits. Level 2: remaining ligament assessment." },
          { code: "API RP 945", clause: "Section 5", req: "Guidelines for avoiding HIC/SOHIC in new and existing equipment. Inspection planning for wet H2S service." },
          { code: "NACE SP0296", clause: "Entire standard", req: "Detection and monitoring of HIC/SOHIC in carbon steel equipment in wet H2S service." }
        ]
      },

      "fire_damage": {
        "pressure_vessel": [
          { code: "API 579-1/ASME FFS-1", clause: "Part 11, Section 11.4", req: "Level 1: visual and dimensional assessment. Level 2: material testing (hardness, replication). Level 3: detailed FEA with degraded material properties." },
          { code: "API 579-1/ASME FFS-1", clause: "Part 11, Table 11.3", req: "Heat exposure zones based on visual evidence. Table 11.4 for material property degradation factors." },
          { code: "API 510", clause: "Section 7.5", req: "Pressure vessels exposed to fire — complete assessment before return to service." }
        ],
        "bridge_steel": [
          { code: "AISC Design Guide 19", clause: "Chapter 5", req: "Assessment methodology for fire-damaged structural steel. Hardness-based temperature estimation. Material property curves." },
          { code: "AASHTO MBE", clause: "Section 5.5", req: "Damage inspection after fire — steel bridges. Load rating at post-fire material properties." },
          { code: "FHWA Bridge Fire Report", clause: "Chapter 4", req: "Post-fire bridge assessment methodology and case studies." }
        ],
        "rail_bridge": [
          { code: "49 CFR 237", clause: "Section 237.33", req: "Railroad bridge engineer must evaluate fire damage before return to service." },
          { code: "AREMA Manual", clause: "Chapter 15, Section 7.3", req: "Evaluation of fire-damaged bridge members. Hardness testing required for steel." },
          { code: "AISC Design Guide 19", clause: "Chapter 5", req: "Steel fire damage assessment methodology." }
        ]
      },

      "deformation": {
        "pressure_vessel": [
          { code: "API 579-1/ASME FFS-1", clause: "Part 8, Section 8.4", req: "Assessment of shell distortion. Out-of-roundness limits. Peaking and angular misalignment at welds." },
          { code: "ASME BPVC Section VIII Div. 1", clause: "UG-80, UG-81", req: "Fabrication tolerances for shells and heads. Out-of-roundness limits: 1% of nominal diameter." }
        ],
        "bridge_steel": [
          { code: "AASHTO MBE", clause: "Section 5.5", req: "Post-damage assessment of deformed bridge members. Load rating with deformed geometry." },
          { code: "AISC 303", clause: "Section 6", req: "Standard tolerances for steel structures. Sweep, camber, and cross-section flatness limits." },
          { code: "FHWA Heat Straightening Guidelines", clause: "FHWA-IF-08-999", req: "Guidelines for heat straightening of damaged steel bridge members." }
        ]
      },

      "dent_gouge": {
        "pressure_vessel": [
          { code: "API 579-1/ASME FFS-1", clause: "Part 12, Section 12.4", req: "Level 1: dent depth limit (6% of diameter for PV). Level 2: strain-based assessment. Dent-gouge combination requires Part 12 assessment." }
        ],
        "pipeline": [
          { code: "ASME B31.8", clause: "Section 851.41", req: "Dent depth limits for pipelines. Dents exceeding 6% of OD on bottom of pipe — immediate repair." },
          { code: "API 579-1/ASME FFS-1", clause: "Part 12", req: "Detailed dent/gouge assessment for pipeline FFS." }
        ]
      },

      "creep_damage": {
        "pressure_vessel": [
          { code: "API 579-1/ASME FFS-1", clause: "Part 10, Section 10.4", req: "Level 1: screening based on material, temperature, time. Level 2: Omega method or MPC remaining life calculation. Level 3: detailed inelastic analysis." },
          { code: "API 579-1/ASME FFS-1", clause: "Part 10, Table 10.2", req: "Screening criteria — materials and temperatures requiring creep assessment." }
        ]
      },

      "settlement": {
        "storage_tank": [
          { code: "API 653", clause: "Annex B", req: "Evaluation of tank bottom settlement. Rigid body tilt, flexible settlement, and edge settlement limits per Tables B.1 and B.2." },
          { code: "API 653", clause: "Section 6.5", req: "Foundation evaluation. Settlement survey methodology and acceptance criteria." }
        ]
      },

      "derailment_damage": {
        "rail_bridge": [
          { code: "49 CFR 237", clause: "Section 237.33", req: "After a derailment affects a bridge, the railroad bridge engineer must determine the bridge is safe for train operations before returning to service." },
          { code: "49 CFR 237", clause: "Section 237.31", req: "Notification requirements — railroad must notify FRA of bridge damage within specified timeframe." },
          { code: "AREMA Manual", clause: "Chapter 15, Section 7.3", req: "Emergency inspection of railroad bridges after damage events. All members, connections, bearings, and track structure." }
        ]
      },

      "track_damage": {
        "rail_bridge": [
          { code: "49 CFR 213", clause: "Section 213.9", req: "Track safety standards — minimum track geometry requirements by FRA Class. Table of limits for gauge, alignment, profile, cross-level." },
          { code: "49 CFR 213", clause: "Section 213.113", req: "Defective rails — conditions requiring rail replacement or speed restriction." },
          { code: "AREMA Manual", clause: "Chapter 5, Section 3", req: "Track geometry standards for railroad bridges. Gauge, alignment, and surface requirements." }
        ]
      },

      "structural_crack": {
        "bridge_concrete": [
          { code: "AASHTO MBE", clause: "Section 6.5", req: "Concrete element evaluation. Condition Factor (phi_c) based on observed deterioration. Table 6A.4.2.3-1." },
          { code: "ACI 318", clause: "Chapter 22", req: "Evaluation of existing structures — strength assessment based on condition." },
          { code: "ACI 224R", clause: "Chapter 4", req: "Crack width limits for reinforced concrete — Table 4.1 for different exposure conditions." }
        ]
      },

      "spalling_delamination": {
        "bridge_concrete": [
          { code: "AASHTO MBE", clause: "Section 4.3", req: "Element-level condition assessment. Condition States CS1 through CS4 for concrete elements." },
          { code: "23 CFR 650", clause: "Section 650.305", req: "NBIS requirements — inspection frequency and procedures for bridges with deterioration." },
          { code: "ACI 562", clause: "Chapter 7", req: "Repair of existing concrete structures — repair of spalling and delamination." }
        ]
      },

      "fire_damage_concrete": {
        "bridge_concrete": [
          { code: "ACI 216.1", clause: "Section 5", req: "Assessment of fire-damaged concrete. Color change correlation to temperature. Strength reduction curves for concrete and reinforcement." },
          { code: "ACI 562", clause: "Chapter 7", req: "Repair of fire-damaged concrete — removal of damaged concrete, reinforcement assessment, repair methods." },
          { code: "AASHTO MBE", clause: "Section 5.5", req: "Post-fire inspection and load rating at reduced material properties." }
        ]
      },

      "scour": {
        "bridge_concrete": [
          { code: "23 CFR 650", clause: "Section 650.305(c)(5)", req: "NBIS requirement — prepare a plan of action for bridges determined to be scour critical." },
          { code: "FHWA HEC-18", clause: "Chapter 6", req: "Scour depth calculation methodology — general scour, contraction scour, and local scour equations." },
          { code: "FHWA HEC-23", clause: "Design Guidelines", req: "Scour countermeasure selection and design — riprap, gabions, sheet piling, grout bags." }
        ]
      },

      "bearing_damage": {
        "bridge_steel": [
          { code: "AASHTO LRFD", clause: "Section 14.7", req: "Elastomeric bearing design requirements. Shear strain limits. Compressive stress limits." },
          { code: "AASHTO MBE", clause: "Section 4.3", req: "Bearing condition assessment per element-level inspection." }
        ]
      },

      "vibration_fatigue_crack": {
        "process_piping": [
          { code: "API 570", clause: "Section 7.1.6", req: "Vibration assessment of piping systems. Small-bore connections and socket welds at highest risk." },
          { code: "ASME B31.3", clause: "Section 319.5", req: "Vibration — piping systems shall be designed and supported to prevent excessive vibration." },
          { code: "ASME OM-S/G-2003", clause: "Part 3", req: "Requirements for preoperational and initial startup vibration testing of piping systems." }
        ]
      },

      "corrosion_wall_loss": {
        "structural_steel": [
          { code: "API RP 2A", clause: "Section 14.2", req: "Assessment of corroded offshore structural members. Calculate reduced section capacity." },
          { code: "API RP 2I", clause: "Section 4.3", req: "Underwater inspection planning for offshore structures. Wall thickness measurement requirements." }
        ]
      },

      "member_buckling": {
        "structural_steel": [
          { code: "API RP 2A", clause: "Section 6.4", req: "Assessment of damaged structural members. Structural analysis with damaged member. Push-over analysis for platform assessment." },
          { code: "AISC 360", clause: "Chapter E", req: "Design of compression members. Column buckling provisions for assessment of buckled members." }
        ]
      },

      "bottom_corrosion": {
        "storage_tank": [
          { code: "API 653", clause: "Section 6.4.2", req: "Tank bottom evaluation. Minimum acceptable thickness. MFL scanning or UT grid." },
          { code: "API 653", clause: "Section 9.4", req: "Repair of tank bottoms — patch plates, overlay plates, or relining per API 653." }
        ]
      },

      "shell_corrosion": {
        "storage_tank": [
          { code: "API 653", clause: "Section 6.3", req: "Shell evaluation. Minimum required thickness per course. Corrosion rate and remaining life." },
          { code: "API 653", clause: "Section 6.3.4", req: "Maximum fill height determination for corroded tanks." }
        ]
      }
    };

    // ================================================================
    // METHOD-BASED CITATIONS
    // ================================================================

    var METHOD_CITATIONS: { [method: string]: Array<{ code: string; clause: string; req: string }> } = {
      "UT": [
        { code: "ASME V", clause: "Article 4 (UT of Welds)", req: "Ultrasonic examination of welds. Calibration, scanning, recording, and evaluation per Article 4." },
        { code: "ASME V", clause: "Article 5 (UT for Thickness)", req: "Ultrasonic examination for thickness determination. Contact method. Calibration requirements." },
        { code: "ASME V", clause: "Article 4, Mandatory Appendix III", req: "TOFD examination requirements — scanner setup, calibration, scan plans, acceptance criteria." },
        { code: "ASME V", clause: "Article 4, Mandatory Appendix IV", req: "Phased array UT examination requirements — focal law setup, calibration, encoded scanning." },
        { code: "ASTM E114", clause: "Standard Practice", req: "UT pulse-echo straight-beam examination by contact method." }
      ],
      "MT": [
        { code: "ASME V", clause: "Article 7", req: "Magnetic particle examination. Magnetization techniques, particle application, interpretation, and acceptance." },
        { code: "ASTM E709", clause: "Standard Guide", req: "Guide for magnetic particle testing — equipment, technique, and interpretation." },
        { code: "AWS D1.5", clause: "Section 6.10", req: "MT acceptance criteria for bridge welds per AWS D1.5 Table 6.1." }
      ],
      "PT": [
        { code: "ASME V", clause: "Article 6", req: "Liquid penetrant examination. Type I (fluorescent) or Type II (visible). Method A-D. Sensitivity levels." },
        { code: "ASTM E165", clause: "Standard Practice", req: "Practice for liquid penetrant testing for general industry." }
      ],
      "RT": [
        { code: "ASME V", clause: "Article 2", req: "Radiographic examination. Source selection, geometry, density, IQI requirements, and interpretation." },
        { code: "ASME V", clause: "Article 22", req: "Radioscopic (Real-Time) Imaging — digital radiography requirements." }
      ],
      "VT": [
        { code: "ASME V", clause: "Article 9", req: "Visual examination. Direct visual: 24-inch max distance, 30-degree angle. Remote visual: resolution and lighting requirements." },
        { code: "API 510", clause: "Section 6.4", req: "Internal and external visual inspection of pressure vessels." },
        { code: "23 CFR 650", clause: "Section 650.305", req: "NBIS visual inspection requirements for bridges. Inspection intervals, qualifications, and reporting." }
      ],
      "HARDNESS": [
        { code: "ASTM A1038", clause: "Standard Practice", req: "Portable hardness testing — Leeb, UCI, and TIV methods. Application guidance for field testing." },
        { code: "ASTM E110", clause: "Standard Test Method", req: "Indentation hardness of metallic materials by portable hardness testers." },
        { code: "NACE SP0472", clause: "Section 5", req: "In-situ hardness testing of welds in sour service. Maximum 200 HBW (22 HRC) for base metal and weld." }
      ],
      "REPLICA": [
        { code: "ASTM E1351", clause: "Standard Practice", req: "Production and evaluation of field metallographic replicas. Surface preparation, replication, and microscopic evaluation." },
        { code: "API 579-1", clause: "Part 10, Annex 10A", req: "Metallographic replication for creep damage classification — Neubauer/Wedel classification system (A through D)." }
      ],
      "DIMENSIONAL": [
        { code: "API 579-1", clause: "Part 8, Section 8.3.3", req: "Dimensional measurement requirements for distortion assessment — out-of-roundness, peaking, bulging." },
        { code: "AISC 303", clause: "Section 6", req: "Tolerances for steel structures — sweep, camber, cross-section dimensions, web flatness." }
      ],
      "GPR": [
        { code: "ASTM D6087", clause: "Standard Test Method", req: "Evaluating asphalt-covered concrete bridge decks using GPR." },
        { code: "ACI 228.2R", clause: "Chapter 5", req: "Nondestructive test methods for evaluation of concrete in structures — GPR methodology." }
      ],
      "SOUNDING": [
        { code: "ASTM D4580", clause: "Standard Practice", req: "Measuring delaminations in concrete bridge decks by sounding (chain drag and hammer)." }
      ],
      "IMPACT_ECHO": [
        { code: "ASTM C1383", clause: "Standard Test Method", req: "Measuring the P-wave speed and thickness of concrete plates using the impact-echo method." },
        { code: "ACI 228.2R", clause: "Chapter 5", req: "Impact-echo methodology for concrete evaluation." }
      ],
      "HALFCELL": [
        { code: "ASTM C876", clause: "Standard Test Method", req: "Corrosion potentials of uncoated reinforcing steel in concrete. Table 1: probability of corrosion based on potential readings." }
      ],
      "PMI": [
        { code: "API 578", clause: "Section 5", req: "PMI program guidelines — when to test, methods (XRF, OES), acceptance criteria, and documentation." }
      ],
      "DIVE_SURVEY": [
        { code: "API RP 2I", clause: "Section 4", req: "Inspection planning for underwater structures. Level I (general visual), Level II (cleaned close visual), Level III (NDE)." },
        { code: "FHWA-NHI-10-027", clause: "Chapter 2", req: "Underwater bridge inspection methodology — Level I through Level III survey types." }
      ],
      "CP": [
        { code: "NACE SP0176", clause: "Section 6", req: "Control of corrosion on steel fixed offshore structures — CP survey methods and protection criteria." },
        { code: "DNV-RP-B401", clause: "Section 8", req: "CP design and monitoring — protection criteria (-800mV to -1100mV vs Ag/AgCl)." }
      ],
      "SURVEY": [
        { code: "API RP 2A", clause: "Section 14.3", req: "Platform survey requirements — tilt, displacement, and settlement measurements." }
      ]
    };

    // ================================================================
    // TRACE FINDINGS
    // ================================================================

    for (var f = 0; f < findings.length; f++) {
      var finding = findings[f];
      var finding_cites = FINDING_CITATIONS[finding];
      if (!finding_cites) continue;

      // Try asset-specific first, then fallback to pressure_vessel
      var asset_cites = finding_cites[asset_class] || finding_cites["pressure_vessel"] || [];
      for (var c = 0; c < asset_cites.length; c++) {
        citations.push({
          code: asset_cites[c].code,
          clause: asset_cites[c].clause,
          requirement: asset_cites[c].req,
          applies_to: "Finding: " + finding,
          category: "finding"
        });
      }
    }

    // ================================================================
    // TRACE METHODS
    // ================================================================

    for (var m = 0; m < methods.length; m++) {
      var method = methods[m];
      var method_cites = METHOD_CITATIONS[method];
      if (!method_cites) continue;

      for (var c = 0; c < method_cites.length; c++) {
        citations.push({
          code: method_cites[c].code,
          clause: method_cites[c].clause,
          requirement: method_cites[c].req,
          applies_to: "Method: " + method,
          category: "method"
        });
      }
    }

    // ================================================================
    // GENERAL ASSET-CLASS CITATIONS (always included)
    // ================================================================

    var ASSET_GENERAL: { [asset: string]: Array<{ code: string; clause: string; req: string }> } = {
      "pressure_vessel": [
        { code: "API 510", clause: "Section 6 (Inspection Planning)", req: "Inspection planning requirements — risk assessment, inspection interval, scope of examination." },
        { code: "ASME BPVC Section VIII", clause: "Div. 1 or Div. 2", req: "Original construction code — provides design basis for fitness-for-service." }
      ],
      "process_piping": [
        { code: "API 570", clause: "Section 6 (Inspection Planning)", req: "Piping inspection planning — circuits, TMLs, injection points, CUI-susceptible areas." },
        { code: "ASME B31.3", clause: "Process Piping Code", req: "Design, fabrication, and examination requirements for process piping." }
      ],
      "storage_tank": [
        { code: "API 653", clause: "Section 6 (Evaluation)", req: "In-service tank evaluation — shell, bottom, foundation, appurtenances." },
        { code: "API 650", clause: "Construction code", req: "Design and construction requirements for welded storage tanks. Provides design basis." }
      ],
      "pipeline": [
        { code: "ASME B31.8", clause: "Gas transmission", req: "Gas transmission and distribution piping systems." },
        { code: "49 CFR 192", clause: "Federal pipeline safety", req: "Federal safety standards for gas transmission pipelines." },
        { code: "49 CFR 195", clause: "Federal pipeline safety", req: "Federal safety standards for hazardous liquid pipelines." }
      ],
      "structural_steel": [
        { code: "API RP 2A", clause: "Section 14 (Assessment)", req: "Assessment of existing platforms — structural analysis, inspection, and repair." },
        { code: "AWS D1.1", clause: "Structural Welding Code", req: "Welding, inspection, and repair requirements for structural steel." }
      ],
      "offshore_platform": [
        { code: "API RP 2A", clause: "Recommended Practice", req: "Planning, designing, and constructing fixed offshore platforms." },
        { code: "30 CFR 250", clause: "BSEE regulations", req: "BSEE regulations for oil and gas operations on the OCS." }
      ],
      "bridge_steel": [
        { code: "AASHTO MBE", clause: "Manual for Bridge Evaluation", req: "Inspection, evaluation, and load rating of highway bridges." },
        { code: "23 CFR 650", clause: "NBIS", req: "National Bridge Inspection Standards — federal requirements for bridge inspection." },
        { code: "AWS D1.5", clause: "Bridge Welding Code", req: "Welding requirements specific to bridge structures." }
      ],
      "bridge_concrete": [
        { code: "AASHTO MBE", clause: "Manual for Bridge Evaluation", req: "Inspection and evaluation of concrete bridge elements." },
        { code: "23 CFR 650", clause: "NBIS", req: "National Bridge Inspection Standards." },
        { code: "ACI 318", clause: "Building Code Requirements for Structural Concrete", req: "Concrete design requirements used as evaluation basis." }
      ],
      "rail_bridge": [
        { code: "49 CFR 237", clause: "FRA Bridge Safety Standards", req: "Federal Railroad Administration requirements for railroad bridge safety management." },
        { code: "AREMA Manual", clause: "Chapter 15 (Steel Structures)", req: "Design, rating, and inspection of railroad bridge structures." },
        { code: "49 CFR 213", clause: "FRA Track Safety Standards", req: "Track geometry and rail condition requirements." }
      ]
    };

    var general_cites = ASSET_GENERAL[asset_class] || ASSET_GENERAL["pressure_vessel"] || [];
    for (var g = 0; g < general_cites.length; g++) {
      citations.push({
        code: general_cites[g].code,
        clause: general_cites[g].clause,
        requirement: general_cites[g].req,
        applies_to: "Asset class: " + asset_class,
        category: "general"
      });
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        citations: citations,
        summary: {
          total_citations: citations.length,
          finding_citations: citations.filter(function(c) { return c.category === "finding"; }).length,
          method_citations: citations.filter(function(c) { return c.category === "method"; }).length,
          general_citations: citations.filter(function(c) { return c.category === "general"; }).length
        }
      })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ error: "code-trace error", message: err.message || "Unknown error" })
    };
  }
};

export { handler };
