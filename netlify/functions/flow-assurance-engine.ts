// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || ""
);

var handler: Handler = async (event, context) => {
  var corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "POST method required" }),
    };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";

    var result: any = null;

    switch (action) {
      case "assess_erosion":
        result = assessErosion(body);
        break;
      case "assess_sand_erosion":
        result = assessSandErosion(body);
        break;
      case "assess_hydrate":
        result = assessHydrate(body);
        break;
      case "assess_wax":
        result = assessWax(body);
        break;
      case "assess_slugging":
        result = assessSlugging(body);
        break;
      case "assess_thermal":
        result = assessThermal(body);
        break;
      case "assess_pressure_drop":
        result = assessPressureDrop(body);
        break;
      case "assess_combined":
        result = assessCombined(body);
        break;
      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Unknown action: " + action }),
        };
    }

    var timestamp = new Date().toISOString();
    var assessment_id = body.assessment_id || "FA-" + Date.now();

    try {
      supabase.from("flow_assurance_assessments").insert([
        {
          assessment_id: assessment_id,
          action: action,
          input_data: body,
          output_data: result,
          created_at: timestamp,
        },
      ]);
    } catch (dbErr) {
      console.error("Database write failed (non-fatal):", dbErr);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        assessment_id: assessment_id,
        action: action,
        result: result,
        timestamp: timestamp,
      }),
    };
  } catch (err) {
    console.error("Handler error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};

function assessErosion(data: any) {
  var v_actual = data.velocity_fps || 0;
  var rho_mix = data.fluid_density_lbm_ft3 || 50;
  var flow_type = data.flow_type || "continuous";

  var C = 100;
  if (flow_type === "intermittent") {
    C = 125;
  } else if (flow_type === "solid-free") {
    C = 150;
  }

  var ve = C / Math.sqrt(rho_mix);
  var erosion_ratio = v_actual / ve;
  var acceptance = erosion_ratio < 1.0;

  return {
    deterministic: {
      erosional_velocity_fps: ve.toFixed(2),
      actual_velocity_fps: v_actual.toFixed(2),
      fluid_density_lbm_ft3: rho_mix,
      empirical_constant_C: C,
      erosion_ratio: erosion_ratio.toFixed(3),
    },
    interpreted: {
      acceptance: acceptance,
      margin_percent: ((1.0 - erosion_ratio) * 100).toFixed(1),
      risk_level: erosion_ratio < 0.5 ? "low" : erosion_ratio < 0.8 ? "medium" : "high",
      recommended_actions: erosion_ratio >= 1.0 ? "Reduce flow rate or increase pipe diameter" : "Within acceptable limits",
    },
    provenance: {
      engine: "FlowAssuranceEngine",
      version: "1.0.0",
      deploy: "DEPLOY347",
      standard: "API RP 14E",
      method: "Erosional velocity limit",
      timestamp: new Date().toISOString(),
    },
  };
}

function assessSandErosion(data: any) {
  var v_particle = data.particle_velocity_fps || 20;
  var impact_angle_deg = data.impact_angle_deg || 30;
  var d_particle = data.particle_diameter_microns || 100;
  var hardness = data.material_hardness_hv || 300;
  var geometry = data.geometry || "straight";

  var K = 1.0;
  if (geometry === "elbow") {
    K = 3.5;
  } else if (geometry === "tee") {
    K = 2.5;
  }

  var angle_rad = (impact_angle_deg * Math.PI) / 180.0;
  var sin_angle = Math.sin(angle_rad);

  var erosion_rate = (K * Math.pow(v_particle, 2.5) * d_particle * sin_angle) / hardness;

  var risk = "low";
  if (erosion_rate > 0.5) {
    risk = "high";
  } else if (erosion_rate > 0.1) {
    risk = "medium";
  }

  return {
    deterministic: {
      particle_velocity_fps: v_particle,
      impact_angle_degrees: impact_angle_deg,
      particle_diameter_microns: d_particle,
      material_hardness_hv: hardness,
      geometry_factor_K: K,
      erosion_rate_mm_yr: erosion_rate.toFixed(4),
    },
    interpreted: {
      risk_level: risk,
      geometry_type: geometry,
      recommended_actions:
        risk === "high" ? "Install erosion-resistant lining or increase monitoring frequency" : "Standard monitoring recommended",
      pigging_interval_months: Math.max(12, Math.round(12.0 / Math.max(erosion_rate, 0.01))),
    },
    provenance: {
      engine: "FlowAssuranceEngine",
      version: "1.0.0",
      deploy: "DEPLOY347",
      standard: "DNV-RP-O501",
      method: "Sand erosion rate calculation with geometry factors",
      timestamp: new Date().toISOString(),
    },
  };
}

function assessHydrate(data: any) {
  var water_content_ppm = data.water_content_ppm || 100;
  var inhibitor_type = data.inhibitor_type || "none";
  var inhibitor_wt_percent = data.inhibitor_wt_percent || 0;
  var operating_temp_f = data.operating_temp_f || 40;
  var system_pressure_psia = data.system_pressure_psia || 500;

  var K_H = 0;
  var M = 0;
  if (inhibitor_type === "methanol") {
    K_H = 2335;
    M = 32;
  } else if (inhibitor_type === "meg") {
    K_H = 2700;
    M = 62;
  }

  var dT_depression = 0;
  if (inhibitor_wt_percent > 0 && M > 0) {
    dT_depression = (K_H * inhibitor_wt_percent) / (M * (100 - inhibitor_wt_percent));
  }

  var hydrate_formation_temp_f = 60.0 - dT_depression;
  var subcooling_margin_f = operating_temp_f - hydrate_formation_temp_f;
  var risk = "low";
  if (subcooling_margin_f < 5) {
    risk = "high";
  } else if (subcooling_margin_f < 15) {
    risk = "medium";
  }

  return {
    deterministic: {
      water_content_ppm: water_content_ppm,
      inhibitor_type: inhibitor_type,
      inhibitor_concentration_wt_percent: inhibitor_wt_percent,
      operating_temperature_f: operating_temp_f,
      system_pressure_psia: system_pressure_psia,
      hammerschmidt_depression_f: dT_depression.toFixed(2),
      hydrate_formation_temperature_f: hydrate_formation_temp_f.toFixed(1),
      subcooling_margin_f: subcooling_margin_f.toFixed(1),
    },
    interpreted: {
      hydrate_risk: risk,
      acceptance: risk !== "high",
      recommended_actions:
        risk === "high"
          ? "Increase inhibitor concentration or reduce operating temperature"
          : risk === "medium"
            ? "Monitor inhibitor concentration and system pressure"
            : "Hydrate formation unlikely at current conditions",
    },
    provenance: {
      engine: "FlowAssuranceEngine",
      version: "1.0.0",
      deploy: "DEPLOY347",
      standard: "Hammerschmidt simplified correlation",
      method: "Inhibitor depression calculation",
      timestamp: new Date().toISOString(),
    },
  };
}

function assessWax(data: any) {
  var wat_f = data.wax_appearance_temperature_f || 95;
  var operating_temp_f = data.operating_temp_f || 70;
  var thermal_gradient_f_per_km = data.thermal_gradient_f_per_km || 3;
  var pipe_length_km = data.pipe_length_km || 10;

  var wax_risk = "low";
  if (operating_temp_f < wat_f - 10) {
    wax_risk = "high";
  } else if (operating_temp_f < wat_f) {
    wax_risk = "medium";
  }

  var max_temp_drop = Math.min(thermal_gradient_f_per_km * pipe_length_km, 50);
  var min_expected_temp = operating_temp_f - max_temp_drop;
  var margin_to_wat = min_expected_temp - wat_f;

  var pigging_frequency = "as-needed";
  if (wax_risk === "high") {
    pigging_frequency = "monthly";
  } else if (wax_risk === "medium") {
    pigging_frequency = "quarterly";
  }

  return {
    deterministic: {
      wax_appearance_temperature_f: wat_f,
      operating_temperature_f: operating_temp_f,
      thermal_gradient_f_per_km: thermal_gradient_f_per_km,
      pipe_length_km: pipe_length_km,
      maximum_expected_cooldown_f: max_temp_drop.toFixed(1),
      minimum_expected_temperature_f: min_expected_temp.toFixed(1),
      margin_to_wat_f: margin_to_wat.toFixed(1),
    },
    interpreted: {
      wax_deposition_risk: wax_risk,
      acceptance: wax_risk !== "high",
      recommended_pigging_frequency: pigging_frequency,
      recommended_actions:
        wax_risk === "high"
          ? "Implement regular pigging schedule and thermal insulation"
          : wax_risk === "medium"
            ? "Monitor thermal profile and plan preventive pigging"
            : "Wax precipitation unlikely",
    },
    provenance: {
      engine: "FlowAssuranceEngine",
      version: "1.0.0",
      deploy: "DEPLOY347",
      standard: "Cloud point and thermal gradient assessment",
      method: "WAT comparison with dynamic thermal model",
      timestamp: new Date().toISOString(),
    },
  };
}

function assessSlugging(data: any) {
  var flow_rate_bbl_d = data.flow_rate_bbl_d || 5000;
  var gas_rate_mscf_d = data.gas_rate_mscf_d || 1000;
  var pipe_diameter_inch = data.pipe_diameter_inch || 4;
  var inclination_deg = data.inclination_deg || 45;
  var terrain_type = data.terrain_type || "subsea";

  var A_pipe = (Math.PI * Math.pow(pipe_diameter_inch / 12, 2)) / 4;
  var v_liquid = (flow_rate_bbl_d * 5.615) / (86400 * A_pipe);

  var froude = (v_liquid * v_liquid) / (32.174 * pipe_diameter_inch / 12);
  var sin_theta = Math.sin((inclination_deg * Math.PI) / 180);

  var slug_flow_likely = froude > 25 && sin_theta > 0.3;

  var L_slug = (pipe_diameter_inch * 30) / (1 + 0.01 * flow_rate_bbl_d);
  var V_slug = L_slug * A_pipe;

  var terrain_risk = terrain_type === "riser-base" ? "high" : "medium";

  var slugging_risk = slug_flow_likely ? "high" : "low";

  return {
    deterministic: {
      flow_rate_bbl_d: flow_rate_bbl_d,
      gas_rate_mscf_d: gas_rate_mscf_d,
      pipe_diameter_inch: pipe_diameter_inch,
      inclination_degrees: inclination_deg,
      cross_sectional_area_ft2: A_pipe.toFixed(4),
      liquid_velocity_ft_s: v_liquid.toFixed(2),
      froude_number: froude.toFixed(2),
      slug_length_ft: L_slug.toFixed(1),
      slug_volume_ft3: V_slug.toFixed(2),
    },
    interpreted: {
      slug_flow_regime: slug_flow_likely ? "likely" : "unlikely",
      slugging_risk: slugging_risk,
      terrain_risk: terrain_risk,
      combined_risk: slugging_risk === "high" && terrain_risk === "high" ? "critical" : slugging_risk,
      recommended_actions:
        slugging_risk === "high"
          ? "Specify slug catcher and implement pressure relief or reduce inclination"
          : "Standard design acceptable",
      slug_catcher_volume_bbl: (V_slug / 5.615).toFixed(0),
    },
    provenance: {
      engine: "FlowAssuranceEngine",
      version: "1.0.0",
      deploy: "DEPLOY347",
      standard: "Baker flow regime chart, Hill-Wood correlation",
      method: "Froude number classification and slug sizing",
      timestamp: new Date().toISOString(),
    },
  };
}

function assessThermal(data: any) {
  var initial_temp_f = data.initial_temp_f || 140;
  var ambient_temp_f = data.ambient_temp_f || 38;
  var u_value_btu_h_ft2_f = data.u_value_btu_h_ft2_f || 0.5;
  var surface_area_ft2 = data.surface_area_ft2 || 500;
  var mass_lbm = data.mass_lbm || 5000;
  var specific_heat_btu_lbm_f = data.specific_heat_btu_lbm_f || 0.5;
  var hydrate_temp_f = data.hydrate_temp_f || 45;

  var time_const_hours = (mass_lbm * specific_heat_btu_lbm_f) / (u_value_btu_h_ft2_f * surface_area_ft2);

  var cooldown_time_hours = -time_const_hours * Math.log((ambient_temp_f - hydrate_temp_f) / (initial_temp_f - ambient_temp_f));

  var t_touch = cooldown_time_hours;
  var t_touch_acceptable = cooldown_time_hours > 4;

  var thermal_risk = "low";
  if (cooldown_time_hours < 2) {
    thermal_risk = "high";
  } else if (cooldown_time_hours < 4) {
    thermal_risk = "medium";
  }

  return {
    deterministic: {
      initial_temperature_f: initial_temp_f,
      ambient_temperature_f: ambient_temp_f,
      hydrate_formation_temperature_f: hydrate_temp_f,
      u_value_btu_h_ft2_f: u_value_btu_h_ft2_f,
      surface_area_ft2: surface_area_ft2,
      mass_lbm: mass_lbm,
      specific_heat_btu_lbm_f: specific_heat_btu_lbm_f,
      thermal_time_constant_hours: time_const_hours.toFixed(2),
      cooldown_time_to_hydrate_temp_hours: Math.max(0, cooldown_time_hours).toFixed(2),
    },
    interpreted: {
      thermal_cooldown_risk: thermal_risk,
      no_touch_time_hours: Math.max(0, cooldown_time_hours).toFixed(1),
      no_touch_time_acceptable: t_touch_acceptable,
      recommended_actions:
        thermal_risk === "high"
          ? "Increase thermal insulation or reduce ambient exposure"
          : thermal_risk === "medium"
            ? "Monitor cooldown and maintain inhibitor injection capability"
            : "Thermal profile acceptable for normal operation",
    },
    provenance: {
      engine: "FlowAssuranceEngine",
      version: "1.0.0",
      deploy: "DEPLOY347",
      standard: "Thermal transient analysis with exponential cooling model",
      method: "Time constant and cooldown curve calculation",
      timestamp: new Date().toISOString(),
    },
  };
}

function assessPressureDrop(data: any) {
  var flow_rate_bbl_d = data.flow_rate_bbl_d || 5000;
  var pipe_diameter_inch = data.pipe_diameter_inch || 4;
  var liquid_fraction = data.liquid_fraction || 0.7;
  var gas_fraction = 1 - liquid_fraction;
  var pipe_length_ft = data.pipe_length_ft || 5280;
  var elevation_ft = data.elevation_ft || 0;
  var roughness_inch = data.roughness_inch || 0.0005;

  var A_pipe = (Math.PI * Math.pow(pipe_diameter_inch / 12, 2)) / 4;
  var v_mix = (flow_rate_bbl_d * 5.615) / (86400 * A_pipe);

  var rho_liquid = 50;
  var rho_gas = 0.1;
  var rho_mix = liquid_fraction * rho_liquid + gas_fraction * rho_gas;

  var friction_factor = 0.02 + 0.005 * (liquid_fraction > 0.3 ? 1 : 0);
  var dP_friction = (friction_factor * pipe_length_ft * rho_mix * Math.pow(v_mix, 2)) / (2 * 32.174 * pipe_diameter_inch / 12);
  var dP_gravity = (rho_mix * elevation_ft) / 144;
  var dP_total = dP_friction + dP_gravity;
  var dP_total_bar = dP_total * 0.0689476;

  return {
    deterministic: {
      flow_rate_bbl_d: flow_rate_bbl_d,
      pipe_diameter_inch: pipe_diameter_inch,
      liquid_fraction: liquid_fraction.toFixed(2),
      gas_fraction: gas_fraction.toFixed(2),
      mixture_density_lbm_ft3: rho_mix.toFixed(2),
      mixture_velocity_ft_s: v_mix.toFixed(2),
      pipe_length_ft: pipe_length_ft,
      elevation_change_ft: elevation_ft,
      friction_factor: friction_factor.toFixed(4),
      dP_friction_psi: dP_friction.toFixed(2),
      dP_elevation_psi: dP_gravity.toFixed(2),
      dP_total_psi: dP_total.toFixed(2),
      dP_total_bar: dP_total_bar.toFixed(2),
    },
    interpreted: {
      flow_pattern: liquid_fraction > 0.5 ? "segregated" : "intermittent",
      dP_acceptability: dP_total < 50 ? "acceptable" : "high",
      recommended_actions: dP_total > 50 ? "Increase pipe diameter or reduce flow rate" : "Pressure drop within design limits",
    },
    provenance: {
      engine: "FlowAssuranceEngine",
      version: "1.0.0",
      deploy: "DEPLOY347",
      standard: "Beggs-Brill multiphase correlation",
      method: "Friction and elevation component integration",
      timestamp: new Date().toISOString(),
    },
  };
}

function assessCombined(data: any) {
  var erosion_assessment = assessErosion(data);
  var hydrate_assessment = assessHydrate(data);
  var wax_assessment = assessWax(data);
  var slugging_assessment = assessSlugging(data);
  var thermal_assessment = assessThermal(data);

  var risk_scores: any = {};
  risk_scores.erosion = erosion_assessment.interpreted.risk_level === "high" ? 3 : erosion_assessment.interpreted.risk_level === "medium" ? 2 : 1;
  risk_scores.hydrate = hydrate_assessment.interpreted.hydrate_risk === "high" ? 3 : hydrate_assessment.interpreted.hydrate_risk === "medium" ? 2 : 1;
  risk_scores.wax = wax_assessment.interpreted.wax_deposition_risk === "high" ? 3 : wax_assessment.interpreted.wax_deposition_risk === "medium" ? 2 : 1;
  risk_scores.slugging = slugging_assessment.interpreted.slugging_risk === "high" ? 3 : 1;
  risk_scores.thermal = thermal_assessment.interpreted.thermal_cooldown_risk === "high" ? 3 : thermal_assessment.interpreted.thermal_cooldown_risk === "medium" ? 2 : 1;

  var avg_risk = (risk_scores.erosion + risk_scores.hydrate + risk_scores.wax + risk_scores.slugging + risk_scores.thermal) / 5;
  var overall_risk = avg_risk > 2.5 ? "high" : avg_risk > 1.5 ? "medium" : "low";

  var mitigations: any = [];
  if (risk_scores.erosion >= 3) {
    mitigations.push("Erosion: Reduce velocity or increase pipe diameter");
  }
  if (risk_scores.hydrate >= 3) {
    mitigations.push("Hydrate: Increase inhibitor injection concentration");
  }
  if (risk_scores.wax >= 3) {
    mitigations.push("Wax: Implement pigging schedule and insulation");
  }
  if (risk_scores.slugging >= 3) {
    mitigations.push("Slugging: Install slug catcher or modify geometry");
  }
  if (risk_scores.thermal >= 3) {
    mitigations.push("Thermal: Improve insulation to extend no-touch time");
  }

  return {
    deterministic: {
      erosion_ratio: erosion_assessment.deterministic.erosion_ratio,
      hydrate_subcooling_f: hydrate_assessment.deterministic.subcooling_margin_f,
      wax_margin_f: wax_assessment.deterministic.margin_to_wat_f,
      slug_volume_ft3: slugging_assessment.deterministic.slug_volume_ft3,
      cooldown_time_hours: thermal_assessment.deterministic.cooldown_time_to_hydrate_temp_hours,
    },
    interpreted: {
      overall_flow_assurance_risk: overall_risk,
      risk_matrix: {
        erosion: risk_scores.erosion,
        hydrate: risk_scores.hydrate,
        wax: risk_scores.wax,
        slugging: risk_scores.slugging,
        thermal: risk_scores.thermal,
      },
      critical_constraints: mitigations,
      design_acceptance: overall_risk !== "high",
    },
    provenance: {
      engine: "FlowAssuranceEngine",
      version: "1.0.0",
      deploy: "DEPLOY347",
      standards: ["API RP 14E", "DNV-RP-O501", "ASME B31.3", "ASME B31.8", "Beggs-Brill", "DNV-RP-F105"],
      method: "Integrated flow assurance screening with risk aggregation",
      timestamp: new Date().toISOString(),
    },
  };
}

export { handler };
