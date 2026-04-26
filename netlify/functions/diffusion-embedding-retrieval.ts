// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var sb = createClient(supabaseUrl, supabaseKey);

var MECHANISMS = {
  hull_fatigue_fpso: { hull: 1.0, fatigue: 1.0, fpso: 0.9, hogging: 0.8, sagging: 0.8, wave: 0.7, bending: 0.7, crack: 0.6, structural: 0.5 },
  MIC_marine: { microbiological: 1.0, bacteria: 0.9, biofilm: 0.9, pitting: 0.8, anaerobic: 0.8, sulfate: 0.7, tubercle: 0.7, low_flow: 0.6 },
  viv_fatigue: { vortex: 1.0, vibration: 1.0, viv: 1.0, span: 0.8, strouhal: 0.7, lockin: 0.8, current: 0.7, oscillation: 0.6 },
  scc_caustic: { stress: 1.0, corrosion: 1.0, cracking: 1.0, caustic: 0.9, scc: 0.9, alkaline: 0.8, transgranular: 0.7, brittle: 0.6 },
  ssc_hydrogen: { sulfide: 1.0, stress: 0.9, cracking: 0.9, hydrogen: 0.9, ssc: 0.9, embrittlement: 0.8, hic: 0.7, cathode: 0.6 },
  corrosion_erosion: { erosion: 1.0, corrosion: 0.9, abrasion: 0.8, impingement: 0.8, flow: 0.7, sand: 0.6, particle: 0.6, loss: 0.5 },
  fatigue_riser: { fatigue: 1.0, riser: 1.0, vortex: 0.8, vibration: 0.8, hydrodynamic: 0.7, bending: 0.7, stress: 0.6, cycle: 0.5 },
  wall_loss_uniform: { uniform: 1.0, loss: 0.9, thinning: 0.8, corrosion: 0.8, general: 0.7, thickness: 0.6, erosion: 0.5 },
  stress_ratcheting: { ratchet: 1.0, stress: 1.0, cycling: 0.9, plastic: 0.8, deformation: 0.8, mean: 0.7, amplitude: 0.6 },
  galvanic_corrosion: { galvanic: 1.0, corrosion: 0.9, couple: 0.8, dissimilar: 0.8, metal: 0.7, potential: 0.6, anode: 0.5 },
  crevice_corrosion: { crevice: 1.0, corrosion: 0.9, stagnant: 0.8, occluded: 0.8, chloride: 0.7, pit: 0.6, local: 0.5 },
  governess_brittle: { brittle: 1.0, hydrogen: 0.9, embrittle: 0.9, fracture: 0.8, low: 0.7, temperature: 0.6, steelwork: 0.5 },
  atmospheric_corrosion: { atmospheric: 1.0, corrosion: 0.9, rust: 0.8, exposure: 0.8, onshore: 0.7, air: 0.6, oxide: 0.5 },
  tfh_design_flaw: { design: 1.0, flaw: 1.0, geometry: 0.9, stress: 0.8, concentration: 0.8, fabrication: 0.7, defect: 0.6 },
  sif_subsea: { subsea: 1.0, mud: 0.9, ingress: 0.8, water: 0.8, flooding: 0.7, internal: 0.6, corrosion: 0.5 },
  biofouling_drag: { biofouling: 1.0, drag: 0.9, growth: 0.8, shell: 0.8, barnacle: 0.7, biofilm: 0.6, hydrodynamic: 0.5 },
  flexing_coupled: { flexible: 1.0, flex: 0.9, coupling: 0.8, vibration: 0.8, fatigue: 0.7, misalignment: 0.6, bearing: 0.5 },
  caustic_embrittlement: { caustic: 1.0, embrittlement: 1.0, scc: 0.9, alkaline: 0.8, cracking: 0.8, stress: 0.7, weld: 0.6 },
  temper_embrittlement: { temper: 1.0, embrittlement: 1.0, brittle: 0.9, hydrogen: 0.8, diffusion: 0.7, low_temp: 0.6, toughness: 0.5 },
  hydrogen_overpressure: { hydrogen: 1.0, overpressure: 1.0, blister: 0.9, internal: 0.8, pressure: 0.8, gas: 0.7, trap: 0.6 },
  top_of_line: { top: 1.0, line: 1.0, tol: 1.0, corrosion: 0.9, condensation: 0.8, oxygen: 0.8, gas: 0.7, carb: 0.6 },
  jackup_spudcan: { jackup: 1.0, spud: 0.9, punch: 0.9, soil: 0.8, foundation: 0.8, penetration: 0.7, stability: 0.6 },
  platform_sway: { sway: 1.0, platform: 0.9, wave: 0.8, motion: 0.8, fatigue: 0.7, deck: 0.6, foundation: 0.5 },
  tlp_tether: { tlp: 1.0, tension: 1.0, tether: 1.0, leg: 0.8, fatigue: 0.8, catenary: 0.7, heave: 0.6 },
  umbilical_abrasion: { umbilical: 1.0, abrasion: 1.0, chafe: 0.9, wear: 0.8, flowline: 0.7, armor: 0.6, protection: 0.5 },
  anodic_protection: { anodic: 1.0, protection: 0.9, impressed: 0.8, current: 0.8, oxidation: 0.7, passive: 0.6 },
  paint_holiday: { paint: 1.0, holiday: 1.0, coating: 0.9, defect: 0.8, exposure: 0.8, bare: 0.7, pinhole: 0.6 },
  sulfidation_corrosion: { sulfide: 1.0, corrosion: 0.9, h2s: 0.8, reaction: 0.8, black: 0.7, oxide: 0.6, tarnish: 0.5 },
  thermite_weld: { thermite: 1.0, weld: 0.9, exothermic: 0.8, quality: 0.7, defect: 0.7, inclusion: 0.6, porosity: 0.5 },
  mechanical_damage: { mechanical: 1.0, damage: 1.0, dent: 0.9, impact: 0.9, gouge: 0.8, handling: 0.7, scratch: 0.6 },
  amine_corrosion: { amine: 1.0, corrosion: 0.9, lean: 0.8, rich: 0.8, degradation: 0.7, solution: 0.6, carb: 0.5 },
  sweet_corrosion: { sweet: 1.0, corrosion: 0.9, co2: 0.9, carb: 0.8, iron_carbonate: 0.7, films: 0.6, pitting: 0.5 }
};

var EVIDENCE_DIMENSIONS = {
  zone_depth: {
    splash_zone: { splash: 1.0, waterline: 0.8, tidal: 0.5, wave: 0.5, wetdry: 0.7 },
    submerged: { submerged: 1.0, underwater: 0.9, immersed: 0.8, depth: 0.7, seabed: 0.6 },
    atmospheric: { atmospheric: 1.0, air: 0.9, onshore: 0.8, exposure: 0.7 },
    subsea_mud: { mud: 1.0, subsea: 0.9, seabed: 0.8, burial: 0.7, sediment: 0.6 },
    buried: { buried: 1.0, soil: 0.9, underground: 0.8, depth: 0.7, landfill: 0.6 }
  },
  morphology: {
    intergranular: { intergranular: 1.0, grain_boundary: 0.9, igc: 0.8, sensitization: 0.6 },
    transgranular: { transgranular: 1.0, grain: 0.8, cleavage: 0.7, brittle: 0.6 },
    pitting: { pitting: 1.0, pit: 0.9, localized: 0.8, deep: 0.6 },
    uniform: { uniform: 1.0, general: 0.9, thinning: 0.8, loss: 0.7 },
    stress_assisted: { stress: 1.0, assisted: 0.9, crack: 0.8, scc: 0.7 }
  },
  crack_orientation: {
    axial: { axial: 1.0, longitudinal: 0.9, along: 0.8, parallel: 0.7 },
    circumferential: { circumferential: 1.0, hoop: 0.9, transverse: 0.8, around: 0.7 },
    helical: { helical: 1.0, spiral: 0.9, angle: 0.7, pitch: 0.6 },
    branched: { branched: 1.0, network: 0.9, multiple: 0.8, interconnect: 0.6 },
    radial: { radial: 1.0, spoke: 0.8, center: 0.7, hub: 0.6 }
  },
  crack_location: {
    weld_toe: { weld: 1.0, toe: 0.9, junction: 0.8, fusion: 0.7, haz: 0.6 },
    weld_root: { weld: 1.0, root: 0.9, pass: 0.8, penetration: 0.6 },
    heat_affected: { heat: 1.0, affected: 0.9, haz: 0.9, zone: 0.8, coarse: 0.6 },
    base_metal: { base: 1.0, metal: 0.9, parent: 0.8, away: 0.6 },
    fastener: { fastener: 1.0, bolt: 0.9, screw: 0.8, hole: 0.7, thread: 0.6 }
  },
  wall_loss_pattern: {
    uniform: { uniform: 1.0, general: 0.9, even: 0.8, consistent: 0.7 },
    localized: { localized: 1.0, spot: 0.9, pit: 0.8, focused: 0.7 },
    sectional: { section: 1.0, portion: 0.9, area: 0.8, zone: 0.7 },
    scattered: { scatter: 1.0, random: 0.9, distributed: 0.8, multiple: 0.7 },
    preferential: { prefer: 1.0, favor: 0.9, bias: 0.8, direction: 0.6 }
  },
  cp_status: {
    protected: { protected: 1.0, cathodic: 0.9, cp: 0.9, potential: 0.8, negative: 0.7 },
    overprotected: { overprotect: 1.0, hydrogen: 0.7, excessive: 0.8, cathodic: 0.5, negative: 0.4 },
    underprotected: { underprotect: 1.0, insufficient: 0.9, bare: 0.8, positive: 0.7 },
    inactive: { inactive: 1.0, off: 0.9, disabled: 0.8, failed: 0.7, broken: 0.6 }
  },
  coating_condition: {
    intact: { intact: 1.0, good: 0.9, protective: 0.8, coverage: 0.7 },
    degraded: { degrade: 1.0, worn: 0.9, thin: 0.8, compromised: 0.7 },
    failed: { failed: 1.0, loss: 0.9, bare: 0.8, exposed: 0.7 },
    patched: { patch: 1.0, repair: 0.9, touch: 0.8, applied: 0.7 }
  },
  marine_growth_grade: {
    none: { none: 1.0, clean: 0.9, bare: 0.8 },
    light: { light: 1.0, thin: 0.9, sparse: 0.8, minimal: 0.7 },
    moderate: { moderate: 1.0, medium: 0.9, coverage: 0.8, growth: 0.7 },
    heavy: { heavy: 1.0, thick: 0.9, dense: 0.9, encrusted: 0.8, fouling: 0.7 }
  },
  current_exposure: {
    stagnant: { stagnant: 1.0, still: 0.9, low: 0.8, flow: 0.7 },
    low_flow: { low: 1.0, flow: 0.9, minimal: 0.8, sluggish: 0.7 },
    high_flow: { high: 1.0, flow: 0.9, velocity: 0.8, fast: 0.7, stream: 0.6 },
    turbulent: { turbulent: 1.0, chaotic: 0.9, mixing: 0.8, swirl: 0.7 }
  },
  platform_type: {
    fixed: { fixed: 1.0, jacket: 0.9, platform: 0.8, pile: 0.7 },
    floating: { floating: 1.0, float: 0.9, fpso: 0.8, vessel: 0.7 },
    subsea: { subsea: 1.0, bottom: 0.9, seabed: 0.8, pipeline: 0.7 },
    jackup: { jackup: 1.0, spud: 0.9, jack: 0.8, leg: 0.7 },
    tlp: { tlp: 1.0, tension: 0.9, tether: 0.8, leg: 0.7 },
    spar: { spar: 1.0, buoy: 0.9, cylinder: 0.8, vertical: 0.7 }
  },
  service_fluid: {
    crude_oil: { crude: 1.0, oil: 0.9, hydrocarbon: 0.8, petroleum: 0.7 },
    natural_gas: { gas: 1.0, natural: 0.9, methane: 0.8, hydrocarbon: 0.7 },
    seawater: { seawater: 1.0, salt: 0.9, marine: 0.8, brine: 0.7 },
    sweetwater: { sweet: 1.0, freshwater: 0.9, water: 0.8, produced: 0.6 },
    drilling_mud: { mud: 1.0, drilling: 0.9, fluid: 0.8, slurry: 0.7 }
  },
  h2s_presence: {
    none: { none: 1.0, absent: 0.9, free: 0.8 },
    low: { low: 1.0, trace: 0.9, minor: 0.8, ppm: 0.6 },
    moderate: { moderate: 1.0, medium: 0.9, present: 0.8, ppm: 0.6 },
    high: { high: 1.0, sour: 0.9, concentration: 0.8, ppm: 0.6 }
  }
};

var ABBREVIATIONS = {
  ut: "ultrasonic",
  rt: "radiographic",
  acfm: "alternating_current_field",
  cp: "cathodic_protection",
  mic: "microbiological",
  viv: "vortex_induced_vibration",
  fpso: "floating_production",
  tlp: "tension_leg",
  ssc: "sulfide_stress_cracking",
  hic: "hydrogen_induced_cracking",
  scc: "stress_corrosion_cracking",
  tol: "top_of_line",
  igc: "intergranular_corrosion",
  co2: "carbon_dioxide",
  h2s: "hydrogen_sulfide"
};

var handler: Handler = async function(event) {
  var response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json"
    },
    body: ""
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: response.headers, body: "" };
  if (event.httpMethod !== "POST") {
    response.statusCode = 405;
    response.body = JSON.stringify({ error: "Method not allowed" });
    return response;
  }

  var body = JSON.parse(event.body || "{}");
  var action = body.action || "embed_observation";
  var text = body.text || "";
  var mechanism_id = body.mechanism_id || "";
  var top_n = body.top_n || 5;
  var observations = body.observations || [];

  var result = null;

  if (action === "get_registry") {
    result = handle_get_registry();
  } else if (action === "embed_observation") {
    result = handle_embed_observation(text, top_n);
  } else if (action === "match_mechanisms") {
    result = handle_match_mechanisms(text, top_n);
  } else if (action === "auto_evidence") {
    result = handle_auto_evidence(text);
  } else if (action === "explain_match") {
    result = handle_explain_match(text, mechanism_id);
  } else if (action === "batch_embed") {
    result = handle_batch_embed(observations);
  } else if (action === "get_vocabulary") {
    var domain = body.domain || "all";
    result = handle_get_vocabulary(domain);
  } else if (action === "similarity_matrix") {
    var mechanism_ids = body.mechanism_ids || [];
    result = handle_similarity_matrix(mechanism_ids);
  } else {
    result = { error: "Unknown action: " + action };
  }

  response.body = JSON.stringify(result);

  try {
    var payload = {
      action: action,
      input_data: { text: text.substring(0, 200) },
      result_data: result,
      created_at: new Date().toISOString()
    };
    sb.from("embedding_retrieval_results").insert([payload]).then(function() {}).catch(function() {});
  } catch (e) {}

  return response;
};

var handle_get_registry = function() {
  var mechanism_count = Object.keys(MECHANISMS).length;
  var dimension_keys = Object.keys(EVIDENCE_DIMENSIONS);
  var dimension_count = 0;
  dimension_keys.forEach(function(dim) {
    dimension_count = dimension_count + Object.keys(EVIDENCE_DIMENSIONS[dim]).length;
  });

  return {
    deterministic: {
      embeddings: mechanism_count,
      similarities: "cosine",
      matched_mechanisms: mechanism_count,
      evidence_vector: dimension_count
    },
    interpreted: {
      top_mechanisms: mechanism_count,
      confidence_level: "vector-based",
      auto_filled_dimensions: dimension_count,
      coverage_ratio: mechanism_count + "/" + (5 * 12)
    },
    provenance: {
      engine: "diffusion-embedding-retrieval",
      version: "DER-1.0.0",
      deploy: "DEPLOY349",
      method: "lexical_diffusion_cosine",
      timestamp: new Date().toISOString()
    }
  };
};

var tokenize = function(text) {
  var lower = text.toLowerCase();
  var normalized = lower.replace(/[^\w\s]/g, " ");
  var words = normalized.split(/\s+/).filter(function(w) { return w.length > 0; });
  var expanded = [];

  words.forEach(function(word) {
    if (ABBREVIATIONS[word]) {
      expanded.push(ABBREVIATIONS[word]);
    } else {
      var stemmed = word;
      if (word.endsWith("ing")) {
        stemmed = word.substring(0, word.length - 3);
      } else if (word.endsWith("tion")) {
        stemmed = word.substring(0, word.length - 4);
      } else if (word.endsWith("ness")) {
        stemmed = word.substring(0, word.length - 4);
      } else if (word.endsWith("ed")) {
        stemmed = word.substring(0, word.length - 2);
      }
      expanded.push(stemmed);
    }
  });

  return expanded;
};

var build_query_vector = function(tokens) {
  var vector = {};
  var freqs = {};

  tokens.forEach(function(token) {
    freqs[token] = (freqs[token] || 0) + 1;
  });

  Object.keys(freqs).forEach(function(token) {
    vector[token] = freqs[token];
  });

  return vector;
};

var cosine_similarity = function(vecA, vecB) {
  var dot = 0;
  var magA = 0;
  var magB = 0;

  var allKeys = {};
  Object.keys(vecA).forEach(function(k) { allKeys[k] = true; });
  Object.keys(vecB).forEach(function(k) { allKeys[k] = true; });

  Object.keys(allKeys).forEach(function(key) {
    var valA = vecA[key] || 0;
    var valB = vecB[key] || 0;
    dot = dot + (valA * valB);
    magA = magA + (valA * valA);
    magB = magB + (valB * valB);
  });

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (magA * magB);
};

var handle_embed_observation = function(text, top_n) {
  var tokens = tokenize(text);
  var queryVector = build_query_vector(tokens);

  var scores = [];
  Object.keys(MECHANISMS).forEach(function(mechId) {
    var similarity = cosine_similarity(queryVector, MECHANISMS[mechId]);
    scores.push({ mechanism_id: mechId, similarity: similarity });
  });

  scores.sort(function(a, b) { return b.similarity - a.similarity; });
  var topMechanisms = scores.slice(0, top_n);

  var evidenceVector = handle_auto_evidence(text);

  return {
    deterministic: {
      embeddings: topMechanisms,
      similarities: "cosine",
      matched_mechanisms: topMechanisms,
      evidence_vector: evidenceVector.interpreted.auto_filled_dimensions
    },
    interpreted: {
      top_mechanisms: topMechanisms.map(function(m) { return m.mechanism_id; }),
      confidence_level: topMechanisms.length > 0 ? topMechanisms[0].similarity : 0,
      auto_filled_dimensions: evidenceVector.interpreted.auto_filled_dimensions,
      coverage_ratio: (Object.keys(evidenceVector.interpreted.auto_filled_dimensions).length / 12).toFixed(2)
    },
    provenance: {
      engine: "diffusion-embedding-retrieval",
      version: "DER-1.0.0",
      deploy: "DEPLOY349",
      method: "lexical_diffusion_cosine",
      timestamp: new Date().toISOString()
    }
  };
};

var handle_match_mechanisms = function(text, top_n) {
  var tokens = tokenize(text);
  var queryVector = build_query_vector(tokens);

  var scores = [];
  Object.keys(MECHANISMS).forEach(function(mechId) {
    var similarity = cosine_similarity(queryVector, MECHANISMS[mechId]);
    scores.push({ mechanism_id: mechId, similarity: similarity });
  });

  scores.sort(function(a, b) { return b.similarity - a.similarity; });
  var topMechanisms = scores.slice(0, top_n);

  return {
    deterministic: {
      embeddings: topMechanisms,
      similarities: "cosine",
      matched_mechanisms: topMechanisms,
      evidence_vector: []
    },
    interpreted: {
      top_mechanisms: topMechanisms.map(function(m) { return m.mechanism_id; }),
      confidence_level: topMechanisms.length > 0 ? topMechanisms[0].similarity : 0,
      auto_filled_dimensions: {},
      coverage_ratio: "0.0"
    },
    provenance: {
      engine: "diffusion-embedding-retrieval",
      version: "DER-1.0.0",
      deploy: "DEPLOY349",
      method: "lexical_diffusion_cosine",
      timestamp: new Date().toISOString()
    }
  };
};

var handle_auto_evidence = function(text) {
  var tokens = tokenize(text);
  var queryVector = build_query_vector(tokens);
  var filledDimensions = {};

  Object.keys(EVIDENCE_DIMENSIONS).forEach(function(dimName) {
    var dimension = EVIDENCE_DIMENSIONS[dimName];
    var bestMatch = null;
    var bestScore = -1;

    Object.keys(dimension).forEach(function(valueKey) {
      var similarity = cosine_similarity(queryVector, dimension[valueKey]);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = valueKey;
      }
    });

    if (bestMatch && bestScore > 0.1) {
      filledDimensions[dimName] = { value: bestMatch, confidence: bestScore };
    }
  });

  return {
    deterministic: {
      embeddings: [],
      similarities: "cosine",
      matched_mechanisms: [],
      evidence_vector: filledDimensions
    },
    interpreted: {
      top_mechanisms: [],
      confidence_level: 0,
      auto_filled_dimensions: filledDimensions,
      coverage_ratio: (Object.keys(filledDimensions).length / 12).toFixed(2)
    },
    provenance: {
      engine: "diffusion-embedding-retrieval",
      version: "DER-1.0.0",
      deploy: "DEPLOY349",
      method: "lexical_diffusion_cosine",
      timestamp: new Date().toISOString()
    }
  };
};

var handle_explain_match = function(text, mechanism_id) {
  if (!MECHANISMS[mechanism_id]) {
    return { error: "Mechanism not found: " + mechanism_id };
  }

  var tokens = tokenize(text);
  var queryVector = build_query_vector(tokens);
  var mechVector = MECHANISMS[mechanism_id];

  var contributions = [];
  Object.keys(queryVector).forEach(function(token) {
    if (mechVector[token]) {
      var contribution = queryVector[token] * mechVector[token];
      contributions.push({ keyword: token, query_freq: queryVector[token], mech_weight: mechVector[token], contribution: contribution });
    }
  });

  contributions.sort(function(a, b) { return b.contribution - a.contribution; });
  var topContributions = contributions.slice(0, 10);

  var totalSim = cosine_similarity(queryVector, mechVector);

  return {
    deterministic: {
      embeddings: [],
      similarities: "cosine",
      matched_mechanisms: [{ mechanism_id: mechanism_id, similarity: totalSim }],
      evidence_vector: topContributions
    },
    interpreted: {
      top_mechanisms: [mechanism_id],
      confidence_level: totalSim,
      auto_filled_dimensions: {},
      coverage_ratio: "keyword-driven"
    },
    provenance: {
      engine: "diffusion-embedding-retrieval",
      version: "DER-1.0.0",
      deploy: "DEPLOY349",
      method: "lexical_diffusion_cosine",
      timestamp: new Date().toISOString()
    }
  };
};

var handle_batch_embed = function(observations) {
  var allMechanismScores = {};
  var allEvidenceDimensions = {};
  var count = 0;

  observations.forEach(function(obs) {
    var tokens = tokenize(obs);
    var queryVector = build_query_vector(tokens);

    Object.keys(MECHANISMS).forEach(function(mechId) {
      var similarity = cosine_similarity(queryVector, MECHANISMS[mechId]);
      if (!allMechanismScores[mechId]) {
        allMechanismScores[mechId] = 0;
      }
      allMechanismScores[mechId] = allMechanismScores[mechId] + similarity;
    });

    Object.keys(EVIDENCE_DIMENSIONS).forEach(function(dimName) {
      var dimension = EVIDENCE_DIMENSIONS[dimName];
      Object.keys(dimension).forEach(function(valueKey) {
        var similarity = cosine_similarity(queryVector, dimension[valueKey]);
        var key = dimName + ":" + valueKey;
        if (!allEvidenceDimensions[key]) {
          allEvidenceDimensions[key] = 0;
        }
        allEvidenceDimensions[key] = allEvidenceDimensions[key] + similarity;
      });
    });

    count = count + 1;
  });

  Object.keys(allMechanismScores).forEach(function(mechId) {
    allMechanismScores[mechId] = allMechanismScores[mechId] / count;
  });

  var consolidated = [];
  Object.keys(allMechanismScores).forEach(function(mechId) {
    consolidated.push({ mechanism_id: mechId, avg_similarity: allMechanismScores[mechId] });
  });

  consolidated.sort(function(a, b) { return b.avg_similarity - a.avg_similarity; });

  return {
    deterministic: {
      embeddings: consolidated.slice(0, 10),
      similarities: "cosine",
      matched_mechanisms: consolidated.slice(0, 10),
      evidence_vector: allEvidenceDimensions
    },
    interpreted: {
      top_mechanisms: consolidated.slice(0, 10).map(function(m) { return m.mechanism_id; }),
      confidence_level: consolidated.length > 0 ? consolidated[0].avg_similarity : 0,
      auto_filled_dimensions: {},
      coverage_ratio: (Object.keys(consolidated).length / 30).toFixed(2)
    },
    provenance: {
      engine: "diffusion-embedding-retrieval",
      version: "DER-1.0.0",
      deploy: "DEPLOY349",
      method: "lexical_diffusion_cosine",
      timestamp: new Date().toISOString()
    }
  };
};

var handle_get_vocabulary = function(domain) {
  var vocabulary = {};

  if (domain === "all" || domain === "mechanisms") {
    Object.keys(MECHANISMS).forEach(function(mechId) {
      Object.keys(MECHANISMS[mechId]).forEach(function(keyword) {
        vocabulary[keyword] = (vocabulary[keyword] || 0) + MECHANISMS[mechId][keyword];
      });
    });
  }

  if (domain === "all" || domain === "evidence") {
    Object.keys(EVIDENCE_DIMENSIONS).forEach(function(dimName) {
      Object.keys(EVIDENCE_DIMENSIONS[dimName]).forEach(function(valueKey) {
        Object.keys(EVIDENCE_DIMENSIONS[dimName][valueKey]).forEach(function(keyword) {
          vocabulary[keyword] = (vocabulary[keyword] || 0) + EVIDENCE_DIMENSIONS[dimName][valueKey][keyword];
        });
      });
    });
  }

  if (domain === "all" || domain === "abbreviations") {
    Object.keys(ABBREVIATIONS).forEach(function(abbr) {
      vocabulary[abbr] = ABBREVIATIONS[abbr];
    });
  }

  var sorted = [];
  Object.keys(vocabulary).forEach(function(term) {
    sorted.push({ term: term, weight: vocabulary[term] });
  });

  sorted.sort(function(a, b) { return b.weight - a.weight; });

  return {
    deterministic: {
      embeddings: [],
      similarities: [],
      matched_mechanisms: sorted.slice(0, 100),
      evidence_vector: []
    },
    interpreted: {
      top_mechanisms: [],
      confidence_level: 0,
      auto_filled_dimensions: {},
      coverage_ratio: (sorted.length / 500).toFixed(2)
    },
    provenance: {
      engine: "diffusion-embedding-retrieval",
      version: "DER-1.0.0",
      deploy: "DEPLOY349",
      method: "lexical_diffusion_cosine",
      timestamp: new Date().toISOString()
    }
  };
};

var handle_similarity_matrix = function(mechanism_ids) {
  var matrix = {};

  for (var i = 0; i < mechanism_ids.length; i = i + 1) {
    var id1 = mechanism_ids[i];
    if (!MECHANISMS[id1]) continue;

    matrix[id1] = {};
    for (var j = 0; j < mechanism_ids.length; j = j + 1) {
      var id2 = mechanism_ids[j];
      if (!MECHANISMS[id2]) continue;

      var sim = cosine_similarity(MECHANISMS[id1], MECHANISMS[id2]);
      matrix[id1][id2] = sim;
    }
  }

  return {
    deterministic: {
      embeddings: [],
      similarities: matrix,
      matched_mechanisms: [],
      evidence_vector: []
    },
    interpreted: {
      top_mechanisms: [],
      confidence_level: 0,
      auto_filled_dimensions: {},
      coverage_ratio: (Object.keys(matrix).length / mechanism_ids.length).toFixed(2)
    },
    provenance: {
      engine: "diffusion-embedding-retrieval",
      version: "DER-1.0.0",
      deploy: "DEPLOY349",
      method: "lexical_diffusion_cosine",
      timestamp: new Date().toISOString()
    }
  };
};

export { handler };
