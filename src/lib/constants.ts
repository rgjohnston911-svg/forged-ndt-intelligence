export var NDT_METHODS = ["VT", "PT", "MT", "UT", "RT", "ET"] as const;

export var METHOD_LABELS: Record<string, string> = {
  VT: "Visual Testing", PT: "Penetrant Testing", MT: "Magnetic Particle Testing",
  UT: "Ultrasonic Testing", RT: "Radiographic Testing", ET: "Electromagnetic Testing",
};

export var METHOD_COLORS: Record<string, string> = {
  VT: "#2E7D32", PT: "#C62828", MT: "#1565C0",
  UT: "#6A1B9A", RT: "#E65100", ET: "#00838F",
};

export var METHOD_ENERGY: Record<string, { energy: string; interaction: string; response: string; time: string }> = {
  VT: { energy: "light", interaction: "reflection", response: "image", time: "instant" },
  PT: { energy: "liquid", interaction: "capillary", response: "indication", time: "dwell" },
  MT: { energy: "magnetic_field", interaction: "field_distortion", response: "particle_pattern", time: "real_time" },
  UT: { energy: "acoustic_wave", interaction: "reflection_refraction", response: "echo_waveform", time: "time_of_flight" },
  RT: { energy: "radiation", interaction: "absorption_density_variation", response: "radiograph", time: "exposure" },
  ET: { energy: "electromagnetic_induction", interaction: "eddy_current_perturbation", response: "signal_trace", time: "frequency_phase_response" },
};

export var MATERIAL_CLASSES = [
  "carbon_steel", "low_alloy_steel", "stainless_steel", "duplex_stainless",
  "aluminum", "nickel_alloy", "titanium", "copper_alloy", "cast_iron",
  "composite", "other", "unknown",
] as const;

export var LOAD_CONDITIONS = [
  "static", "dynamic", "cyclic", "thermal_cycle",
  "pressure", "cryogenic", "high_temp", "unknown",
] as const;

export var WELDING_PROCESSES = [
  "SMAW", "GMAW", "FCAW", "GTAW", "SAW", "unknown",
] as const;

export var WELDING_PROCESS_LABELS: Record<string, string> = {
  SMAW: "SMAW (Stick)", GMAW: "GMAW (MIG)", FCAW: "FCAW (Flux Core)",
  GTAW: "GTAW (TIG)", SAW: "SAW (Submerged Arc)", unknown: "Unknown / Not Specified",
};

export var WELD_POSITIONS = [
  "1G", "2G", "3G", "4G", "5G", "6G",
  "1F", "2F", "3F", "4F", "unknown",
] as const;

export var JOINT_TYPES = [
  "butt", "fillet", "groove", "lap", "tee", "pipe_girth", "unknown",
] as const;

export var JOINT_TYPE_LABELS: Record<string, string> = {
  butt: "Butt Joint", fillet: "Fillet", groove: "Groove (V, U, J)",
  lap: "Lap Joint", tee: "T-Joint", pipe_girth: "Pipe Girth", unknown: "Unknown",
};

export var HEAT_INPUT_LEVELS = ["low", "normal", "high", "unknown"] as const;
export var TRAVEL_SPEED_LEVELS = ["slow", "normal", "fast", "unknown"] as const;

export var DISPOSITIONS = [
  "accept", "reject", "review_required", "inconclusive", "monitor",
] as const;

export var DISPOSITION_COLORS: Record<string, string> = {
  accept: "#2E7D32", reject: "#C62828", review_required: "#E65100",
  inconclusive: "#757575", monitor: "#1565C0",
};
