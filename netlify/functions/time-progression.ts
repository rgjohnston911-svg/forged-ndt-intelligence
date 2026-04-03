/**
 * DEPLOY77 — time-progression.ts
 * FORGED NDT Intelligence OS
 * Time Progression Engine v1
 *
 * PURPOSE: Model how risk changes over time for a given
 * inspection finding, damage mechanism, and asset context.
 *
 * OUTPUT:
 *   "At 0 hrs -> LOW risk"
 *   "At 72 hrs -> crack propagation likely"
 *   "At 7 days -> rupture probability 42%"
 *
 * ARCHITECTURE POSITION:
 *   Voice Input -> Plan -> Event Classification -> Code Authority
 *     -> Time Progression Engine v1  <-- this file
 *     -> UI renders risk curve over time
 *
 * THIS IS THE ASNT DEMO CENTERPIECE.
 *
 * DEPLOY NOTES:
 *   - String concatenation only (no backtick template literals)
 *   - All logic inlined (no lib/ imports)
 *   - Target: netlify/functions/time-progression.ts
 *   - Deterministic — no AI calls, pure calculation
 *   - Stays well under 60-second timeout
 */

import { Handler } from "@netlify/functions";

/* =========================================================
   TYPE DEFINITIONS
   ========================================================= */

type DamageMechanism =
  | "general_corrosion"
  | "pitting_corrosion"
  | "stress_corrosion_cracking"
  | "hydrogen_induced_cracking"
  | "high_temp_hydrogen_attack"
  | "corrosion_under_insulation"
  | "fatigue_cracking"
  | "creep"
  | "erosion"
  | "impact_damage"
  | "atmospheric_corrosion"
  | "caustic_cracking"
  | "sulfide_stress_cracking"
  | "thermal_fatigue"
  | "mechanical_fatigue"
  | "microbiologically_influenced"
  | "unknown_mechanism";

type ServiceEnvironment =
  | "general_hydrocarbon"
  | "sour_service"
  | "hydrogen_service"
  | "high_temperature"
  | "chloride_service"
  | "caustic_service"
  | "marine_exposure"
  | "cyclic_service"
  | "insulated_service"
  | "water_service"
  | "steam_service"
  | "cryogenic_service"
  | "unknown_service";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "EXTREME";

type DispositionUrgency =
  | "routine_monitoring"
  | "increased_monitoring"
  | "priority_inspection"
  | "immediate_inspection"
  | "emergency_shutdown"
  | "remove_from_service";

interface TimeProgressionInput {
  asset_type: string;
  component_type: string;
  damage_mechanisms: DamageMechanism[];
  service_environment: ServiceEnvironment[];
  initial_severity: string;
  initial_risk_score: number;
  wall_thickness_remaining_pct: number | null;
  operating_temperature_f: number | null;
  operating_pressure_psi: number | null;
  years_in_service: number | null;
  last_inspection_days_ago: number | null;
  event_context: string | null;
  findings_summary: string | null;
}

interface TimePoint {
  hours: number;
  label: string;
  risk_level: RiskLevel;
  risk_score: number;
  failure_probability_pct: number;
  dominant_mechanism: DamageMechanism;
  progression_narrative: string;
  recommended_action: DispositionUrgency;
  action_narrative: string;
  new_mechanisms_activated: DamageMechanism[];
  warnings: string[];
}

interface TimeProgressionOutput {
  engine: "Time Progression Engine v1";
  input_summary: {
    asset_type: string;
    component_type: string;
    damage_mechanisms: DamageMechanism[];
    initial_risk_score: number;
    initial_severity: string;
  };
  time_points: TimePoint[];
  peak_risk_point: {
    hours: number;
    label: string;
    risk_score: number;
    failure_probability_pct: number;
  };
  critical_threshold_hours: number | null;
  extreme_threshold_hours: number | null;
  overall_trajectory: string;
  executive_summary: string;
  code_basis: string[];
  warnings: string[];
}

/* =========================================================
   CONSTANTS
   ========================================================= */

var TIME_INTERVALS: { hours: number; label: string }[] = [
  { hours: 0, label: "Current" },
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
  { hours: 336, label: "14 days" },
  { hours: 720, label: "30 days" },
  { hours: 2160, label: "90 days" },
  { hours: 4320, label: "180 days" },
  { hours: 8760, label: "365 days" }
];

/* =========================================================
   HELPERS
   ========================================================= */

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 90) return "EXTREME";
  if (score >= 75) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

function dispositionFromScore(score: number): DispositionUrgency {
  if (score >= 92) return "remove_from_service";
  if (score >= 80) return "emergency_shutdown";
  if (score >= 65) return "immediate_inspection";
  if (score >= 50) return "priority_inspection";
  if (score >= 30) return "increased_monitoring";
  return "routine_monitoring";
}

function actionNarrative(disp: DispositionUrgency): string {
  if (disp === "remove_from_service") return "Asset should be removed from service immediately. Continued operation risks catastrophic failure.";
  if (disp === "emergency_shutdown") return "Emergency shutdown and inspection recommended. Risk of imminent structural or pressure-boundary failure.";
  if (disp === "immediate_inspection") return "Immediate detailed inspection required. Degradation is approaching critical thresholds.";
  if (disp === "priority_inspection") return "Priority inspection should be scheduled within the next operating window. Risk is escalating.";
  if (disp === "increased_monitoring") return "Increase monitoring frequency. Current degradation rate warrants closer tracking.";
  return "Continue routine monitoring per current inspection program.";
}

function includesAny(arr: string[], values: string[]): boolean {
  for (var i = 0; i < arr.length; i++) {
    for (var j = 0; j < values.length; j++) {
      if (arr[i] === values[j]) return true;
    }
  }
  return false;
}

/* =========================================================
   DAMAGE MECHANISM PROGRESSION MODELS
   ---------------------------------------------------------
   Each mechanism has:
   - base_rate: risk increase per hour (at baseline)
   - acceleration_factor: how fast rate increases over time
   - cascade_hours: hours after which secondary mechanisms activate
   - cascade_mechanisms: what activates after cascade_hours
   - failure_curve_shape: linear, exponential, or step
   ========================================================= */

interface MechanismModel {
  base_rate: number;
  acceleration_factor: number;
  cascade_hours: number;
  cascade_mechanisms: DamageMechanism[];
  failure_curve_shape: string;
  base_failure_probability_per_1000h: number;
}

function getMechanismModel(mech: DamageMechanism): MechanismModel {
  var models: Record<string, MechanismModel> = {
    "general_corrosion": {
      base_rate: 0.003,
      acceleration_factor: 1.02,
      cascade_hours: 4320,
      cascade_mechanisms: ["pitting_corrosion"],
      failure_curve_shape: "linear",
      base_failure_probability_per_1000h: 2.5
    },
    "pitting_corrosion": {
      base_rate: 0.008,
      acceleration_factor: 1.08,
      cascade_hours: 2160,
      cascade_mechanisms: ["stress_corrosion_cracking"],
      failure_curve_shape: "exponential",
      base_failure_probability_per_1000h: 6.0
    },
    "stress_corrosion_cracking": {
      base_rate: 0.015,
      acceleration_factor: 1.15,
      cascade_hours: 720,
      cascade_mechanisms: ["mechanical_fatigue"],
      failure_curve_shape: "exponential",
      base_failure_probability_per_1000h: 14.0
    },
    "hydrogen_induced_cracking": {
      base_rate: 0.020,
      acceleration_factor: 1.18,
      cascade_hours: 336,
      cascade_mechanisms: ["sulfide_stress_cracking"],
      failure_curve_shape: "exponential",
      base_failure_probability_per_1000h: 18.0
    },
    "high_temp_hydrogen_attack": {
      base_rate: 0.025,
      acceleration_factor: 1.20,
      cascade_hours: 168,
      cascade_mechanisms: ["creep"],
      failure_curve_shape: "exponential",
      base_failure_probability_per_1000h: 22.0
    },
    "corrosion_under_insulation": {
      base_rate: 0.005,
      acceleration_factor: 1.05,
      cascade_hours: 4320,
      cascade_mechanisms: ["pitting_corrosion", "stress_corrosion_cracking"],
      failure_curve_shape: "linear",
      base_failure_probability_per_1000h: 4.0
    },
    "fatigue_cracking": {
      base_rate: 0.012,
      acceleration_factor: 1.12,
      cascade_hours: 720,
      cascade_mechanisms: ["mechanical_fatigue"],
      failure_curve_shape: "exponential",
      base_failure_probability_per_1000h: 12.0
    },
    "creep": {
      base_rate: 0.006,
      acceleration_factor: 1.25,
      cascade_hours: 2160,
      cascade_mechanisms: ["stress_corrosion_cracking"],
      failure_curve_shape: "exponential",
      base_failure_probability_per_1000h: 8.0
    },
    "erosion": {
      base_rate: 0.007,
      acceleration_factor: 1.04,
      cascade_hours: 2160,
      cascade_mechanisms: ["general_corrosion"],
      failure_curve_shape: "linear",
      base_failure_probability_per_1000h: 5.0
    },
    "impact_damage": {
      base_rate: 0.035,
      acceleration_factor: 1.10,
      cascade_hours: 72,
      cascade_mechanisms: ["fatigue_cracking", "stress_corrosion_cracking"],
      failure_curve_shape: "step",
      base_failure_probability_per_1000h: 28.0
    },
    "atmospheric_corrosion": {
      base_rate: 0.002,
      acceleration_factor: 1.01,
      cascade_hours: 8760,
      cascade_mechanisms: ["pitting_corrosion"],
      failure_curve_shape: "linear",
      base_failure_probability_per_1000h: 1.5
    },
    "caustic_cracking": {
      base_rate: 0.018,
      acceleration_factor: 1.16,
      cascade_hours: 336,
      cascade_mechanisms: ["stress_corrosion_cracking"],
      failure_curve_shape: "exponential",
      base_failure_probability_per_1000h: 16.0
    },
    "sulfide_stress_cracking": {
      base_rate: 0.022,
      acceleration_factor: 1.20,
      cascade_hours: 168,
      cascade_mechanisms: ["hydrogen_induced_cracking"],
      failure_curve_shape: "exponential",
      base_failure_probability_per_1000h: 20.0
    },
    "thermal_fatigue": {
      base_rate: 0.010,
      acceleration_factor: 1.10,
      cascade_hours: 720,
      cascade_mechanisms: ["creep", "fatigue_cracking"],
      failure_curve_shape: "exponential",
      base_failure_probability_per_1000h: 10.0
    },
    "mechanical_fatigue": {
      base_rate: 0.014,
      acceleration_factor: 1.12,
      cascade_hours: 720,
      cascade_mechanisms: ["stress_corrosion_cracking"],
      failure_curve_shape: "exponential",
      base_failure_probability_per_1000h: 13.0
    },
    "microbiologically_influenced": {
      base_rate: 0.006,
      acceleration_factor: 1.08,
      cascade_hours: 2160,
      cascade_mechanisms: ["pitting_corrosion"],
      failure_curve_shape: "exponential",
      base_failure_probability_per_1000h: 5.5
    },
    "unknown_mechanism": {
      base_rate: 0.010,
      acceleration_factor: 1.10,
      cascade_hours: 720,
      cascade_mechanisms: [],
      failure_curve_shape: "linear",
      base_failure_probability_per_1000h: 8.0
    }
  };

  return models[mech] || models["unknown_mechanism"];
}

/* =========================================================
   SERVICE ENVIRONMENT MULTIPLIERS
   ========================================================= */

function getServiceMultiplier(services: ServiceEnvironment[]): number {
  var mult = 1.0;

  for (var i = 0; i < services.length; i++) {
    var s = services[i];
    if (s === "sour_service") mult = mult * 1.8;
    else if (s === "hydrogen_service") mult = mult * 1.9;
    else if (s === "high_temperature") mult = mult * 1.6;
    else if (s === "chloride_service") mult = mult * 1.7;
    else if (s === "caustic_service") mult = mult * 1.5;
    else if (s === "marine_exposure") mult = mult * 1.3;
    else if (s === "cyclic_service") mult = mult * 1.4;
    else if (s === "insulated_service") mult = mult * 1.2;
    else if (s === "cryogenic_service") mult = mult * 1.3;
    else if (s === "steam_service") mult = mult * 1.2;
    else if (s === "water_service") mult = mult * 1.1;
  }

  if (mult > 4.0) mult = 4.0;
  return mult;
}

/* =========================================================
   SEVERITY MULTIPLIER
   ========================================================= */

function getSeverityMultiplier(severity: string): number {
  var s = (severity || "").toLowerCase();
  if (s === "critical") return 2.0;
  if (s === "major" || s === "high") return 1.5;
  if (s === "moderate" || s === "medium") return 1.2;
  if (s === "minor" || s === "low") return 1.0;
  return 1.1;
}

/* =========================================================
   WALL THICKNESS MODIFIER
   ========================================================= */

function getWallThicknessModifier(pct: number | null): number {
  if (pct === null || pct === undefined) return 1.0;
  if (pct <= 10) return 3.0;
  if (pct <= 25) return 2.0;
  if (pct <= 40) return 1.5;
  if (pct <= 60) return 1.2;
  if (pct <= 80) return 1.05;
  return 1.0;
}

/* =========================================================
   TEMPERATURE MODIFIER
   ========================================================= */

function getTemperatureModifier(tempF: number | null): number {
  if (tempF === null || tempF === undefined) return 1.0;
  if (tempF >= 1000) return 2.5;
  if (tempF >= 800) return 2.0;
  if (tempF >= 600) return 1.6;
  if (tempF >= 400) return 1.3;
  if (tempF >= 200) return 1.1;
  if (tempF <= -100) return 1.4;
  return 1.0;
}

/* =========================================================
   AGE MODIFIER
   ========================================================= */

function getAgeModifier(yearsInService: number | null): number {
  if (yearsInService === null || yearsInService === undefined) return 1.0;
  if (yearsInService >= 40) return 1.8;
  if (yearsInService >= 30) return 1.5;
  if (yearsInService >= 20) return 1.3;
  if (yearsInService >= 10) return 1.1;
  return 1.0;
}

/* =========================================================
   INSPECTION RECENCY MODIFIER
   ========================================================= */

function getInspectionRecencyModifier(daysAgo: number | null): number {
  if (daysAgo === null || daysAgo === undefined) return 1.1;
  if (daysAgo >= 1825) return 1.6;
  if (daysAgo >= 1095) return 1.4;
  if (daysAgo >= 730) return 1.2;
  if (daysAgo >= 365) return 1.1;
  return 1.0;
}

/* =========================================================
   PROGRESSION NARRATIVE GENERATOR
   ========================================================= */

function buildProgressionNarrative(
  hours: number,
  riskLevel: RiskLevel,
  score: number,
  failProb: number,
  dominant: DamageMechanism,
  newMechs: DamageMechanism[]
): string {
  var parts: string[] = [];

  var mechName = dominant.replace(/_/g, " ");

  if (hours === 0) {
    parts.push("Current state: " + mechName + " active at " + riskLevel + " risk level.");
  } else if (riskLevel === "LOW") {
    parts.push("At " + hours + " hours: degradation progressing within manageable range. " + mechName + " remains the dominant concern.");
  } else if (riskLevel === "MEDIUM") {
    parts.push("At " + hours + " hours: " + mechName + " progression is increasing. Risk is elevated and trending upward.");
  } else if (riskLevel === "HIGH") {
    parts.push("At " + hours + " hours: " + mechName + " has reached HIGH risk. Active degradation likely accelerating.");
  } else if (riskLevel === "CRITICAL") {
    parts.push("At " + hours + " hours: CRITICAL risk threshold reached. " + mechName + " progression indicates potential for near-term failure.");
  } else {
    parts.push("At " + hours + " hours: EXTREME risk. Failure probability " + failProb.toFixed(1) + "%. Immediate action required.");
  }

  if (failProb >= 30) {
    parts.push("Failure probability has reached " + failProb.toFixed(1) + "% — structural or pressure-boundary integrity may be compromised.");
  }

  if (newMechs.length > 0) {
    var mechNames: string[] = [];
    for (var i = 0; i < newMechs.length; i++) {
      mechNames.push(newMechs[i].replace(/_/g, " "));
    }
    parts.push("WARNING: Secondary mechanism(s) now likely active: " + mechNames.join(", ") + ".");
  }

  return parts.join(" ");
}

/* =========================================================
   CORE PROGRESSION CALCULATOR
   ========================================================= */

function calculateProgression(input: TimeProgressionInput): TimePoint[] {
  var points: TimePoint[] = [];
  var baseScore = clamp(input.initial_risk_score || 25, 5, 95);

  var serviceMultiplier = getServiceMultiplier(input.service_environment);
  var severityMultiplier = getSeverityMultiplier(input.initial_severity);
  var wallMultiplier = getWallThicknessModifier(input.wall_thickness_remaining_pct);
  var tempMultiplier = getTemperatureModifier(input.operating_temperature_f);
  var ageMultiplier = getAgeModifier(input.years_in_service);
  var inspectionMultiplier = getInspectionRecencyModifier(input.last_inspection_days_ago);

  var combinedMultiplier = serviceMultiplier * severityMultiplier * wallMultiplier * tempMultiplier * ageMultiplier * inspectionMultiplier;
  if (combinedMultiplier > 12.0) combinedMultiplier = 12.0;

  /* Find the worst (fastest progressing) mechanism */
  var mechanisms = input.damage_mechanisms;
  if (mechanisms.length === 0) {
    mechanisms = ["unknown_mechanism"];
  }

  var worstModel = getMechanismModel(mechanisms[0]);
  var dominantMech = mechanisms[0];

  for (var m = 1; m < mechanisms.length; m++) {
    var model = getMechanismModel(mechanisms[m]);
    if (model.base_rate * model.acceleration_factor > worstModel.base_rate * worstModel.acceleration_factor) {
      worstModel = model;
      dominantMech = mechanisms[m];
    }
  }

  /* Also track all models for cascade detection */
  var allModels: { mech: DamageMechanism; model: MechanismModel }[] = [];
  for (var am = 0; am < mechanisms.length; am++) {
    allModels.push({ mech: mechanisms[am], model: getMechanismModel(mechanisms[am]) });
  }

  var activeMechanisms: DamageMechanism[] = [];
  for (var am2 = 0; am2 < mechanisms.length; am2++) {
    activeMechanisms.push(mechanisms[am2]);
  }

  for (var t = 0; t < TIME_INTERVALS.length; t++) {
    var interval = TIME_INTERVALS[t];
    var hours = interval.hours;

    /* Calculate risk score at this time point */
    var riskIncrement = 0;

    if (hours > 0) {
      if (worstModel.failure_curve_shape === "exponential") {
        riskIncrement = worstModel.base_rate * Math.pow(worstModel.acceleration_factor, hours / 24) * hours * combinedMultiplier;
      } else if (worstModel.failure_curve_shape === "step") {
        /* Step function: big jump early, then slower */
        if (hours <= 24) {
          riskIncrement = worstModel.base_rate * hours * combinedMultiplier * 3.0;
        } else {
          riskIncrement = worstModel.base_rate * 24 * combinedMultiplier * 3.0;
          riskIncrement = riskIncrement + worstModel.base_rate * (hours - 24) * combinedMultiplier * 0.8;
        }
      } else {
        /* Linear */
        riskIncrement = worstModel.base_rate * hours * combinedMultiplier;
      }
    }

    var currentScore = clamp(baseScore + riskIncrement, 5, 99);

    /* Calculate failure probability */
    var baseFailProb = worstModel.base_failure_probability_per_1000h * (hours / 1000) * combinedMultiplier;
    /* Add exponential component for high scores */
    if (currentScore >= 75) {
      baseFailProb = baseFailProb * (1 + (currentScore - 75) * 0.05);
    }
    var failProb = clamp(baseFailProb, 0, 99);

    /* Check for cascade activation */
    var newMechs: DamageMechanism[] = [];
    for (var c = 0; c < allModels.length; c++) {
      if (hours >= allModels[c].model.cascade_hours) {
        var cascades = allModels[c].model.cascade_mechanisms;
        for (var cc = 0; cc < cascades.length; cc++) {
          var alreadyActive = false;
          for (var aa = 0; aa < activeMechanisms.length; aa++) {
            if (activeMechanisms[aa] === cascades[cc]) {
              alreadyActive = true;
              break;
            }
          }
          if (!alreadyActive) {
            activeMechanisms.push(cascades[cc]);
            newMechs.push(cascades[cc]);
            /* Cascade mechanisms add additional risk */
            var cascadeModel = getMechanismModel(cascades[cc]);
            currentScore = clamp(currentScore + cascadeModel.base_rate * 50, 5, 99);
          }
        }
      }
    }

    /* Re-evaluate dominant if cascade activated something worse */
    if (newMechs.length > 0) {
      for (var nm = 0; nm < newMechs.length; nm++) {
        var nmModel = getMechanismModel(newMechs[nm]);
        if (nmModel.base_rate * nmModel.acceleration_factor > worstModel.base_rate * worstModel.acceleration_factor) {
          worstModel = nmModel;
          dominantMech = newMechs[nm];
        }
      }
    }

    var riskLevel = riskLevelFromScore(currentScore);
    var disposition = dispositionFromScore(currentScore);

    /* Build warnings */
    var warnings: string[] = [];
    if (failProb >= 50) {
      warnings.push("Failure probability exceeds 50% — continued operation at extreme risk.");
    }
    if (failProb >= 25 && failProb < 50) {
      warnings.push("Failure probability exceeds 25% — urgent intervention recommended.");
    }
    if (newMechs.length > 0) {
      warnings.push("Secondary damage mechanisms have activated at this time point.");
    }
    if (currentScore >= 90 && hours <= 168) {
      warnings.push("EXTREME risk reached within 7 days — time-critical response required.");
    }

    points.push({
      hours: hours,
      label: interval.label,
      risk_level: riskLevel,
      risk_score: Math.round(currentScore * 10) / 10,
      failure_probability_pct: Math.round(failProb * 10) / 10,
      dominant_mechanism: dominantMech,
      progression_narrative: buildProgressionNarrative(hours, riskLevel, currentScore, failProb, dominantMech, newMechs),
      recommended_action: disposition,
      action_narrative: actionNarrative(disposition),
      new_mechanisms_activated: newMechs,
      warnings: warnings
    });
  }

  return points;
}

/* =========================================================
   EXECUTIVE SUMMARY BUILDER
   ========================================================= */

function buildExecutiveSummary(points: TimePoint[], input: TimeProgressionInput): string {
  var first = points[0];
  var last = points[points.length - 1];

  var criticalPoint: TimePoint | null = null;
  var extremePoint: TimePoint | null = null;
  var totalCascades = 0;

  for (var i = 0; i < points.length; i++) {
    if (points[i].risk_level === "CRITICAL" && !criticalPoint) {
      criticalPoint = points[i];
    }
    if (points[i].risk_level === "EXTREME" && !extremePoint) {
      extremePoint = points[i];
    }
    totalCascades = totalCascades + points[i].new_mechanisms_activated.length;
  }

  var parts: string[] = [];

  parts.push("Starting from " + first.risk_level + " risk (score " + first.risk_score + "), the asset progresses to " + last.risk_level + " risk (score " + last.risk_score + ") over 365 days.");

  if (criticalPoint) {
    parts.push("CRITICAL risk threshold is reached at " + criticalPoint.label + " (" + criticalPoint.hours + " hours).");
  }

  if (extremePoint) {
    parts.push("EXTREME risk threshold is reached at " + extremePoint.label + " (" + extremePoint.hours + " hours) with " + extremePoint.failure_probability_pct + "% failure probability.");
  }

  if (totalCascades > 0) {
    parts.push(totalCascades + " secondary damage mechanism(s) activate during the progression window.");
  }

  var dominant = points[points.length - 1].dominant_mechanism.replace(/_/g, " ");
  parts.push("Dominant mechanism: " + dominant + ".");

  if (first.risk_score >= 60) {
    parts.push("This asset enters the progression window at already elevated risk. Time to intervention is compressed.");
  }

  return parts.join(" ");
}

/* =========================================================
   OVERALL TRAJECTORY
   ========================================================= */

function determineTrajectory(points: TimePoint[]): string {
  if (points.length < 2) return "INSUFFICIENT DATA";

  var first = points[0].risk_score;
  var last = points[points.length - 1].risk_score;
  var delta = last - first;

  if (delta <= 5) return "STABLE — minimal progression expected in the forecast window.";
  if (delta <= 15) return "GRADUAL — slow but measurable degradation progression.";
  if (delta <= 30) return "ACCELERATING — degradation rate is increasing meaningfully over time.";
  if (delta <= 50) return "RAPID — significant risk escalation expected. Intervention timeline is compressed.";
  return "CRITICAL ACCELERATION — risk escalates dramatically. Immediate action required to prevent failure.";
}

/* =========================================================
   CODE BASIS
   ========================================================= */

function buildCodeBasis(input: TimeProgressionInput): string[] {
  var codes: string[] = [];

  codes.push("API 571 — Damage Mechanism Reference");
  codes.push("API 580 — Risk-Based Inspection Framework");
  codes.push("API 581 — RBI Methodology");

  var assetLower = (input.asset_type || "").toLowerCase();

  if (assetLower.indexOf("vessel") !== -1 || assetLower.indexOf("exchanger") !== -1 || assetLower.indexOf("boiler") !== -1 || assetLower.indexOf("heater") !== -1) {
    codes.push("API 510 — Pressure Vessel Inspection Code");
  }
  if (assetLower.indexOf("piping") !== -1 || assetLower.indexOf("pipe") !== -1) {
    codes.push("API 570 — Piping Inspection Code");
  }
  if (assetLower.indexOf("tank") !== -1) {
    codes.push("API 653 — Tank Inspection Code");
  }
  if (assetLower.indexOf("offshore") !== -1 || assetLower.indexOf("platform") !== -1) {
    codes.push("API RP 2A — Offshore Structural Standard");
  }
  if (assetLower.indexOf("bridge") !== -1) {
    codes.push("FHWA Bridge Inspection Manual");
  }

  codes.push("API 579-1/ASME FFS-1 — Fitness-for-Service (escalation reference)");

  return codes;
}

/* =========================================================
   DAMAGE MECHANISM DETECTOR (from raw text)
   ========================================================= */

function detectDamageMechanisms(rawText: string, services: ServiceEnvironment[]): DamageMechanism[] {
  var t = (rawText || "").toLowerCase();
  var mechs: DamageMechanism[] = [];

  if (t.indexOf("general corrosion") !== -1 || t.indexOf("wall thinning") !== -1 || t.indexOf("wall loss") !== -1 || t.indexOf("uniform corrosion") !== -1) mechs.push("general_corrosion");
  if (t.indexOf("pitting") !== -1 || t.indexOf("pit") !== -1 || t.indexOf("localized corrosion") !== -1) mechs.push("pitting_corrosion");
  if (t.indexOf("stress corrosion") !== -1 || t.indexOf("scc") !== -1 || t.indexOf("environmentally assisted") !== -1) mechs.push("stress_corrosion_cracking");
  if (t.indexOf("hydrogen crack") !== -1 || t.indexOf("hic") !== -1 || t.indexOf("hydrogen induced") !== -1 || t.indexOf("hydrogen embrittlement") !== -1) mechs.push("hydrogen_induced_cracking");
  if (t.indexOf("htha") !== -1 || t.indexOf("high temperature hydrogen") !== -1) mechs.push("high_temp_hydrogen_attack");
  if (t.indexOf("cui") !== -1 || t.indexOf("corrosion under insulation") !== -1) mechs.push("corrosion_under_insulation");
  if (t.indexOf("fatigue crack") !== -1 || t.indexOf("cyclic") !== -1 || t.indexOf("fatigue") !== -1) mechs.push("fatigue_cracking");
  if (t.indexOf("creep") !== -1) mechs.push("creep");
  if (t.indexOf("erosion") !== -1 || t.indexOf("flow accelerated") !== -1) mechs.push("erosion");
  if (t.indexOf("impact") !== -1 || t.indexOf("collision") !== -1 || t.indexOf("truck hit") !== -1 || t.indexOf("hurricane") !== -1 || t.indexOf("blast") !== -1) mechs.push("impact_damage");
  if (t.indexOf("atmospheric") !== -1) mechs.push("atmospheric_corrosion");
  if (t.indexOf("caustic crack") !== -1 || t.indexOf("caustic embrittlement") !== -1) mechs.push("caustic_cracking");
  if (t.indexOf("sulfide stress") !== -1 || t.indexOf("ssc") !== -1) mechs.push("sulfide_stress_cracking");
  if (t.indexOf("thermal fatigue") !== -1) mechs.push("thermal_fatigue");
  if (t.indexOf("mechanical fatigue") !== -1 || t.indexOf("vibration") !== -1) mechs.push("mechanical_fatigue");
  if (t.indexOf("mic") !== -1 || t.indexOf("microbiological") !== -1 || t.indexOf("bacteria") !== -1) mechs.push("microbiologically_influenced");

  /* Service-driven inference */
  if (mechs.length === 0) {
    if (includesAny(services as string[], ["sour_service"])) mechs.push("sulfide_stress_cracking");
    if (includesAny(services as string[], ["hydrogen_service"])) mechs.push("hydrogen_induced_cracking");
    if (includesAny(services as string[], ["high_temperature"])) mechs.push("creep");
    if (includesAny(services as string[], ["chloride_service"])) mechs.push("stress_corrosion_cracking");
    if (includesAny(services as string[], ["caustic_service"])) mechs.push("caustic_cracking");
    if (includesAny(services as string[], ["insulated_service"])) mechs.push("corrosion_under_insulation");
    if (includesAny(services as string[], ["cyclic_service"])) mechs.push("fatigue_cracking");
    if (includesAny(services as string[], ["marine_exposure"])) mechs.push("atmospheric_corrosion");
    if (includesAny(services as string[], ["water_service"])) mechs.push("general_corrosion");
  }

  if (mechs.length === 0) mechs.push("general_corrosion");

  return mechs;
}

/* =========================================================
   MAIN ENGINE
   ========================================================= */

function runTimeProgressionEngine(input: TimeProgressionInput): TimeProgressionOutput {
  var points = calculateProgression(input);

  /* Find peak risk point */
  var peak = points[0];
  for (var p = 1; p < points.length; p++) {
    if (points[p].risk_score > peak.risk_score) {
      peak = points[p];
    }
  }

  /* Find critical and extreme threshold hours */
  var criticalHours: number | null = null;
  var extremeHours: number | null = null;
  for (var th = 0; th < points.length; th++) {
    if (points[th].risk_level === "CRITICAL" && criticalHours === null) {
      criticalHours = points[th].hours;
    }
    if (points[th].risk_level === "EXTREME" && extremeHours === null) {
      extremeHours = points[th].hours;
    }
  }

  /* Build warnings */
  var engineWarnings: string[] = [];
  engineWarnings.push("Time Progression Engine models are probabilistic estimates based on generalized degradation rates. Actual progression depends on specific material, geometry, operating conditions, and maintenance history.");
  engineWarnings.push("This engine does not replace fitness-for-service assessment, engineering judgment, or owner/user program requirements.");

  if (input.wall_thickness_remaining_pct !== null && input.wall_thickness_remaining_pct <= 25) {
    engineWarnings.push("Wall thickness remaining is at or below 25% — progression rates may underestimate actual risk.");
  }

  if (criticalHours !== null && criticalHours <= 72) {
    engineWarnings.push("CRITICAL risk threshold reached within 72 hours. Time-critical intervention required.");
  }

  return {
    engine: "Time Progression Engine v1",
    input_summary: {
      asset_type: input.asset_type,
      component_type: input.component_type,
      damage_mechanisms: input.damage_mechanisms,
      initial_risk_score: input.initial_risk_score,
      initial_severity: input.initial_severity
    },
    time_points: points,
    peak_risk_point: {
      hours: peak.hours,
      label: peak.label,
      risk_score: peak.risk_score,
      failure_probability_pct: peak.failure_probability_pct
    },
    critical_threshold_hours: criticalHours,
    extreme_threshold_hours: extremeHours,
    overall_trajectory: determineTrajectory(points),
    executive_summary: buildExecutiveSummary(points, input),
    code_basis: buildCodeBasis(input),
    warnings: engineWarnings
  };
}

/* =========================================================
   NETLIFY FUNCTION HANDLER
   ========================================================= */

var handler: Handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");

    var rawText = body.raw_text || body.transcript || body.findings_summary || "";
    var services: ServiceEnvironment[] = body.service_environment || [];
    if (services.length === 0) services = ["unknown_service"];

    var mechanisms: DamageMechanism[] = body.damage_mechanisms || [];
    if (mechanisms.length === 0 && rawText) {
      mechanisms = detectDamageMechanisms(rawText, services);
    }
    if (mechanisms.length === 0) {
      mechanisms = ["general_corrosion"];
    }

    var input: TimeProgressionInput = {
      asset_type: body.asset_type || "unknown",
      component_type: body.component_type || "unknown",
      damage_mechanisms: mechanisms,
      service_environment: services,
      initial_severity: body.initial_severity || body.severity || "moderate",
      initial_risk_score: body.initial_risk_score || body.risk_score || 30,
      wall_thickness_remaining_pct: body.wall_thickness_remaining_pct || null,
      operating_temperature_f: body.operating_temperature_f || null,
      operating_pressure_psi: body.operating_pressure_psi || null,
      years_in_service: body.years_in_service || null,
      last_inspection_days_ago: body.last_inspection_days_ago || null,
      event_context: body.event_context || null,
      findings_summary: rawText || null
    };

    var result = runTimeProgressionEngine(input);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify(result)
    };
  } catch (err) {
    var errMsg = (err && typeof err === "object" && "message" in err) ? (err as any).message : "Unknown error";
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Time Progression Engine failed", detail: errMsg })
    };
  }
};

export { handler };
