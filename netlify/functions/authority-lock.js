// AUTHORITY LOCK ENGINE v1.1
// File: netlify/functions/authority-lock.js
// NO TYPESCRIPT — PURE JAVASCRIPT
// v1.1 — Component-type discriminator: resolves authority by COMPONENT TYPE,
//         not just asset location. An offshore platform can have piping (API 570),
//         vessels (API 510), and structural steel (API RP 2A) — the component
//         being assessed determines the primary authority, not the facility.

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
    var component = (body.component_type || "").toLowerCase().trim();
    var service = (body.service_environment || "").toLowerCase().trim();
    var damage = (body.damage_mechanisms || []).map(function(d) { return (d || "").toLowerCase().trim(); });
    var jurisdiction = (body.jurisdiction || "").toLowerCase().trim();
    var wallLossPercent = body.wall_loss_percent || 0;
    var hasCracking = body.has_cracking || false;
    var isPressureBoundary = body.is_pressure_boundary !== false;
    var componentDescription = (body.component_description || "").toLowerCase().trim();

    var authorities = [];
    var lockReasons = [];
    var supplementalCodes = [];
    var triggerB31G = false;

    // ============================================================
    // COMPONENT-TYPE DISCRIMINATOR (v1.1)
    // When a component_type is provided OR can be inferred from the
    // component_description, it OVERRIDES the asset_type for primary
    // authority selection. The asset_type still provides facility-level
    // overlay (regulatory jurisdiction, environmental factors).
    // ============================================================
    var resolvedComponentType = component;

    // Auto-detect component type from description if not explicitly provided
    if (!resolvedComponentType && componentDescription) {
      if (componentDescription.indexOf("header") >= 0 || componentDescription.indexOf("piping") >= 0 ||
          componentDescription.indexOf("pipe") >= 0 || componentDescription.indexOf("pipeline") >= 0 ||
          componentDescription.indexOf("riser") >= 0 || componentDescription.indexOf("flowline") >= 0 ||
          componentDescription.indexOf("manifold") >= 0 || componentDescription.indexOf("spool") >= 0 ||
          componentDescription.indexOf("branch connection") >= 0 || componentDescription.indexOf("nozzle") >= 0 ||
          componentDescription.indexOf("weldolet") >= 0) {
        resolvedComponentType = "piping";
      } else if (componentDescription.indexOf("vessel") >= 0 || componentDescription.indexOf("separator") >= 0 ||
                 componentDescription.indexOf("drum") >= 0 || componentDescription.indexOf("reactor") >= 0 ||
                 componentDescription.indexOf("column") >= 0 || componentDescription.indexOf("tower") >= 0 ||
                 componentDescription.indexOf("accumulator") >= 0 || componentDescription.indexOf("receiver") >= 0) {
        resolvedComponentType = "pressure_vessel";
      } else if (componentDescription.indexOf("exchanger") >= 0 || componentDescription.indexOf("cooler") >= 0 ||
                 componentDescription.indexOf("condenser") >= 0 || componentDescription.indexOf("reboiler") >= 0) {
        resolvedComponentType = "heat_exchanger";
      } else if (componentDescription.indexOf("tank") >= 0) {
        resolvedComponentType = "storage_tank";
      } else if (componentDescription.indexOf("structural") >= 0 || componentDescription.indexOf("beam") >= 0 ||
                 componentDescription.indexOf("brace") >= 0 || componentDescription.indexOf("jacket") >= 0 ||
                 componentDescription.indexOf("deck plate") >= 0 || componentDescription.indexOf("truss") >= 0 ||
                 componentDescription.indexOf("framing") >= 0) {
        resolvedComponentType = "structural";
      } else if (componentDescription.indexOf("valve") >= 0 || componentDescription.indexOf("relief") >= 0 ||
                 componentDescription.indexOf("psv") >= 0 || componentDescription.indexOf("prv") >= 0) {
        resolvedComponentType = "valve";
      } else if (componentDescription.indexOf("boiler") >= 0) {
        resolvedComponentType = "boiler";
      }
    }

    // Determine if this is a facility-type asset with components on it
    var isFacilityAsset = (asset === "offshore_platform" || asset === "offshore_fixed_platform" ||
                           asset === "offshore_floating" || asset === "refinery" ||
                           asset === "chemical_plant" || asset === "petrochemical" ||
                           asset === "power_plant" || asset === "production_facility" ||
                           asset === "fpso" || asset === "processing_platform");

    // Use component type for primary authority when available on facility assets
    var primaryRouteKey = asset;
    if (isFacilityAsset && resolvedComponentType) {
      primaryRouteKey = resolvedComponentType;
      lockReasons.push("Component type '" + resolvedComponentType + "' detected on facility '" + asset + "' — routing authority by component, not facility");
    }

    // Add facility-level regulatory overlay for offshore assets
    if (asset === "offshore_platform" || asset === "offshore_fixed_platform" ||
        asset === "offshore_floating" || asset === "fpso" || asset === "processing_platform") {
      supplementalCodes.push({ code: "BSEE 30 CFR Part 250", title: "Oil and Gas and Sulphur Operations in the Outer Continental Shelf", role: "regulatory_overlay", locked: false });
      supplementalCodes.push({ code: "USCG 33 CFR/46 CFR", title: "Coast Guard OCS Requirements", role: "regulatory_overlay", locked: false });
      lockReasons.push("Offshore asset -> BSEE/USCG regulatory overlay applied");
    }

    // PIPELINE
    if (primaryRouteKey === "pipeline" || primaryRouteKey === "transmission_pipeline" || primaryRouteKey === "gathering_line") {
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
    if (primaryRouteKey === "pressure_vessel" || primaryRouteKey === "vessel" || primaryRouteKey === "reactor" || primaryRouteKey === "drum" || primaryRouteKey === "heat_exchanger") {
      authorities.push({ code: "API 510", title: "Pressure Vessel Inspection Code", role: "inspection_authority", locked: true });
      lockReasons.push("Pressure vessel component -> API 510 inspection authority");
      authorities.push({ code: "ASME BPVC Section VIII", title: "Boiler and Pressure Vessel Code - Pressure Vessels", role: "primary_construction", locked: true });
      lockReasons.push("Pressure vessel -> ASME Section VIII construction code");
      authorities.push({ code: "API 579-1/ASME FFS-1", title: "Fitness-For-Service", role: "fitness_for_service", locked: true });
      lockReasons.push("Pressure vessel integrity -> API 579-1 FFS authority");
    }

    // PIPING
    if (primaryRouteKey === "piping" || primaryRouteKey === "process_piping" || primaryRouteKey === "plant_piping" ||
        primaryRouteKey === "header" || primaryRouteKey === "production_header" || primaryRouteKey === "flowline" ||
        primaryRouteKey === "riser" || primaryRouteKey === "manifold") {
      authorities.push({ code: "API 570", title: "Piping Inspection Code", role: "inspection_authority", locked: true });
      lockReasons.push("Piping component -> API 570 inspection authority");
      authorities.push({ code: "ASME B31.3", title: "Process Piping", role: "primary_construction", locked: true });
      lockReasons.push("Process piping -> ASME B31.3 construction/design code");
      authorities.push({ code: "API 579-1/ASME FFS-1", title: "Fitness-For-Service", role: "fitness_for_service", locked: true });
      lockReasons.push("Piping integrity -> API 579-1 FFS authority");

      // API 571 for damage mechanism identification on all piping
      supplementalCodes.push({ code: "API 571", title: "Damage Mechanisms Affecting Fixed Equipment in the Refining Industry", role: "damage_mechanism_reference", locked: false });

      // ASME Section V for NDE method authority
      supplementalCodes.push({ code: "ASME BPVC Section V", title: "Nondestructive Examination", role: "nde_method_authority", locked: false });

      if (jurisdiction === "refinery" || jurisdiction === "petrochemical" || jurisdiction === "chemical_plant" ||
          isFacilityAsset) {
        supplementalCodes.push({ code: "API 574", title: "Inspection Practices for Piping System Components", role: "supplemental_inspection", locked: false });
      }
    }

    // VALVE / RELIEF DEVICE (on facility)
    if (primaryRouteKey === "valve" || primaryRouteKey === "relief_device") {
      authorities.push({ code: "API 570", title: "Piping Inspection Code", role: "inspection_authority", locked: true });
      lockReasons.push("Valve/relief device -> API 570 inspection authority (in-line component)");
      authorities.push({ code: "API 576", title: "Inspection of Pressure-Relieving Devices", role: "supplemental_inspection", locked: true });
      lockReasons.push("Pressure-relieving device -> API 576 supplemental authority");
      authorities.push({ code: "API 579-1/ASME FFS-1", title: "Fitness-For-Service", role: "fitness_for_service", locked: true });
    }

    // STORAGE TANK
    if (primaryRouteKey === "storage_tank" || primaryRouteKey === "tank" || primaryRouteKey === "aboveground_storage_tank" || primaryRouteKey === "ast") {
      authorities.push({ code: "API 653", title: "Tank Inspection, Repair, Alteration, and Reconstruction", role: "inspection_authority", locked: true });
      lockReasons.push("Storage tank asset -> API 653 inspection authority");
      authorities.push({ code: "API 650", title: "Welded Tanks for Oil Storage", role: "primary_construction", locked: true });
      lockReasons.push("Storage tank -> API 650 construction code");
    }

    // BOILER
    if (primaryRouteKey === "boiler" || primaryRouteKey === "power_boiler" || primaryRouteKey === "heating_boiler") {
      authorities.push({ code: "NB-23 (NBIC)", title: "National Board Inspection Code", role: "inspection_authority", locked: true });
      lockReasons.push("Boiler asset -> NBIC inspection authority");
      authorities.push({ code: "ASME BPVC Section I", title: "Boiler and Pressure Vessel Code - Power Boilers", role: "primary_construction", locked: true });
      lockReasons.push("Boiler -> ASME Section I construction code");
    }

    // STRUCTURAL (only when the component itself is structural steel)
    if (primaryRouteKey === "structural" || primaryRouteKey === "structural_steel" || primaryRouteKey === "bridge" || primaryRouteKey === "offshore_structure") {
      authorities.push({ code: "AWS D1.1", title: "Structural Welding Code - Steel", role: "primary_construction", locked: true });
      lockReasons.push("Structural steel component -> AWS D1.1 construction/inspection authority");
      if (primaryRouteKey === "offshore_structure" || asset === "offshore_platform" || asset === "offshore_fixed_platform") {
        authorities.push({ code: "API RP 2A", title: "Planning, Designing, and Constructing Fixed Offshore Platforms", role: "design_authority", locked: true });
        lockReasons.push("Offshore structural component -> API RP 2A design authority");
      }
    }

    // OFFSHORE PLATFORM WITH NO COMPONENT TYPE — FALLBACK WITH WARNING
    // If an offshore platform asset is provided with NO identifiable component type,
    // default to API RP 2A but flag that component-level resolution is needed
    if (isFacilityAsset && !resolvedComponentType && authorities.length === 0) {
      if (asset === "offshore_platform" || asset === "offshore_fixed_platform") {
        authorities.push({ code: "API RP 2A", title: "Planning, Designing, and Constructing Fixed Offshore Platforms", role: "facility_default", locked: false });
        lockReasons.push("WARNING: Offshore platform asset with no component type specified — defaulting to API RP 2A facility-level authority. Provide component_type or component_description for accurate authority resolution (piping->API 570, vessel->API 510, structural->API RP 2A)");
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
        version: "1.1",
        asset_type: asset,
        component_type: resolvedComponentType || null,
        component_type_source: component ? "explicit" : (resolvedComponentType ? "inferred_from_description" : "none"),
        primary_route_key: primaryRouteKey,
        is_facility_asset: isFacilityAsset,
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