/** 
 * DEPLOY09_create_case.ts
 * Netlify Function: create-case
 * Deploy to: netlify/functions/create-case.ts
 *
 * Creates an inspection case, auto-populates 4D energy model,
 * and triggers the physics model builder.
 *
 * CRITICAL: String concatenation only. No backtick template literals.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var supabase = createClient(supabaseUrl, supabaseKey);

var METHOD_MODELS: Record<string, { energy_type: string; interaction_type: string; response_type: string; time_dimension_type: string }> = {
  VT: { energy_type: "light", interaction_type: "reflection", response_type: "image", time_dimension_type: "instant" },
  PT: { energy_type: "liquid", interaction_type: "capillary", response_type: "indication", time_dimension_type: "dwell" },
  MT: { energy_type: "magnetic_field", interaction_type: "field_distortion", response_type: "particle_pattern", time_dimension_type: "real_time" },
  UT: { energy_type: "acoustic_wave", interaction_type: "reflection_refraction", response_type: "echo_waveform", time_dimension_type: "time_of_flight" },
  RT: { energy_type: "radiation", interaction_type: "absorption_density_variation", response_type: "radiograph", time_dimension_type: "exposure" },
  ET: { energy_type: "electromagnetic_induction", interaction_type: "eddy_current_perturbation", response_type: "signal_trace", time_dimension_type: "frequency_phase_response" }
};

export var handler: Handler = async function(event) {
  try {
    var body = JSON.parse(event.body || "{}");

    if (!body.method || !METHOD_MODELS[body.method]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Valid method required: VT, PT, MT, UT, RT, ET" })
      };
    }

    if (!body.title) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Title required" })
      };
    }

    if (!body.org_id || !body.user_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "org_id and user_id required" })
      };
    }

    var model = METHOD_MODELS[body.method];
    var caseNumber = "NDT-" + Date.now();

    // Create the inspection case
    var insertResult = await supabase
      .from("inspection_cases")
      .insert({
        org_id: body.org_id,
        project_id: body.project_id || null,
        case_number: caseNumber,
        title: body.title,
        method: body.method,
        status: "draft",
        material_class: body.material_class || "unknown",
        load_condition: body.load_condition || "unknown",
        code_family: body.code_family || null,
        code_edition: body.code_edition || null,
        code_section: body.code_section || null,
        acceptance_table: body.acceptance_table || null,
        component_name: body.component_name || null,
        weld_id: body.weld_id || null,
        joint_type: body.joint_type || null,
        thickness_mm: body.thickness_mm || null,
        procedure_ref: body.procedure_ref || null,
        inspector_ref: body.inspector_ref || null,
        energy_type: model.energy_type,
        interaction_type: model.interaction_type,
        response_type: model.response_type,
        time_dimension_type: model.time_dimension_type,
        created_by: body.user_id
      })
      .select()
      .single();

    if (insertResult.error) {
      throw insertResult.error;
    }

    var newCase = insertResult.data;

    // Log the case creation event
    await supabase.from("case_events").insert({
      case_id: newCase.id,
      event_type: "case_created",
      actor_id: body.user_id,
      event_json: {
        method: body.method,
        material_class: body.material_class || "unknown",
        code_family: body.code_family || null
      }
    });

    // Load material physics data if available
    var materialResult = await supabase
      .from("material_models")
      .select("*")
      .eq("material_class", body.material_class || "unknown")
      .limit(1)
      .single();

    var materialData = materialResult.data;

    // Build initial physics reality model from known data
    var physicsModel = {
      case_id: newCase.id,
      material_properties_json: materialData ? {
        material_class: materialData.material_class,
        material_name: materialData.material_name,
        acoustic_velocity_longitudinal_ms: materialData.acoustic_velocity_longitudinal_ms,
        acoustic_velocity_shear_ms: materialData.acoustic_velocity_shear_ms,
        acoustic_impedance: materialData.acoustic_impedance,
        density_kg_m3: materialData.density_kg_m3,
        attenuation_coefficient: materialData.attenuation_coefficient,
        magnetic_permeability: materialData.magnetic_permeability,
        electrical_conductivity_ms_m: materialData.electrical_conductivity_ms_m,
        ferromagnetic: materialData.physics_profile_json ? materialData.physics_profile_json.ferromagnetic : null
      } : { material_class: body.material_class || "unknown" },
      geometry_json: {
        thickness_mm: body.thickness_mm || null,
        joint_type: body.joint_type || null,
        component_name: body.component_name || null
      },
      process_context_json: {
        procedure_ref: body.procedure_ref || null,
        notes: "Process context to be enriched by AI physics model builder"
      },
      service_context_json: {
        load_condition: body.load_condition || "unknown"
      },
      probable_discontinuities_json: materialData && materialData.common_discontinuities_json
        ? materialData.common_discontinuities_json
        : [],
      method_capability_map_json: materialData && materialData.physics_profile_json
        ? materialData.physics_profile_json
        : {},
      model_version: "v1_seed"
    };

    var physicsInsertResult = await supabase
      .from("physics_reality_models")
      .insert(physicsModel);

    if (physicsInsertResult.error) {
      // Log but do not fail the case creation
      console.error("Physics model insert error: " + JSON.stringify(physicsInsertResult.error));
    }

    // Log physics model creation event
    await supabase.from("case_events").insert({
      case_id: newCase.id,
      event_type: "physics_model_created",
      actor_id: null,
      event_json: {
        model_version: "v1_seed",
        material_data_available: !!materialData,
        discontinuity_count: physicsModel.probable_discontinuities_json.length
      }
    });

    // If an asset_tag was provided, link to existing asset or create new one
    if (body.asset_tag) {
      var assetResult = await supabase
        .from("assets")
        .select("id")
        .eq("org_id", body.org_id)
        .eq("asset_tag", body.asset_tag)
        .single();

      var assetId = null;

      if (assetResult.data) {
        assetId = assetResult.data.id;
      } else {
        // Create new asset
        var newAssetResult = await supabase
          .from("assets")
          .insert({
            org_id: body.org_id,
            asset_tag: body.asset_tag,
            asset_type: "other",
            asset_name: body.component_name || body.asset_tag,
            material_class: body.material_class || null,
            nominal_thickness_mm: body.thickness_mm || null
          })
          .select("id")
          .single();

        if (newAssetResult.data) {
          assetId = newAssetResult.data.id;
        }
      }

      if (assetId) {
        // Link case to asset
        await supabase
          .from("inspection_cases")
          .update({ asset_id: assetId })
          .eq("id", newCase.id);

        // Create asset inspection record
        await supabase.from("asset_inspections").insert({
          asset_id: assetId,
          case_id: newCase.id,
          inspection_date: new Date().toISOString().split("T")[0]
        });

        newCase.asset_id = assetId;
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        case: newCase,
        physics_model_seeded: true,
        material_data_found: !!materialData,
        predicted_discontinuities: physicsModel.probable_discontinuities_json.length
      })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "create-case failed" })
    };
  }
};
