/**
 * DEPLOY57 — dre-record-intake.ts
 * netlify/functions/dre-record-intake.ts
 *
 * Damage Reality Engine — Record Intake
 * Accepts event-driven or condition-driven damage reports.
 * Auto-infers event_category or finding_category from narrative if not provided.
 * Stores in damage_cases table.
 *
 * CONSTRAINT: String concatenation only — no backtick template literals
 */

import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

/* ---- Supabase client ---- */

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

/* ---- Event category inference ---- */

var EVENT_KEYWORDS: Array<{ category: string; terms: string[] }> = [
  { category: "wind", terms: ["wind", "gust", "hurricane", "tornado", "storm wind"] },
  { category: "wave_surge", terms: ["wave", "surge", "current", "sea state", "swell", "splash zone"] },
  { category: "rain_flood", terms: ["rain", "flood", "inundation", "water intrusion", "washout"] },
  { category: "extreme_heat", terms: ["extreme heat", "overheated", "high temperature", "thermal exposure"] },
  { category: "extreme_cold", terms: ["freeze", "cold", "cold snap", "low temperature"] },
  { category: "hail_ice_snow", terms: ["hail", "ice", "snow", "freezing rain"] },
  { category: "earthquake_ground_movement", terms: ["earthquake", "subsidence", "settlement", "ground movement"] },
  { category: "lightning_electrical", terms: ["lightning", "electrical strike", "power surge", "arc flash"] },
  { category: "impact", terms: ["impact", "hit", "struck", "collision", "anchor drag", "dropped object", "tree fell"] },
  { category: "fire_blast", terms: ["fire", "blast", "explosion", "overpressure", "flash fire"] },
];

var FINDING_KEYWORDS: Array<{ category: string; terms: string[] }> = [
  { category: "corrosion", terms: ["corrosion", "pitting", "rust", "metal loss"] },
  { category: "crack_indication", terms: ["crack", "linear indication", "fracture", "toe crack"] },
  { category: "dent_gouge_impact", terms: ["dent", "gouge", "denting", "gouged", "impact mark"] },
  { category: "coating_failure", terms: ["coating loss", "coating failure", "disbondment", "coating breakdown"] },
  { category: "section_loss", terms: ["section loss", "wall loss", "thinning"] },
  { category: "leak_or_staining", terms: ["leak", "staining", "weeping", "product residue"] },
  { category: "support_distress", terms: ["support distress", "distortion", "misalignment", "sagging", "support crack"] },
  { category: "marine_growth_obscured_condition", terms: ["marine growth", "biofouling", "obscured"] },
  { category: "cui_suspected", terms: ["cui", "corrosion under insulation", "under insulation"] },
  { category: "anode_or_cp_issue", terms: ["anode loss", "cp issue", "cathodic protection"] },
  { category: "deformation", terms: ["deformation", "bent", "buckled", "out of plane"] },
];

function textHasAny(text: string, terms: string[]): boolean {
  var lower = text.toLowerCase();
  for (var i = 0; i < terms.length; i++) {
    if (lower.indexOf(terms[i]) !== -1) return true;
  }
  return false;
}

function inferEventCategory(body: any): string {
  if (body.event_category) return body.event_category;
  var narrative = body.narrative || "";
  var matched: string[] = [];
  for (var i = 0; i < EVENT_KEYWORDS.length; i++) {
    if (textHasAny(narrative, EVENT_KEYWORDS[i].terms)) {
      matched.push(EVENT_KEYWORDS[i].category);
    }
  }
  if (matched.length > 1) return "multi_factor";
  if (matched.length === 1) return matched[0];

  if ((body.wind_mph || 0) > 0 && (body.wave_height_ft || 0) > 0) return "multi_factor";
  if ((body.wind_mph || 0) > 0) return "wind";
  if ((body.wave_height_ft || 0) > 0 || (body.current_speed_kts || 0) > 0) return "wave_surge";
  if ((body.rainfall_inches || 0) > 0 || (body.flood_depth_ft || 0) > 0) return "rain_flood";
  if ((body.high_temp_f || 0) > 110) return "extreme_heat";
  if ((body.low_temp_f || 999) < 32) return "extreme_cold";
  if ((body.hail_size_in || 0) > 0) return "hail_ice_snow";
  if ((body.seismic_magnitude || 0) > 0) return "earthquake_ground_movement";
  if (body.impact_object || (body.impact_speed_mph || 0) > 0) return "impact";
  if (body.fire_exposure) return "fire_blast";

  return "multi_factor";
}

function inferFindingCategory(body: any): string {
  if (body.finding_category) return body.finding_category;
  var narrative = (body.narrative || "") + " " + (body.observed_damage_description || "");
  for (var i = 0; i < FINDING_KEYWORDS.length; i++) {
    if (textHasAny(narrative, FINDING_KEYWORDS[i].terms)) {
      return FINDING_KEYWORDS[i].category;
    }
  }
  if (body.crack_like_indication) return "crack_indication";
  if (body.wall_loss_suspected) return "section_loss";
  if (body.coating_loss_present) return "coating_failure";
  if (body.leak_evidence_present) return "leak_or_staining";
  if (body.support_distress_present) return "support_distress";
  if (body.deformation_present) return "deformation";
  if (body.marine_growth_present) return "marine_growth_obscured_condition";
  if (body.cp_anode_loss_present) return "anode_or_cp_issue";
  return "unknown_condition";
}

/* ---- Handler ---- */

var handler: Handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    var body = JSON.parse(event.body || "{}");
    var supabase = getSupabase();

    /* Validate required fields */
    if (!body.org_id) return { statusCode: 400, body: JSON.stringify({ error: "org_id required" }) };
    if (!body.asset_id) return { statusCode: 400, body: JSON.stringify({ error: "asset_id required" }) };
    if (!body.intake_path) return { statusCode: 400, body: JSON.stringify({ error: "intake_path required (event_driven or condition_driven)" }) };
    if (!body.narrative) return { statusCode: 400, body: JSON.stringify({ error: "narrative required" }) };

    /* Infer categories */
    var eventCat = null;
    var findingCat = null;
    if (body.intake_path === "event_driven") {
      eventCat = inferEventCategory(body);
    }
    if (body.intake_path === "condition_driven") {
      findingCat = inferFindingCategory(body);
    }

    /* Build record */
    var record = {
      org_id: body.org_id,
      asset_id: body.asset_id,
      reported_by_user_id: body.reported_by_user_id || null,
      intake_path: body.intake_path,
      source_type: body.source_type || "manual",
      title: body.title || null,
      narrative: body.narrative,
      location_context: body.location_context || null,

      /* event-driven */
      event_category: eventCat,
      event_subtype: body.event_subtype || null,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      duration_hours: body.duration_hours || null,
      severity_input: body.severity_input || null,
      directionality: body.directionality || null,
      wind_mph: body.wind_mph || null,
      wave_height_ft: body.wave_height_ft || null,
      current_speed_kts: body.current_speed_kts || null,
      rainfall_inches: body.rainfall_inches || null,
      flood_depth_ft: body.flood_depth_ft || null,
      high_temp_f: body.high_temp_f || null,
      low_temp_f: body.low_temp_f || null,
      hail_size_in: body.hail_size_in || null,
      seismic_magnitude: body.seismic_magnitude || null,
      impact_object: body.impact_object || null,
      impact_speed_mph: body.impact_speed_mph || null,
      impact_energy_estimate: body.impact_energy_estimate || null,
      debris_present: body.debris_present === true,
      power_loss: body.power_loss === true,
      fire_exposure: body.fire_exposure === true,
      chemical_exposure: body.chemical_exposure === true,

      /* condition-driven */
      finding_category: findingCat,
      finding_subtype: body.finding_subtype || null,
      finding_source: body.finding_source || null,
      observed_damage_description: body.observed_damage_description || null,
      observed_extent: body.observed_extent || null,
      observed_depth_or_size: body.observed_depth_or_size || null,
      marine_growth_present: body.marine_growth_present === true,
      visibility_condition: body.visibility_condition || null,
      cleaning_performed: body.cleaning_performed === true,
      coating_loss_present: body.coating_loss_present === true,
      leak_evidence_present: body.leak_evidence_present === true,
      deformation_present: body.deformation_present === true,
      crack_like_indication: body.crack_like_indication === true,
      wall_loss_suspected: body.wall_loss_suspected === true,
      support_distress_present: body.support_distress_present === true,
      cp_anode_loss_present: body.cp_anode_loss_present === true,
      photo_confidence: body.photo_confidence || null,
      known_impact_point: body.known_impact_point || null,

      photos: body.photos || [],
      videos: body.videos || [],
      raw_payload: body.raw_payload || {},
    };

    var result = await supabase
      .from("damage_cases")
      .insert(record)
      .select("*")
      .single();

    if (result.error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: result.error.message || "Insert failed" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        damage_case: result.data,
        inferred: {
          event_category: eventCat,
          finding_category: findingCat,
        },
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Unexpected error" }),
    };
  }
};

export { handler };
