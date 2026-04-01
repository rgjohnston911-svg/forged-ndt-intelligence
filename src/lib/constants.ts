export const NDT_METHODS = ["VT", "PT", "MT", "UT", "RT", "ET"] as const;

export const METHOD_LABELS: Record<string, string> = {
  VT: "Visual Testing",
  PT: "Penetrant Testing",
  MT: "Magnetic Particle Testing",
  UT: "Ultrasonic Testing",
  RT: "Radiographic Testing",
  ET: "Electromagnetic Testing",
};

export const METHOD_COLORS: Record<string, string> = {
  VT: "#2E7D32",
  PT: "#C62828",
  MT: "#1565C0",
  UT: "#6A1B9A",
  RT: "#E65100",
  ET: "#00838F",
};

export const METHOD_ENERGY: Record<string, { energy: string; interaction: string; response: string; time: string }> = {
  VT: { energy: "light", interaction: "reflection", response: "image", time: "instant" },
  PT: { energy: "liquid", interaction: "capillary", response: "indication", time: "dwell" },
  MT: { energy: "magnetic_field", interaction: "field_distortion", response: "particle_pattern", time: "real_time" },
  UT: { energy: "acoustic_wave", interaction: "reflection_refraction", response: "echo_waveform", time: "time_of_flight" },
  RT: { energy: "radiation", interaction: "absorption_density_variation", response: "radiograph", time: "exposure" },
  ET: { energy: "electromagnetic_induction", interaction: "eddy_current_perturbation", response: "signal_trace", time: "frequency_phase_response" },
};

export const MATERIAL_CLASSES = [
  "carbon_steel", "low_alloy_steel", "stainless_steel", "duplex_stainless",
  "aluminum", "nickel_alloy", "titanium", "copper_alloy", "cast_iron",
  "composite", "other", "unknown",
] as const;

export const LOAD_CONDITIONS = [
  "static", "dynamic", "cyclic", "thermal_cycle",
  "pressure", "cryogenic", "high_temp", "unknown",
] as const;

export const DISPOSITIONS = [
  "accept", "reject", "review_required", "inconclusive", "monitor",
] as const;

export const DISPOSITION_COLORS: Record<string, string> = {
  accept: "#2E7D32",
  reject: "#C62828",
  review_required: "#E65100",
  inconclusive: "#757575",
  monitor: "#1565C0",
};
