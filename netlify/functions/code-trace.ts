/**
 * DEPLOY68 — Code Trace API v1
 * FORGED NDT Intelligence OS
 * 
 * Standalone Netlify function that generates code authority traces.
 * Called by frontend after receiving output from DRE, Voice, or any engine.
 * 
 * POST /api/code-trace
 * Body: {
 *   findings: string[],       // e.g. ["crack", "corrosion", "porosity"]
 *   methods: string[],        // e.g. ["UT", "MT", "VT"]
 *   disposition: string,      // e.g. "immediate_inspection"
 *   asset_class: string,      // e.g. "Pipeline"
 *   score_dimensions?: string[], // e.g. ["event_severity", "consequence"]
 *   underwater_contexts?: string[] // e.g. ["adci_general", "offshore"]
 * }
 * 
 * Returns: CodeTraceOutput with full clause references and engineering rationale.
 * 
 * DETERMINISTIC — no AI calls, millisecond execution.
 * String concatenation only — no backtick template literals.
 * All logic inlined — no lib/ imports.
 */

import { Handler } from "@netlify/functions";

// ============================================================
// TYPES
// ============================================================

interface CodeReference {
  code_family: string;
  code_edition: string;
  clause: string;
  title: string;
  requirement_summary: string;
  acceptance_criteria: string;
  engineering_rationale: string;
}

interface FindingTrace {
  finding_type: string;
  display_name: string;
  references: CodeReference[];
  rejection_basis: string;
  physics_basis: string;
}

interface MethodTrace {
  method: string;
  display_name: string;
  references: CodeReference[];
  capability_summary: string;
  limitation_summary: string;
}

interface DispositionTrace {
  disposition: string;
  references: CodeReference[];
  authority_statement: string;
}

interface ScoreDimensionTrace {
  dimension: string;
  engineering_basis: string;
  references: CodeReference[];
}

interface CodeTraceOutput {
  finding_traces: FindingTrace[];
  method_traces: MethodTrace[];
  disposition_trace: DispositionTrace | null;
  score_traces: ScoreDimensionTrace[];
  underwater_traces: CodeReference[];
  applicable_code_families: string[];
  generated_at: string;
  trace_version: string;
}

// ============================================================
// FINDING TYPE -> CODE REFERENCES
// ============================================================

var FINDING_CODE_MAP: Record<string, FindingTrace> = {
  crack: {
    finding_type: "crack",
    display_name: "Crack (Any Orientation)",
    references: [
      {
        code_family: "AWS D1.1",
        code_edition: "2020",
        clause: "Table 6.1, Item 1",
        title: "Crack Prohibition",
        requirement_summary: "No cracks permitted regardless of size or location",
        acceptance_criteria: "Zero tolerance — any crack is rejectable",
        engineering_rationale: "Cracks are stress concentrators that propagate under cyclic loading. A 0.5mm surface crack in structural steel under fatigue loading can propagate to failure in as few as 10,000 cycles."
      },
      {
        code_family: "API 1104",
        code_edition: "2021",
        clause: "Section 9.3.1",
        title: "Crack Acceptance Criteria",
        requirement_summary: "Cracks not acceptable unless evaluated by ECA per Appendix A",
        acceptance_criteria: "Reject unless engineering critical assessment (ECA) performed",
        engineering_rationale: "Pipeline cracks under hoop stress and pressure cycling have high propagation rates. ECA required to demonstrate fitness-for-service."
      },
      {
        code_family: "ASME VIII Div 1",
        code_edition: "2023",
        clause: "UW-51(b)",
        title: "Radiographic Acceptance — Cracks",
        requirement_summary: "Linear indications interpreted as cracks are unacceptable",
        acceptance_criteria: "No cracks permitted in pressure boundary welds",
        engineering_rationale: "Pressure vessel failure from crack propagation under internal pressure is catastrophic. ASME mandates zero crack tolerance in pressure boundary."
      },
      {
        code_family: "ASME Section XI",
        code_edition: "2023",
        clause: "IWB-3510",
        title: "Flaw Evaluation — Class 1 Components",
        requirement_summary: "Flaws exceeding Table IWB-3510-1 require analytical evaluation",
        acceptance_criteria: "Evaluate per IWB-3600 fracture mechanics methodology",
        engineering_rationale: "Nuclear components use damage tolerance approach — flaw is evaluated against critical flaw size for remaining design life."
      }
    ],
    rejection_basis: "Universal rejection across all major fabrication codes. Cracks are the most critical discontinuity in any structural or pressure-retaining component.",
    physics_basis: "Stress intensity factor at crack tip exceeds material fracture toughness under service loading. Propagation follows Paris Law: da/dN = C(delta_K)^m. Even sub-critical cracks grow under cyclic loading."
  },
  incomplete_fusion: {
    finding_type: "incomplete_fusion",
    display_name: "Incomplete Fusion / Lack of Fusion",
    references: [
      {
        code_family: "AWS D1.1",
        code_edition: "2020",
        clause: "Table 6.1, Item 2",
        title: "Complete Joint Penetration — Fusion",
        requirement_summary: "Incomplete fusion not permitted in CJP groove welds",
        acceptance_criteria: "Reject — no incomplete fusion in tension or fatigue applications",
        engineering_rationale: "Lack of fusion creates a planar discontinuity that acts as a crack initiation site under tensile loading."
      },
      {
        code_family: "API 1104",
        code_edition: "2021",
        clause: "Section 9.3.3",
        title: "Inadequate Penetration Without High-Low",
        requirement_summary: "IP length limits based on weld length inspected",
        acceptance_criteria: "Individual max 1 inch, aggregate max 1 inch in 12 inches of weld",
        engineering_rationale: "Pipeline girth welds under axial and bending loads require full cross-section for design strength."
      },
      {
        code_family: "ASME VIII Div 1",
        code_edition: "2023",
        clause: "UW-51(b)(3)",
        title: "Incomplete Fusion — Radiographic Standards",
        requirement_summary: "Incomplete fusion indications evaluated per Appendix 4",
        acceptance_criteria: "Linear indication limits per Table 4-1",
        engineering_rationale: "Planar flaws in pressure boundary are more severe than volumetric flaws due to stress concentration geometry."
      }
    ],
    rejection_basis: "Planar discontinuity — acts as crack under load. Universally limited or prohibited in structural and pressure applications.",
    physics_basis: "Incomplete fusion creates a disbond plane with near-zero cross-sectional area for load transfer. Under tensile stress, the effective stress at the flaw boundary approaches infinity (stress singularity), identical to crack behavior."
  },
  porosity: {
    finding_type: "porosity",
    display_name: "Porosity (Gas Pores)",
    references: [
      {
        code_family: "AWS D1.1",
        code_edition: "2020",
        clause: "Table 6.1, Items 8-10",
        title: "Porosity Limits — Visual and RT",
        requirement_summary: "Sum of diameters shall not exceed limits based on weld size",
        acceptance_criteria: "Piping porosity: max 3/8 inch in any linear inch. Scattered: frequency-based limits per Table 6.1",
        engineering_rationale: "Porosity reduces effective cross-section and can act as fatigue initiation sites when clustered."
      },
      {
        code_family: "API 1104",
        code_edition: "2021",
        clause: "Section 9.3.6",
        title: "Porosity — Radiographic Acceptance",
        requirement_summary: "Individual pore max dimension and distribution limits",
        acceptance_criteria: "Individual pore shall not exceed 1/8 of weld width or 1/4 inch max",
        engineering_rationale: "Gas entrapment in pipeline welds is typically process-related (moisture, shielding loss) and indicates welding parameter control issues."
      },
      {
        code_family: "ASME VIII Div 1",
        code_edition: "2023",
        clause: "Appendix 4, Table 4-1",
        title: "Rounded Indication Acceptance",
        requirement_summary: "Charts based on material thickness and indication size",
        acceptance_criteria: "Rounded indications evaluated per acceptance charts in Appendix 4",
        engineering_rationale: "Volumetric flaws in pressure vessels are less critical than planar flaws but reduce burst pressure proportionally to cross-section loss."
      }
    ],
    rejection_basis: "Size and distribution dependent — not automatically rejectable. Exceeding limits indicates process control failure.",
    physics_basis: "Volumetric discontinuity with rounded geometry. Stress concentration factor approximately 2.0 (vs >5.0 for planar flaws). Primary concern is cross-section reduction and fatigue initiation under high-cycle loading."
  },
  undercut: {
    finding_type: "undercut",
    display_name: "Undercut",
    references: [
      {
        code_family: "AWS D1.1",
        code_edition: "2020",
        clause: "Table 6.1, Item 7",
        title: "Undercut Limits",
        requirement_summary: "Depth limits based on loading condition",
        acceptance_criteria: "Statically loaded: max 1/32 inch. Cyclically loaded: max 0.01 inch",
        engineering_rationale: "Undercut creates a stress riser at the weld toe — the highest-stressed region in a fillet or groove weld under fatigue loading."
      },
      {
        code_family: "API 1104",
        code_edition: "2021",
        clause: "Section 9.3.8",
        title: "Undercut Acceptance",
        requirement_summary: "Depth and length limits",
        acceptance_criteria: "Max depth 1/32 inch or 12.5% of wall thickness, whichever is smaller",
        engineering_rationale: "Pipeline undercut under hoop stress acts as longitudinal stress concentrator at weld toe."
      }
    ],
    rejection_basis: "Depth and length dependent. Critical in fatigue applications due to weld toe stress concentration.",
    physics_basis: "Geometric notch at weld toe reduces local cross-section and creates stress concentration factor of 2.5-4.0 depending on depth-to-width ratio."
  },
  slag_inclusion: {
    finding_type: "slag_inclusion",
    display_name: "Slag Inclusion",
    references: [
      {
        code_family: "AWS D1.1",
        code_edition: "2020",
        clause: "Table 6.1, Items 3-5",
        title: "Slag Inclusion Limits",
        requirement_summary: "Length and width limits based on weld size and loading",
        acceptance_criteria: "Elongated slag: max 2/3 of weld thickness in any 12-inch span",
        engineering_rationale: "Slag inclusions reduce effective throat and create stress risers. Process-specific: SMAW and FCAW are primary sources."
      },
      {
        code_family: "API 1104",
        code_edition: "2021",
        clause: "Section 9.3.4",
        title: "Slag Inclusion Acceptance",
        requirement_summary: "Individual and aggregate length limits",
        acceptance_criteria: "Individual max 2 inches. Aggregate max 8% of weld length in any 12-inch span",
        engineering_rationale: "Linear slag in pipeline girth welds reduces cross-section for hoop stress resistance."
      }
    ],
    rejection_basis: "Length and distribution dependent. Always associated with flux-based processes (SMAW, SAW, FCAW).",
    physics_basis: "Non-metallic inclusion with near-zero tensile strength. Reduces effective weld cross-section proportionally to inclusion area."
  },
  incomplete_penetration: {
    finding_type: "incomplete_penetration",
    display_name: "Incomplete Joint Penetration",
    references: [
      {
        code_family: "AWS D1.1",
        code_edition: "2020",
        clause: "Table 6.1, Item 2",
        title: "CJP Groove Weld — Penetration",
        requirement_summary: "Complete joint penetration required where specified by design",
        acceptance_criteria: "No incomplete penetration in CJP welds",
        engineering_rationale: "Design throat assumes full penetration. Any reduction directly decreases allowable stress capacity."
      },
      {
        code_family: "API 1104",
        code_edition: "2021",
        clause: "Section 9.3.2",
        title: "Inadequate Penetration — Root",
        requirement_summary: "Length limits for root penetration deficiency",
        acceptance_criteria: "Individual max 1 inch. Aggregate max 1 inch in 12 inches",
        engineering_rationale: "Root penetration deficiency in pipeline girth welds creates internal surface flaw exposed to product and pressure."
      }
    ],
    rejection_basis: "Critical in CJP welds — design assumes full penetration.",
    physics_basis: "Reduces effective throat to less than design requirement. Root-side incomplete penetration is exposed to internal environment."
  },
  overlap: {
    finding_type: "overlap",
    display_name: "Overlap (Cold Lap)",
    references: [
      {
        code_family: "AWS D1.1",
        code_edition: "2020",
        clause: "Section 6.9.2",
        title: "Overlap — Visual Acceptance",
        requirement_summary: "Overlap not permitted",
        acceptance_criteria: "Reject — overlap indicates insufficient fusion at weld toe",
        engineering_rationale: "Overlap is weld metal that has flowed onto base metal without fusing. Creates a notch and unfused interface."
      }
    ],
    rejection_basis: "Not permitted under most codes. Indicates inadequate heat input or incorrect technique.",
    physics_basis: "Unfused interface at weld toe creates a pre-existing crack-like discontinuity."
  },
  burn_through: {
    finding_type: "burn_through",
    display_name: "Burn-Through / Melt-Through",
    references: [
      {
        code_family: "API 1104",
        code_edition: "2021",
        clause: "Section 9.3.7",
        title: "Burn-Through Acceptance",
        requirement_summary: "Size limits based on pipe diameter",
        acceptance_criteria: "Max 1/4 inch dimension. Max one per weld",
        engineering_rationale: "Burn-through creates a thin spot or hole in the root, reducing pressure-containing cross-section."
      }
    ],
    rejection_basis: "Size limited. Primarily a pipeline and thin-wall concern.",
    physics_basis: "Excessive heat input melts through root. Reduces wall thickness locally."
  },
  corrosion: {
    finding_type: "corrosion",
    display_name: "Corrosion (General / Localized)",
    references: [
      {
        code_family: "API 570",
        code_edition: "2020",
        clause: "Section 7.1",
        title: "Corrosion Assessment",
        requirement_summary: "Remaining wall thickness evaluation and corrosion rate calculation",
        acceptance_criteria: "Minimum required thickness per design code",
        engineering_rationale: "Corrosion reduces pressure-containing wall thickness. Rate determines remaining life and inspection interval."
      },
      {
        code_family: "API 510",
        code_edition: "2020",
        clause: "Section 7.4",
        title: "Corrosion Rate and Remaining Life",
        requirement_summary: "Calculate short-term and long-term corrosion rates",
        acceptance_criteria: "Remaining life = (t_actual - t_required) / corrosion_rate",
        engineering_rationale: "Trending corrosion rate provides prediction of when minimum thickness will be reached."
      },
      {
        code_family: "ASME Section XI",
        code_edition: "2023",
        clause: "IWC-3520",
        title: "Wall Thinning Evaluation — Class 2",
        requirement_summary: "Evaluate thinned areas per analytical methods",
        acceptance_criteria: "Remaining wall must meet design pressure requirements",
        engineering_rationale: "Nuclear piping thinning from flow-accelerated corrosion (FAC) requires analytical evaluation."
      }
    ],
    rejection_basis: "Below minimum required wall thickness per design code.",
    physics_basis: "Electrochemical dissolution of metal. Rate depends on temperature, chemistry, flow velocity, and metallurgy."
  },
  fatigue_crack: {
    finding_type: "fatigue_crack",
    display_name: "Fatigue Crack",
    references: [
      {
        code_family: "API 579-1/ASME FFS-1",
        code_edition: "2021",
        clause: "Part 9",
        title: "Assessment of Crack-Like Flaws",
        requirement_summary: "Fitness-for-service evaluation using fracture mechanics",
        acceptance_criteria: "Flaw must be below critical flaw size",
        engineering_rationale: "Fatigue cracks grow predictably under cyclic loading. Paris Law allows remaining life prediction."
      },
      {
        code_family: "BS 7910",
        code_edition: "2019",
        clause: "Section 8",
        title: "Assessment of Flaws in Fusion Welded Structures",
        requirement_summary: "Fracture assessment using Failure Assessment Diagram (FAD)",
        acceptance_criteria: "Assessment point must fall within FAD acceptable region",
        engineering_rationale: "FAD simultaneously evaluates fracture and plastic collapse failure modes."
      }
    ],
    rejection_basis: "Requires fracture mechanics evaluation. Automatic rejection in fabrication codes.",
    physics_basis: "Cyclic stress creates progressive crack extension. Beach marks indicate load cycles. Growth rate accelerates as crack lengthens."
  },
  erosion: {
    finding_type: "erosion",
    display_name: "Erosion / Erosion-Corrosion",
    references: [
      {
        code_family: "API 570",
        code_edition: "2020",
        clause: "Section 5.2.2",
        title: "Erosion-Corrosion Assessment",
        requirement_summary: "Identify erosion-prone locations",
        acceptance_criteria: "Same wall thickness criteria as corrosion",
        engineering_rationale: "Erosion removes protective layer, accelerating material loss up to 10x general corrosion rate."
      }
    ],
    rejection_basis: "Below minimum wall thickness.",
    physics_basis: "Mechanical removal of material by impingement. Flow-accelerated corrosion combines erosion with corrosion synergistically."
  },
  pitting: {
    finding_type: "pitting",
    display_name: "Pitting Corrosion",
    references: [
      {
        code_family: "API 579-1/ASME FFS-1",
        code_edition: "2021",
        clause: "Part 6",
        title: "Assessment of Pitting Damage",
        requirement_summary: "Remaining Strength Factor (RSF) calculation for pitted areas",
        acceptance_criteria: "RSF must exceed RSF_allowable (typically 0.9)",
        engineering_rationale: "Pitting reduces local wall thickness. Closely spaced pits interact to reduce strength more than individual pits."
      }
    ],
    rejection_basis: "RSF below allowable. Pitting depth exceeding threshold for pit spacing.",
    physics_basis: "Localized electrochemical cell creates deep narrow material loss. Pit depth-to-diameter ratio determines stress concentration."
  },
  hydrogen_damage: {
    finding_type: "hydrogen_damage",
    display_name: "Hydrogen Damage",
    references: [
      {
        code_family: "API 571",
        code_edition: "2020",
        clause: "Section 5.1.2.3",
        title: "Hydrogen Induced Cracking (HIC)",
        requirement_summary: "Stepwise cracking from hydrogen diffusion",
        acceptance_criteria: "Evaluate per API 579 Part 7 or Part 9",
        engineering_rationale: "Hydrogen diffuses into steel and recombines at inclusions or interfaces, creating internal blistering and cracking."
      },
      {
        code_family: "API 941",
        code_edition: "2016",
        clause: "Nelson Curves",
        title: "Steels for Hydrogen Service",
        requirement_summary: "Material selection based on temperature and hydrogen partial pressure",
        acceptance_criteria: "Operating conditions must fall below applicable Nelson Curve",
        engineering_rationale: "High temperature hydrogen attack (HTHA) causes irreversible grain boundary damage. Nelson Curves define safe operating envelope."
      }
    ],
    rejection_basis: "Hydrogen damage is often internal and progressive. Detected damage typically indicates advanced condition.",
    physics_basis: "Atomic hydrogen diffuses through steel lattice. Recombination at voids creates internal pressure. HIC, SOHIC, and HTHA are distinct mechanisms with different detection methods."
  },
  stress_corrosion_cracking: {
    finding_type: "stress_corrosion_cracking",
    display_name: "Stress Corrosion Cracking (SCC)",
    references: [
      {
        code_family: "API 571",
        code_edition: "2020",
        clause: "Section 5.1.2.1",
        title: "Chloride Stress Corrosion Cracking",
        requirement_summary: "Branching transgranular cracks in austenitic SS from chloride exposure under tensile stress",
        acceptance_criteria: "Evaluate per API 579 Part 9. May require immediate shutdown depending on extent.",
        engineering_rationale: "SCC requires three simultaneous conditions: susceptible material, corrosive environment, and tensile stress. Removing any one condition arrests the mechanism."
      }
    ],
    rejection_basis: "SCC is progressive and can lead to sudden failure. Detected SCC typically requires immediate engineering evaluation.",
    physics_basis: "Electrochemical dissolution at crack tip under tensile stress. Crack propagation rate depends on stress intensity, environment, and temperature."
  },
  creep: {
    finding_type: "creep",
    display_name: "Creep Damage",
    references: [
      {
        code_family: "API 579-1/ASME FFS-1",
        code_edition: "2021",
        clause: "Part 10",
        title: "Assessment of Creep Damage",
        requirement_summary: "Remaining life assessment for equipment operating in creep range",
        acceptance_criteria: "Creep life fraction consumed must allow adequate remaining life",
        engineering_rationale: "Above material-specific temperature threshold, time-dependent deformation and void formation lead to eventual rupture."
      },
      {
        code_family: "API 571",
        code_edition: "2020",
        clause: "Section 5.1.3.1",
        title: "Creep / Stress Rupture",
        requirement_summary: "Time-dependent damage in high-temperature service",
        acceptance_criteria: "Metallographic examination for creep voids and classification",
        engineering_rationale: "Creep damage progresses through isolated voids, aligned voids, linked voids (micro-cracks), to macro-cracks. Each stage has different remaining life implications."
      }
    ],
    rejection_basis: "Creep damage beyond isolated voids requires engineering evaluation. Macro-crack stage typically requires repair or retirement.",
    physics_basis: "Thermally activated dislocation climb and grain boundary sliding at elevated temperature. Larson-Miller parameter relates time and temperature to damage accumulation."
  }
};

// ============================================================
// NDE METHOD -> CODE REFERENCES
// ============================================================

var METHOD_CODE_MAP: Record<string, MethodTrace> = {
  VT: {
    method: "VT",
    display_name: "Visual Testing",
    references: [
      {
        code_family: "ASME Section V",
        code_edition: "2023",
        clause: "Article 9",
        title: "Visual Examination",
        requirement_summary: "Direct or remote visual examination of surfaces",
        acceptance_criteria: "Per referencing code section",
        engineering_rationale: "Primary screening method. Detects surface conditions and geometric deviations."
      },
      {
        code_family: "AWS D1.1",
        code_edition: "2020",
        clause: "Section 6.9",
        title: "Visual Inspection Requirements",
        requirement_summary: "All welds shall be visually inspected per Table 6.1",
        acceptance_criteria: "Table 6.1 visual acceptance criteria",
        engineering_rationale: "Visual inspection catches approximately 70% of rejectable conditions when performed by qualified inspector."
      }
    ],
    capability_summary: "Surface conditions, geometry, workmanship. Cannot detect subsurface flaws.",
    limitation_summary: "Surface only. Requires adequate lighting (min 50 fc per AWS, 1000 lux per ASME V)."
  },
  UT: {
    method: "UT",
    display_name: "Ultrasonic Testing",
    references: [
      {
        code_family: "ASME Section V",
        code_edition: "2023",
        clause: "Article 4",
        title: "Ultrasonic Examination Methods for Welds",
        requirement_summary: "Pulse-echo and TOFD methods for weld examination",
        acceptance_criteria: "Per referencing code",
        engineering_rationale: "Sound wave interaction with discontinuities provides detection, sizing, and characterization of internal flaws."
      },
      {
        code_family: "ASME Section V",
        code_edition: "2023",
        clause: "Article 5",
        title: "UT Examination of Materials",
        requirement_summary: "Thickness measurement and lamination detection",
        acceptance_criteria: "Material-specific acceptance per purchasing specification",
        engineering_rationale: "Through-transmission and pulse-echo methods measure remaining wall thickness."
      }
    ],
    capability_summary: "Subsurface flaw detection. Thickness measurement. Crack sizing. TOFD for accurate height.",
    limitation_summary: "Requires coupling medium. Geometry limitations. Coarse grain materials attenuate signal."
  },
  RT: {
    method: "RT",
    display_name: "Radiographic Testing",
    references: [
      {
        code_family: "ASME Section V",
        code_edition: "2023",
        clause: "Article 2",
        title: "Radiographic Examination",
        requirement_summary: "Film and digital radiography",
        acceptance_criteria: "Per referencing code (VIII Appendix 4, API 1104 Section 9)",
        engineering_rationale: "Through-thickness projection imaging reveals internal discontinuity morphology. Permanent record."
      }
    ],
    capability_summary: "Internal volumetric flaws. Permanent record. Through-wall imaging.",
    limitation_summary: "Poor sensitivity to planar flaws parallel to beam. Radiation safety required. Both-side access needed."
  },
  MT: {
    method: "MT",
    display_name: "Magnetic Particle Testing",
    references: [
      {
        code_family: "ASME Section V",
        code_edition: "2023",
        clause: "Article 7",
        title: "Magnetic Particle Examination",
        requirement_summary: "Surface and near-surface discontinuities in ferromagnetic materials",
        acceptance_criteria: "Per referencing code section",
        engineering_rationale: "Magnetic flux leakage at discontinuity attracts particles."
      }
    ],
    capability_summary: "Surface and near-surface flaws in ferromagnetic materials. Excellent crack sensitivity.",
    limitation_summary: "Ferromagnetic materials ONLY. Orientation-dependent. Near-surface depth limited to 1/4 inch."
  },
  PT: {
    method: "PT",
    display_name: "Liquid Penetrant Testing",
    references: [
      {
        code_family: "ASME Section V",
        code_edition: "2023",
        clause: "Article 6",
        title: "Liquid Penetrant Examination",
        requirement_summary: "Surface-breaking discontinuities in non-porous materials",
        acceptance_criteria: "Per referencing code section",
        engineering_rationale: "Capillary action draws penetrant into surface-breaking flaws."
      }
    ],
    capability_summary: "Surface-breaking flaws in any non-porous material.",
    limitation_summary: "Surface-breaking ONLY. Surface must be clean and dry. Temperature sensitive (40-125 deg F)."
  },
  PAUT: {
    method: "PAUT",
    display_name: "Phased Array Ultrasonic Testing",
    references: [
      {
        code_family: "ASME Section V",
        code_edition: "2023",
        clause: "Article 4, Mandatory Appendix III",
        title: "TOFD and Phased Array UT Techniques",
        requirement_summary: "Electronic beam steering and focusing for weld examination",
        acceptance_criteria: "Per referencing code — typically same as conventional UT",
        engineering_rationale: "Multi-element transducer provides electronic beam steering. S-scan provides real-time cross-sectional image."
      }
    ],
    capability_summary: "Full weld volume in single pass. Real-time S-scan imaging. Electronic focusing.",
    limitation_summary: "Higher cost. Same material/geometry limitations as conventional UT."
  },
  TOFD: {
    method: "TOFD",
    display_name: "Time-of-Flight Diffraction",
    references: [
      {
        code_family: "ASME Section V",
        code_edition: "2023",
        clause: "Article 4, Mandatory Appendix III",
        title: "TOFD Technique",
        requirement_summary: "Diffraction-based flaw detection and sizing",
        acceptance_criteria: "Per referencing code",
        engineering_rationale: "Diffracted signals from flaw tips provide accurate height measurement. Sizing accuracy +/- 1mm."
      }
    ],
    capability_summary: "Accurate flaw height sizing. Orientation-independent detection.",
    limitation_summary: "Dead zones at surface and back wall. Requires two probes. Not suited for thin materials."
  },
  AE: {
    method: "AE",
    display_name: "Acoustic Emission Testing",
    references: [
      {
        code_family: "ASME Section V",
        code_edition: "2023",
        clause: "Article 12",
        title: "Acoustic Emission Examination",
        requirement_summary: "Passive monitoring of stress waves from active defect mechanisms",
        acceptance_criteria: "Source classification per test protocol",
        engineering_rationale: "Only method that detects active damage progression in real time."
      }
    ],
    capability_summary: "Real-time monitoring of active damage. Source location. Monitors entire structure.",
    limitation_summary: "Cannot detect static flaws. Requires loading. High noise sensitivity."
  },
  ET: {
    method: "ET",
    display_name: "Eddy Current Testing",
    references: [
      {
        code_family: "ASME Section V",
        code_edition: "2023",
        clause: "Article 8",
        title: "Eddy Current Examination",
        requirement_summary: "Electromagnetic induction for surface/near-surface flaws in conductive materials",
        acceptance_criteria: "Per referencing code and calibration standard",
        engineering_rationale: "Alternating current induces eddy currents. Discontinuities alter flow, changing coil impedance."
      }
    ],
    capability_summary: "Surface/near-surface flaws in conductive materials. No coupling medium. High-speed scanning.",
    limitation_summary: "Conductive materials only. Depth limited by skin effect. Reference standards required."
  },
  MFL: {
    method: "MFL",
    display_name: "Magnetic Flux Leakage",
    references: [
      {
        code_family: "API 570",
        code_edition: "2020",
        clause: "Section 7.1.4",
        title: "Screening Methods — MFL",
        requirement_summary: "Screening for wall loss in ferromagnetic piping and storage tank floors",
        acceptance_criteria: "MFL is screening — anomalies confirmed by UT thickness measurement",
        engineering_rationale: "Magnetic saturation of wall with flux leakage at thin spots provides rapid screening of large areas."
      },
      {
        code_family: "API 653",
        code_edition: "2014",
        clause: "Section 6.3.2",
        title: "Tank Floor Examination — MFL",
        requirement_summary: "MFL scanning of storage tank floor plates",
        acceptance_criteria: "Indications confirmed by UT. Floor replacement criteria per Section 4.4",
        engineering_rationale: "Tank floor corrosion is bottom-side (soil contact) and not visible from interior without MFL or UT scanning."
      }
    ],
    capability_summary: "Rapid screening of large ferromagnetic surfaces for wall loss. Tank floors and piping.",
    limitation_summary: "Screening only — requires UT confirmation. Ferromagnetic materials only. Surface condition affects sensitivity."
  }
};

// ============================================================
// DISPOSITION -> CODE REFERENCES
// ============================================================

var DISPOSITION_CODE_MAP: Record<string, DispositionTrace> = {
  continue_normal: {
    disposition: "continue_normal",
    references: [
      {
        code_family: "API 579-1/ASME FFS-1",
        code_edition: "2021",
        clause: "Part 2, Section 2.4",
        title: "Assessment Results — Acceptable",
        requirement_summary: "Component fit for continued service",
        acceptance_criteria: "All assessment levels pass with adequate margin",
        engineering_rationale: "Remaining strength exceeds required strength with appropriate safety factor."
      }
    ],
    authority_statement: "Component meets all applicable code requirements. No restrictions required."
  },
  continue_monitoring: {
    disposition: "continue_monitoring",
    references: [
      {
        code_family: "API 510",
        code_edition: "2020",
        clause: "Section 7.5",
        title: "Inspection Interval Determination",
        requirement_summary: "Interval based on remaining life calculation",
        acceptance_criteria: "Next inspection before 50% remaining life or max interval per code",
        engineering_rationale: "Monitoring confirms predictions and catches accelerated degradation."
      }
    ],
    authority_statement: "Currently acceptable. Monitoring required with interval set by degradation rate."
  },
  restrict_operations: {
    disposition: "restrict_operations",
    references: [
      {
        code_family: "API 579-1/ASME FFS-1",
        code_edition: "2021",
        clause: "Part 2, Section 2.4.3",
        title: "Acceptable with Restrictions",
        requirement_summary: "Fit for service under reduced operating conditions",
        acceptance_criteria: "Acceptable at de-rated pressure, temperature, or loading",
        engineering_rationale: "Reducing operating severity extends remaining life."
      }
    ],
    authority_statement: "Operational restrictions (de-rating) required to maintain safety margin."
  },
  immediate_inspection: {
    disposition: "immediate_inspection",
    references: [
      {
        code_family: "API 510",
        code_edition: "2020",
        clause: "Section 6.6",
        title: "Unscheduled Inspections",
        requirement_summary: "Immediate inspection for damage events or threshold exceedances",
        acceptance_criteria: "Scope determined by event type and component history",
        engineering_rationale: "Event-driven damage may not follow predicted curves. Immediate assessment required."
      }
    ],
    authority_statement: "Immediate inspection required to assess integrity before continued operation."
  },
  repair_required: {
    disposition: "repair_required",
    references: [
      {
        code_family: "API 510",
        code_edition: "2020",
        clause: "Section 8",
        title: "Repairs, Alterations, and Rerating",
        requirement_summary: "Repairs must meet original construction code or NBIC Part 3",
        acceptance_criteria: "Repair procedure approved by authorized inspector",
        engineering_rationale: "Repair restores component to acceptable condition."
      }
    ],
    authority_statement: "Does not meet acceptance criteria. Repair required before return to service."
  },
  engineering_evaluation: {
    disposition: "engineering_evaluation",
    references: [
      {
        code_family: "API 579-1/ASME FFS-1",
        code_edition: "2021",
        clause: "Part 1, Section 1.4",
        title: "Assessment Levels",
        requirement_summary: "Three-level assessment: screening, detailed, advanced",
        acceptance_criteria: "Progressive analytical rigor for complex flaws",
        engineering_rationale: "Inspector findings alone insufficient for disposition. Engineering analysis required."
      }
    ],
    authority_statement: "Requires engineering evaluation per API 579 or equivalent FFS methodology."
  },
  shutdown_consideration: {
    disposition: "shutdown_consideration",
    references: [
      {
        code_family: "API 510",
        code_edition: "2020",
        clause: "Section 6.2",
        title: "Imminent Danger",
        requirement_summary: "Equipment presenting imminent danger removed from service",
        acceptance_criteria: "Authorized inspector judgment",
        engineering_rationale: "Risk of continued operation exceeds cost of shutdown."
      },
      {
        code_family: "OSHA",
        code_edition: "29 CFR 1910.119",
        clause: "Section (j)(5)",
        title: "Mechanical Integrity",
        requirement_summary: "Equipment outside acceptable limits must be corrected before further use",
        acceptance_criteria: "Employer shall correct deficiencies",
        engineering_rationale: "Regulatory requirement. OSHA enforcement authority."
      }
    ],
    authority_statement: "Potential imminent failure. Shutdown and comprehensive evaluation required."
  }
};

// ============================================================
// UNDERWATER -> CODE REFERENCES
// ============================================================

var UNDERWATER_CODE_MAP: Record<string, CodeReference[]> = {
  adci_general: [
    {
      code_family: "ADCI",
      code_edition: "2023",
      clause: "Section 5",
      title: "Diving Operations",
      requirement_summary: "Dive planning, manning, and safety requirements",
      acceptance_criteria: "Full ADCI Consensus Standards compliance",
      engineering_rationale: "Commercial diving operations require qualified teams, proper gas management, and emergency procedures."
    }
  ],
  osha_diving: [
    {
      code_family: "OSHA",
      code_edition: "29 CFR 1910 Subpart T",
      clause: "1910.401-441",
      title: "Commercial Diving Operations",
      requirement_summary: "Safe practices for commercial diving",
      acceptance_criteria: "Employer compliance with dive planning and equipment requirements",
      engineering_rationale: "Federal safety requirements for all US commercial diving operations."
    }
  ],
  nuclear_underwater: [
    {
      code_family: "ASME Section XI",
      code_edition: "2023",
      clause: "IWA-2200",
      title: "NDE Personnel Qualification — Underwater",
      requirement_summary: "Underwater NDE personnel must be qualified per plant procedures",
      acceptance_criteria: "SNT-TC-1A plus plant-specific underwater requirements",
      engineering_rationale: "Underwater nuclear examination requires additional qualification due to access and radiation."
    },
    {
      code_family: "NRC",
      code_edition: "10 CFR 50",
      clause: "50.55a",
      title: "Codes and Standards — ISI",
      requirement_summary: "ISI per ASME XI with NRC regulatory guides",
      acceptance_criteria: "ASME XI as modified by 10 CFR 50.55a conditions",
      engineering_rationale: "Nuclear regulatory framework overlays ASME XI with NRC conditions."
    }
  ],
  dam_hydro: [
    {
      code_family: "FERC",
      code_edition: "Engineering Guidelines",
      clause: "Chapter 14",
      title: "Dam Safety Surveillance",
      requirement_summary: "Underwater inspection requirements for dam structures",
      acceptance_criteria: "Per FERC Part 12D requirements",
      engineering_rationale: "Dam structures require periodic underwater inspection for scour, undermining, and deterioration."
    }
  ],
  marine_vessel: [
    {
      code_family: "DNV",
      code_edition: "Rules for Classification",
      clause: "Part 7, Chapter 1",
      title: "Hull Surveys",
      requirement_summary: "Underwater hull inspection requirements",
      acceptance_criteria: "Classification society criteria for wastage, coating, and CP",
      engineering_rationale: "Marine classification rules govern hull structural integrity assessment."
    }
  ],
  offshore: [
    {
      code_family: "API RP 2A-WSD",
      code_edition: "2014",
      clause: "Section 14",
      title: "Inspection of Existing Platforms",
      requirement_summary: "Underwater inspection requirements for fixed offshore platforms",
      acceptance_criteria: "Structural assessment per Section 17 for damaged members",
      engineering_rationale: "Offshore underwater inspection covers jacket, nodes, risers, and conductors."
    }
  ],
  cathodic_protection: [
    {
      code_family: "NACE SP0176",
      code_edition: "2019",
      clause: "Section 6",
      title: "CP Monitoring — Offshore Platforms",
      requirement_summary: "CP potential measurements during underwater inspection",
      acceptance_criteria: "Min -800 mV vs Ag/AgCl for steel in seawater",
      engineering_rationale: "Inadequate CP results in accelerated corrosion and reduced inspection intervals."
    }
  ]
};

// ============================================================
// SCORE DIMENSION -> ENGINEERING BASIS
// ============================================================

var SCORE_DIMENSION_MAP: Record<string, ScoreDimensionTrace> = {
  event_severity: {
    dimension: "event_severity",
    engineering_basis: "Magnitude and type of initiating event. Impact > environmental. Seismic uses MMI. Fire incorporates temperature and duration.",
    references: [{
      code_family: "API 579-1/ASME FFS-1", code_edition: "2021", clause: "Part 11",
      title: "Assessment of Fire Damage",
      requirement_summary: "Evaluation for equipment exposed to fire",
      acceptance_criteria: "Material property degradation assessment",
      engineering_rationale: "Fire can permanently alter material properties even after cooling."
    }]
  },
  observed_condition_severity: {
    dimension: "observed_condition_severity",
    engineering_basis: "Direct observation severity. Visible cracking highest. Wall loss proportional to percentage consumed.",
    references: [{
      code_family: "API 581", code_edition: "2016", clause: "Part 2, Section 7",
      title: "Damage Factor — Thinning",
      requirement_summary: "Risk factor for active thinning",
      acceptance_criteria: "Damage factor inputs to risk ranking",
      engineering_rationale: "Observed condition drives risk-based inspection planning."
    }]
  },
  hidden_damage_likelihood: {
    dimension: "hidden_damage_likelihood",
    engineering_basis: "Probability of non-visible damage mechanisms. Hydrogen, SCC, and creep are frequently hidden until advanced.",
    references: [{
      code_family: "API 571", code_edition: "2020", clause: "Various",
      title: "Damage Mechanisms Affecting Fixed Equipment",
      requirement_summary: "Comprehensive damage mechanism catalog",
      acceptance_criteria: "Method selection must detect suspected mechanism",
      engineering_rationale: "Many mechanisms produce subsurface degradation before surface evidence."
    }]
  },
  inspection_urgency: {
    dimension: "inspection_urgency",
    engineering_basis: "Time-criticality based on failure consequence, progression rate, and current margin.",
    references: [{
      code_family: "API 580", code_edition: "2016", clause: "Section 10",
      title: "RBI Planning",
      requirement_summary: "Inspection timing based on risk ranking",
      acceptance_criteria: "Interval must not exceed remaining life with safety margin",
      engineering_rationale: "Timing balances inspection cost against failure probability."
    }]
  },
  consequence: {
    dimension: "consequence",
    engineering_basis: "Safety, environmental, and business impact of failure. Personnel proximity is primary factor.",
    references: [{
      code_family: "API 581", code_edition: "2016", clause: "Part 3",
      title: "Consequence Analysis",
      requirement_summary: "Consequence of failure calculation",
      acceptance_criteria: "Consequence category drives inspection scope",
      engineering_rationale: "High-consequence equipment gets priority regardless of probability."
    }]
  },
  overall_risk: {
    dimension: "overall_risk",
    engineering_basis: "Risk = Probability x Consequence. DRE normalizes across event severity, condition, hidden damage, and consequence.",
    references: [{
      code_family: "API 580", code_edition: "2016", clause: "Section 7",
      title: "Risk Analysis",
      requirement_summary: "Qualitative and quantitative risk assessment",
      acceptance_criteria: "Risk ranking determines priority and resources",
      engineering_rationale: "Risk-based approach maximizes risk reduction per inspection dollar."
    }]
  },
  confidence: {
    dimension: "confidence",
    engineering_basis: "Data quality assessment. High confidence requires direct observation, calibrated measurements, known properties, documented history.",
    references: [{
      code_family: "API 579-1/ASME FFS-1", code_edition: "2021", clause: "Part 2, Section 2.3",
      title: "Data Requirements",
      requirement_summary: "Data quality per assessment level",
      acceptance_criteria: "Missing data requires conservative assumptions",
      engineering_rationale: "Assessment reliability proportional to data quality."
    }]
  }
};

// ============================================================
// ASSET CLASS -> APPLICABLE CODE FAMILIES
// ============================================================

function getCodeFamilies(asset_class: string): string[] {
  var familyMap: Record<string, string[]> = {
    "Pipeline": ["API 1104", "API 570", "API 579-1/ASME FFS-1", "ASME B31.4", "ASME B31.8", "PHMSA 49 CFR 192/195"],
    "Offshore": ["API RP 2A-WSD", "API RP 2I", "DNV", "NACE SP0176", "ASME Section V"],
    "Refinery/Process": ["API 510", "API 570", "API 571", "API 579-1/ASME FFS-1", "API 580", "API 581", "ASME VIII"],
    "Marine Vessel": ["DNV", "ABS", "Lloyds Register", "SOLAS", "ASME Section V"],
    "Wind Energy": ["IEC 61400", "DNV-ST-0126", "ASME Section V"],
    "Bridge/Civil": ["AWS D1.5", "AASHTO", "FHWA", "ASME Section V"],
    "Dam/Hydro": ["FERC", "USACE", "ACI 318", "ASME Section V"],
    "Nuclear": ["ASME Section XI", "ASME Section V", "ASME III", "NRC 10 CFR 50"],
    "Storage/Terminal": ["API 653", "API 650", "API 579-1/ASME FFS-1", "ASME Section V"],
    "Mining": ["MSHA 30 CFR", "AWS D14.3", "ASME Section V"],
    "Rail": ["FRA 49 CFR 213", "AREMA", "ASME Section V"],
    "Aerospace": ["NAS 410", "AMS 2630", "ASTM E2375", "ASME Section V"],
    "Power Generation": ["ASME Section I", "ASME Section V", "ASME Section XI", "API 579-1/ASME FFS-1"],
    "Water/Wastewater": ["AWWA", "API 570", "ASME Section V"],
    "Telecom": ["AWS D1.1", "ASME Section V"],
    "Other": ["AWS D1.1", "ASME Section V"]
  };
  return familyMap[asset_class] || familyMap["Other"];
}

// ============================================================
// TRACE GENERATION HELPERS
// ============================================================

function findFindingTrace(findingType: string): FindingTrace | null {
  var key = findingType.toLowerCase().replace(/[\s\-\/]+/g, "_");
  if (FINDING_CODE_MAP[key]) return FINDING_CODE_MAP[key];
  var keys = Object.keys(FINDING_CODE_MAP);
  for (var i = 0; i < keys.length; i++) {
    if (key.indexOf(keys[i]) >= 0 || keys[i].indexOf(key) >= 0) {
      return FINDING_CODE_MAP[keys[i]];
    }
  }
  return null;
}

function filterByAssetClass(refs: CodeReference[], asset_class: string): CodeReference[] {
  var families = getCodeFamilies(asset_class);
  var filtered: CodeReference[] = [];
  for (var i = 0; i < refs.length; i++) {
    for (var j = 0; j < families.length; j++) {
      if (refs[i].code_family.indexOf(families[j]) >= 0 || families[j].indexOf(refs[i].code_family) >= 0) {
        filtered.push(refs[i]);
        break;
      }
    }
  }
  // If no family-specific match, return all (ASME V is universal)
  return filtered.length > 0 ? filtered : refs;
}

// ============================================================
// HANDLER
// ============================================================

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var findings: string[] = body.findings || [];
    var methods: string[] = body.methods || [];
    var disposition: string = body.disposition || "";
    var asset_class: string = body.asset_class || "Other";
    var score_dimensions: string[] = body.score_dimensions || [];
    var underwater_contexts: string[] = body.underwater_contexts || [];

    // Generate finding traces
    var finding_traces: FindingTrace[] = [];
    for (var i = 0; i < findings.length; i++) {
      var ft = findFindingTrace(findings[i]);
      if (ft) {
        var filtered: FindingTrace = {
          finding_type: ft.finding_type,
          display_name: ft.display_name,
          references: filterByAssetClass(ft.references, asset_class),
          rejection_basis: ft.rejection_basis,
          physics_basis: ft.physics_basis
        };
        finding_traces.push(filtered);
      }
    }

    // Generate method traces
    var method_traces: MethodTrace[] = [];
    for (var i = 0; i < methods.length; i++) {
      var key = methods[i].toUpperCase();
      if (METHOD_CODE_MAP[key]) {
        method_traces.push(METHOD_CODE_MAP[key]);
      }
    }

    // Generate disposition trace
    var disposition_trace: DispositionTrace | null = DISPOSITION_CODE_MAP[disposition] || null;

    // Generate score traces
    var score_traces: ScoreDimensionTrace[] = [];
    for (var i = 0; i < score_dimensions.length; i++) {
      if (SCORE_DIMENSION_MAP[score_dimensions[i]]) {
        score_traces.push(SCORE_DIMENSION_MAP[score_dimensions[i]]);
      }
    }

    // Generate underwater traces
    var underwater_traces: CodeReference[] = [];
    for (var i = 0; i < underwater_contexts.length; i++) {
      var uwRefs = UNDERWATER_CODE_MAP[underwater_contexts[i]];
      if (uwRefs) {
        for (var j = 0; j < uwRefs.length; j++) {
          underwater_traces.push(uwRefs[j]);
        }
      }
    }

    var output: CodeTraceOutput = {
      finding_traces: finding_traces,
      method_traces: method_traces,
      disposition_trace: disposition_trace,
      score_traces: score_traces,
      underwater_traces: underwater_traces,
      applicable_code_families: getCodeFamilies(asset_class),
      generated_at: new Date().toISOString(),
      trace_version: "1.0.0"
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(output)
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Code trace generation failed: " + (err.message || "unknown error") })
    };
  }
};

export { handler };
