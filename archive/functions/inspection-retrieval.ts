// @ts-nocheck
// DEPLOY201 -- inspection-retrieval.ts v1.0.0
// Engine 3: Knowledge Retrieval & Synthesis AI
// The third pillar of the FORGED dual+retrieval engine architecture.
//   Engine 1 (decision-core): Deterministic physics reasoning -- 41 mechanisms, 10 precondition buckets
//   Engine 2 (inspection-intelligence): AI reasoning via GPT-4o-mini -- extends beyond static catalog
//   Engine 3 (inspection-retrieval): Knowledge retrieval via Claude -- code citations, method selection,
//     inspection planning grounded in API 571, ASME, API 510/570/580/581, and global standards.
//
// Architecture:
//   1. MECHANISM_REFERENCE: Deterministic mapping of each mechanism to API 571 sections, governing
//      codes, and recommended inspection methods. This is the "library" -- no AI needed.
//   2. METHOD_REFERENCE: Deterministic mapping of NDT methods to capabilities and limitations.
//   3. buildRetrievalContext(): Selects relevant entries based on Engine 1 output.
//   4. Claude AI synthesis: Takes the deterministic references + physics context and produces
//      a coherent inspection plan with code citations and engineering rationale.
//
// Uses ANTHROPIC_API_KEY (Claude) for AI synthesis layer.

import type { Handler } from "@netlify/functions";

var anthropicKey = process.env.ANTHROPIC_API_KEY || "";

// ============================================================================
// MECHANISM REFERENCE: API 571 sections, codes, inspection methods
// Each entry maps a damage mechanism to its authoritative references.
// This is deterministic -- no AI involved in the lookup.
// ============================================================================

var MECHANISM_REFERENCE: any = {
  "cui": {
    api_571: "4.3.3",
    name: "Corrosion Under Insulation",
    codes: ["API 571 4.3.3", "API 510", "API 570", "NACE SP0198", "ASTM C1617"],
    primary_methods: ["UT_thickness_survey", "profile_radiography"],
    supplementary_methods: ["pulsed_eddy_current", "neutron_backscatter", "infrared_thermography", "VT_insulation_removal"],
    critical_factors: "CUI active 25-350F for carbon steel, 140-400F for austenitic stainless (ESCC). Inspect at insulation damage, penetrations, supports, low points where water collects. Remove insulation for direct VT/UT at highest risk locations.",
    acceptance_ref: "API 510 / API 570 minimum thickness calculations"
  },
  "general_corrosion": {
    api_571: "4.3.1",
    name: "General Corrosion",
    codes: ["API 571 4.3.1", "API 510", "API 570", "ASME B31.3"],
    primary_methods: ["UT_thickness_survey", "UT_scanning"],
    supplementary_methods: ["VT_external", "profile_radiography", "guided_wave_UT"],
    critical_factors: "Uniform wall loss -- grid-based UT thickness surveys per API 510/570. Establish corrosion rate from multiple readings over time. Calculate remaining life and next inspection date.",
    acceptance_ref: "API 510/570 t_min calculations per ASME B31.3 or ASME VIII Div 1"
  },
  "pitting": {
    api_571: "4.3.2",
    name: "Pitting Corrosion",
    codes: ["API 571 4.3.2", "API 510", "API 570", "ASME FFS-1/API 579-1 Part 6"],
    primary_methods: ["UT_thickness_survey", "UT_C_scan"],
    supplementary_methods: ["VT_internal", "pit_depth_gauge", "profile_radiography", "eddy_current"],
    critical_factors: "Localized -- grid UT may miss pits between measurement points. C-scan or internal VT preferred. Pit depth governs FFS assessment. Map pit density and maximum depth. ASME FFS-1 Part 6 Level 1/2 assessment for remaining strength.",
    acceptance_ref: "API 579-1/ASME FFS-1 Part 6 (pitting assessment)"
  },
  "co2_corrosion": {
    api_571: "4.3.5",
    name: "CO2 (Sweet) Corrosion",
    codes: ["API 571 4.3.5", "NACE SP0106", "API 570", "ASME B31.3"],
    primary_methods: ["UT_thickness_survey", "UT_scanning"],
    supplementary_methods: ["VT_internal", "coupon_monitoring", "ER_probes", "guided_wave_UT"],
    critical_factors: "Internal mechanism in wet CO2 service. Mesa-attack morphology common. Monitor with corrosion coupons and ER probes between inspections. Downstream of injection points and at flow-direction changes.",
    acceptance_ref: "API 570 t_min per ASME B31.3"
  },
  "erosion": {
    api_571: "4.3.7",
    name: "Erosion / Erosion-Corrosion",
    codes: ["API 571 4.3.7", "API 570", "ASME B31.3", "API RP 14E"],
    primary_methods: ["UT_thickness_survey", "UT_scanning"],
    supplementary_methods: ["VT_internal", "profile_radiography", "guided_wave_UT"],
    critical_factors: "Localized at elbows, tees, reducers, downstream of orifice plates. Monitor downstream side of flow-direction changes. API RP 14E for velocity limits. High rate -- short inspection intervals.",
    acceptance_ref: "API 570 t_min; API RP 14E velocity limits"
  },
  "cscc": {
    api_571: "4.5.1",
    name: "Chloride Stress Corrosion Cracking",
    codes: ["API 571 4.5.1", "API 510", "NACE MR0175/ISO 15156", "ASME FFS-1/API 579-1 Part 9"],
    primary_methods: ["UT_shear_wave", "TOFD", "phased_array_UT"],
    supplementary_methods: ["PT_fluorescent", "ET_eddy_current", "acoustic_emission", "metallographic_replication"],
    critical_factors: "Branching transgranular cracks in austenitic stainless above 140F with chlorides. Inspect welds, HAZ, and high-stress areas. TOFD/PAUT for crack sizing. PT for surface-breaking cracks.",
    acceptance_ref: "API 579-1 Part 9 (crack assessment); ASME VIII UCS-66"
  },
  "mic": {
    api_571: "4.3.8",
    name: "Microbiologically Influenced Corrosion",
    codes: ["API 571 4.3.8", "NACE TM0194", "API 570"],
    primary_methods: ["UT_thickness_survey", "VT_internal"],
    supplementary_methods: ["microbial_culture_testing", "pit_depth_gauge", "biofilm_sampling"],
    critical_factors: "Under deposits in stagnant/low-flow areas. Tubercles and nodules over active pits. Chemical testing to confirm microbial activity. Remove deposits before UT to get accurate readings.",
    acceptance_ref: "API 570 t_min; NACE TM0194 for microbial testing"
  },
  "sulfidation": {
    api_571: "4.4.1",
    name: "High Temperature Sulfidation",
    codes: ["API 571 4.4.1", "API 939-C", "API 510", "ASME B31.3"],
    primary_methods: ["UT_thickness_survey", "UT_scanning"],
    supplementary_methods: ["PMI_positive_material_identification", "hardness_testing", "metallographic_replication"],
    critical_factors: "Active above 500F in sulfur-bearing streams. Rate depends on H2S concentration, temperature, and alloy silicon content. McConomy curves for rate estimation. PMI critical to verify actual alloy composition.",
    acceptance_ref: "API 510/570 t_min; API 939-C rate prediction"
  },
  "underdeposit_corrosion": {
    api_571: "4.3.9",
    name: "Under-Deposit Corrosion",
    codes: ["API 571 4.3.9", "API 570", "NACE SP0590"],
    primary_methods: ["UT_thickness_survey", "VT_internal"],
    supplementary_methods: ["pit_depth_gauge", "deposit_analysis"],
    critical_factors: "Localized under deposits where concentration cell forms. Must remove deposits to inspect underlying metal. Ammonium chloride deposits in overhead systems particularly aggressive.",
    acceptance_ref: "API 570 t_min"
  },
  "naphthenic_acid_corrosion": {
    api_571: "4.4.3",
    name: "Naphthenic Acid Corrosion",
    codes: ["API 571 4.4.3", "API 510", "API 570", "NACE 34103"],
    primary_methods: ["UT_thickness_survey", "UT_scanning"],
    supplementary_methods: ["VT_internal", "coupon_monitoring", "TAN_monitoring"],
    critical_factors: "Active 430-750F with TAN > 0.5. Aggressive above TAN 1.5. Attacks elbows, tees, and turbulent flow areas. Rate can be very high (>1mm/yr). Frequent monitoring required.",
    acceptance_ref: "API 510/570 t_min; NACE 34103 guidelines"
  },
  "galvanic_corrosion": {
    api_571: "4.3.12",
    name: "Galvanic Corrosion",
    codes: ["API 571 4.3.12", "NACE SP0169", "ASTM G82"],
    primary_methods: ["UT_thickness_survey", "VT_external"],
    supplementary_methods: ["pit_depth_gauge", "potential_survey"],
    critical_factors: "At dissimilar metal junctions with electrolyte. Anodic (less noble) metal preferentially attacked. Area ratio critical -- small anode/large cathode accelerates attack. Inspect within 2-3 diameters of dissimilar joint.",
    acceptance_ref: "ASTM G82 galvanic series; API 570 t_min"
  },
  "atmospheric_corrosion": {
    api_571: "4.3.13",
    name: "Atmospheric Corrosion",
    codes: ["API 571 4.3.13", "AMPP SP21430", "ISO 12944", "ISO 9223"],
    primary_methods: ["VT_external", "UT_thickness_survey"],
    supplementary_methods: ["coating_thickness_measurement", "adhesion_testing", "holiday_detection"],
    critical_factors: "External surfaces exposed to weather. Marine, industrial, and tropical atmospheres most aggressive. Coating condition is the primary mitigation variable. Inspect at coating failures, crevices, ledges where moisture collects.",
    acceptance_ref: "ISO 9223 corrosivity categories; ISO 12944 coating durability; API 570 t_min"
  },
  "soil_corrosion": {
    api_571: "4.3.14",
    name: "Soil-Side Corrosion",
    codes: ["API 571 4.3.14", "NACE SP0169", "API 570", "ASME B31.4", "49 CFR 192/195"],
    primary_methods: ["UT_thickness_survey", "close_interval_potential_survey"],
    supplementary_methods: ["DCVG_direct_current_voltage_gradient", "ACVG", "guided_wave_UT", "ILI_intelligent_pigging", "soil_resistivity_testing"],
    critical_factors: "Buried piping with coating holidays. CP effectiveness is key variable. Soil resistivity, moisture, pH, and microbial activity drive rate. DCVG/ACVG to find coating holidays. ILI for transmission pipelines.",
    acceptance_ref: "49 CFR 192/195 (regulated pipelines); API 570; NACE SP0169 CP criteria"
  },
  "cavitation": {
    api_571: "4.3.15",
    name: "Cavitation Damage",
    codes: ["API 571 4.3.15", "API 570", "ASME B73.1"],
    primary_methods: ["VT_internal", "UT_thickness_survey"],
    supplementary_methods: ["vibration_monitoring", "acoustic_emission"],
    critical_factors: "At pump impellers, valve seats, and downstream of flow restrictions where local pressure drops below vapor pressure. Rough pitted surface distinctive from corrosion pitting.",
    acceptance_ref: "API 570 t_min; ASME B73.1 pump inspection"
  },
  "fatigue_mechanical": {
    api_571: "4.5.4",
    name: "Mechanical Fatigue",
    codes: ["API 571 4.5.4", "ASME FFS-1/API 579-1 Part 9", "ASME VIII Div 2", "BS 7910"],
    primary_methods: ["UT_shear_wave", "TOFD", "phased_array_UT"],
    supplementary_methods: ["MT_magnetic_particle", "PT_dye_penetrant", "acoustic_emission", "strain_gauging", "vibration_analysis"],
    critical_factors: "Cracks at stress concentrations under cyclic loading. Weld toes, notches, branch connections most susceptible. TOFD/PAUT for crack detection and sizing. Strain gauging to quantify cyclic stress range. FFS assessment per API 579-1 Part 9.",
    acceptance_ref: "API 579-1 Part 9; BS 7910 fracture assessment; ASME VIII Div 2 fatigue curves"
  },
  "fatigue_thermal": {
    api_571: "4.5.5",
    name: "Thermal Fatigue",
    codes: ["API 571 4.5.5", "ASME FFS-1/API 579-1 Part 9", "ASME VIII Div 2"],
    primary_methods: ["UT_shear_wave", "TOFD", "phased_array_UT"],
    supplementary_methods: ["PT_fluorescent", "infrared_thermography", "thermocouple_monitoring"],
    critical_factors: "Cracking from repeated thermal cycling. Mixing points, quench zones, start/stop operations. Surface-breaking crazing pattern. Infrared thermography to identify thermal cycling locations.",
    acceptance_ref: "API 579-1 Part 9; ASME VIII Div 2 thermal fatigue curves"
  },
  "fatigue_vibration": {
    api_571: "4.5.6",
    name: "Vibration-Induced Fatigue",
    codes: ["API 571 4.5.6", "ASME FFS-1/API 579-1 Part 9", "API 618", "API 674"],
    primary_methods: ["VT_external", "vibration_analysis"],
    supplementary_methods: ["MT_magnetic_particle", "PT_dye_penetrant", "strain_gauging", "modal_analysis"],
    critical_factors: "Small-bore connections, socket welds, and unsupported spans near reciprocating equipment. Vibration monitoring to establish severity. Fix root cause (bracing, supports) rather than just finding cracks.",
    acceptance_ref: "API 618/674 pulsation limits; API 579-1 Part 9"
  },
  "scc_caustic": {
    api_571: "4.5.3",
    name: "Caustic Stress Corrosion Cracking",
    codes: ["API 571 4.5.3", "API RP 945", "NACE SP0403"],
    primary_methods: ["UT_shear_wave", "TOFD", "phased_array_UT"],
    supplementary_methods: ["PT_fluorescent", "metallographic_replication", "hardness_testing"],
    critical_factors: "Carbon steel in caustic above 150F, or at concentration points. PWHT is primary mitigation. Inspect non-PWHT welds and heat-affected zones.",
    acceptance_ref: "API RP 945; NACE SP0403; API 579-1 Part 9"
  },
  "ssc_sulfide": {
    api_571: "4.5.7",
    name: "Sulfide Stress Cracking",
    codes: ["API 571 4.5.7", "NACE MR0175/ISO 15156", "NACE TM0177", "API 510"],
    primary_methods: ["UT_shear_wave", "TOFD", "phased_array_UT"],
    supplementary_methods: ["hardness_testing", "MT_magnetic_particle", "acoustic_emission"],
    critical_factors: "Hard steels (>22 HRC) in wet H2S. Check hardness of welds and HAZ. NACE MR0175 material requirements. Crack propagation can be rapid -- immediate action on confirmed SSC.",
    acceptance_ref: "NACE MR0175/ISO 15156; API 579-1 Part 9"
  },
  "hic": {
    api_571: "4.5.8",
    name: "Hydrogen-Induced Cracking",
    codes: ["API 571 4.5.8", "NACE MR0175/ISO 15156", "NACE TM0284", "API 510"],
    primary_methods: ["UT_shear_wave", "phased_array_UT"],
    supplementary_methods: ["UT_C_scan", "TOFD", "wet_fluorescent_MT"],
    critical_factors: "Stepwise internal cracking from hydrogen charging in wet H2S. Laminar/blistering at inclusions. PAUT/C-scan for internal crack mapping. Steel cleanliness (low sulfur, HIC-tested per NACE TM0284) is primary prevention.",
    acceptance_ref: "NACE TM0284; API 579-1 Part 9; API 510"
  },
  "scc_chloride": {
    api_571: "4.5.1",
    name: "External Chloride SCC",
    codes: ["API 571 4.5.1", "API 510", "ASME FFS-1/API 579-1 Part 9"],
    primary_methods: ["PT_fluorescent", "ET_eddy_current"],
    supplementary_methods: ["UT_shear_wave", "phased_array_UT", "acoustic_emission"],
    critical_factors: "Austenitic stainless under insulation with chloride contamination above 140F. Branching transgranular cracks. PT for surface detection, PAUT for depth sizing.",
    acceptance_ref: "API 579-1 Part 9; API 510"
  },
  "creep": {
    api_571: "4.4.2",
    name: "Creep / Stress Rupture",
    codes: ["API 571 4.4.2", "API 530", "API 579-1 Part 10", "API 510"],
    primary_methods: ["metallographic_replication", "hardness_testing"],
    supplementary_methods: ["UT_shear_wave", "phased_array_UT", "dimensional_survey", "strain_monitoring"],
    critical_factors: "Carbon steel above 700F, CrMo above 800-900F depending on grade. Replication to assess creep void density (API 579-1 Part 10). Dimensional survey for bulging/swelling. API 530 for heater tube life assessment.",
    acceptance_ref: "API 579-1 Part 10; API 530 remaining life; Neubauer classification"
  },
  "brittle_fracture": {
    api_571: "4.5.9",
    name: "Brittle Fracture",
    codes: ["API 571 4.5.9", "ASME VIII UCS-66", "API 579-1 Part 3", "BS 7910"],
    primary_methods: ["UT_shear_wave", "TOFD"],
    supplementary_methods: ["charpy_impact_testing", "hardness_testing", "CTOD_testing"],
    critical_factors: "Low toughness at startup/shutdown temperatures below MDMT. Not a progressive mechanism -- sudden failure if flaw + stress + low temperature coincide. Verify MDMT compliance per UCS-66. MAT assessment per API 579-1 Part 3.",
    acceptance_ref: "ASME VIII UCS-66; API 579-1 Part 3"
  },
  "overload_buckling": {
    api_571: "4.6.1",
    name: "Mechanical Overload / Buckling",
    codes: ["API 571 4.6.1", "AISC 360", "API RP 2A-WSD", "API 579-1 Part 8"],
    primary_methods: ["VT_external", "dimensional_survey"],
    supplementary_methods: ["UT_thickness_survey", "strain_gauging", "FEA_engineering_analysis"],
    critical_factors: "Visual deformation, out-of-plumb, buckling of thin shells or columns. Post-event (hurricane, overpressure, dropped object) dimensional survey to quantify deformation. FFS assessment per API 579-1 Part 8 for dents/bulges.",
    acceptance_ref: "API 579-1 Part 8 (dents/bulges); AISC 360; API RP 2A-WSD"
  },
  "fire_damage": {
    api_571: "4.6.2",
    name: "Fire Damage",
    codes: ["API 571 4.6.2", "API 579-1 Part 11", "API 510", "API RP 2A-WSD"],
    primary_methods: ["hardness_testing", "metallographic_replication", "dimensional_survey"],
    supplementary_methods: ["UT_thickness_survey", "PMI_positive_material_identification", "charpy_impact_testing"],
    critical_factors: "Post-fire: hardness survey to detect temper damage, replication for microstructural changes, dimensional survey for distortion. API 579-1 Part 11 for fire damage assessment. Material properties may be permanently degraded.",
    acceptance_ref: "API 579-1 Part 11; API 510/570 post-fire evaluation"
  },
  "hydrogen_damage": {
    api_571: "4.5.10",
    name: "High Temperature Hydrogen Attack (HTHA)",
    codes: ["API 571 4.5.10", "API RP 941", "API 579-1 Part 9"],
    primary_methods: ["advanced_UT_backscatter", "phased_array_UT", "TOFD"],
    supplementary_methods: ["metallographic_replication", "hardness_testing", "acoustic_emission"],
    critical_factors: "Carbon steel above 400F in hydrogen partial pressure per Nelson curves (API RP 941). Methane voids at grain boundaries reduce strength. Advanced UT (AUBT, PAUT, TOFD) required -- conventional UT unreliable for HTHA detection. Known industry killer.",
    acceptance_ref: "API RP 941 Nelson curves; API 579-1 Part 9"
  },
  "polythionic_acid_scc": {
    api_571: "4.5.2",
    name: "Polythionic Acid SCC",
    codes: ["API 571 4.5.2", "NACE SP0170", "API 510"],
    primary_methods: ["PT_fluorescent", "ET_eddy_current"],
    supplementary_methods: ["UT_shear_wave", "phased_array_UT", "metallographic_replication"],
    critical_factors: "Sensitized austenitic stainless exposed to polythionic acid during shutdowns (sulfide scale + moisture + oxygen). Alkaline wash per NACE SP0170 before opening equipment. Inspect welds and HAZ.",
    acceptance_ref: "NACE SP0170; API 579-1 Part 9"
  },
  "amine_cracking": {
    api_571: "4.5.11",
    name: "Amine Cracking",
    codes: ["API 571 4.5.11", "API RP 945", "API 570"],
    primary_methods: ["wet_fluorescent_MT", "UT_shear_wave"],
    supplementary_methods: ["phased_array_UT", "TOFD", "acoustic_emission"],
    critical_factors: "Carbon steel in lean amine service, especially non-PWHT welds. Cracking at weld toes and HAZ. WFMT preferred for surface crack detection in amine systems.",
    acceptance_ref: "API RP 945; API 579-1 Part 9"
  },
  "carbonate_scc": {
    api_571: "4.5.12",
    name: "Carbonate SCC",
    codes: ["API 571 4.5.12", "API 570", "NACE SP0472"],
    primary_methods: ["wet_fluorescent_MT", "UT_shear_wave"],
    supplementary_methods: ["phased_array_UT", "TOFD"],
    critical_factors: "Carbon steel in alkaline sour water with carbonate species. FCC main fractionator overhead systems. Non-PWHT welds at highest risk. WFMT for surface detection.",
    acceptance_ref: "NACE SP0472; API 579-1 Part 9"
  },
  "embrittlement_885f": {
    api_571: "4.4.5",
    name: "885F Embrittlement",
    codes: ["API 571 4.4.5", "API 510", "API 579-1 Part 3"],
    primary_methods: ["hardness_testing", "charpy_impact_testing"],
    supplementary_methods: ["metallographic_replication"],
    critical_factors: "Ferritic and duplex stainless steels exposed 600-1050F. Loss of toughness -- not detectable by UT. Charpy testing of representative samples. Restrict startup/shutdown temperatures if embrittled.",
    acceptance_ref: "API 579-1 Part 3 (MAT); ASME VIII UCS-66"
  },
  "sigma_phase_embrittlement": {
    api_571: "4.4.6",
    name: "Sigma Phase Embrittlement",
    codes: ["API 571 4.4.6", "API 510", "API 579-1 Part 3"],
    primary_methods: ["hardness_testing", "metallographic_replication"],
    supplementary_methods: ["charpy_impact_testing", "ferrite_measurement"],
    critical_factors: "Austenitic and duplex stainless 1050-1700F. Sigma phase formation reduces toughness and ductility. Replication to identify sigma phase. Ferrite measurement for duplex.",
    acceptance_ref: "API 579-1 Part 3; API 510"
  },
  "temper_embrittlement": {
    api_571: "4.4.4",
    name: "Temper Embrittlement",
    codes: ["API 571 4.4.4", "API RP 934-A", "API 579-1 Part 3"],
    primary_methods: ["charpy_impact_testing", "hardness_testing"],
    supplementary_methods: ["metallographic_replication", "Bruscato_X_factor_calculation"],
    critical_factors: "CrMo steels exposed 650-1100F, especially 2.25Cr-1Mo. Shifts DBTT upward. Bruscato X-factor or J-factor to assess susceptibility from composition. Restrict pressurizing temperature.",
    acceptance_ref: "API RP 934-A; API 579-1 Part 3"
  },
  "carburization": {
    api_571: "4.4.7",
    name: "Carburization",
    codes: ["API 571 4.4.7", "API 510"],
    primary_methods: ["metallographic_replication", "hardness_testing"],
    supplementary_methods: ["UT_velocity_measurement", "PMI_positive_material_identification"],
    critical_factors: "Carbon diffusion into metal above 1100F in hydrocarbon streams. Increases hardness, reduces ductility. Ethylene furnace tubes. Replication for carbide network assessment.",
    acceptance_ref: "API 510; OEM specifications"
  },
  "metal_dusting": {
    api_571: "4.4.8",
    name: "Metal Dusting",
    codes: ["API 571 4.4.8", "API 510", "NACE 34108"],
    primary_methods: ["VT_internal", "UT_thickness_survey"],
    supplementary_methods: ["metallographic_replication"],
    critical_factors: "Catastrophic carburization in syngas/reformer environments 800-1800F. Pitting and grooving with metalite dust. Carbon activity > 1. Very aggressive -- can perforate quickly.",
    acceptance_ref: "API 510; NACE 34108"
  },
  "high_temp_oxidation": {
    api_571: "4.4.9",
    name: "High Temperature Oxidation",
    codes: ["API 571 4.4.9", "API 510", "API 530"],
    primary_methods: ["UT_thickness_survey", "VT_external"],
    supplementary_methods: ["metallographic_replication", "scale_thickness_measurement"],
    critical_factors: "Oxide scale formation above 1000F for carbon steel, higher for alloys. Scale spallation during thermal cycling accelerates loss. UT through scale can give false readings -- ensure good coupling.",
    acceptance_ref: "API 530; API 510"
  },
  "spheroidization": {
    api_571: "4.4.10",
    name: "Spheroidization",
    codes: ["API 571 4.4.10", "API 510"],
    primary_methods: ["metallographic_replication", "hardness_testing"],
    supplementary_methods: [],
    critical_factors: "Carbon steel above 850F for extended time. Pearlite lamellae spheroidize reducing strength. Hardness decrease. Replication to assess microstructural change. Usually combined with creep assessment.",
    acceptance_ref: "API 510; API 530"
  },
  "decarburization": {
    api_571: "4.4.11",
    name: "Decarburization",
    codes: ["API 571 4.4.11", "API 510", "API RP 941"],
    primary_methods: ["metallographic_replication", "hardness_testing"],
    supplementary_methods: ["UT_velocity_measurement"],
    critical_factors: "Carbon loss from steel surface in hydrogen service above 400F. Reduces strength. Often precedes HTHA. Surface decarburization detectable by replication and hardness decrease.",
    acceptance_ref: "API RP 941; API 510"
  },
  "graphitization": {
    api_571: "4.4.12",
    name: "Graphitization",
    codes: ["API 571 4.4.12", "API 510"],
    primary_methods: ["metallographic_replication"],
    supplementary_methods: ["hardness_testing"],
    critical_factors: "Decomposition of pearlite to ferrite + graphite nodules above 800F in carbon steel. Weakens along graphitized band, especially in HAZ. Replication is definitive diagnostic.",
    acceptance_ref: "API 510"
  },
  "ammonia_scc": {
    api_571: "4.5.13",
    name: "Ammonia Stress Corrosion Cracking",
    codes: ["API 571 4.5.13", "API 510", "ASHRAE 15"],
    primary_methods: ["VT_external", "PT_dye_penetrant"],
    supplementary_methods: ["UT_shear_wave", "acoustic_emission"],
    critical_factors: "Carbon steel in anhydrous ammonia with air contamination (>0.2% O2). Stress-relieved steel resistant. Inspect liquid-vapor interface and non-PWHT welds.",
    acceptance_ref: "CGA G-2.1; ASHRAE 15; API 579-1 Part 9"
  },
  "hydrogen_embrittlement": {
    api_571: "4.5.14",
    name: "Hydrogen Embrittlement",
    codes: ["API 571 4.5.14", "NACE MR0175/ISO 15156", "API 510"],
    primary_methods: ["UT_shear_wave", "phased_array_UT"],
    supplementary_methods: ["hardness_testing", "slow_strain_rate_testing"],
    critical_factors: "High-strength steels (>90 ksi) or hard HAZ in hydrogen-charging environments. Delayed cracking. Hardness control is primary prevention. NACE MR0175 limits.",
    acceptance_ref: "NACE MR0175/ISO 15156; API 579-1 Part 9"
  },
  "wet_h2s_blister": {
    api_571: "4.5.15",
    name: "Wet H2S Blistering / HIC-SOHIC",
    codes: ["API 571 4.5.15", "NACE MR0175/ISO 15156", "NACE TM0284", "API RP 571"],
    primary_methods: ["UT_shear_wave", "UT_C_scan"],
    supplementary_methods: ["VT_internal_for_blisters", "phased_array_UT", "acoustic_emission"],
    critical_factors: "Surface blisters from hydrogen recombination at inclusions. C-scan to map blister extent and stacking. SOHIC at weld toes. HIC-tested steel (NACE TM0284) for replacements.",
    acceptance_ref: "NACE TM0284; API 579-1 Part 9; API 510"
  }
};

// ============================================================================
// METHOD REFERENCE: NDT method capabilities and applicable standards
// ============================================================================

var METHOD_REFERENCE: any = {
  "UT_thickness_survey": {
    full_name: "Ultrasonic Thickness Measurement",
    standard: "ASME V Article 5; API 570 Appendix B",
    detects: ["wall_loss", "internal_corrosion", "erosion", "general_thinning"],
    limitations: ["Point measurement -- can miss localized pitting between grid points", "Requires surface preparation and couplant", "Oxide scale can cause false high readings"],
    typical_sensitivity: "Wall loss detection to 0.1mm resolution"
  },
  "UT_scanning": {
    full_name: "Automated/Encoded UT Scanning (B-scan/C-scan)",
    standard: "ASME V Article 4; ASTM E2775",
    detects: ["wall_loss_mapping", "pitting_mapping", "erosion_patterns", "HIC_laminations"],
    limitations: ["Requires encoded scanner setup", "Surface preparation critical", "Slower than spot UT"],
    typical_sensitivity: "Full wall coverage with spatial resolution to 1mm"
  },
  "UT_shear_wave": {
    full_name: "Ultrasonic Shear Wave (Angle Beam) Examination",
    standard: "ASME V Article 4; AWS D1.1 Clause 6",
    detects: ["cracks", "lack_of_fusion", "incomplete_penetration", "planar_flaws"],
    limitations: ["Operator dependent", "Geometry affects coverage", "Sizing accuracy limited vs TOFD/PAUT"],
    typical_sensitivity: "Crack detection per ASME V acceptance criteria"
  },
  "UT_C_scan": {
    full_name: "Ultrasonic C-Scan Mapping",
    standard: "ASME V Article 4; ASTM E2775",
    detects: ["HIC_blisters", "laminations", "corrosion_mapping", "disbonds"],
    limitations: ["Requires immersion or encoded scanner", "Time intensive"],
    typical_sensitivity: "Volumetric mapping with sub-mm resolution"
  },
  "phased_array_UT": {
    full_name: "Phased Array Ultrasonic Testing (PAUT)",
    standard: "ASME V Article 4 Mandatory Appendix XI; ASTM E2700",
    detects: ["cracks", "lack_of_fusion", "HIC_SOHIC", "wall_loss_mapping", "weld_flaws"],
    limitations: ["Requires qualified PAUT operator", "Calibration critical", "Cost higher than conventional UT"],
    typical_sensitivity: "Crack detection and sizing to 1mm accuracy"
  },
  "TOFD": {
    full_name: "Time-of-Flight Diffraction",
    standard: "ASME V Article 4 Mandatory Appendix III; BS EN ISO 10863",
    detects: ["cracks_depth_sizing", "lack_of_fusion", "planar_flaws", "crack_growth_monitoring"],
    limitations: ["Dead zones at surfaces", "Requires parallel scanning", "Interpretation requires training"],
    typical_sensitivity: "Crack height sizing to +/- 1mm"
  },
  "MT_magnetic_particle": {
    full_name: "Magnetic Particle Testing",
    standard: "ASME V Article 7; ASTM E709; AWS D1.1 Clause 6",
    detects: ["surface_cracks", "near_surface_cracks", "toe_cracks", "HAZ_cracks"],
    limitations: ["Ferromagnetic materials only", "Surface preparation required", "Subsurface depth limited to ~6mm"],
    typical_sensitivity: "Surface-breaking cracks > 0.5mm length"
  },
  "wet_fluorescent_MT": {
    full_name: "Wet Fluorescent Magnetic Particle Testing (WFMT)",
    standard: "ASME V Article 7; ASTM E709",
    detects: ["fine_surface_cracks", "SCC", "amine_cracking", "carbonate_SCC"],
    limitations: ["Ferromagnetic only", "UV light required", "Surface must be clean and dry"],
    typical_sensitivity: "Higher sensitivity than dry MT -- detects finer cracks"
  },
  "PT_dye_penetrant": {
    full_name: "Liquid Penetrant Testing (Visible Dye)",
    standard: "ASME V Article 6; ASTM E165",
    detects: ["surface_breaking_cracks", "porosity", "laps", "seams"],
    limitations: ["Surface-breaking only", "Surface prep critical", "Temperature range limited", "Non-ferrous and ferrous"],
    typical_sensitivity: "Surface cracks > 1mm length"
  },
  "PT_fluorescent": {
    full_name: "Fluorescent Penetrant Testing",
    standard: "ASME V Article 6; ASTM E1417",
    detects: ["fine_surface_cracks", "SCC", "fatigue_cracks", "intergranular_cracks"],
    limitations: ["Surface-breaking only", "Higher sensitivity than visible dye", "UV light required"],
    typical_sensitivity: "Surface cracks > 0.25mm length -- highest PT sensitivity"
  },
  "VT_external": {
    full_name: "Visual Testing -- External",
    standard: "ASME V Article 9; API 510/570; AWS D1.1 Clause 6",
    detects: ["corrosion", "coating_damage", "deformation", "leaks", "insulation_damage"],
    limitations: ["Surface only", "Limited by access and lighting", "Subjective"],
    typical_sensitivity: "Depends on lighting and access -- minimum 50 foot-candles per code"
  },
  "VT_internal": {
    full_name: "Visual Testing -- Internal (including RVI)",
    standard: "ASME V Article 9; API 510",
    detects: ["internal_corrosion", "pitting", "deposits", "cracking", "erosion_patterns"],
    limitations: ["Requires entry or remote visual (borescope/crawler)", "Confined space entry hazards"],
    typical_sensitivity: "Direct VT per ASME V; RVI resolution varies by equipment"
  },
  "profile_radiography": {
    full_name: "Radiographic Thickness Profile (Tangential RT)",
    standard: "ASME V Article 2; API 570",
    detects: ["wall_loss_under_insulation", "CUI", "localized_thinning"],
    limitations: ["Radiation safety controls required", "Limited to small diameter", "Single-wall reading"],
    typical_sensitivity: "Wall thickness measurement through insulation without removal"
  },
  "digital_radiography": {
    full_name: "Digital Radiography (DR/CR)",
    standard: "ASME V Article 2; ASTM E2698",
    detects: ["weld_flaws", "internal_corrosion", "erosion", "porosity", "cracks"],
    limitations: ["Radiation safety", "Access to both sides preferred", "Volumetric -- orientation sensitivity"],
    typical_sensitivity: "2% sensitivity per ASME V; IQI verification"
  },
  "ET_eddy_current": {
    full_name: "Eddy Current Testing",
    standard: "ASME V Article 8; ASTM E309/E376",
    detects: ["surface_cracks", "near_surface_cracks", "wall_loss", "heat_exchanger_tube_defects"],
    limitations: ["Conductive materials only", "Depth penetration limited", "Lift-off sensitivity"],
    typical_sensitivity: "Surface cracks in non-ferromagnetic materials; tube wall loss > 20%"
  },
  "pulsed_eddy_current": {
    full_name: "Pulsed Eddy Current (PEC)",
    standard: "ASTM E2884",
    detects: ["wall_loss_under_insulation", "CUI_screening"],
    limitations: ["Screening tool -- confirms with UT", "Average wall over footprint", "Cannot detect cracks"],
    typical_sensitivity: "Average wall loss detection through insulation -- screening accuracy"
  },
  "guided_wave_UT": {
    full_name: "Guided Wave Ultrasonic Testing (GWUT/LRUT)",
    standard: "ASME V Article 19; ASTM E2775",
    detects: ["wall_loss_screening", "corrosion_under_supports", "buried_pipe_corrosion", "CUI_screening"],
    limitations: ["Screening tool -- follow up with conventional UT", "Range limited by coating/contents", "Cannot size precisely"],
    typical_sensitivity: "5-9% cross-sectional area loss screening over 30-100m range"
  },
  "acoustic_emission": {
    full_name: "Acoustic Emission Testing (AE/AET)",
    standard: "ASME V Article 12; ASTM E569",
    detects: ["active_crack_growth", "leak_detection", "fiber_breakage", "active_corrosion"],
    limitations: ["Detects active damage only", "Background noise filtering required", "Requires loading"],
    typical_sensitivity: "Active damage emission above background threshold"
  },
  "infrared_thermography": {
    full_name: "Infrared Thermography",
    standard: "ASME V Article 16; ASTM E1934",
    detects: ["insulation_damage", "CUI_moisture", "thermal_cycling", "refractory_damage", "electrical_faults"],
    limitations: ["Surface temperature only", "Emissivity corrections needed", "Weather dependent for outdoor"],
    typical_sensitivity: "Temperature differentials > 1C"
  },
  "hardness_testing": {
    full_name: "Portable Hardness Testing",
    standard: "ASTM E110; ASTM A956; NACE MR0175",
    detects: ["temper_damage", "carburization", "decarburization", "HAZ_hardness_exceedance"],
    limitations: ["Surface preparation required", "Point measurement", "Material-specific calibration"],
    typical_sensitivity: "Hardness values per applicable method (Brinell/Leeb/UCI)"
  },
  "metallographic_replication": {
    full_name: "Field Metallographic Replication",
    standard: "ASTM E1351; API 579-1 Part 10",
    detects: ["creep_voids", "sigma_phase", "spheroidization", "carburization", "sensitization", "graphitization"],
    limitations: ["Surface preparation critical", "Interpretation requires metallurgist", "Surface only"],
    typical_sensitivity: "Microstructural features at 100-500X magnification"
  },
  "PMI_positive_material_identification": {
    full_name: "Positive Material Identification (PMI)",
    standard: "API RP 578; ASTM E1476",
    detects: ["material_misidentification", "alloy_verification", "wrong_material_installed"],
    limitations: ["XRF cannot detect carbon content", "OES needed for carbon", "Surface contamination affects results"],
    typical_sensitivity: "Elemental composition to 0.01-0.1% depending on element"
  },
  "coating_thickness_measurement": {
    full_name: "Coating Thickness Measurement (DFT)",
    standard: "SSPC-PA 2; ISO 19840; ASTM D7091",
    detects: ["coating_thickness_compliance", "coating_degradation", "under_application"],
    limitations: ["Substrate dependent (magnetic vs eddy current)", "Rough surfaces affect accuracy"],
    typical_sensitivity: "Coating thickness to 1 micron resolution"
  },
  "vibration_analysis": {
    full_name: "Vibration Monitoring and Analysis",
    standard: "ISO 10816; API 670",
    detects: ["vibration_severity", "resonance", "mechanical_looseness", "imbalance"],
    limitations: ["Requires baseline data for trending", "Sensor placement critical"],
    typical_sensitivity: "Vibration velocity/displacement per ISO 10816 severity charts"
  },
  "strain_gauging": {
    full_name: "Strain Gauge Monitoring",
    standard: "ASTM E251; BS 7910 Annex E",
    detects: ["cyclic_stress_range", "thermal_stress", "overload_events", "fatigue_damage_accumulation"],
    limitations: ["Point measurement", "Installation requires surface prep", "Long-term drift"],
    typical_sensitivity: "Strain resolution to 1 microstrain"
  },
  "dimensional_survey": {
    full_name: "Dimensional / Alignment Survey",
    standard: "API 579-1 Part 8; API RP 2A-WSD",
    detects: ["deformation", "bulging", "out_of_plumb", "settlement", "denting"],
    limitations: ["Requires reference datum", "Weather/thermal expansion corrections needed"],
    typical_sensitivity: "Survey accuracy to 1mm with modern equipment"
  },
  "holiday_detection": {
    full_name: "Holiday (Pinhole) Detection in Coatings",
    standard: "NACE SP0188; ASTM D5162; ASTM G62",
    detects: ["coating_holidays", "pinholes", "coating_discontinuities"],
    limitations: ["Voltage setting depends on coating thickness", "Conductive substrate required"],
    typical_sensitivity: "Single pinhole detection through coating"
  },
  "ILI_intelligent_pigging": {
    full_name: "In-Line Inspection (Intelligent Pigging)",
    standard: "API 1163; ASME B31.8S; 49 CFR 192/195",
    detects: ["wall_loss_mapping", "dents", "cracks", "corrosion", "geometry"],
    limitations: ["Requires piggable pipeline", "Launcher/receiver required", "Data interpretation complex"],
    typical_sensitivity: "10% wall loss detection; crack detection with EMAT/UT tools"
  }
};

// ============================================================================
// SYSTEM PROMPT: Engine 3 -- Knowledge Retrieval & Synthesis
// ============================================================================

var SYSTEM_PROMPT = "You are Engine 3 of the FORGED NDT Intelligence OS -- the Knowledge Retrieval and Synthesis engine. You work alongside:"
  + "\n- Engine 1 (Deterministic Physics): Evaluates 41 damage mechanisms across 10 precondition buckets. Its VALIDATED and REJECTED results are ground truth."
  + "\n- Engine 2 (AI Reasoning): Extends analysis beyond the static catalog with additional mechanisms and temporal projections."
  + "\n\nYOUR ROLE: You are the AUTHORITY and KNOWLEDGE layer. Given Engine 1's physics results and the deterministic reference data provided, you synthesize:"
  + "\n1. A prioritized inspection plan grounded in specific code sections and standards"
  + "\n2. Method selection rationale tied to the physics of each damage mechanism"
  + "\n3. Acceptance criteria with specific code references"
  + "\n4. Inspection interval guidance based on damage severity and consequence"
  + "\n5. A teaching narrative that explains the engineering reasoning at a Level 3 NDT professional standard"
  + "\n\nCRITICAL RULES:"
  + "\n- Every recommendation MUST cite a specific code section. No generic advice."
  + "\n- Method selection MUST follow from physics. Explain WHY each method detects the mechanism based on the physical principle."
  + "\n- When multiple mechanisms are validated, identify OVERLAPPING inspection coverage -- one technique that serves multiple mechanisms is more efficient."
  + "\n- Rank by priority: mechanisms with highest consequence and fastest progression rate get inspected first."
  + "\n- If coating condition is known, incorporate it into method selection (e.g., coating thickness measurement for atmospheric corrosion)."
  + "\n- If the physical reality shows data gaps, explicitly state what additional data collection would resolve INDETERMINATE mechanisms."
  + "\n\nOUTPUT FORMAT: Return ONLY a JSON object (no markdown, no backticks) with these keys:"
  + "\n- inspection_plan: {priority_order: [{mechanism_id, mechanism_name, primary_method, method_rationale (1-2 sentences explaining WHY this method based on physics), supplementary_methods: [], code_basis, acceptance_criteria, priority (critical|high|medium|routine), interval_guidance}]}"
  + "\n- coverage_matrix: [{method, mechanisms_covered: [], efficiency_note}] -- show which methods serve multiple mechanisms"
  + "\n- data_gaps: [{gap_description, resolving_action, impact_if_unresolved}]"
  + "\n- authority_summary: string -- 2-3 sentences identifying the governing code framework for this specific scenario"
  + "\n- engineering_narrative: string -- A teaching-quality explanation (3-5 paragraphs) of why these mechanisms matter for this asset, how they interact, and what the inspection strategy accomplishes. Written at Level 3 NDT professional standard. This is the 'brain' output that separates FORGED from every other system."
  + "\n- coating_assessment: {condition, type, impact_on_inspection} -- only if coating data present"
  + "\n\nBe thorough. Be specific. Cite codes. Think like a senior corrosion engineer with 30 years of experience.";

// ============================================================================
// CONTEXT BUILDER: Selects relevant references for validated mechanisms
// ============================================================================

function buildRetrievalContext(dcOutput: any, transcript: string) {
  var dc = dcOutput.decision_core || dcOutput;
  var pr = dc.physical_reality || {};
  var dr = dc.damage_reality || {};
  var cr = dc.consequence_reality || {};
  var pc = dc.physics_computations || {};

  var text = "=== PROVEN PHYSICS STATE (from Engine 1 -- deterministic ground truth) ===\n\n";

  // Material
  var mat = pr.material || {};
  text = text + "MATERIAL: " + (mat.class || "unknown") + " (confidence: " + (mat.class_confidence || 0) + ")\n";
  if (mat.evidence && mat.evidence.length > 0) {
    text = text + "  Evidence: " + mat.evidence.join(", ") + "\n";
  }

  // Environment
  var env = pr.environment || {};
  if (env.phases_present && env.phases_present.length > 0) {
    text = text + "ENVIRONMENT: phases=" + JSON.stringify(env.phases_present) + " atmosphere=" + (env.atmosphere_class || "unknown") + "\n";
  }

  // Coating (DEPLOY200)
  var coat = pr.coating || {};
  if (coat.coating_condition || coat.coating_type) {
    text = text + "COATING: condition=" + (coat.coating_condition || "unknown") + " type=" + (coat.coating_type || "unknown") + "\n";
    if (coat.coating_evidence && coat.coating_evidence.length > 0) {
      text = text + "  Evidence: " + coat.coating_evidence.join(", ") + "\n";
    }
  }

  // Thermal
  var thermal = pr.thermal || {};
  text = text + "THERMAL: temp=" + (thermal.operating_temp_f !== null && thermal.operating_temp_f !== undefined ? thermal.operating_temp_f + "F" : "unknown");
  text = text + " cycling=" + (thermal.thermal_cycling || false);
  text = text + " creep_range=" + (thermal.creep_range || false);
  text = text + " fire_exposure=" + (thermal.fire_exposure || false) + "\n";

  // Stress
  var stress = pr.stress || {};
  text = text + "STRESS: cyclic=" + (stress.cyclic_loading || false) + " tensile=" + (stress.tensile_stress || false);
  text = text + " stress_conc=" + (stress.stress_concentration_present || false) + "\n";
  if (stress.stress_concentration_locations && stress.stress_concentration_locations.length > 0) {
    text = text + "  Locations: " + stress.stress_concentration_locations.join(", ") + "\n";
  }

  // Flow
  var flow = pr.flow_regime || {};
  if (flow.flow_state) {
    text = text + "FLOW: state=" + flow.flow_state + " deadleg=" + (flow.deadleg || false) + "\n";
  }

  // Deposits
  var dep = pr.deposits || {};
  if (dep.deposits_present) {
    text = text + "DEPOSITS: type=" + (dep.deposit_type || "unknown") + "\n";
  }

  // Physics computations
  if (pc && pc.data_quality) {
    var dq = pc.data_quality || {};
    text = text + "\nPHYSICS COMPUTATIONS:\n";
    if (dq.wall_thickness_used_mm) text = text + "  Wall: " + dq.wall_thickness_used_mm + "mm (source: " + (dq.wall_source || "?") + ")\n";
    if (pc.remaining_life_years !== undefined && pc.remaining_life_years !== null) text = text + "  Remaining life: " + pc.remaining_life_years + " years\n";
    if (pc.corrosion_rate_mm_yr !== undefined && pc.corrosion_rate_mm_yr !== null) text = text + "  Corrosion rate: " + pc.corrosion_rate_mm_yr + " mm/yr\n";
  }

  // Consequence
  text = text + "\nCONSEQUENCE: tier=" + (cr.consequence_tier || "unknown");
  if (cr.consequence_undetermined) text = text + " (UNDETERMINED: " + JSON.stringify(cr.undetermined_impacts || []) + ")";
  text = text + "\n";

  // Validated mechanisms with reference data
  var validated = dr.validated_mechanisms || [];
  text = text + "\n=== VALIDATED DAMAGE MECHANISMS (" + validated.length + ") ===\n";
  var refsUsed: string[] = [];
  for (var i = 0; i < validated.length; i++) {
    var v = validated[i];
    var ref = MECHANISM_REFERENCE[v.id];
    text = text + "\n" + (i + 1) + ". " + (v.name || v.id) + " [" + v.id + "]";
    text = text + " -- reality_state: " + (v.reality_state || "validated") + ", severity: " + (v.severity || "unknown") + "\n";
    if (ref) {
      text = text + "   API 571: Section " + ref.api_571 + "\n";
      text = text + "   Codes: " + ref.codes.join(", ") + "\n";
      text = text + "   Primary methods: " + ref.primary_methods.join(", ") + "\n";
      if (ref.supplementary_methods.length > 0) {
        text = text + "   Supplementary: " + ref.supplementary_methods.join(", ") + "\n";
      }
      text = text + "   Critical factors: " + ref.critical_factors + "\n";
      text = text + "   Acceptance: " + ref.acceptance_ref + "\n";
      // Track methods used for coverage matrix
      for (var mi = 0; mi < ref.primary_methods.length; mi++) {
        if (refsUsed.indexOf(ref.primary_methods[mi]) === -1) refsUsed.push(ref.primary_methods[mi]);
      }
    }
  }

  // Method reference for all methods that appeared
  text = text + "\n=== NDT METHOD REFERENCE (for methods applicable to validated mechanisms) ===\n";
  for (var ri = 0; ri < refsUsed.length; ri++) {
    var mRef = METHOD_REFERENCE[refsUsed[ri]];
    if (mRef) {
      text = text + "\n" + refsUsed[ri] + ": " + mRef.full_name + "\n";
      text = text + "  Standard: " + mRef.standard + "\n";
      text = text + "  Detects: " + mRef.detects.join(", ") + "\n";
      text = text + "  Limitations: " + mRef.limitations.join("; ") + "\n";
    }
  }

  // Rejected count
  var rejected = dr.rejected_mechanisms || [];
  text = text + "\n\nREJECTED MECHANISMS: " + rejected.length + " (physics preconditions violated -- not applicable)\n";

  // Indeterminate
  var indeterminate = dr.indeterminate_mechanisms || [];
  if (indeterminate.length > 0) {
    text = text + "INDETERMINATE MECHANISMS: " + indeterminate.length + " (data gaps prevent confirmation)\n";
    for (var ii = 0; ii < indeterminate.length; ii++) {
      text = text + "  - " + (indeterminate[ii].id || indeterminate[ii].name || "unknown") + "\n";
    }
  }

  // Original transcript
  if (transcript) {
    text = text + "\n=== ORIGINAL INSPECTOR TRANSCRIPT ===\n" + transcript + "\n";
  }

  return text;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

var handler: Handler = async function(event) {
  var startTime = Date.now();

  // CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  try {
    var body = JSON.parse(event.body || "{}");

    var dcOutput = body.decision_core ? body : (body.decision_core_output || body);
    var transcript = body.transcript || "";

    // Domain refusal pass-through
    var dc = dcOutput.decision_core || dcOutput;
    if (dc.domain_not_supported === true) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          domain_not_supported: true,
          reason: "Decision core refused this domain. Retrieval engine cannot extend a refused analysis.",
          metadata: { version: "1.0.0", engine: "inspection-retrieval" }
        })
      };
    }

    // Build deterministic reference context
    var retrievalContext = buildRetrievalContext(dcOutput, transcript);

    // Determine which AI to call
    var useAnthropic = !!anthropicKey;
    var openaiKey = process.env.OPENAI_API_KEY || "";
    var useOpenAI = !useAnthropic && !!openaiKey;

    if (!useAnthropic && !useOpenAI) {
      // Return deterministic-only response (no AI synthesis)
      var deterministicResult = buildDeterministicResponse(dcOutput);
      deterministicResult.metadata = { version: "1.0.0", engine: "inspection-retrieval", ai_synthesis: false, reason: "No API key configured (ANTHROPIC_API_KEY or OPENAI_API_KEY)" };
      deterministicResult.elapsed_ms = Date.now() - startTime;
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(deterministicResult)
      };
    }

    // Call AI for synthesis (prefer Anthropic, fallback to OpenAI)
    var abortController = new AbortController();
    var fetchTimeout = setTimeout(function() { abortController.abort(); }, 24000);

    var aiJson: any = null;
    var aiProvider = "none";
    var aiError: string | null = null;

    if (useAnthropic) {
      aiProvider = "anthropic_claude";
      try {
        var anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          signal: abortController.signal,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            temperature: 0.2,
            system: SYSTEM_PROMPT,
            messages: [
              { role: "user", content: retrievalContext }
            ]
          })
        });
        clearTimeout(fetchTimeout);

        if (anthropicResp.ok) {
          var anthropicData: any = await anthropicResp.json();
          var rawText = "";
          if (anthropicData.content && anthropicData.content.length > 0) {
            rawText = anthropicData.content[0].text || "";
          }
          // Strip markdown fences if present
          rawText = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          try {
            aiJson = JSON.parse(rawText);
          } catch (parseErr: any) {
            aiError = "Claude returned non-JSON: " + rawText.substring(0, 200);
          }
        } else {
          var errBody = await anthropicResp.text();
          aiError = "Anthropic API error " + anthropicResp.status + ": " + errBody.substring(0, 200);
        }
      } catch (fetchErr: any) {
        clearTimeout(fetchTimeout);
        if (fetchErr.name === "AbortError") {
          aiError = "Anthropic API call timed out after 24 seconds";
        } else {
          aiError = "Anthropic fetch error: " + (fetchErr.message || String(fetchErr));
        }
      }
    } else if (useOpenAI) {
      aiProvider = "openai_gpt4o_mini";
      try {
        var openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          signal: abortController.signal,
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + openaiKey
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            max_tokens: 4096,
            temperature: 0.2,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: retrievalContext }
            ]
          })
        });
        clearTimeout(fetchTimeout);

        if (openaiResp.ok) {
          var openaiData: any = await openaiResp.json();
          var rawMsg = (openaiData.choices && openaiData.choices[0] && openaiData.choices[0].message && openaiData.choices[0].message.content) || "";
          rawMsg = rawMsg.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          try {
            aiJson = JSON.parse(rawMsg);
          } catch (parseErr2: any) {
            aiError = "OpenAI returned non-JSON: " + rawMsg.substring(0, 200);
          }
        } else {
          var errBody2 = await openaiResp.text();
          aiError = "OpenAI API error " + openaiResp.status + ": " + errBody2.substring(0, 200);
        }
      } catch (fetchErr2: any) {
        clearTimeout(fetchTimeout);
        if (fetchErr2.name === "AbortError") {
          aiError = "OpenAI API call timed out after 24 seconds";
        } else {
          aiError = "OpenAI fetch error: " + (fetchErr2.message || String(fetchErr2));
        }
      }
    }

    // Build final response
    var deterministicBase = buildDeterministicResponse(dcOutput);
    var result: any = {
      engine_version: "inspection-retrieval-v1.0.0",
      mechanism_references: deterministicBase.mechanism_references,
      method_coverage: deterministicBase.method_coverage,
      ai_synthesis: aiJson || null,
      ai_provider: aiProvider,
      ai_error: aiError,
      retrieval_context_length: retrievalContext.length,
      elapsed_ms: Date.now() - startTime,
      metadata: {
        version: "1.0.0",
        engine: "inspection-retrieval",
        ai_synthesis: aiJson !== null,
        mechanisms_referenced: deterministicBase.mechanism_references.length,
        methods_referenced: deterministicBase.method_coverage.length
      }
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(result)
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ error: "inspection-retrieval failed: " + (err.message || String(err)) })
    };
  }
};

// ============================================================================
// DETERMINISTIC RESPONSE BUILDER
// Returns structured reference data without AI synthesis
// ============================================================================

function buildDeterministicResponse(dcOutput: any) {
  var dc = dcOutput.decision_core || dcOutput;
  var dr = dc.damage_reality || {};
  var validated = dr.validated_mechanisms || [];

  var mechRefs: any[] = [];
  var methodSet: any = {};

  for (var i = 0; i < validated.length; i++) {
    var v = validated[i];
    var ref = MECHANISM_REFERENCE[v.id];
    if (ref) {
      mechRefs.push({
        mechanism_id: v.id,
        mechanism_name: ref.name,
        api_571_section: ref.api_571,
        governing_codes: ref.codes,
        primary_methods: ref.primary_methods,
        supplementary_methods: ref.supplementary_methods,
        critical_factors: ref.critical_factors,
        acceptance_reference: ref.acceptance_ref,
        reality_state: v.reality_state || "validated",
        severity: v.severity || "unknown"
      });

      // Build method coverage map
      var allMethods = ref.primary_methods.concat(ref.supplementary_methods);
      for (var mi = 0; mi < allMethods.length; mi++) {
        var mId = allMethods[mi];
        if (!methodSet[mId]) {
          methodSet[mId] = { method: mId, mechanisms_covered: [], is_primary_for: [] };
          var mRef = METHOD_REFERENCE[mId];
          if (mRef) {
            methodSet[mId].full_name = mRef.full_name;
            methodSet[mId].standard = mRef.standard;
          }
        }
        if (methodSet[mId].mechanisms_covered.indexOf(v.id) === -1) {
          methodSet[mId].mechanisms_covered.push(v.id);
        }
        if (ref.primary_methods.indexOf(mId) >= 0 && methodSet[mId].is_primary_for.indexOf(v.id) === -1) {
          methodSet[mId].is_primary_for.push(v.id);
        }
      }
    }
  }

  // Convert method set to sorted array (most coverage first)
  var methodCoverage: any[] = [];
  var methodKeys = Object.keys(methodSet);
  for (var mk = 0; mk < methodKeys.length; mk++) {
    methodCoverage.push(methodSet[methodKeys[mk]]);
  }
  methodCoverage.sort(function(a: any, b: any) { return b.mechanisms_covered.length - a.mechanisms_covered.length; });

  return {
    mechanism_references: mechRefs,
    method_coverage: methodCoverage
  };
}

export { handler };
