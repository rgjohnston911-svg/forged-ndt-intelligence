// @ts-nocheck
// ══════════════════════════════════════════════════════════════════════════════
// DDE PRIOR BASE RATES
// Prior probability tables keyed by domain:service:material
//
// These are hand-calibrated base rates representing the relative frequency
// of each damage mechanism given asset context. They are NOT learned from
// production data — they are version-controlled reference values derived
// from industry experience (API 571 Table 1, refinery turnaround data,
// and published failure statistics).
//
// Key format: "domain:service:material"
// Fallback: "domain:default" if exact context not found
//
// Every probability set MUST sum to ~1.0. The "other" catch-all absorbs
// residual probability for mechanisms not explicitly listed.
// ══════════════════════════════════════════════════════════════════════════════

var PRIORS = {

  // ── FIXED EQUIPMENT ─────────────────────────────────────────────────────

  // Sour gas / amine service — carbon steel
  "fixed:sour_gas_amine:carbon_steel": {
    HIC: 0.18,
    SSC: 0.14,
    SOHIC: 0.08,
    amine_cracking: 0.12,
    general_corrosion: 0.15,
    naphthenic_acid_corrosion: 0.02,
    fatigue: 0.06,
    CUI: 0.05,
    MIC: 0.03,
    hydrogen_embrittlement: 0.04,
    caustic_cracking: 0.02,
    chloride_scc: 0.01,
    creep: 0.01,
    erosion_corrosion: 0.03,
    temper_embrittlement: 0.01,
    other: 0.05
  },

  // Sour gas — low alloy steel
  "fixed:sour_gas:low_alloy_steel": {
    SSC: 0.20,
    HIC: 0.12,
    SOHIC: 0.10,
    hydrogen_embrittlement: 0.10,
    general_corrosion: 0.12,
    fatigue: 0.08,
    creep: 0.05,
    CUI: 0.05,
    temper_embrittlement: 0.04,
    caustic_cracking: 0.02,
    MIC: 0.02,
    erosion_corrosion: 0.02,
    other: 0.08
  },

  // Crude distillation — carbon steel
  "fixed:crude_distillation:carbon_steel": {
    naphthenic_acid_corrosion: 0.18,
    general_corrosion: 0.20,
    HIC: 0.08,
    erosion_corrosion: 0.10,
    CUI: 0.10,
    fatigue: 0.06,
    MIC: 0.04,
    chloride_scc: 0.02,
    creep: 0.05,
    SSC: 0.03,
    caustic_cracking: 0.02,
    hydrogen_embrittlement: 0.02,
    other: 0.10
  },

  // Hydrogen reformer — low alloy steel
  "fixed:hydrogen_service:low_alloy_steel": {
    hydrogen_embrittlement: 0.22,
    creep: 0.18,
    HIC: 0.05,
    SSC: 0.05,
    general_corrosion: 0.12,
    fatigue: 0.10,
    temper_embrittlement: 0.08,
    CUI: 0.05,
    erosion_corrosion: 0.03,
    other: 0.12
  },

  // Caustic service — carbon steel
  "fixed:caustic_service:carbon_steel": {
    caustic_cracking: 0.30,
    general_corrosion: 0.20,
    amine_cracking: 0.05,
    CUI: 0.08,
    fatigue: 0.06,
    MIC: 0.05,
    erosion_corrosion: 0.05,
    HIC: 0.02,
    hydrogen_embrittlement: 0.03,
    other: 0.16
  },

  // Cooling water — austenitic stainless
  "fixed:cooling_water:austenitic_stainless": {
    chloride_scc: 0.25,
    MIC: 0.18,
    general_corrosion: 0.15,
    erosion_corrosion: 0.10,
    fatigue: 0.08,
    CUI: 0.06,
    other: 0.18
  },

  // High-temperature service — carbon steel
  "fixed:high_temp_service:carbon_steel": {
    creep: 0.25,
    temper_embrittlement: 0.10,
    general_corrosion: 0.15,
    fatigue: 0.10,
    hydrogen_embrittlement: 0.08,
    CUI: 0.05,
    erosion_corrosion: 0.08,
    naphthenic_acid_corrosion: 0.05,
    other: 0.14
  },

  // Domain-level default for fixed equipment
  "fixed:default": {
    general_corrosion: 0.20,
    fatigue: 0.10,
    CUI: 0.08,
    HIC: 0.06,
    SSC: 0.05,
    SOHIC: 0.04,
    amine_cracking: 0.04,
    caustic_cracking: 0.04,
    chloride_scc: 0.04,
    MIC: 0.05,
    naphthenic_acid_corrosion: 0.03,
    erosion_corrosion: 0.05,
    creep: 0.04,
    hydrogen_embrittlement: 0.04,
    temper_embrittlement: 0.02,
    other: 0.12
  },

  // ── SUBSEA / OFFSHORE ───────────────────────────────────────────────────

  // Jacket structure — carbon steel
  "subsea:jacket_structure:carbon_steel": {
    fatigue_tubular_joint: 0.22,
    splash_zone_corrosion: 0.18,
    free_corrosion_cp_failure: 0.15,
    anchor_impact: 0.08,
    weld_defect_subsea: 0.06,
    MIC_marine: 0.05,
    erosion_scour: 0.06,
    hydrogen_cracking_cp: 0.03,
    j_tube_corrosion: 0.04,
    viv_fatigue: 0.03,
    concrete_deterioration: 0.02,
    riser_fatigue: 0.03,
    other: 0.05
  },

  // Subsea pipeline — carbon steel
  "subsea:pipeline:carbon_steel": {
    free_corrosion_cp_failure: 0.20,
    viv_fatigue: 0.15,
    anchor_impact: 0.12,
    erosion_scour: 0.12,
    MIC_marine: 0.08,
    weld_defect_subsea: 0.06,
    hydrogen_cracking_cp: 0.04,
    splash_zone_corrosion: 0.03,
    fatigue_tubular_joint: 0.02,
    riser_fatigue: 0.08,
    other: 0.10
  },

  // Riser system — high strength steel
  "subsea:riser:high_strength_steel": {
    riser_fatigue: 0.25,
    viv_fatigue: 0.15,
    hydrogen_cracking_cp: 0.12,
    free_corrosion_cp_failure: 0.10,
    weld_defect_subsea: 0.08,
    j_tube_corrosion: 0.08,
    fatigue_tubular_joint: 0.05,
    anchor_impact: 0.05,
    MIC_marine: 0.03,
    other: 0.09
  },

  // Domain-level default for subsea
  "subsea:default": {
    free_corrosion_cp_failure: 0.15,
    splash_zone_corrosion: 0.12,
    fatigue_tubular_joint: 0.15,
    anchor_impact: 0.08,
    weld_defect_subsea: 0.06,
    j_tube_corrosion: 0.05,
    riser_fatigue: 0.06,
    viv_fatigue: 0.06,
    erosion_scour: 0.06,
    MIC_marine: 0.05,
    hydrogen_cracking_cp: 0.04,
    concrete_deterioration: 0.03,
    other: 0.09
  },

  // ── MARINE VESSELS / MODUs ──────────────────────────────────────────────

  // Bulk carrier — carbon steel
  "marine:bulk_carrier:carbon_steel": {
    general_corrosion_marine: 0.22,
    pitting_marine: 0.15,
    fatigue_cracking_marine: 0.15,
    grooving_corrosion: 0.08,
    coating_breakdown: 0.10,
    slamming_damage: 0.06,
    buckling_marine: 0.05,
    MIC_vessel: 0.05,
    weld_defect_marine: 0.04,
    erosion_corrosion_marine: 0.03,
    other: 0.07
  },

  // Tanker — carbon steel
  "marine:tanker:carbon_steel": {
    general_corrosion_marine: 0.20,
    pitting_marine: 0.18,
    fatigue_cracking_marine: 0.12,
    coating_breakdown: 0.12,
    grooving_corrosion: 0.08,
    MIC_vessel: 0.06,
    slamming_damage: 0.04,
    buckling_marine: 0.04,
    weld_defect_marine: 0.04,
    erosion_corrosion_marine: 0.05,
    other: 0.07
  },

  // MODU / semi-submersible — high strength steel
  "marine:modu:high_strength_steel": {
    fatigue_cracking_marine: 0.22,
    general_corrosion_marine: 0.15,
    pitting_marine: 0.10,
    buckling_marine: 0.10,
    slamming_damage: 0.08,
    coating_breakdown: 0.08,
    weld_defect_marine: 0.06,
    grooving_corrosion: 0.05,
    MIC_vessel: 0.04,
    erosion_corrosion_marine: 0.04,
    other: 0.08
  },

  // Domain-level default for marine
  "marine:default": {
    general_corrosion_marine: 0.20,
    pitting_marine: 0.12,
    fatigue_cracking_marine: 0.14,
    slamming_damage: 0.06,
    grooving_corrosion: 0.07,
    weld_defect_marine: 0.05,
    buckling_marine: 0.06,
    MIC_vessel: 0.05,
    coating_breakdown: 0.08,
    erosion_corrosion_marine: 0.05,
    other: 0.12
  },

  // ── FLOATING PLATFORMS ──────────────────────────────────────────────────

  // FPSO — carbon steel hull
  "floating:fpso:carbon_steel": {
    hull_fatigue_fpso: 0.20,
    internal_corrosion_fpso: 0.18,
    turret_bearing_wear: 0.12,
    motion_induced_fatigue: 0.10,
    green_water_damage: 0.08,
    topside_interface_cracking: 0.08,
    column_plate_buckling: 0.06,
    tendon_fatigue_tlp: 0.01,
    other: 0.17
  },

  // TLP — high strength steel tendons
  "floating:tlp:high_strength_steel": {
    tendon_fatigue_tlp: 0.25,
    motion_induced_fatigue: 0.15,
    topside_interface_cracking: 0.10,
    column_plate_buckling: 0.12,
    hull_fatigue_fpso: 0.05,
    green_water_damage: 0.06,
    turret_bearing_wear: 0.01,
    internal_corrosion_fpso: 0.04,
    other: 0.22
  },

  // Semi-sub — carbon steel columns
  "floating:semi_sub:carbon_steel": {
    column_plate_buckling: 0.18,
    motion_induced_fatigue: 0.15,
    topside_interface_cracking: 0.12,
    hull_fatigue_fpso: 0.10,
    green_water_damage: 0.10,
    internal_corrosion_fpso: 0.08,
    tendon_fatigue_tlp: 0.01,
    turret_bearing_wear: 0.01,
    other: 0.25
  },

  // SPAR — high strength steel
  "floating:spar:high_strength_steel": {
    motion_induced_fatigue: 0.22,
    column_plate_buckling: 0.18,
    topside_interface_cracking: 0.12,
    hull_fatigue_fpso: 0.08,
    green_water_damage: 0.05,
    tendon_fatigue_tlp: 0.08,
    internal_corrosion_fpso: 0.06,
    turret_bearing_wear: 0.01,
    other: 0.20
  },

  // Domain-level default for floating
  "floating:default": {
    hull_fatigue_fpso: 0.15,
    turret_bearing_wear: 0.08,
    tendon_fatigue_tlp: 0.08,
    green_water_damage: 0.08,
    column_plate_buckling: 0.12,
    motion_induced_fatigue: 0.14,
    topside_interface_cracking: 0.10,
    internal_corrosion_fpso: 0.10,
    other: 0.15
  },

  // ── SUBSEA PRODUCTION / MOORING / FLOW ASSURANCE ────────────────────────

  // Subsea tree — carbon steel in sour service
  "production:subsea_tree:carbon_steel": {
    tree_seal_degradation: 0.25,
    connector_make_break_fatigue: 0.15,
    flow_erosion_sand: 0.12,
    hydrate_wax_blockage: 0.10,
    umbilical_armor_corrosion: 0.08,
    mooring_chain_fatigue: 0.02,
    synthetic_rope_creep: 0.01,
    other: 0.27
  },

  // Mooring system — high strength steel chain
  "production:mooring:high_strength_steel": {
    mooring_chain_fatigue: 0.30,
    synthetic_rope_creep: 0.15,
    connector_make_break_fatigue: 0.10,
    tree_seal_degradation: 0.02,
    umbilical_armor_corrosion: 0.05,
    flow_erosion_sand: 0.02,
    hydrate_wax_blockage: 0.01,
    other: 0.35
  },

  // Flowline — carbon steel multiphase
  "production:flowline:carbon_steel": {
    flow_erosion_sand: 0.22,
    hydrate_wax_blockage: 0.18,
    tree_seal_degradation: 0.05,
    connector_make_break_fatigue: 0.10,
    umbilical_armor_corrosion: 0.08,
    mooring_chain_fatigue: 0.02,
    synthetic_rope_creep: 0.01,
    other: 0.34
  },

  // Domain-level default for production
  "production:default": {
    tree_seal_degradation: 0.15,
    umbilical_armor_corrosion: 0.12,
    connector_make_break_fatigue: 0.12,
    mooring_chain_fatigue: 0.15,
    synthetic_rope_creep: 0.08,
    flow_erosion_sand: 0.12,
    hydrate_wax_blockage: 0.10,
    other: 0.16
  }
};

export { PRIORS };
