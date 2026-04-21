// AUTHORITY LOCK ENGINE v1.0
// File: netlify/functions/authority-lock.js
// NO TYPESCRIPT — PURE JAVASCRIPT

var handler = async function(event) {
  "use strict";

  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var asset = (body.asset_type || "").toLowerCase().trim();
    var service = (body.service_environment || "").toLowerCase().trim();
    var damage = (body.damage_mechanisms || []).map(function(d) { return (d || "").toLowerCase().trim(); });
    var jurisdiction = (body.jurisdiction || "").toLowerCase().trim();
    var wallLossPercent = body.wall_loss_percent || 0;
    var hasCracking = body.has_cracking || false;
    var isPressureBoundary = body.is_pressure_boundary !== false;

    var authorities = [];
    var lockReasons = [];
    var supplementalCodes = [];
    var triggerB31G = false;

    // PIPELINE
    if (asset === "pipeline" || asset === "transmission_pipeline" || asset === "gathering_line") {
      authorities.push({ code: "ASME B31.8", title: "Gas Transmission and Distribution Piping Systems", role: "primary_construction", locked: true });
      lockReasons.push("Pipeline asset -> ASME B31.8 primary authority");

      if (service.indexOf("liquid") >= 0 || service.indexOf("oil") >= 0 || service.indexOf("crude") >= 0) {
        authorities.push({ code: "ASME B31.4", title: "Pipeline Transportation Systems for Liquids and Slurries", role: "primary_construction", locked: true });
        lockReasons.push("Liquid/crude service -> ASME B31.4 co-authority");
      }

      if (service.indexOf("sour") >= 0 || service.indexOf("h2s") >= 0 || service.indexOf("hydrogen sulfide") >= 0) {
        authorities.push({ code: "NACE MR0175/ISO 15156", title: "Materials for Use in H2S-Containing Environments", role: "material_suitability", locked: true });
        lockReasons.push("Sour/H2S service -> NACE MR0175/ISO 15156 material authority locked");
      }

      authorities.push({ code: "API 579-1/ASME FFS-1", title: "Fitness-For-Service", role: "fitness_for_service", locked: true });
      lockReasons.push("Pipeline integrity assessment -> API 579-1 FFS authority");
    }

    // PRESSURE VESSEL
    if (asset === "pressure_vessel" || asset === "vessel" || asset === "reactor" || asset === "drum" || asset === "heat_exchanger") {
      authorities.push({ code: "API 510", title: "Pressure Vessel Inspection Code", role: "inspection_authority", locked: true });
      lockReasons.push("Pressure vessel asset -> API 510 inspection authority");
      authorities.push({ code: "ASME BPVC Section VIII", title: "Boiler and Pressure Vessel Code - Pressure Vessels", role: "primary_construction", locked: true });
      lockReasons.push("Pressure vessel -> ASME Section VIII construction code");
      authorities.push({ code: "API 579-1/ASME FFS-1", title: "Fitness-For-Service", role: "fitness_for_service", locked: true });
      lockReasons.push("Pressure vessel integrity -> API 579-1 FFS authority");
    }

    // PIPING
    if (asset === "piping" || asset === "process_piping" || asset === "plant_piping") {
      authorities.push({ code: "API 570", title: "Piping Inspection Code", role: "inspection_authority", locked: true });
      lockReasons.push("Piping asset -> API 570 inspection authority");
      authorities.push({ code: "ASME B31.3", title: "Process Piping", role: "primary_construction", locked: true });
      lockReasons.push("Process piping -> ASME B31.3 construction code");
      authorities.push({ code: "API 579-1/ASME FFS-1", title: "Fitness-For-Service", role: "fitness_for_service", locked: true });
      lockReasons.push("Piping integrity -> API 579-1 FFS authority");

      if (jurisdiction === "refinery" || jurisdiction === "petrochemical" || jurisdiction === "chemical_plant") {
        supplementalCodes.push({ code: "API 574", title: "Inspection Practices for Piping System Components", role: "supplemental_inspection", locked: false });
      }
    }

    // STORAGE TANK
    if (asset === "storage_tank" || asset === "tank" || asset === "aboveground_storage_tank" || asset === "ast") {
      authorities.push({ code: "API 653", title: "Tank Inspection, Repair, Alteration, and Reconstruction", role: "inspection_authority", locked: true });
      lockReasons.push("Storage tank asset -> API 653 inspection authority");
      authorities.push({ code: "API 650", title: "Welded Tanks for Oil Storage", role: "primary_construction", locked: true });
      lockReasons.push("Storage tank -> API 650 construction code");
    }

    // BOILER
    if (asset === "boiler" || asset === "power_boiler" || asset === "heating_boiler") {
      authorities.push({ code: "NB-23 (NBIC)", title: "National Board Inspection Code", role: "inspection_authority", locked: true });
      lockReasons.push("Boiler asset -> NBIC inspection authority");
      authorities.push({ code: "ASME BPVC Section I", title: "Boiler and Pressure Vessel Code - Power Boilers", role: "primary_construction", locked: true });
      lockReasons.push("Boiler -> ASME Section I construction code");
    }

    // STRUCTURAL
    if (asset === "structural" || asset === "structural_steel" || asset === "bridge" || asset === "offshore_structure") {
      authorities.push({ code: "AWS D1.1", title: "Structural Welding Code - Steel", role: "primary_construction", locked: true });
      lockReasons.push("Structural steel -> AWS D1.1 construction/inspection authority");
      if (asset === "offshore_structure") {
        authorities.push({ code: "API RP 2A", title: "Planning, Designing, and Constructing Fixed Offshore Platforms", role: "design_authority", locked: true });
        lockReasons.push("Offshore structure -> API RP 2A design authority");
      }
    }

    // DAMAGE MECHANISM SUPPLEMENTS
    var hasCrackingMechanism = hasCracking;
    var hasCorrosion = false;
    var hasSourCracking = false;

    damage.forEach(function(mech) {
      if (mech.indexOf("crack") >= 0 || mech.indexOf("scc") >= 0 || mech.indexOf("fatigue") >= 0 ||
          mech.indexOf("hic") >= 0 || mech.indexOf("sohic") >= 0 || mech.indexOf("sscc") >= 0 ||
          mech === "hydrogen_induced_cracking" || mech === "sulfide_stress_cracking") {
        hasCrackingMechanism = true;
      }
      if (mech.indexOf("ssc") >= 0 || mech.indexOf("sscc") >= 0 || mech.indexOf("hic") >= 0 ||
          mech.indexOf("sohic") >= 0 || mech.indexOf("sour") >= 0) {
        hasSourCracking = true;
      }
      if (mech.indexOf("corrosion") >= 0 || mech.indexOf("wall_loss") >= 0 || mech.indexOf("pitting") >= 0 ||
          mech.indexOf("erosion") >= 0 || mech.indexOf("mic") >= 0 || mech.indexOf("co2") >= 0) {
        hasCorrosion = true;
      }
    });

    if (hasCrackingMechanism && isPressureBoundary) {
      var hasApi579 = authorities.some(function(a) { return a.code.indexOf("API 579") >= 0; });
      if (!hasApi579) {
        authorities.push({ code: "API 579-1/ASME FFS-1", title: "Fitness-For-Service", role: "fitness_for_service", locked: true });
      }
      supplementalCodes.push({ code: "API 579-1 Part 9", title: "Assessment of Crack-Like Flaws", role: "crack_assessment", locked: true });
      lockReasons.push("Cracking on pressure boundary -> API 579-1 Part 9 crack assessment required");
    }

    if (hasSourCracking) {
      var hasNace = authorities.some(function(a) { return a.code.indexOf("NACE") >= 0 || a.code.indexOf("ISO 15156") >= 0; });
      if (!hasNace) {
        authorities.push({ code: "NACE MR0175/ISO 15156", title: "Materials for Use in H2S-Containing Environments", role: "material_suitability", locked: true });
        lockReasons.push("Sour cracking mechanism detected -> NACE MR0175/ISO 15156 locked");
      }
    }

    if (wallLossPercent > 20 && isPressureBoundary) {
      supplementalCodes.push({ code: "ASME B31G", title: "Manual for Determining the Remaining Strength of Corroded Pipelines", role: "remaining_strength", locked: true });
      supplementalCodes.push({ code: "Modified B31G (RSTRENG)", title: "Modified Criterion for Evaluating Corroded Pipe", role: "remaining_strength", locked: true });
      lockReasons.push("Wall loss " + wallLossPercent.toFixed(1) + "% > 20% threshold -> B31G remaining strength calculation required");
      triggerB31G = true;
    }

    if (hasCorrosion && isPressureBoundary) {
      supplementalCodes.push({ code: "API 579-1 Part 4", title: "Assessment of General Metal Loss", role: "general_metal_loss", locked: true });
      supplementalCodes.push({ code: "API 579-1 Part 5", title: "Assessment of Local Metal Loss", role: "local_metal_loss", locked: true });
      lockReasons.push("Corrosion on pressure boundary -> API 579-1 Part 4/5 metal loss assessment");
    }

    // RESOLVE STATUS
    var status = "UNRESOLVED";
    var confidence = "none";

    if (authorities.length > 0) {
      status = "LOCKED";
      confidence = "deterministic";
    } else if (asset && asset.length > 0) {
      status = "PARTIAL";
      confidence = "low";
      lockReasons.push("Asset type '" + asset + "' not in authority matrix - manual code assignment required");
    } else {
      status = "UNRESOLVED";
      confidence = "none";
      lockReasons.push("No asset type provided - cannot resolve authority");
    }

    var allCodes = authorities.concat(supplementalCodes);
    var codeList = allCodes.map(function(c) { return c.code; });

    var result = {
      status: status,
      confidence: confidence,
      authority_chain: authorities,
      supplemental_codes: supplementalCodes,
      all_codes: codeList,
      lock_reasons: lockReasons,
      trigger_b31g: triggerB31G,
      trigger_crack_assessment: hasCrackingMechanism && isPressureBoundary,
      trigger_sour_service: hasSourCracking,
      metadata: {
        engine: "authority-lock",
        version: "1.0",
        asset_type: asset,
        service_environment: service,
        damage_mechanisms: damage,
        jurisdiction: jurisdiction,
        wall_loss_percent: wallLossPercent,
        is_pressure_boundary: isPressureBoundary,
        timestamp: new Date().toISOString()
      }
    };

    return { statusCode: 200, headers: headers, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: "Authority lock engine error: " + (err.message || String(err)) }) };
  }
};

module.exports = { handler: handler };
