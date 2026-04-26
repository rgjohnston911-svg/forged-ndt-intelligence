// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════
// ASSET REGISTRY ENGINE (DEPLOY334)
//
// Central asset master for the entire platform.
// Every engine references case_id, but there's been no proper
// asset hierarchy. This engine provides:
//
// Plant → Unit → System → Component → CML
//
// With material properties, design data, operating conditions,
// and inspection history metadata attached at each level.
//
// All other engines can query this to resolve asset context:
// - What material is this pipe? → carbon steel SA-106B
// - What's the nominal wall? → 7.11mm (NPS 6 Sch 40)
// - What's upstream? → the heat exchanger in Unit 2
// - What CMLs exist on this component? → CML-1 through CML-12
// - What's the design temperature/pressure? → 350F / 150 psig
// ══════════════════════════════════════════════════════════════════

// ── ASSET TYPE DEFINITIONS ─────────────────────────────────────
var ASSET_TYPES = {
  "plant": {
    level: 0,
    can_contain: ["unit"],
    fields: ["plant_name", "plant_code", "location", "operator", "commission_date"]
  },
  "unit": {
    level: 1,
    can_contain: ["system"],
    fields: ["unit_name", "unit_number", "process_type", "design_code"]
  },
  "system": {
    level: 2,
    can_contain: ["component"],
    fields: ["system_name", "system_type", "pid_number", "service_fluid", "operating_temp", "operating_pressure"]
  },
  "component": {
    level: 3,
    can_contain: ["cml"],
    fields: ["component_type", "tag_number", "material_spec", "nominal_diameter", "nominal_wall", "schedule", "design_pressure", "design_temperature", "maop", "corrosion_allowance", "install_date", "design_code", "insulated", "insulation_type", "coating_type", "coating_date"]
  },
  "cml": {
    level: 4,
    can_contain: [],
    fields: ["cml_id", "cml_type", "orientation", "clock_position", "weld_proximity", "elevation", "description", "baseline_thickness", "min_required_thickness"]
  }
};

// ── STANDARD PIPE DATA ─────────────────────────────────────────
var PIPE_SCHEDULES = {
  "NPS_2_SCH40": { od_mm: 60.3, wall_mm: 3.91 },
  "NPS_2_SCH80": { od_mm: 60.3, wall_mm: 5.54 },
  "NPS_3_SCH40": { od_mm: 88.9, wall_mm: 5.49 },
  "NPS_3_SCH80": { od_mm: 88.9, wall_mm: 7.62 },
  "NPS_4_SCH40": { od_mm: 114.3, wall_mm: 6.02 },
  "NPS_4_SCH80": { od_mm: 114.3, wall_mm: 8.56 },
  "NPS_6_SCH40": { od_mm: 168.3, wall_mm: 7.11 },
  "NPS_6_SCH80": { od_mm: 168.3, wall_mm: 10.97 },
  "NPS_8_SCH40": { od_mm: 219.1, wall_mm: 8.18 },
  "NPS_8_SCH80": { od_mm: 219.1, wall_mm: 12.70 },
  "NPS_10_SCH40": { od_mm: 273.1, wall_mm: 9.27 },
  "NPS_10_SCH80": { od_mm: 273.1, wall_mm: 15.09 },
  "NPS_12_SCH40": { od_mm: 323.9, wall_mm: 10.31 },
  "NPS_12_SCH80": { od_mm: 323.9, wall_mm: 17.48 },
  "NPS_16_SCH40": { od_mm: 406.4, wall_mm: 12.70 },
  "NPS_20_SCH40": { od_mm: 508.0, wall_mm: 12.70 },
  "NPS_24_SCH40": { od_mm: 609.6, wall_mm: 14.27 }
};

// ── MATERIAL PROPERTIES ────────────────────────────────────────
var MATERIAL_LIBRARY = {
  "SA-106B": { type: "carbon_steel", smys_mpa: 241, suts_mpa: 414, allowable_mpa: 138, max_temp_c: 427 },
  "SA-516-70": { type: "carbon_steel", smys_mpa: 262, suts_mpa: 483, allowable_mpa: 138, max_temp_c: 427 },
  "SA-335-P11": { type: "cr_mo_steel", smys_mpa: 207, suts_mpa: 414, allowable_mpa: 121, max_temp_c: 593 },
  "SA-335-P22": { type: "cr_mo_steel", smys_mpa: 207, suts_mpa: 414, allowable_mpa: 121, max_temp_c: 593 },
  "SA-312-304": { type: "stainless_steel", smys_mpa: 207, suts_mpa: 517, allowable_mpa: 138, max_temp_c: 816 },
  "SA-312-316": { type: "stainless_steel", smys_mpa: 207, suts_mpa: 517, allowable_mpa: 138, max_temp_c: 816 },
  "SA-790-S31803": { type: "duplex", smys_mpa: 448, suts_mpa: 621, allowable_mpa: 207, max_temp_c: 315 },
  "SA-333-6": { type: "carbon_steel", smys_mpa: 241, suts_mpa: 414, allowable_mpa: 138, max_temp_c: 427 },
  "API-5L-X52": { type: "pipeline_steel", smys_mpa: 359, suts_mpa: 455, allowable_mpa: 172, max_temp_c: 232 },
  "API-5L-X65": { type: "pipeline_steel", smys_mpa: 448, suts_mpa: 531, allowable_mpa: 207, max_temp_c: 232 }
};

// ── ASSET RESOLUTION ───────────────────────────────────────────
function resolveAssetContext(assetData) {
  var context = {
    asset_id: assetData.asset_id || null,
    asset_type: assetData.asset_type || "component",
    hierarchy: [],
    material: null,
    design_data: {},
    pipe_data: null,
    operating_conditions: {}
  };

  // Resolve material
  if (assetData.material_spec) {
    var matKey = assetData.material_spec.replace(/\s+/g, "-").toUpperCase();
    context.material = MATERIAL_LIBRARY[matKey] || null;
    if (context.material) {
      context.material.spec = assetData.material_spec;
    }
  }

  // Resolve pipe schedule
  if (assetData.nominal_diameter && assetData.schedule) {
    var pipeKey = "NPS_" + assetData.nominal_diameter + "_SCH" + assetData.schedule;
    context.pipe_data = PIPE_SCHEDULES[pipeKey] || null;
    if (context.pipe_data) {
      context.pipe_data.nps = assetData.nominal_diameter;
      context.pipe_data.schedule = assetData.schedule;
    }
  }

  // Design data
  if (assetData.design_pressure) context.design_data.pressure = assetData.design_pressure;
  if (assetData.design_temperature) context.design_data.temperature = assetData.design_temperature;
  if (assetData.corrosion_allowance) context.design_data.corrosion_allowance = assetData.corrosion_allowance;
  if (assetData.design_code) context.design_data.code = assetData.design_code;

  // Operating conditions
  if (assetData.operating_temp) context.operating_conditions.temperature = assetData.operating_temp;
  if (assetData.operating_pressure) context.operating_conditions.pressure = assetData.operating_pressure;
  if (assetData.service_fluid) context.operating_conditions.service_fluid = assetData.service_fluid;

  return context;
}

// ── SAVE FUNCTIONS ─────────────────────────────────────────────
async function saveAsset(sb, asset) {
  try {
    await sb.from("asset_registry").upsert([{
      asset_id: asset.asset_id,
      asset_type: asset.asset_type || "component",
      parent_id: asset.parent_id || null,
      tag_number: asset.tag_number || null,
      name: asset.name || asset.asset_id,
      material_spec: asset.material_spec || null,
      nominal_diameter: asset.nominal_diameter || null,
      nominal_wall: asset.nominal_wall || null,
      schedule: asset.schedule || null,
      design_pressure: asset.design_pressure || null,
      design_temperature: asset.design_temperature || null,
      design_code: asset.design_code || null,
      service_fluid: asset.service_fluid || null,
      operating_temp: asset.operating_temp || null,
      operating_pressure: asset.operating_pressure || null,
      corrosion_allowance: asset.corrosion_allowance || null,
      install_date: asset.install_date || null,
      metadata: asset.metadata || {}
    }], { onConflict: "asset_id" });
  } catch (e) {
    // non-fatal
  }
}

async function getAsset(sb, assetId) {
  try {
    var result = await sb.from("asset_registry").select("*").eq("asset_id", assetId).limit(1);
    return result.data && result.data.length > 0 ? result.data[0] : null;
  } catch (e) {
    return null;
  }
}

async function getChildren(sb, parentId) {
  try {
    var result = await sb.from("asset_registry").select("*").eq("parent_id", parentId).order("asset_id");
    return result.data || [];
  } catch (e) {
    return [];
  }
}

async function searchAssets(sb, query, assetType) {
  try {
    var q = sb.from("asset_registry").select("*").limit(50);
    if (assetType) q = q.eq("asset_type", assetType);
    if (query) q = q.or("asset_id.ilike.%" + query + "%,name.ilike.%" + query + "%,tag_number.ilike.%" + query + "%");
    var result = await q;
    return result.data || [];
  } catch (e) {
    return [];
  }
}

// ── HANDLER ────────────────────────────────────────────────────
var handler = async function(event) {
  var corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    var sb = createClient(supabaseUrl, supabaseKey);

    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "asset-registry",
          deploy: "DEPLOY334",
          version: "1.0.0",
          description: "Asset Registry Engine — central asset master with hierarchy, material properties, pipe schedules, and design data",
          asset_types: Object.keys(ASSET_TYPES).length,
          pipe_schedules: Object.keys(PIPE_SCHEDULES).length,
          materials: Object.keys(MATERIAL_LIBRARY).length,
          capabilities: ["register", "resolve_context", "hierarchy", "search", "material_lookup", "pipe_lookup"],
          actions: ["get_registry", "register", "get_asset", "get_children", "resolve_context", "search", "get_materials", "get_pipe_schedules"]
        })
      };
    }

    if (action === "register") {
      await saveAsset(sb, body);
      var ctx = resolveAssetContext(body);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: "asset-registry", action: "register", status: "registered", context: ctx }) };
    }

    if (action === "get_asset") {
      var asset = await getAsset(sb, body.asset_id);
      var context = asset ? resolveAssetContext(asset) : null;
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: "asset-registry", action: "get_asset", asset: asset, context: context }) };
    }

    if (action === "get_children") {
      var children = await getChildren(sb, body.parent_id || body.asset_id);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: "asset-registry", action: "get_children", children: children, count: children.length }) };
    }

    if (action === "resolve_context") {
      var rcAsset = await getAsset(sb, body.asset_id);
      var rcData = rcAsset || body;
      var rcContext = resolveAssetContext(rcData);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: "asset-registry", action: "resolve_context", context: rcContext }) };
    }

    if (action === "search") {
      var results = await searchAssets(sb, body.query, body.asset_type);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: "asset-registry", action: "search", results: results, count: results.length }) };
    }

    if (action === "get_materials") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: "asset-registry", action: "get_materials", materials: MATERIAL_LIBRARY }) };
    }

    if (action === "get_pipe_schedules") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: "asset-registry", action: "get_pipe_schedules", schedules: PIPE_SCHEDULES }) };
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: "asset-registry", error: "Unknown action: " + action }) };

  } catch (err) {
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: "asset-registry", error: String(err && err.message ? err.message : err) }) };
  }
};

export { handler };
