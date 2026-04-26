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
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true })
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  var body = JSON.parse(event.body || "{}");
  var action = body.action || "";
  var params = body.params || {};

  var result: any = {};

  try {
    if (action === "assess_viv") {
      result = assessVIV(params);
    } else if (action === "assess_touchdown") {
      result = assessTouchdown(params);
    } else if (action === "assess_clash") {
      result = assessClash(params);
    } else if (action === "assess_flex_joint") {
      result = assessFlexJoint(params);
    } else if (action === "assess_free_span") {
      result = assessFreeSpan(params);
    } else if (action === "assess_fatigue") {
      result = assessFatigue(params);
    } else if (action === "assess_natural_frequency") {
      result = assessNaturalFrequency(params);
    } else if (action === "assess_combined") {
      result = assessCombined(params);
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Unknown action: " + action })
      };
    }

    try {
      var { error: dbError } = await supabase
        .from("riser_dynamics_assessments")
        .insert({
          action: action,
          params: params,
          result: result,
          created_at: new Date().toISOString(),
          riser_type: params.riser_type || "unknown"
        });
      if (dbError) {
        console.error("DB write failed (non-fatal): " + dbError.message);
      }
    } catch (dbErr) {
      console.error("DB exception (non-fatal): " + (dbErr as any).message);
    }

    var response = {
      deterministic: result.deterministic || {},
      interpreted: result.interpreted || {},
      provenance: {
        engine: "riser-dynamics-engine",
        version: "DEPLOY348",
        deploy: "DEPLOY348",
        standards: [
          "DNV-RP-F105",
          "DNV-RP-F107",
          "DNV-RP-C203",
          "DNV-ST-F201",
          "API RP 2RD",
          "API RP 16Q",
          "ISO 13628-7"
        ],
        timestamp: new Date().toISOString(),
        riser_type: params.riser_type || "unknown"
      }
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response)
    };
  } catch (err) {
    console.error("Handler error: " + (err as any).message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Internal server error",
        message: (err as any).message
      })
    };
  }
};

function assessVIV(params: any) {
  var D = params.diameter || 0.5;
  var U = params.current_velocity || 1.0;
  var f_n = params.natural_frequency || 0.5;
  var T_eff = params.effective_tension || 1000;
  var m_eff = params.mass_per_length || 100;
  var Ca = params.added_mass_coeff || 1.0;
  var riser_length = params.riser_length || 1000;
  var Cd = params.drag_coeff || 1.2;
  var rho = params.fluid_density || 1025;

  var St = 0.2;
  var f_shed = (St * U) / D;
  var Vr = U / (f_n * D);

  var cross_flow_lock_in_min = 4;
  var cross_flow_lock_in_max = 8;
  var in_line_lock_in_min = 1.5;
  var in_line_lock_in_max = 3.5;

  var is_cross_flow_lock_in =
    Vr >= cross_flow_lock_in_min && Vr <= cross_flow_lock_in_max;
  var is_in_line_lock_in =
    Vr >= in_line_lock_in_min && Vr <= in_line_lock_in_max;

  var amplitude = 0;
  if (is_cross_flow_lock_in || is_in_line_lock_in) {
    amplitude = 0.4 * D;
  } else {
    amplitude = 0.1 * D;
  }

  var E = 207000;
  var I = Math.PI * Math.pow(D, 4) / 64;
  var M_max = (E * I * amplitude) / Math.pow(riser_length / 2, 2);
  var stress_viv = (M_max * 1e6) / (I * 1e-12);

  var cycles_per_hour = f_shed * 3600;
  var damage_per_cycle = Math.pow(stress_viv / 355, -3) / 1e7;
  var fatigue_damage_rate = damage_per_cycle * cycles_per_hour;

  return {
    deterministic: {
      strouhal_number: St,
      vortex_shedding_frequency: f_shed,
      reduced_velocity: Vr,
      amplitude_of_motion: amplitude,
      stress_amplitude_viv: stress_viv,
      fatigue_damage_rate_per_hour: fatigue_damage_rate,
      lock_in_cross_flow: is_cross_flow_lock_in,
      lock_in_in_line: is_in_line_lock_in
    },
    interpreted: {
      acceptance:
        Vr < cross_flow_lock_in_min || Vr > cross_flow_lock_in_max
          ? "PASS"
          : "CAUTION",
      risk_level:
        is_cross_flow_lock_in || is_in_line_lock_in ? "MEDIUM" : "LOW",
      critical_mode: is_cross_flow_lock_in ? "cross-flow VIV" : "in-line VIV",
      recommended_actions: is_cross_flow_lock_in
        ? "Monitor amplitude; consider fairings or strakes"
        : "Continue normal operations"
    }
  };
}

function assessTouchdown(params: any) {
  var D = params.diameter || 0.5;
  var t = params.wall_thickness || 0.012;
  var contact_pressure = params.contact_pressure || 50;
  var soil_friction = params.soil_friction_coeff || 0.5;
  var trench_depth = params.trench_depth || 0.5;
  var E = 207000;
  var sigma_y = 450;
  var service_life = params.service_life || 20;
  var DFF = params.design_fatigue_factor || 10;

  var curvature_radius = params.tdp_radius || 50;
  var M_tdp = (E * Math.PI * Math.pow(D, 4) / 64) / curvature_radius;
  var stress_bending = (M_tdp * 1e6) / (Math.PI * D * t * 1e-6);

  var stress_contact = contact_pressure * 1.5;

  var stress_combined = Math.sqrt(
    Math.pow(stress_bending, 2) + Math.pow(stress_contact, 2)
  );

  var log_cycles_to_fail = 12.175 - 3 * Math.log10(stress_combined);
  var cycles_to_fail = Math.pow(10, log_cycles_to_fail);

  var cycles_per_year = 1e6;
  var fatigue_life_years = cycles_to_fail / cycles_per_year;

  var design_fatigue_life = fatigue_life_years / DFF;

  return {
    deterministic: {
      contact_pressure: contact_pressure,
      bending_stress_tdp: stress_bending,
      contact_stress_tdp: stress_contact,
      combined_stress: stress_combined,
      cycles_to_fail: cycles_to_fail,
      fatigue_life_years: fatigue_life_years,
      design_fatigue_life: design_fatigue_life,
      trench_depth: trench_depth
    },
    interpreted: {
      acceptance: design_fatigue_life > service_life ? "PASS" : "FAIL",
      risk_level:
        design_fatigue_life > service_life * 2 ? "LOW" : "MEDIUM",
      critical_mode: "touchdown point fatigue",
      recommended_actions:
        design_fatigue_life > service_life
          ? "Routine monitoring at TDP zone"
          : "Evaluate trench deepening or riser redesign"
    }
  };
}

function assessClash(params: any) {
  var D = params.diameter || 0.5;
  var min_clearance = params.measured_clearance || 1.5;
  var riser_count = params.adjacent_risers || 3;
  var current_velocity = params.current_velocity || 1.0;
  var current_angle = params.current_angle || 0;
  var dnv_minimum = 1.0;

  var effective_clearance = min_clearance;

  var angle_factor = Math.cos((current_angle * Math.PI) / 180);
  var lateral_sway = (0.2 * D * current_velocity * angle_factor) / 2;

  effective_clearance = min_clearance - lateral_sway;

  var meets_dnv = effective_clearance >= dnv_minimum;
  var passes = effective_clearance >= 0.5 * D;

  return {
    deterministic: {
      measured_clearance: min_clearance,
      lateral_sway_amplitude: lateral_sway,
      effective_clearance: effective_clearance,
      dnv_minimum: dnv_minimum,
      half_diameter_minimum: 0.5 * D,
      adjacent_risers: riser_count
    },
    interpreted: {
      acceptance: meets_dnv ? "PASS" : "FAIL",
      risk_level: meets_dnv && effective_clearance > 1.5 ? "LOW" : "HIGH",
      critical_mode: "riser-to-riser collision",
      recommended_actions:
        meets_dnv
          ? "Continue monitoring spacing"
          : "Install guides or increase spacing immediately"
    }
  };
}

function assessFlexJoint(params: any) {
  var max_static_rotation = params.static_rotation || 8;
  var max_dynamic_rotation = params.dynamic_rotation || 12;
  var moment_capacity = params.moment_capacity || 5000;
  var applied_moment = params.applied_moment || 3000;
  var belleville_preload = params.belleville_preload || 1000;
  var cycle_count = params.cycle_count || 1000;
  var seal_wear_factor = params.seal_wear || 0.3;

  var static_allowable = 10;
  var static_pass = Math.abs(max_static_rotation) <= static_allowable;

  var dynamic_allowable = 16;
  var dynamic_pass = Math.abs(max_dynamic_rotation) <= dynamic_allowable;

  var moment_ratio = applied_moment / moment_capacity;
  var moment_pass = moment_ratio < 0.9;

  var stress_amplitude_belleville =
    (belleville_preload * moment_ratio) / 50;
  var cycles_to_fail_belleville = 1e7 / Math.pow(stress_amplitude_belleville, 2);
  var belleville_pass = cycle_count < cycles_to_fail_belleville;

  var seal_remaining_life = (1 - seal_wear_factor) * 100;
  var seal_pass = seal_wear_factor < 0.7;

  var overall_pass =
    static_pass && dynamic_pass && moment_pass && belleville_pass && seal_pass;

  return {
    deterministic: {
      static_rotation: max_static_rotation,
      dynamic_rotation: max_dynamic_rotation,
      moment_ratio: moment_ratio,
      belleville_cycles_to_fail: cycles_to_fail_belleville,
      seal_wear_percent: seal_wear_factor * 100,
      cycles_accumulated: cycle_count
    },
    interpreted: {
      acceptance: overall_pass ? "PASS" : "FAIL",
      risk_level: overall_pass ? "LOW" : "HIGH",
      critical_mode:
        !static_pass || !dynamic_pass
          ? "rotation limit exceeded"
          : !belleville_pass
            ? "belleville spring fatigue"
            : "seal degradation",
      recommended_actions: overall_pass
        ? "Continue monitoring"
        : "Schedule flex joint inspection or replacement"
    }
  };
}

function assessFreeSpan(params: any) {
  var L = params.span_length || 50;
  var D = params.diameter || 0.5;
  var f_n = params.natural_frequency || 0.3;
  var v_current = params.current_velocity || 1.0;
  var St = 0.2;
  var rho_fluid = params.fluid_density || 1025;
  var m_eff = params.mass_per_length || 100;
  var Ca = params.added_mass_coeff || 1.0;

  var LD_ratio = L / D;
  var LD_limit = 100;
  var ld_pass = LD_ratio <= LD_limit;

  var V_onset = (f_n * D) / St;

  var screening_pass = v_current < V_onset;

  var m_added = Ca * rho_fluid * Math.PI * Math.pow(D, 2) / 4;
  var m_total = m_eff + m_added;

  var f_limit = 0.5;
  var L_allowable = (Math.PI / f_limit) * Math.sqrt(100 / m_total);

  var span_pass = L <= L_allowable;

  return {
    deterministic: {
      span_length: L,
      ld_ratio: LD_ratio,
      natural_frequency: f_n,
      onset_velocity: V_onset,
      current_velocity: v_current,
      allowable_span_length: L_allowable,
      total_mass_per_length: m_total
    },
    interpreted: {
      acceptance: screening_pass && span_pass && ld_pass ? "PASS" : "CAUTION",
      risk_level:
        screening_pass && span_pass ? "LOW" : "MEDIUM",
      critical_mode: !screening_pass
        ? "VIV in free span"
        : "excessive span length",
      recommended_actions: screening_pass
        ? "Continue monitoring"
        : "Install span support or increase frequency via stiffening"
    }
  };
}

function assessFatigue(params: any) {
  var service_life = params.service_life || 20;
  var DFF = params.design_fatigue_factor || 10;
  var sigma_wave = params.wave_stress_amplitude || 100;
  var sigma_lf = params.low_freq_stress_amplitude || 50;
  var sigma_viv = params.viv_stress_amplitude || 80;
  var f_wave = params.wave_frequency || 0.1;
  var f_lf = params.lf_frequency || 0.01;
  var f_viv = params.viv_frequency || 0.5;

  function dnv_fatigue_life(stress_amplitude: any) {
    var log_cycles = 12.175 - 3 * Math.log10(stress_amplitude);
    var cycles = Math.pow(10, log_cycles);
    return cycles;
  }

  var hours_per_year = 365.25 * 24;
  var hours_total = service_life * hours_per_year;

  var cycles_wave = f_wave * hours_total * 3600;
  var cycles_lf = f_lf * hours_total * 3600;
  var cycles_viv = f_viv * hours_total * 3600;

  var N_wave = dnv_fatigue_life(sigma_wave);
  var N_lf = dnv_fatigue_life(sigma_lf);
  var N_viv = dnv_fatigue_life(sigma_viv);

  var D_wave = cycles_wave / N_wave;
  var D_lf = cycles_lf / N_lf;
  var D_viv = cycles_viv / N_viv;

  var D_total = D_wave + D_lf + D_viv;

  var design_fatigue_life = service_life / (D_total * DFF);

  return {
    deterministic: {
      wave_damage_ratio: D_wave,
      lf_damage_ratio: D_lf,
      viv_damage_ratio: D_viv,
      total_damage_miner: D_total,
      cycles_wave: cycles_wave,
      cycles_lf: cycles_lf,
      cycles_viv: cycles_viv,
      design_fatigue_life: design_fatigue_life
    },
    interpreted: {
      acceptance: D_total < 1.0 / DFF ? "PASS" : "FAIL",
      risk_level: D_total < 0.05 ? "LOW" : "MEDIUM",
      critical_mode:
        D_wave > D_lf && D_wave > D_viv
          ? "wave-frequency fatigue"
          : D_viv > D_lf
            ? "VIV fatigue"
            : "low-frequency fatigue",
      recommended_actions:
        D_total < 1.0 / DFF
          ? "Continue normal operations"
          : "Increase monitoring frequency and evaluate reinforcement"
    }
  };
}

function assessNaturalFrequency(params: any) {
  var L = params.length || 1000;
  var T_eff = params.effective_tension || 5000;
  var m_eff = params.mass_per_length || 100;
  var D = params.diameter || 0.5;
  var E = 207000;
  var Ca = params.added_mass_coeff || 1.0;
  var rho_fluid = params.fluid_density || 1025;

  var m_added = Ca * rho_fluid * Math.PI * Math.pow(D, 2) / 4;
  var m_total = m_eff + m_added;

  var modes: any = [];
  var n = 1;
  while (n <= 3) {
    var f_n = ((n * Math.PI) / L) * Math.sqrt((T_eff * 1000) / m_total);
    modes.push({
      mode: n,
      frequency: f_n
    });
    n = n + 1;
  }

  var f1 = modes[0].frequency;

  return {
    deterministic: {
      total_mass_per_length: m_total,
      added_mass: m_added,
      effective_tension: T_eff,
      riser_length: L,
      modes: modes,
      first_mode_frequency: f1
    },
    interpreted: {
      acceptance: f1 > 0.2 ? "PASS" : "CAUTION",
      risk_level: f1 > 0.5 ? "LOW" : "MEDIUM",
      critical_mode: "first natural frequency",
      recommended_actions:
        f1 > 0.2
          ? "Frequency adequate for typical wave loading"
          : "Evaluate tension increase or mass reduction"
    }
  };
}

function assessCombined(params: any) {
  var assessments: any = {};

  assessments.viv = assessVIV(params);
  assessments.touchdown = assessTouchdown(params);
  assessments.clash = assessClash(params);
  assessments.flex_joint = assessFlexJoint(params);
  assessments.free_span = assessFreeSpan(params);
  assessments.fatigue = assessFatigue(params);
  assessments.natural_frequency = assessNaturalFrequency(params);

  var all_pass =
    assessments.viv.interpreted.acceptance === "PASS" &&
    assessments.touchdown.interpreted.acceptance === "PASS" &&
    assessments.clash.interpreted.acceptance === "PASS" &&
    assessments.flex_joint.interpreted.acceptance === "PASS" &&
    assessments.free_span.interpreted.acceptance !== "FAIL" &&
    assessments.fatigue.interpreted.acceptance === "PASS" &&
    assessments.natural_frequency.interpreted.acceptance !== "FAIL";

  var critical_modes: any = [];
  var keys = Object.keys(assessments);
  var i = 0;
  while (i < keys.length) {
    var key = keys[i];
    if (assessments[key].interpreted.acceptance === "FAIL") {
      critical_modes.push(assessments[key].interpreted.critical_mode);
    }
    i = i + 1;
  }

  var inspection_interval = "12 months";
  if (all_pass) {
    inspection_interval = "24 months";
  }
  if (critical_modes.length > 0) {
    inspection_interval = "3-6 months";
  }

  return {
    deterministic: assessments,
    interpreted: {
      acceptance: all_pass ? "PASS" : "FAIL",
      risk_level: all_pass ? "LOW" : "HIGH",
      overall_riser_integrity: all_pass ? "ACCEPTABLE" : "UNACCEPTABLE",
      critical_modes: critical_modes,
      recommended_actions:
        all_pass
          ? "Continue normal operations with routine monitoring"
          : "Address critical modes before extended operation",
      inspection_interval: inspection_interval
    }
  };
}

export { handler };
