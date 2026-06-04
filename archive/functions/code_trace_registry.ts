/**
 * DEPLOY67 — Code Trace Registry v1
 * FORGED NDT Intelligence OS
 * 
 * Master authority lookup for every decision the system makes.
 * Every finding, method selection, disposition, and score dimension
 * traces back to a specific code clause with engineering rationale.
 * 
 * DETERMINISTIC — no AI calls, millisecond execution.
 * String concatenation only — no backtick template literals.
 * All logic inlined — no lib/ imports.
 * 
 * Usage: import functions into dre-run-evaluation.ts and voice-incident-plan.ts
 * (inlined, not imported — per project rules)
 */

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
  generated_at: string;
  trace_version: string;
}

// ============================================================
// FINDING TYPE → CODE REFERENCES
// ============================================================

var FINDING_CODE_MAP: Record<string, FindingTrace> = {
  // --- CRACKS ---
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

  // --- INCOMPLETE FUSION ---
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

  // --- POROSITY ---
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
        acceptance_criteria: "Individual pore shall not exceed 1/8 of weld width or 1/4 inch max. Cluster porosity per 9.3.6.3",
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

  // --- UNDERCUT ---
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
        acceptance_criteria: "Statically loaded: max 1/32 inch. Cyclically loaded: max 0.01 inch for primary members",
        engineering_rationale: "Undercut creates a stress riser at the weld toe — the highest-stressed region in a fillet or groove weld under fatigue loading."
      },
      {
        code_family: "API 1104",
        code_edition: "2021",
        clause: "Section 9.3.8",
        title: "Undercut Acceptance",
        requirement_summary: "Depth and length limits for external and internal undercut",
        acceptance_criteria: "Max depth 1/32 inch or 12.5% of wall thickness, whichever is smaller. Max length: 2 inches in 12 inches",
        engineering_rationale: "Pipeline undercut under hoop stress acts as longitudinal stress concentrator at weld toe."
      }
    ],
    rejection_basis: "Depth and length dependent. Critical in fatigue applications due to weld toe stress concentration.",
    physics_basis: "Geometric notch at weld toe reduces local cross-section and creates stress concentration factor of 2.5-4.0 depending on depth-to-width ratio. Under cyclic loading, fatigue crack initiation occurs at undercut root."
  },

  // --- SLAG INCLUSION ---
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
        acceptance_criteria: "Elongated slag: max 2/3 of weld thickness in any 12-inch span. Width: max 1/32 inch to 3/32 inch based on plate thickness",
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
    physics_basis: "Non-metallic inclusion with near-zero tensile strength. Reduces effective weld cross-section proportionally to inclusion area. Under load, stress flows around inclusion creating local stress amplification."
  },

  // --- INCOMPLETE PENETRATION ---
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
    rejection_basis: "Critical in CJP welds — design assumes full penetration. Limited allowances in some pipeline applications.",
    physics_basis: "Reduces effective throat to less than design requirement. Root-side incomplete penetration is exposed to internal environment (corrosion, erosion, product chemistry) which accelerates degradation."
  },

  // --- OVERLAP ---
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
        engineering_rationale: "Overlap is weld metal that has flowed onto base metal without fusing. It creates a notch and an unfused interface."
      }
    ],
    rejection_basis: "Not permitted under most codes. Overlap indicates inadequate heat input or incorrect technique.",
    physics_basis: "Unfused interface at weld toe creates a pre-existing crack-like discontinuity. The overlapping metal provides no structural contribution and creates a crevice for corrosion initiation."
  },

  // --- BURN THROUGH ---
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
        acceptance_criteria: "Max 1/4 inch dimension. Max one per weld or one per 12 inches for long welds",
        engineering_rationale: "Burn-through creates a thin spot or hole in the root, reducing pressure-containing cross-section and creating turbulence point for internal flow."
      }
    ],
    rejection_basis: "Size limited. Primarily a pipeline and thin-wall concern.",
    physics_basis: "Excessive heat input melts through root, creating concavity or hole. Reduces wall thickness locally, creating stress concentration under internal pressure (hoop stress inversely proportional to wall thickness)."
  },

  // --- CORROSION ---
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
        acceptance_criteria: "Minimum required thickness per ASME B31.3 or original design code. Retirement thickness includes corrosion allowance consumed.",
        engineering_rationale: "Corrosion reduces pressure-containing wall thickness. Rate determines remaining life and inspection interval."
      },
      {
        code_family: "API 510",
        code_edition: "2020",
        clause: "Section 7.4",
        title: "Corrosion Rate and Remaining Life",
        requirement_summary: "Calculate short-term and long-term corrosion rates from UT thickness data",
        acceptance_criteria: "Remaining life = (t_actual - t_required) / corrosion_rate",
        engineering_rationale: "Trending corrosion rate over multiple inspection intervals provides prediction of when minimum thickness will be reached."
      },
      {
        code_family: "ASME Section XI",
        code_edition: "2023",
        clause: "IWC-3520",
        title: "Wall Thinning Evaluation — Class 2",
        requirement_summary: "Evaluate thinned areas per IWC-3640 analytical methods",
        acceptance_criteria: "Remaining wall must meet design pressure requirements with appropriate safety factor",
        engineering_rationale: "Nuclear piping thinning from flow-accelerated corrosion (FAC) requires analytical evaluation considering design transients."
      }
    ],
    rejection_basis: "Below minimum required wall thickness per design code. Rate-based remaining life below next inspection interval.",
    physics_basis: "Electrochemical dissolution of metal in corrosive environment. General corrosion reduces wall uniformly. Pitting creates local thin spots with stress concentration. Corrosion rate depends on temperature, chemistry, flow velocity, and metallurgy."
  },

  // --- FATIGUE CRACK ---
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
        acceptance_criteria: "Flaw must be below critical flaw size for applied stress and material toughness. Remaining life calculated via fatigue crack growth analysis.",
        engineering_rationale: "Fatigue cracks grow predictably under cyclic loading. Paris Law (da/dN = C * deltaK^m) allows remaining life prediction."
      },
      {
        code_family: "BS 7910",
        code_edition: "2019",
        clause: "Section 8",
        title: "Assessment of Flaws in Fusion Welded Structures",
        requirement_summary: "Fracture assessment using Failure Assessment Diagram (FAD)",
        acceptance_criteria: "Assessment point must fall within FAD acceptable region",
        engineering_rationale: "FAD simultaneously evaluates fracture (Kr) and plastic collapse (Lr) failure modes."
      }
    ],
    rejection_basis: "Requires fracture mechanics evaluation. Automatic rejection in fabrication codes; FFS evaluation in in-service codes.",
    physics_basis: "Cyclic stress creates progressive crack extension at rate governed by stress intensity range. Beach marks on fracture surface indicate load cycles. Crack growth rate accelerates as crack lengthens (increasing stress intensity)."
  },

  // --- EROSION ---
  erosion: {
    finding_type: "erosion",
    display_name: "Erosion / Erosion-Corrosion",
    references: [
      {
        code_family: "API 570",
        code_edition: "2020",
        clause: "Section 5.2.2",
        title: "Erosion-Corrosion Assessment",
        requirement_summary: "Identify erosion-prone locations: elbows, tees, reducers, downstream of control valves",
        acceptance_criteria: "Same wall thickness criteria as corrosion — minimum required thickness per design code",
        engineering_rationale: "Erosion removes protective corrosion product layer, dramatically accelerating material loss. Rate can be 10x general corrosion."
      }
    ],
    rejection_basis: "Below minimum wall thickness. Erosion rates often much higher than general corrosion.",
    physics_basis: "Mechanical removal of material by impingement of particles, droplets, or high-velocity fluid. Flow-accelerated corrosion (FAC) combines erosion with corrosion synergistically."
  }
};

// ============================================================
// NDE METHOD → CODE REFERENCES
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
        acceptance_criteria: "Per referencing code section (VIII, III, XI, etc.)",
        engineering_rationale: "Primary screening method. Detects surface-breaking discontinuities, geometric deviations, and workmanship defects. Limited to surface conditions only."
      },
      {
        code_family: "AWS D1.1",
        code_edition: "2020",
        clause: "Section 6.9",
        title: "Visual Inspection Requirements",
        requirement_summary: "All welds shall be visually inspected per Table 6.1",
        acceptance_criteria: "Table 6.1 visual acceptance criteria",
        engineering_rationale: "Visual inspection is the first and most fundamental examination. Catches approximately 70% of rejectable conditions when performed by qualified inspector."
      }
    ],
    capability_summary: "Surface conditions, geometry, workmanship. Cannot detect subsurface or embedded flaws.",
    limitation_summary: "Surface only. Cannot determine depth, internal geometry, or subsurface condition. Requires adequate lighting (min 50 fc per AWS, 1000 lux per ASME V)."
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
        acceptance_criteria: "Per referencing code (VIII, XI, B31.1, etc.)",
        engineering_rationale: "Sound wave interaction with material discontinuities provides detection, sizing, and characterization of internal flaws."
      },
      {
        code_family: "ASME Section V",
        code_edition: "2023",
        clause: "Article 5",
        title: "UT Examination of Materials",
        requirement_summary: "Thickness measurement and lamination detection",
        acceptance_criteria: "Material-specific acceptance per purchasing specification",
        engineering_rationale: "Through-transmission and pulse-echo methods measure remaining wall thickness and detect internal material degradation."
      }
    ],
    capability_summary: "Subsurface and through-wall flaw detection. Thickness measurement. Crack sizing. TOFD provides accurate height measurement.",
    limitation_summary: "Requires coupling medium. Surface condition affects coupling. Geometry limitations (curved surfaces, thin sections). Coarse grain materials (austenitic stainless, cast iron) attenuate signal."
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
        requirement_summary: "Film and digital radiography of welds and materials",
        acceptance_criteria: "Per referencing code (VIII Appendix 4, API 1104 Section 9, etc.)",
        engineering_rationale: "Through-thickness projection imaging reveals internal discontinuity morphology. Permanent record (film/digital)."
      }
    ],
    capability_summary: "Internal volumetric flaws (porosity, slag, inclusions). Permanent record. Through-wall imaging.",
    limitation_summary: "Poor sensitivity to planar flaws oriented parallel to beam (tight cracks perpendicular to film). Radiation safety requirements. Access needed on both sides for conventional RT."
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
        requirement_summary: "Detection of surface and near-surface discontinuities in ferromagnetic materials",
        acceptance_criteria: "Per referencing code section",
        engineering_rationale: "Magnetic flux leakage at discontinuity attracts particles, making surface and slight subsurface flaws visible."
      },
      {
        code_family: "AWS D1.1",
        code_edition: "2020",
        clause: "Section 6.14",
        title: "MT Acceptance Criteria",
        requirement_summary: "Linear and rounded indications evaluated per Table 6.1",
        acceptance_criteria: "Per Table 6.1 visual criteria (MT findings evaluated same as visual)",
        engineering_rationale: "MT extends visual inspection capability to detect tight surface cracks not visible to naked eye and near-surface flaws up to approximately 1/4 inch depth."
      }
    ],
    capability_summary: "Surface and near-surface flaws in ferromagnetic materials. Excellent crack sensitivity. Relatively fast and inexpensive.",
    limitation_summary: "Ferromagnetic materials ONLY. Cannot inspect austenitic stainless, aluminum, titanium, copper. Orientation-dependent — flux must be perpendicular to flaw. Near-surface depth limited to approximately 1/4 inch."
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
        requirement_summary: "Detection of surface-breaking discontinuities in non-porous materials",
        acceptance_criteria: "Per referencing code section",
        engineering_rationale: "Capillary action draws penetrant into surface-breaking flaws. Developer draws penetrant back to surface for visualization."
      }
    ],
    capability_summary: "Surface-breaking flaws in any non-porous material. Works on ferromagnetic and non-ferromagnetic metals, ceramics, plastics.",
    limitation_summary: "Surface-breaking ONLY — cannot detect subsurface or embedded flaws. Surface must be clean and dry. Temperature sensitive (typically 40-125 deg F). Cannot inspect porous materials."
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
        acceptance_criteria: "Per referencing code — typically same as conventional UT acceptance",
        engineering_rationale: "Multi-element transducer provides electronic beam steering across angles. Single pass covers full weld volume. S-scan provides real-time cross-sectional image."
      }
    ],
    capability_summary: "Full weld volume coverage in single pass. Real-time S-scan imaging. Electronic focusing improves resolution. Flaw sizing and characterization.",
    limitation_summary: "Higher equipment cost. Requires trained operator for scan plan design. Same material/geometry limitations as conventional UT. Coarse grain attenuation."
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
        acceptance_criteria: "Per referencing code — TOFD sizing is considered more accurate than amplitude-based UT",
        engineering_rationale: "Diffracted signals from flaw tips provide accurate height measurement independent of flaw orientation. Sizing accuracy typically +/- 1mm."
      }
    ],
    capability_summary: "Accurate flaw height sizing from diffracted tip signals. Orientation-independent detection. Excellent for planar flaws.",
    limitation_summary: "Dead zones at surface and back wall. Requires two probes (pitch-catch). Interpretation requires training. Not suited for thin materials (less than approximately 12mm)."
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
        acceptance_criteria: "Source location, intensity, and activity classification per test protocol",
        engineering_rationale: "Active flaws (growing cracks, fiber breakage, corrosion) emit stress waves detectable by piezoelectric sensors. Only method that detects active damage progression in real time."
      }
    ],
    capability_summary: "Real-time monitoring of active damage. Source location via triangulation. Monitors entire structure simultaneously. Only method that detects damage GROWTH.",
    limitation_summary: "Cannot detect static flaws. Requires loading (mechanical, thermal, or pressure). High sensitivity to noise. Specialized equipment and expertise."
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
        requirement_summary: "Electromagnetic induction method for surface and near-surface flaws in conductive materials",
        acceptance_criteria: "Per referencing code and calibration standard",
        engineering_rationale: "Alternating current in coil induces eddy currents in conductive material. Discontinuities alter eddy current flow, changing coil impedance."
      }
    ],
    capability_summary: "Surface and near-surface flaw detection in conductive materials. No coupling medium required. High-speed scanning. Conductivity and coating thickness measurement.",
    limitation_summary: "Conductive materials only. Depth penetration limited by skin effect (frequency-dependent). Geometry-sensitive. Reference standards required for calibration."
  }
};

// ============================================================
// DISPOSITION → CODE REFERENCES
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
        requirement_summary: "Component is fit for continued service at current operating conditions",
        acceptance_criteria: "All assessment levels pass with adequate margin",
        engineering_rationale: "Fitness-for-service analysis confirms remaining strength exceeds required strength with appropriate safety factor."
      }
    ],
    authority_statement: "Component meets all applicable code requirements for continued operation. No restrictions required."
  },
  continue_monitoring: {
    disposition: "continue_monitoring",
    references: [
      {
        code_family: "API 510",
        code_edition: "2020",
        clause: "Section 7.5",
        title: "Inspection Interval Determination",
        requirement_summary: "Set inspection interval based on remaining life calculation",
        acceptance_criteria: "Next inspection before 50% of remaining life or maximum interval per code",
        engineering_rationale: "Monitoring interval ensures degradation is tracked and component is re-evaluated before reaching minimum thickness."
      },
      {
        code_family: "API 570",
        code_edition: "2020",
        clause: "Section 7.2",
        title: "Inspection Interval — Piping",
        requirement_summary: "Interval based on corrosion rate and remaining life",
        acceptance_criteria: "Half remaining life or maximum 10 years for on-stream inspection",
        engineering_rationale: "Regular monitoring confirms corrosion rate predictions and catches accelerated degradation early."
      }
    ],
    authority_statement: "Component is currently acceptable but requires monitoring. Inspection interval set based on degradation rate and remaining life."
  },
  restrict_operations: {
    disposition: "restrict_operations",
    references: [
      {
        code_family: "API 579-1/ASME FFS-1",
        code_edition: "2021",
        clause: "Part 2, Section 2.4.3",
        title: "Assessment Results — Acceptable with Restrictions",
        requirement_summary: "Component fit for service under reduced operating conditions",
        acceptance_criteria: "Acceptable at de-rated pressure, temperature, or loading",
        engineering_rationale: "Reducing operating severity extends remaining life and increases safety margin for degraded component."
      }
    ],
    authority_statement: "Component requires operational restrictions (de-rating) to maintain adequate safety margin. Engineering analysis required to define acceptable limits."
  },
  immediate_inspection: {
    disposition: "immediate_inspection",
    references: [
      {
        code_family: "API 510",
        code_edition: "2020",
        clause: "Section 6.6",
        title: "Unscheduled Inspections",
        requirement_summary: "Immediate inspection required for changes in service, damage events, or threshold exceedances",
        acceptance_criteria: "Inspection scope determined by event type and component history",
        engineering_rationale: "Event-driven damage may not follow predicted degradation curves. Immediate assessment required to confirm structural integrity."
      }
    ],
    authority_statement: "Conditions require immediate inspection to assess component integrity before continued operation."
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
        acceptance_criteria: "Repair procedure approved by authorized inspector. Post-repair NDE per original code.",
        engineering_rationale: "Repair restores component to acceptable condition. Must meet original design intent or be evaluated by engineering analysis."
      },
      {
        code_family: "AWS D1.1",
        code_edition: "2020",
        clause: "Section 7",
        title: "Weld Repair Requirements",
        requirement_summary: "Repair welding procedures and acceptance criteria",
        acceptance_criteria: "Repaired welds meet same acceptance criteria as original welds",
        engineering_rationale: "Repair must achieve at minimum the same quality level as the original fabrication."
      }
    ],
    authority_statement: "Component does not meet acceptance criteria. Repair required before return to service."
  },
  engineering_evaluation: {
    disposition: "engineering_evaluation",
    references: [
      {
        code_family: "API 579-1/ASME FFS-1",
        code_edition: "2021",
        clause: "Part 1, Section 1.4",
        title: "Assessment Levels",
        requirement_summary: "Three-level assessment framework: screening, detailed, advanced",
        acceptance_criteria: "Level 1 screening may suffice; Level 3 requires finite element analysis",
        engineering_rationale: "Progressive assessment levels provide increasing analytical rigor for flaws that fail screening criteria."
      }
    ],
    authority_statement: "Condition requires engineering evaluation per API 579 or equivalent FFS methodology. Inspector findings alone insufficient for disposition."
  },
  shutdown_consideration: {
    disposition: "shutdown_consideration",
    references: [
      {
        code_family: "API 510",
        code_edition: "2020",
        clause: "Section 6.2",
        title: "Pressure Equipment Integrity — Imminent Danger",
        requirement_summary: "Equipment presenting imminent danger shall be removed from service",
        acceptance_criteria: "Authorized inspector judgment of imminent failure risk",
        engineering_rationale: "When remaining strength margin is insufficient or uncertain, the risk of continued operation exceeds the cost of shutdown."
      },
      {
        code_family: "OSHA",
        code_edition: "29 CFR 1910.119",
        clause: "Section (j)(5)",
        title: "Process Hazard Analysis — Mechanical Integrity",
        requirement_summary: "Equipment deficiencies outside acceptable limits must be corrected before further use",
        acceptance_criteria: "Employer shall correct deficiencies in equipment that are outside acceptable limits",
        engineering_rationale: "Regulatory requirement to remove deficient equipment from service. OSHA enforcement authority."
      }
    ],
    authority_statement: "Conditions indicate potential imminent failure or unacceptable risk. Shutdown and comprehensive evaluation required before restart."
  }
};

// ============================================================
// UNDERWATER EXTENSION → CODE REFERENCES
// ============================================================

var UNDERWATER_CODE_MAP: Record<string, CodeReference[]> = {
  adci_general: [
    {
      code_family: "ADCI",
      code_edition: "2023",
      clause: "Section 5",
      title: "Diving Operations",
      requirement_summary: "Dive planning, manning, and safety requirements for commercial diving operations",
      acceptance_criteria: "Full compliance with ADCI Consensus Standards required",
      engineering_rationale: "Commercial diving operations supporting inspection require qualified dive teams, proper gas management, and emergency procedures."
    }
  ],
  osha_diving: [
    {
      code_family: "OSHA",
      code_edition: "29 CFR 1910 Subpart T",
      clause: "1910.401-441",
      title: "Commercial Diving Operations",
      requirement_summary: "Safe practices for commercial diving including air, mixed gas, and saturation diving",
      acceptance_criteria: "Employer compliance with dive planning, emergency procedures, and equipment requirements",
      engineering_rationale: "Federal safety requirements for all commercial diving operations in the United States."
    }
  ],
  nuclear_underwater: [
    {
      code_family: "ASME Section XI",
      code_edition: "2023",
      clause: "IWA-2200",
      title: "Qualification of NDE Personnel",
      requirement_summary: "NDE personnel performing underwater examination must be qualified per plant procedures",
      acceptance_criteria: "Personnel qualification to SNT-TC-1A plus plant-specific requirements for underwater work",
      engineering_rationale: "Underwater examination in nuclear facilities requires additional qualification beyond standard NDE certification due to access limitations and radiation environment."
    },
    {
      code_family: "NRC",
      code_edition: "10 CFR 50",
      clause: "50.55a",
      title: "Codes and Standards — In-Service Inspection",
      requirement_summary: "ISI program per ASME Section XI with NRC regulatory guides",
      acceptance_criteria: "ASME XI requirements as modified by 10 CFR 50.55a conditions",
      engineering_rationale: "Nuclear regulatory framework overlays ASME XI requirements with additional NRC-specific conditions and relief request provisions."
    }
  ],
  dam_hydro: [
    {
      code_family: "FERC",
      code_edition: "Engineering Guidelines",
      clause: "Chapter 14",
      title: "Dam Safety Surveillance and Monitoring",
      requirement_summary: "Underwater inspection requirements for dam structures",
      acceptance_criteria: "Inspection frequency and scope per FERC Part 12D requirements",
      engineering_rationale: "Dam structures require periodic underwater inspection to assess scour, undermining, concrete deterioration, and gate operability."
    },
    {
      code_family: "USACE",
      code_edition: "EM 1110-2-2100",
      clause: "Chapter 6",
      title: "Stability Analysis of Concrete Structures",
      requirement_summary: "Structural evaluation methodology for hydraulic structures",
      acceptance_criteria: "Safety factors per load combination and structure type",
      engineering_rationale: "Underwater findings feed into structural stability analysis for dams, locks, and hydraulic structures."
    }
  ],
  marine_vessel: [
    {
      code_family: "DNV",
      code_edition: "Rules for Classification",
      clause: "Part 7, Chapter 1",
      title: "Hull Surveys",
      requirement_summary: "Underwater hull inspection requirements and intervals",
      acceptance_criteria: "Classification society acceptance criteria for hull wastage, coating, and cathodic protection",
      engineering_rationale: "Marine classification rules govern hull structural integrity assessment including underwater inspection scope and acceptance."
    }
  ],
  offshore: [
    {
      code_family: "API RP 2A-WSD",
      code_edition: "2014",
      clause: "Section 14",
      title: "Inspection of Existing Platforms",
      requirement_summary: "Underwater inspection requirements for fixed offshore platforms",
      acceptance_criteria: "Structural assessment per Section 17 for damaged or degraded members",
      engineering_rationale: "Offshore platform underwater inspection covers jacket members, nodes, risers, and conductors. Findings feed into structural reassessment."
    },
    {
      code_family: "API RP 2I",
      code_edition: "2015",
      clause: "Section 5",
      title: "In-Service Inspection of Mooring Hardware",
      requirement_summary: "Underwater inspection of mooring system components",
      acceptance_criteria: "Wear and corrosion limits per manufacturer and API guidelines",
      engineering_rationale: "Mooring system failure can result in platform drift, riser damage, and environmental release."
    }
  ],
  cathodic_protection: [
    {
      code_family: "NACE SP0176",
      code_edition: "2019",
      clause: "Section 6",
      title: "CP Monitoring of Fixed Offshore Platforms",
      requirement_summary: "Cathodic protection potential measurements during underwater inspection",
      acceptance_criteria: "Minimum -800 mV vs Ag/AgCl for steel in seawater",
      engineering_rationale: "Cathodic protection status directly affects corrosion rate. Inadequate CP results in accelerated material loss and reduced inspection intervals."
    }
  ]
};

// ============================================================
// SCORE DIMENSION → ENGINEERING BASIS
// ============================================================

var SCORE_DIMENSION_MAP: Record<string, ScoreDimensionTrace> = {
  event_severity: {
    dimension: "event_severity",
    engineering_basis: "Magnitude and type of initiating event. Impact events carry higher severity than environmental exposure. Seismic events use Modified Mercalli Intensity for structural relevance. Fire events incorporate temperature and duration.",
    references: [
      {
        code_family: "API 579-1/ASME FFS-1",
        code_edition: "2021",
        clause: "Part 11",
        title: "Assessment of Fire Damage",
        requirement_summary: "Evaluation methodology for equipment exposed to fire",
        acceptance_criteria: "Material property degradation assessment based on temperature and duration exposure",
        engineering_rationale: "Fire exposure can permanently alter material properties (strength, toughness, creep resistance) even after cooling."
      }
    ]
  },
  observed_condition_severity: {
    dimension: "observed_condition_severity",
    engineering_basis: "Direct observation of material condition. Visible cracking is highest severity. Wall loss severity proportional to percentage of original thickness consumed. Coating failure severity depends on environment aggressiveness.",
    references: [
      {
        code_family: "API 581",
        code_edition: "2016",
        clause: "Part 2, Section 7",
        title: "Damage Factor — Thinning",
        requirement_summary: "Risk factor calculation for active thinning mechanisms",
        acceptance_criteria: "Damage factor inputs to risk ranking for inspection planning",
        engineering_rationale: "Observed condition severity drives risk-based inspection planning. Higher severity findings trigger more frequent and more thorough inspection."
      }
    ]
  },
  hidden_damage_likelihood: {
    dimension: "hidden_damage_likelihood",
    engineering_basis: "Probability of damage mechanisms not visible on surface. Hydrogen damage, stress corrosion cracking, and creep are frequently hidden until advanced. Event-driven hidden damage (e.g., post-impact internal deformation) scored based on energy and mechanism.",
    references: [
      {
        code_family: "API 571",
        code_edition: "2020",
        clause: "Various Sections",
        title: "Damage Mechanisms Affecting Fixed Equipment",
        requirement_summary: "Comprehensive catalog of damage mechanisms with detection methods",
        acceptance_criteria: "Method selection must be capable of detecting suspected mechanism",
        engineering_rationale: "Many damage mechanisms produce subsurface degradation before surface evidence appears. NDE method selection must target the specific mechanism."
      }
    ]
  },
  inspection_urgency: {
    dimension: "inspection_urgency",
    engineering_basis: "Time-criticality of inspection response. Driven by failure consequence, damage progression rate, and current condition margin. Immediate urgency for any condition where failure could occur before next scheduled inspection.",
    references: [
      {
        code_family: "API 580",
        code_edition: "2016",
        clause: "Section 10",
        title: "Risk-Based Inspection Planning",
        requirement_summary: "Inspection timing based on risk ranking",
        acceptance_criteria: "Inspection interval must not exceed remaining life with appropriate safety margin",
        engineering_rationale: "Inspection timing balances cost of inspection against probability of failure between inspections."
      }
    ]
  },
  consequence: {
    dimension: "consequence",
    engineering_basis: "Impact of failure on safety, environment, and operations. Personnel proximity is primary factor. Pressurized equipment has blast radius consideration. Environmental consequence includes release volume and toxicity. Business consequence includes production loss and regulatory penalties.",
    references: [
      {
        code_family: "API 581",
        code_edition: "2016",
        clause: "Part 3",
        title: "Consequence Analysis",
        requirement_summary: "Consequence of failure calculation for risk-based inspection",
        acceptance_criteria: "Consequence category drives inspection scope and frequency",
        engineering_rationale: "High-consequence equipment receives priority inspection resources regardless of probability of failure."
      }
    ]
  },
  overall_risk: {
    dimension: "overall_risk",
    engineering_basis: "Combined assessment of probability and consequence. Risk = Probability x Consequence. DRE normalizes across event severity, condition severity, hidden damage likelihood, and consequence to produce unified risk score.",
    references: [
      {
        code_family: "API 580",
        code_edition: "2016",
        clause: "Section 7",
        title: "Risk Analysis",
        requirement_summary: "Qualitative and quantitative risk assessment approaches",
        acceptance_criteria: "Risk ranking determines inspection priority and resource allocation",
        engineering_rationale: "Risk-based approach allocates inspection resources where they provide maximum risk reduction per inspection dollar spent."
      }
    ]
  },
  confidence: {
    dimension: "confidence",
    engineering_basis: "Data quality and completeness assessment. High confidence requires: direct observation, calibrated measurements, known material properties, and documented history. Low confidence when relying on inference, incomplete records, or indirect evidence.",
    references: [
      {
        code_family: "API 579-1/ASME FFS-1",
        code_edition: "2021",
        clause: "Part 2, Section 2.3",
        title: "Data Requirements",
        requirement_summary: "Data quality requirements for fitness-for-service assessment",
        acceptance_criteria: "Minimum data requirements per assessment level. Missing data requires conservative assumptions.",
        engineering_rationale: "Assessment reliability is directly proportional to data quality. Conservative assumptions compensate for missing information but may result in unnecessarily restrictive conclusions."
      }
    ]
  }
};

// ============================================================
// TRACE GENERATION FUNCTIONS
// ============================================================

function getCodeFamily(asset_class: string): string[] {
  var familyMap: Record<string, string[]> = {
    "Pipeline": ["API 1104", "API 570", "API 579-1/ASME FFS-1", "ASME B31.4", "ASME B31.8", "DOT PHMSA 49 CFR 192/195"],
    "Offshore": ["API RP 2A-WSD", "API RP 2I", "DNV", "NACE SP0176", "ASME Section V"],
    "Refinery/Process": ["API 510", "API 570", "API 571", "API 579-1/ASME FFS-1", "API 580", "API 581", "ASME VIII", "ASME Section V"],
    "Marine Vessel": ["DNV", "ABS", "Lloyds Register", "SOLAS", "ASME Section V"],
    "Wind Energy": ["IEC 61400", "DNV-ST-0126", "ASME Section V"],
    "Bridge/Civil": ["AWS D1.5", "AASHTO", "FHWA", "ASME Section V"],
    "Dam/Hydro": ["FERC", "USACE", "ACI 318", "ASME Section V"],
    "Nuclear": ["ASME Section XI", "ASME Section V", "ASME III", "NRC 10 CFR 50", "ASNT SNT-TC-1A"],
    "Storage/Terminal": ["API 653", "API 650", "API 579-1/ASME FFS-1", "ASME Section V"],
    "Mining": ["MSHA 30 CFR", "ASME Section V", "AWS D14.3"],
    "Rail": ["FRA 49 CFR 213", "AREMA", "ASME Section V"],
    "Aerospace": ["NAS 410", "AMS 2630", "ASTM E2375", "ASME Section V"],
    "Power Generation": ["ASME Section I", "ASME Section V", "ASME Section XI", "API 579-1/ASME FFS-1", "EPRI"],
    "Water/Wastewater": ["AWWA", "ASME Section V", "API 570"],
    "Telecom": ["ASME Section V", "AWS D1.1"],
    "Other": ["ASME Section V", "AWS D1.1"]
  };
  return familyMap[asset_class] || familyMap["Other"];
}

function generateFindingTraces(findings: string[]): FindingTrace[] {
  var traces: FindingTrace[] = [];
  for (var i = 0; i < findings.length; i++) {
    var key = findings[i].toLowerCase().replace(/[\s\-\/]+/g, "_");
    // Try exact match first
    if (FINDING_CODE_MAP[key]) {
      traces.push(FINDING_CODE_MAP[key]);
    } else {
      // Try partial match
      var keys = Object.keys(FINDING_CODE_MAP);
      for (var j = 0; j < keys.length; j++) {
        if (key.indexOf(keys[j]) >= 0 || keys[j].indexOf(key) >= 0) {
          traces.push(FINDING_CODE_MAP[keys[j]]);
          break;
        }
      }
    }
  }
  return traces;
}

function generateMethodTraces(methods: string[]): MethodTrace[] {
  var traces: MethodTrace[] = [];
  for (var i = 0; i < methods.length; i++) {
    var key = methods[i].toUpperCase();
    if (METHOD_CODE_MAP[key]) {
      traces.push(METHOD_CODE_MAP[key]);
    }
  }
  return traces;
}

function generateDispositionTrace(disposition: string): DispositionTrace | null {
  return DISPOSITION_CODE_MAP[disposition] || null;
}

function generateScoreTraces(dimensions: string[]): ScoreDimensionTrace[] {
  var traces: ScoreDimensionTrace[] = [];
  for (var i = 0; i < dimensions.length; i++) {
    if (SCORE_DIMENSION_MAP[dimensions[i]]) {
      traces.push(SCORE_DIMENSION_MAP[dimensions[i]]);
    }
  }
  return traces;
}

function generateUnderwaterTraces(contexts: string[]): CodeReference[] {
  var traces: CodeReference[] = [];
  for (var i = 0; i < contexts.length; i++) {
    var refs = UNDERWATER_CODE_MAP[contexts[i]];
    if (refs) {
      for (var j = 0; j < refs.length; j++) {
        traces.push(refs[j]);
      }
    }
  }
  return traces;
}

function filterTracesByCodeFamily(trace: FindingTrace, asset_class: string): FindingTrace {
  var relevantFamilies = getCodeFamily(asset_class);
  var filtered: CodeReference[] = [];
  for (var i = 0; i < trace.references.length; i++) {
    for (var j = 0; j < relevantFamilies.length; j++) {
      if (trace.references[i].code_family.indexOf(relevantFamilies[j]) >= 0 ||
          relevantFamilies[j].indexOf(trace.references[i].code_family) >= 0) {
        filtered.push(trace.references[i]);
        break;
      }
    }
  }
  // Always include ASME V as it applies to NDE methods universally
  if (filtered.length === 0) {
    filtered = trace.references;
  }
  return {
    finding_type: trace.finding_type,
    display_name: trace.display_name,
    references: filtered,
    rejection_basis: trace.rejection_basis,
    physics_basis: trace.physics_basis
  };
}

// ============================================================
// MASTER TRACE GENERATOR
// ============================================================

function generateFullCodeTrace(input: {
  findings: string[];
  methods: string[];
  disposition: string;
  score_dimensions: string[];
  asset_class: string;
  underwater_contexts?: string[];
}): CodeTraceOutput {
  var findingTraces = generateFindingTraces(input.findings);
  // Filter by asset class relevance
  var filteredFindingTraces: FindingTrace[] = [];
  for (var i = 0; i < findingTraces.length; i++) {
    filteredFindingTraces.push(filterTracesByCodeFamily(findingTraces[i], input.asset_class));
  }

  var methodTraces = generateMethodTraces(input.methods);
  var dispositionTrace = generateDispositionTrace(input.disposition);
  var scoreTraces = generateScoreTraces(input.score_dimensions);
  var underwaterTraces: CodeReference[] = [];
  if (input.underwater_contexts && input.underwater_contexts.length > 0) {
    underwaterTraces = generateUnderwaterTraces(input.underwater_contexts);
  }

  return {
    finding_traces: filteredFindingTraces,
    method_traces: methodTraces,
    disposition_trace: dispositionTrace,
    score_traces: scoreTraces,
    underwater_traces: underwaterTraces,
    generated_at: new Date().toISOString(),
    trace_version: "1.0.0"
  };
}

// ============================================================
// EXPORT NOTE
// ============================================================
// This file is a REFERENCE. The maps and functions above must be
// INLINED into dre-run-evaluation.ts and voice-incident-plan.ts
// per project rules (no lib/ imports in Netlify functions).
//
// Integration:
// 1. Copy FINDING_CODE_MAP, METHOD_CODE_MAP, DISPOSITION_CODE_MAP,
//    SCORE_DIMENSION_MAP, UNDERWATER_CODE_MAP into the target function.
// 2. Copy generateFullCodeTrace() and helper functions.
// 3. Call generateFullCodeTrace() after scoring/plan generation.
// 4. Attach output as "code_trace" field in response JSON.
