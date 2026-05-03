// AUTHORITY LOCK ENGINE v1.2
// File: netlify/functions/authority-lock.js
// NO TYPESCRIPT — PURE JAVASCRIPT
// v1.2 — GPT enterprise audit fixes:
//         - Bridge assets → AWS D1.5 primary (not D1.1 refined downstream)
//         - Nuclear domain → ASME Section XI primary (API suppressed)
//         - Composite → ASTM/OEM-directed NDE redirect (not just PARTIAL)
//         - Rail → AAR/AREMA redirect (not just PARTIAL)
//         - Component-type discriminator retained from v1.1

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

    // ============================================================
    // DOMAIN DETECTION (v1.2)
    // Detect specialty domains BEFORE facility routing.
    // Nuclear, bridge, aerospace, rail, composite each have
    // domain-specific primary authorities that override generic routing.
    // ============================================================
    var isNuclearDomain = (asset === "nuclear" || asset === "nuclear_plant" || asset === "nuclear_facility" ||
                           jurisdiction.indexOf("nuclear") >= 0 || jurisdiction.indexOf("nrc") >= 0 ||
                           componentDescription.indexOf("nuclear") >= 0 || componentDescription.indexOf("safety-related") >= 0 ||
                           componentDescription.indexOf("safety related") >= 0 || componentDescription.indexOf("asme xi") >= 0 ||
                           componentDescription.indexOf("section xi") >= 0);

    var isBridgeDomain = (asset === "bridge" || asset === "highway_bridge" || asset === "railway_bridge" ||
                          componentDescription.indexOf("bridge") >= 0 || componentDescription.indexOf("highway") >= 0 ||
                          componentDescription.indexOf("aashto") >= 0);

    var isAerospaceDomain = (asset === "aerospace" || asset === "aircraft" || asset === "aviation" ||
                             componentDescription.indexOf("aerospace") >= 0 || componentDescription.indexOf("aircraft") >= 0 ||
                             componentDescription.indexOf("aviation") >= 0 || componentDescription.indexOf("d17.1") >= 0);

    var isRailDomain = (asset === "rail" || asset === "railroad" || asset === "railway" ||
                        componentDescription.indexOf("rail") >= 0 || componentDescription.indexOf("axle") >= 0 ||
                        componentDescription.indexOf("railcar") >= 0 || componentDescription.indexOf("locomotive") >= 0 ||
                        componentDescription.indexOf("wheel") >= 0);

    var isCompositeDomain = (asset === "composite" || asset === "frp" || asset === "cfrp" || asset === "gfrp" ||
                             componentDescription.indexOf("composite") >= 0 || componentDescription.indexOf("carbon fiber") >= 0 ||
                             componentDescription.indexOf("fiberglass") >= 0 || componentDescription.indexOf("frp") >= 0 ||
                             componentDescription.indexOf("laminate") >= 0 || componentDescription.indexOf("non-metallic") >= 0 ||
                             componentDescription.indexOf("delamination") >= 0);

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

    // ============================================================
    // SPECIALTY DOMAIN OVERRIDES (v1.2)
    // These domains have unique primary authorities that take
    // precedence over generic component-type routing.
    // The governing code must be correct AT THE DECISION POINT,
    // not "refined downstream" — per audit requirements.
    // ============================================================

    // NUCLEAR — ASME Section XI dominates; API becomes secondary
    if (isNuclearDomain) {
      authorities.push({ code: "ASME BPVC Section XI", title: "Rules for Inservice Inspection of Nuclear Power Plant Components", role: "primary_inspection", locked: true });
      lockReasons.push("Nuclear domain detected -> ASME Section XI is primary inspection authority (overrides API framework)");
      authorities.push({ code: "ASME BPVC Section V", title: "Nondestructive Examination", role: "nde_method_authority", locked: true });
      lockReasons.push("Nuclear NDE -> ASME Section V mandatory");
      authorities.push({ code: "ASME BPVC Section IX", title: "Welding, Brazing, and Fusing Qualifications", role: "welding_qualification", locked: true });
      lockReasons.push("Nuclear welding -> ASME Section IX qualification required");
      supplementalCodes.push({ code: "10 CFR 50 / NRC", title: "Nuclear Regulatory Commission Requirements", role: "regulatory_overlay", locked: true });
      supplementalCodes.push({ code: "Owner Nuclear Program", title: "Owner/Licensee Quality Assurance Program", role: "program_authority", locked: true });
      lockReasons.push("Nuclear regulatory -> 10 CFR 50 / NRC + Owner QA program overlay");

      // Add construction code based on component type (secondary to Section XI)
      if (resolvedComponentType === "piping" || componentDescription.indexOf("piping") >= 0 || componentDescription.indexOf("pipe") >= 0) {
        supplementalCodes.push({ code: "ASME B31.1", title: "Power Piping (nuclear-class piping reference)", role: "construction_reference", locked: false });
      }
      if (resolvedComponentType === "vessel" || resolvedComponentType === "pressure_vessel") {
        supplementalCodes.push({ code: "ASME BPVC Section III", title: "Rules for Construction of Nuclear Facility Components", role: "construction_reference", locked: false });
      }
    }

    // BRIDGE — AWS D1.5 primary (NOT D1.1 refined later)
    if (isBridgeDomain && !isNuclearDomain) {
      authorities.push({ code: "AWS D1.5", title: "Bridge Welding Code", role: "primary_construction", locked: true });
      lockReasons.push("Bridge domain detected -> AWS D1.5 is primary authority (not generic D1.1)");
      supplementalCodes.push({ code: "AASHTO", title: "AASHTO Bridge Design/Inspection Standards", role: "owner_requirements", locked: false });
      lockReasons.push("Bridge -> AASHTO owner requirements overlay");
      supplementalCodes.push({ code: "ASME BPVC Section V", title: "Nondestructive Examination", role: "nde_method_authority", locked: false });
    }

    // AEROSPACE — AWS D17.1 primary
    if (isAerospaceDomain && !isNuclearDomain) {
      authorities.push({ code: "AWS D17.1", title: "Specification for Fusion Welding for Aerospace Applications", role: "primary_construction", locked: true });
      lockReasons.push("Aerospace domain detected -> AWS D17.1 primary authority");
      supplementalCodes.push({ code: "Customer Aerospace Procedure", title: "OEM/Customer Specific Welding and NDE Procedure", role: "program_authority", locked: true });
      lockReasons.push("Aerospace -> OEM/customer procedure required (no generic acceptance)");
    }

    // RAIL — AAR/AREMA primary
    if (isRailDomain && !isNuclearDomain) {
      authorities.push({ code: "AAR/AREMA Standards", title: "Association of American Railroads / American Railway Engineering and Maintenance-of-Way Association", role: "primary_inspection", locked: true });
      lockReasons.push("Rail domain detected -> AAR/AREMA primary inspection authority");
      supplementalCodes.push({ code: "FRA 49 CFR Part 213/238", title: "Federal Railroad Administration Safety Standards", role: "regulatory_overlay", locked: true });
      lockReasons.push("Rail regulatory -> FRA safety standards overlay");
      supplementalCodes.push({ code: "ASME BPVC Section V", title: "Nondestructive Examination", role: "nde_method_authority", locked: false });
    }

    // COMPOSITE / NON-METALLIC — ASTM + OEM-directed NDE
    if (isCompositeDomain && !isNuclearDomain) {
      authorities.push({ code: "ASTM D7136/D7137", title: "ASTM Composite Damage Tolerance Standards", role: "primary_inspection", locked: true });
      lockReasons.push("Composite domain detected -> ASTM composite standards primary authority");
      authorities.push({ code: "OEM Procedure Required", title: "Original Equipment Manufacturer Inspection/Acceptance Procedure", role: "program_authority", locked: true });
      lockReasons.push("Composite -> OEM procedure required for acceptance criteria");
      supplementalCodes.push({ code: "ASTM E2580/E2582", title: "ASTM Ultrasonic Examination of Composites", role: "nde_method_authority", locked: false });
      supplementalCodes.push({ code: "Physics-Based NDE", title: "UT C-scan, Thermography, Shearography (metallic corrosion logic suppressed)", role: "method_redirect", locked: true });
      lockReasons.push("Composite -> metallic corrosion logic SUPPRESSED; physics-based NDE methods required");
    }

    // ============================================================
    // STANDARD DOMAIN ROUTING (skip if specialty domain already resolved)
    // ============================================================
    var specialtyDomainResolved = isNuclearDomain || isBridgeDomain || isAerospaceDomain || isRailDomain || isCompositeDomain;

    // PIPELINE
    if (!specialtyDomainResolved && (primaryRouteKey === "pipeline" || primaryRouteKey === "transmission_pipeline" || primaryRouteKey === "gathering_line")) {
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
    if (!specialtyDomainResolved && (primaryRouteKey === "pressure_vessel" || primaryRouteKey === "vessel" || primaryRouteKey === "reactor" || primaryRouteKey === "drum" || primaryRouteKey === "heat_exchanger")) {
      authorities.push({ code: "API 510", title: "Pressure Vessel Inspection Code", role: "inspection_authority", locked: true });
      lockReasons.push("Pressure vessel component -> API 510 inspection authority");
      authorities.push({ code: "ASME BPVC Section VIII", title: "Boiler and Pressure Vessel Code - Pressure Vessels", role: "primary_construction", locked: true });
      lockReasons.push("Pressure vessel -> ASME Section VIII construction code");
      authorities.push({ code: "API 579-1/ASME FFS-1", title: "Fitness-For-Service", role: "fitness_for_service", locked: true });
      lockReasons.push("Pressure vessel integrity -> API 579-1 FFS authority");
    }

    // PIPING
    if (!specialtyDomainResolved && (primaryRouteKey === "piping" || primaryRouteKey === "process_piping" || primaryRouteKey === "plant_piping" ||
        primaryRouteKey === "header" || primaryRouteKey === "production_header" || primaryRouteKey === "flowline" ||
        primaryRouteKey === "riser" || primaryRouteKey === "manifold")) {
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
    if (!specialtyDomainResolved && (primaryRouteKey === "valve" || primaryRouteKey === "relief_device")) {
      authorities.push({ code: "API 570", title: "Piping Inspection Code", role: "inspection_authority", locked: true });
      lockReasons.push("Valve/relief device -> API 570 inspection authority (in-line component)");
      authorities.push({ code: "API 576", title: "Inspection of Pressure-Relieving Devices", role: "supplemental_inspection", locked: true });
      lockReasons.push("Pressure-relieving device -> API 576 supplemental authority");
      authorities.push({ code: "API 579-1/ASME FFS-1", title: "Fitness-For-Service", role: "fitness_for_service", locked: true });
    }

    // STORAGE TANK
    if (!specialtyDomainResolved && (primaryRouteKey === "storage_tank" || primaryRouteKey === "tank" || primaryRouteKey === "aboveground_storage_tank" || primaryRouteKey === "ast")) {
      authorities.push({ code: "API 653", title: "Tank Inspection, Repair, Alteration, and Reconstruction", role: "inspection_authority", locked: true });
      lockReasons.push("Storage tank asset -> API 653 inspection authority");
      authorities.push({ code: "API 650", title: "Welded Tanks for Oil Storage", role: "primary_construction", locked: true });
      lockReasons.push("Storage tank -> API 650 construction code");
    }

    // BOILER
    if (!specialtyDomainResolved && (primaryRouteKey === "boiler" || primaryRouteKey === "power_boiler" || primaryRouteKey === "heating_boiler")) {
      authorities.push({ code: "NB-23 (NBIC)", title: "National Board Inspection Code", role: "inspection_authority", locked: true });
      lockReasons.push("Boiler asset -> NBIC inspection authority");
      authorities.push({ code: "ASME BPVC Section I", title: "Boiler and Pressure Vessel Code - Power Boilers", role: "primary_construction", locked: true });
      lockReasons.push("Boiler -> ASME Section I construction code");
    }

    // STRUCTURAL (only when the component itself is structural steel — bridge handled above in specialty domains)
    if (!specialtyDomainResolved && (primaryRouteKey === "structural" || primaryRouteKey === "structural_steel" || primaryRouteKey === "offshore_structure")) {
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
          mech.indexOf("sohic") >= 0 || mech.indexOf("sour") >= 0 ||
          mech === "hydrogen_induced_cracking" || mech === "sulfide_stress_cracking") {
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

    // SERVICE ENVIRONMENT CHECK: sour/H2S service always requires NACE regardless of asset type
    var isSourService = service.indexOf("sour") >= 0 || service.indexOf("h2s") >= 0 || service.indexOf("hydrogen sulfide") >= 0;

    if (hasSourCracking || isSourService) {
      var hasNace = authorities.some(function(a) { return a.code.indexOf("NACE") >= 0 || a.code.indexOf("ISO 15156") >= 0; });
      if (!hasNace) {
        authorities.push({ code: "NACE MR0175/ISO 15156", title: "Materials for Use in H2S-Containing Environments", role: "material_suitability", locked: true });
        lockReasons.push(hasSourCracking
          ? "Sour cracking mechanism detected -> NACE MR0175/ISO 15156 locked"
          : "Sour/H2S service environment -> NACE MR0175/ISO 15156 locked");
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
        version: "1.2",
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