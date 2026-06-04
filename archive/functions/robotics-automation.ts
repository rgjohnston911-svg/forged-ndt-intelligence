// @ts-nocheck
/**
 * DEPLOY244 - robotics-automation.ts
 * netlify/functions/robotics-automation.ts
 *
 * ROBOTICS & AUTOMATION INTEGRATION ENGINE
 * Drone inspection, robotic crawlers, automated UT, sensor fusion,
 * automated defect recognition (ADR), scan plan management
 *
 * POST /api/robotics-automation { action, ... }
 *
 * Actions:
 *   register_platform    - register a robotic inspection platform
 *   create_scan_plan     - create automated scan plan for a case
 *   ingest_sensor_data   - receive and validate sensor data from platform
 *   evaluate_adr_result  - evaluate automated defect recognition output
 *   get_platform_registry - list all platform types and capabilities
 *   get_registry         - full engine registry
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ── ROBOTIC PLATFORM REGISTRY ──────────────────────────────────────

var PLATFORM_TYPES = [
  {
    id: "drone_visual",
    name: "Visual Inspection Drone (sUAS)",
    category: "aerial",
    description: "Small unmanned aerial system for visual and photogrammetric inspection of structures, vessels, and elevated assets",
    sensors: ["rgb_camera", "zoom_camera", "photogrammetry"],
    capabilities: ["visual_inspection", "photogrammetry", "3d_model", "orthomosaic", "crack_mapping"],
    typical_assets: ["storage tank", "flare stack", "bridge", "wind turbine", "building facade", "cooling tower"],
    data_outputs: ["image", "video", "point_cloud", "3d_model"],
    standards: ["ASTM E2929", "API 653 Annex", "FAA 14 CFR 107"],
    limitations: ["no_contact_ndt", "weather_dependent", "battery_life", "gps_required"]
  },
  {
    id: "drone_thermal",
    name: "Thermal Inspection Drone",
    category: "aerial",
    description: "Drone equipped with thermal/infrared camera for detecting insulation defects, hot spots, moisture ingress, and delamination",
    sensors: ["thermal_ir", "rgb_camera"],
    capabilities: ["thermal_survey", "hot_spot_detection", "insulation_assessment", "moisture_detection", "cui_screening"],
    typical_assets: ["insulated pipe", "vessel", "electrical equipment", "building envelope", "solar panel", "refractory"],
    data_outputs: ["thermogram", "radiometric_image", "temperature_map"],
    standards: ["ASTM E1934", "ISO 6781", "ASNT SNT-TC-1A"],
    limitations: ["emissivity_dependent", "ambient_conditions", "resolution_vs_altitude"]
  },
  {
    id: "drone_ut",
    name: "Contact UT Drone",
    category: "aerial",
    description: "Drone with ultrasonic thickness measurement probe for wall thickness surveys on elevated or hard-to-access structures",
    sensors: ["ut_probe", "rgb_camera", "position_encoder"],
    capabilities: ["wall_thickness", "corrosion_mapping", "min_thickness_survey"],
    typical_assets: ["storage tank", "vessel shell", "stack", "flare", "offshore structure"],
    data_outputs: ["thickness_reading", "thickness_grid", "corrosion_map"],
    standards: ["ASTM E797", "API 653", "API 510"],
    limitations: ["surface_preparation", "coupling", "wind_limits", "payload_weight"]
  },
  {
    id: "crawler_magnetic",
    name: "Magnetic Wall Crawler",
    category: "crawler",
    description: "Magnetically adhering robotic crawler for ferromagnetic surface inspection carrying UT, EMAT, MFL, or camera payloads",
    sensors: ["ut_probe", "emat", "mfl_array", "rgb_camera"],
    capabilities: ["wall_thickness_mapping", "weld_inspection", "corrosion_mapping", "visual_inspection"],
    typical_assets: ["storage tank", "vessel", "ship hull", "penstock", "stack", "offshore jacket"],
    data_outputs: ["thickness_grid", "c_scan", "mfl_map", "image"],
    standards: ["API 653", "API 510", "ASME V", "DNVGL-CG-0051"],
    limitations: ["ferromagnetic_only", "surface_roughness", "curvature_limits", "obstacle_navigation"]
  },
  {
    id: "crawler_pipe",
    name: "Internal Pipe Crawler",
    category: "crawler",
    description: "Wheeled or tracked robot for internal inspection of pipes, ducts, and confined spaces with camera, UT, or laser profiling",
    sensors: ["camera", "laser_profiler", "ut_probe", "lidar"],
    capabilities: ["internal_visual", "wall_thickness", "profile_measurement", "defect_detection", "blockage_detection"],
    typical_assets: ["pipeline", "sewer", "heat exchanger tube", "duct", "tunnel"],
    data_outputs: ["video", "laser_profile", "thickness_reading", "3d_scan"],
    standards: ["NASSCO PACP", "ASME B31.4", "ASTM F2550"],
    limitations: ["diameter_range", "bend_radius", "tethered_range", "power_supply"]
  },
  {
    id: "rov_subsea",
    name: "Subsea ROV",
    category: "subsea",
    description: "Remotely operated underwater vehicle for subsea structure inspection with visual, CP survey, and NDT tooling capability",
    sensors: ["hd_camera", "sonar", "cp_probe", "ut_probe", "laser_scale"],
    capabilities: ["visual_inspection", "cp_survey", "cleaning", "ut_measurement", "cathodic_potential", "photogrammetry"],
    typical_assets: ["jacket structure", "subsea pipeline", "riser", "mooring", "subsea equipment", "dam face"],
    data_outputs: ["video", "still_image", "cp_reading", "thickness_reading", "sonar_image"],
    standards: ["IMCA R 004", "DNV-RP-C210", "API RP 2SIM", "ISO 13628-8"],
    limitations: ["depth_rating", "current_limits", "visibility", "tooling_deployment"]
  },
  {
    id: "auv_pipeline",
    name: "Autonomous Underwater Vehicle (AUV)",
    category: "subsea",
    description: "Free-swimming autonomous vehicle for pipeline survey, seabed mapping, and cathodic protection assessment over long distances",
    sensors: ["multibeam_sonar", "side_scan_sonar", "camera", "cp_sensor", "magnetometer"],
    capabilities: ["pipeline_survey", "seabed_mapping", "freespan_detection", "cp_survey", "debris_detection"],
    typical_assets: ["subsea pipeline", "cable route", "seabed", "offshore field"],
    data_outputs: ["bathymetry", "sonar_mosaic", "pipeline_profile", "cp_map"],
    standards: ["DNV-ST-F101", "IMCA S 018", "API 1160"],
    limitations: ["navigation_accuracy", "battery_endurance", "no_contact_ndt", "comms_latency"]
  },
  {
    id: "scanner_automated",
    name: "Automated UT/PA Scanner",
    category: "fixed_scanner",
    description: "Motorized scanner for automated ultrasonic or phased array inspection of welds, plates, and components with encoded position data",
    sensors: ["phased_array_ut", "tofd", "conventional_ut", "position_encoder"],
    capabilities: ["weld_inspection", "corrosion_mapping", "flaw_sizing", "c_scan", "encoded_scan"],
    typical_assets: ["pipe weld", "vessel weld", "plate", "forging", "casting", "rail"],
    data_outputs: ["c_scan", "b_scan", "d_scan", "tofd_image", "thickness_map"],
    standards: ["ASME V Art.4", "AWS D1.1", "ISO 13588", "DNV-OS-C401"],
    limitations: ["surface_access", "geometry_dependent", "calibration_required", "scanner_rail_setup"]
  }
];

// ── ADR CONFIDENCE FRAMEWORK ───────────────────────────────────────

var ADR_CONFIDENCE_LEVELS = [
  { level: "high", min_score: 0.85, action: "auto_accept_with_audit", description: "ADR result accepted automatically, logged for audit trail" },
  { level: "medium", min_score: 0.65, action: "flag_for_review", description: "ADR result flagged for human inspector review before acceptance" },
  { level: "low", min_score: 0.40, action: "manual_review_required", description: "ADR result unreliable, full manual review required" },
  { level: "reject", min_score: 0.0, action: "discard_and_manual", description: "ADR result discarded, manual inspection required" }
];

var ADR_DEFECT_CLASSES = [
  { id: "crack", label: "Crack / Linear Indication", critical: true },
  { id: "porosity", label: "Porosity / Volumetric", critical: false },
  { id: "wall_loss", label: "Wall Loss / Thinning", critical: true },
  { id: "lamination", label: "Lamination / Delamination", critical: true },
  { id: "inclusion", label: "Inclusion / Slag", critical: false },
  { id: "lack_of_fusion", label: "Lack of Fusion", critical: true },
  { id: "undercut", label: "Undercut", critical: false },
  { id: "dent", label: "Dent / Mechanical Damage", critical: false },
  { id: "corrosion_pit", label: "Corrosion Pit", critical: true },
  { id: "coating_defect", label: "Coating Defect / Disbond", critical: false }
];

// ── SCAN PLAN TEMPLATES ────────────────────────────────────────────

var SCAN_PLAN_TEMPLATES = [
  {
    id: "tank_shell_survey",
    name: "Storage Tank Shell Survey",
    platform_types: ["drone_ut", "crawler_magnetic"],
    grid_pattern: "vertical_strips",
    grid_spacing_mm: 300,
    coverage_target: 0.95,
    scan_parameters: { mode: "thickness_grid", probe_frequency_mhz: 5, gain_db: "auto", gate: "backwall" }
  },
  {
    id: "pipe_weld_scan",
    name: "Pipe Weld Automated Scan",
    platform_types: ["scanner_automated"],
    grid_pattern: "circumferential",
    grid_spacing_mm: 1,
    coverage_target: 1.0,
    scan_parameters: { mode: "phased_array", probe_type: "linear_array", focal_law: "sectorial", angle_range: "40-70", wave_type: "shear" }
  },
  {
    id: "aerial_visual_survey",
    name: "Aerial Visual Survey",
    platform_types: ["drone_visual", "drone_thermal"],
    grid_pattern: "lawnmower",
    overlap_percent: 70,
    coverage_target: 1.0,
    scan_parameters: { mode: "photogrammetry", altitude_m: 15, gsd_mm_per_px: 3, image_format: "raw_plus_jpg" }
  },
  {
    id: "subsea_gvi",
    name: "Subsea General Visual Inspection",
    platform_types: ["rov_subsea"],
    grid_pattern: "waypoint_route",
    coverage_target: 1.0,
    scan_parameters: { mode: "video_survey", camera: "hd", lighting: "led_array", cp_interval_m: 10 }
  },
  {
    id: "internal_pipe_survey",
    name: "Internal Pipe / Sewer Survey",
    platform_types: ["crawler_pipe"],
    grid_pattern: "linear_traverse",
    coverage_target: 1.0,
    scan_parameters: { mode: "visual_plus_laser", camera: "pan_tilt", laser: "360_profile", speed_m_per_min: 3 }
  }
];

// ── HANDLER ────────────────────────────────────────────────────────

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    // ── get_registry ──
    if (action === "get_registry") {
      var byCat = {};
      for (var i = 0; i < PLATFORM_TYPES.length; i++) {
        var cat = PLATFORM_TYPES[i].category;
        if (!byCat[cat]) byCat[cat] = 0;
        byCat[cat]++;
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "robotics-automation",
          deploy: "DEPLOY244",
          version: "1.0.0",
          total_platforms: PLATFORM_TYPES.length,
          by_category: byCat,
          categories: ["aerial", "crawler", "subsea", "fixed_scanner"],
          scan_plan_templates: SCAN_PLAN_TEMPLATES.length,
          adr_defect_classes: ADR_DEFECT_CLASSES.length,
          adr_confidence_levels: ADR_CONFIDENCE_LEVELS.length,
          platforms: PLATFORM_TYPES.map(function(p) {
            return { id: p.id, name: p.name, category: p.category, sensors: p.sensors };
          }),
          scan_plans: SCAN_PLAN_TEMPLATES.map(function(s) {
            return { id: s.id, name: s.name, platform_types: s.platform_types };
          })
        })
      };
    }

    // ── get_platform_registry ──
    if (action === "get_platform_registry") {
      var catFilter = (body.category || "").toLowerCase();
      var filtered = PLATFORM_TYPES;
      if (catFilter) {
        filtered = PLATFORM_TYPES.filter(function(p) { return p.category === catFilter; });
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_platform_registry",
          filter: catFilter || "all",
          total: filtered.length,
          platforms: filtered
        })
      };
    }

    // ── register_platform ──
    if (action === "register_platform") {
      if (!body.platform_type || !body.platform_id || !body.operator) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "platform_type, platform_id, and operator required" }) };
      }

      // validate platform type
      var validType = null;
      for (var pi = 0; pi < PLATFORM_TYPES.length; pi++) {
        if (PLATFORM_TYPES[pi].id === body.platform_type) {
          validType = PLATFORM_TYPES[pi];
          break;
        }
      }
      if (!validType) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({
          error: "Invalid platform_type",
          valid_types: PLATFORM_TYPES.map(function(p) { return p.id; })
        })};
      }

      // in production this would write to a platforms table
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "register_platform",
          registered: true,
          platform: {
            platform_id: body.platform_id,
            platform_type: validType.id,
            platform_name: validType.name,
            operator: body.operator,
            serial_number: body.serial_number || null,
            calibration_due: body.calibration_due || null,
            sensors: validType.sensors,
            capabilities: validType.capabilities,
            standards: validType.standards
          }
        })
      };
    }

    // ── create_scan_plan ──
    if (action === "create_scan_plan") {
      if (!body.case_id || !body.template_id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id and template_id required" }) };
      }

      var template = null;
      for (var ti = 0; ti < SCAN_PLAN_TEMPLATES.length; ti++) {
        if (SCAN_PLAN_TEMPLATES[ti].id === body.template_id) {
          template = SCAN_PLAN_TEMPLATES[ti];
          break;
        }
      }
      if (!template) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({
          error: "Invalid template_id",
          valid_templates: SCAN_PLAN_TEMPLATES.map(function(s) { return { id: s.id, name: s.name }; })
        })};
      }

      var sb = createClient(supabaseUrl, supabaseKey);
      var caseRes = await sb.from("inspection_cases").select("id, component_name, inspection_method, status").eq("id", body.case_id).single();
      if (caseRes.error || !caseRes.data) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ action: "create_scan_plan", case_id: body.case_id, error: "case_not_found" }) };
      }

      var scanPlan = {
        plan_id: "SP-" + Date.now(),
        case_id: body.case_id,
        component: caseRes.data.component_name,
        template: template.id,
        template_name: template.name,
        platform_types: template.platform_types,
        grid_pattern: template.grid_pattern,
        coverage_target: template.coverage_target,
        scan_parameters: template.scan_parameters,
        custom_overrides: body.overrides || {},
        status: "planned",
        created_at: new Date().toISOString()
      };

      // log as audit event
      await sb.from("audit_events").insert({
        case_id: body.case_id,
        event_type: "scan_plan_created",
        event_data: { plan_id: scanPlan.plan_id, template: template.id, platform_types: template.platform_types },
        created_by: body.user_id || "system"
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "create_scan_plan",
          scan_plan: scanPlan
        })
      };
    }

    // ── ingest_sensor_data ──
    if (action === "ingest_sensor_data") {
      if (!body.case_id || !body.platform_id || !body.data_type) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id, platform_id, and data_type required" }) };
      }

      var validDataTypes = ["thickness_grid", "c_scan", "image_set", "video", "thermogram", "point_cloud", "cp_readings", "laser_profile"];
      if (validDataTypes.indexOf(body.data_type) === -1) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid data_type", valid_types: validDataTypes }) };
      }

      // validate and summarize sensor data
      var dataPoints = body.readings || body.data_points || [];
      var summary = {
        data_type: body.data_type,
        platform_id: body.platform_id,
        point_count: dataPoints.length,
        received_at: new Date().toISOString()
      };

      // for thickness data, compute statistics
      if (body.data_type === "thickness_grid" && dataPoints.length > 0) {
        var values = [];
        for (var di = 0; di < dataPoints.length; di++) {
          var val = parseFloat(dataPoints[di].value || dataPoints[di].thickness || dataPoints[di]);
          if (!isNaN(val) && val > 0) values.push(val);
        }
        if (values.length > 0) {
          values.sort(function(a, b) { return a - b; });
          var sum = 0;
          for (var vi = 0; vi < values.length; vi++) sum += values[vi];
          var avg = sum / values.length;
          var sqSum = 0;
          for (var si = 0; si < values.length; si++) sqSum += (values[si] - avg) * (values[si] - avg);

          summary.statistics = {
            count: values.length,
            min: values[0],
            max: values[values.length - 1],
            average: Math.round(avg * 1000) / 1000,
            std_deviation: Math.round(Math.sqrt(sqSum / values.length) * 1000) / 1000
          };

          // auto-flag anomalies (readings below 2 std deviations)
          var threshold = avg - 2 * Math.sqrt(sqSum / values.length);
          var anomalies = [];
          for (var ai = 0; ai < values.length; ai++) {
            if (values[ai] < threshold) anomalies.push(values[ai]);
          }
          summary.anomaly_count = anomalies.length;
          summary.anomaly_threshold = Math.round(threshold * 1000) / 1000;
        }
      }

      // store as evidence
      var sb2 = createClient(supabaseUrl, supabaseKey);
      await sb2.from("evidence").insert({
        case_id: body.case_id,
        evidence_type: "sensor_data",
        file_name: body.data_type + "_" + body.platform_id + ".json",
        metadata: { platform_id: body.platform_id, data_type: body.data_type, summary: summary }
      });

      await sb2.from("audit_events").insert({
        case_id: body.case_id,
        event_type: "sensor_data_ingested",
        event_data: { platform_id: body.platform_id, data_type: body.data_type, point_count: summary.point_count },
        created_by: body.user_id || "system"
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "ingest_sensor_data",
          case_id: body.case_id,
          ingestion_summary: summary,
          status: "ingested"
        })
      };
    }

    // ── evaluate_adr_result ──
    if (action === "evaluate_adr_result") {
      if (!body.case_id || !body.defect_class || body.confidence_score === undefined) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id, defect_class, and confidence_score required" }) };
      }

      var score = parseFloat(body.confidence_score);
      if (isNaN(score) || score < 0 || score > 1) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "confidence_score must be between 0 and 1" }) };
      }

      // find defect class
      var defectClass = null;
      for (var dci = 0; dci < ADR_DEFECT_CLASSES.length; dci++) {
        if (ADR_DEFECT_CLASSES[dci].id === body.defect_class) {
          defectClass = ADR_DEFECT_CLASSES[dci];
          break;
        }
      }
      if (!defectClass) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({
          error: "Invalid defect_class",
          valid_classes: ADR_DEFECT_CLASSES.map(function(d) { return d.id; })
        })};
      }

      // determine confidence level
      var confLevel = ADR_CONFIDENCE_LEVELS[ADR_CONFIDENCE_LEVELS.length - 1]; // default reject
      for (var cli = 0; cli < ADR_CONFIDENCE_LEVELS.length; cli++) {
        if (score >= ADR_CONFIDENCE_LEVELS[cli].min_score) {
          confLevel = ADR_CONFIDENCE_LEVELS[cli];
          break;
        }
      }

      // critical defects require higher threshold for auto-accept
      var effectiveAction = confLevel.action;
      if (defectClass.critical && confLevel.level === "high" && score < 0.92) {
        effectiveAction = "flag_for_review";
      }

      // log the ADR evaluation
      var sb3 = createClient(supabaseUrl, supabaseKey);
      await sb3.from("audit_events").insert({
        case_id: body.case_id,
        event_type: "adr_evaluation",
        event_data: {
          defect_class: defectClass.id,
          confidence_score: score,
          confidence_level: confLevel.level,
          action: effectiveAction,
          is_critical: defectClass.critical,
          adr_model: body.adr_model || "unknown",
          location: body.location || null,
          dimensions: body.dimensions || null
        },
        created_by: body.user_id || "system"
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "evaluate_adr_result",
          case_id: body.case_id,
          defect_class: defectClass,
          confidence_score: score,
          confidence_level: confLevel.level,
          recommended_action: effectiveAction,
          rationale: defectClass.critical && confLevel.level === "high" && score < 0.92 ?
            "Critical defect class requires 0.92+ confidence for auto-accept" :
            confLevel.description,
          requires_human_review: effectiveAction !== "auto_accept_with_audit"
        })
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action, valid_actions: ["register_platform", "create_scan_plan", "ingest_sensor_data", "evaluate_adr_result", "get_platform_registry", "get_registry"] }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
