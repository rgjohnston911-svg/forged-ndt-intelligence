// AUTHORITY LOCK ENGINE v1.3
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
    // DEPLOY458 CP3 commit 2: the SINGLE mechanism-evidence verdict (transcript-only, shared
    // module). component_description carries the raw transcript (frontend raw_text / eval c.transcript).
    // ASSET-CLASS locks (API 510 / B31.3 / general API 579 FFS authority) are UNCHANGED and still fire
    // from the asset/component type. MECHANISM-TRIGGERED locks (Part 9 crack, NACE sour, Part 4/5 metal
    // loss) now fire ONLY on this evidence verdict - never on inferred has_cracking / sour-from-hydrogen.
    var mev = require("./_mechanism-evidence.cjs").buildMechanismVerdict(body.component_description || "");

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
          componentDescription.indexOf("weldolet") >= 0 ||
          componentDescription.indexOf("loading line") >= 0 || componentDescription.indexOf("transfer line") >= 0 ||
          componentDescription.indexOf("export line") >= 0 || componentDescription.indexOf("jetty line") >= 0 ||
          componentDescription.indexOf("transfer piping") >= 0 || componentDescription.indexOf("loading arm") >= 0) {
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

    // Rail detection: use specific terms to avoid false positives
    // "wheel" alone triggers on "wheel valve" (piping); "rail" alone triggers on "handrail"/"guardrail"
    // Safe terms: railcar, railroad, railway, locomotive, railwheel, wheelset, rail axle, train axle
    var isRailDomain = (asset === "rail" || asset === "railroad" || asset === "railway" ||
                        componentDescription.indexOf("railcar") >= 0 || componentDescription.indexOf("locomotive") >= 0 ||
                        componentDescription.indexOf("railroad") >= 0 || componentDescription.indexOf("railway") >= 0 ||
                        componentDescription.indexOf("railwheel") >= 0 || componentDescription.indexOf("wheelset") >= 0 ||
                        componentDescription.indexOf("rail axle") >= 0 || componentDescription.indexOf("train axle") >= 0 ||
                        componentDescription.indexOf("rail weld") >= 0 || componentDescription.indexOf("rail joint") >= 0);

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

    // DEPLOY427: SERVED-EQUIPMENT TRAP. An exchanger/cooler asset whose described
    // component is explicitly PIPING ("Reactor effluent air cooler INLET PIPING")
    // must route by the piping component (API 570 / ASME B31.3), not the served
    // exchanger (API 510 / Section VIII). The reactor/cooler words name the
    // equipment the piping serves. Scoped to exchanger/cooler asset classes so
    // pressure vessels with nozzle piping are unaffected.
    if (resolvedComponentType === "piping" && componentDescription.indexOf("piping") >= 0 &&
        (asset === "heat_exchanger" || asset === "air_cooler" || asset === "cooler" ||
         asset === "exchanger" || asset === "reac" || asset === "fin_fan")) {
      primaryRouteKey = "piping";
      lockReasons.push("Served-equipment trap: explicit piping component overrides '" + asset + "' asset_type -> piping authority (API 570 / B31.3)");
    }

    // DEPLOY432: LNG / MARINE TRANSFER & LOADING LINE TRAP. A loading/transfer/export
    // line (and the articulated marine loading arm it feeds) is PIPING governed by
    // API 570 / ASME B31.3 (+ DNV / SIGTTO for LNG marine transfer) -- NOT a pressure
    // vessel. These line terms are unambiguously piping, so override a vessel / tank /
    // facility-equipment classification. (Does not touch "nozzle piping on a vessel".)
    if ((componentDescription.indexOf("loading line") >= 0 || componentDescription.indexOf("transfer line") >= 0 ||
         componentDescription.indexOf("export line") >= 0 || componentDescription.indexOf("jetty line") >= 0 ||
         componentDescription.indexOf("transfer piping") >= 0 || componentDescription.indexOf("loading arm") >= 0) &&
        (primaryRouteKey === "pressure_vessel" || primaryRouteKey === "vessel" || primaryRouteKey === "tank" ||
         primaryRouteKey === "storage_tank" || primaryRouteKey === "heat_exchanger" || primaryRouteKey === "reactor" ||
         primaryRouteKey === "drum" || primaryRouteKey === "" || isFacilityAsset)) {
      primaryRouteKey = "piping";
      lockReasons.push("LNG/marine transfer or loading line -> piping authority (API 570 / ASME B31.3; DNV/SIGTTO apply for LNG marine transfer); vessel/facility classification overridden");
    }

    // Add facility-level regulatory overlay for offshore assets
    if (asset === "offshore_platform" || asset === "offshore_fixed_platform" ||
        asset === "offshore_floating" || asset === "fpso" || asset === "processing_platform") {
      supplementalCodes.push({ code: "BSEE 30 CFR Part 250", title: "Oil and Gas and Sulphur Operations in the Outer Continental Shelf", role: "regulatory_overlay", locked: false });
      supplementalCodes.push({ code: "USCG 33 CFR/46 CFR", title: "Coast Guard OCS Requirements", role: "regulatory_overlay", locked: false });
      lockReasons.push("Offshore asset -> BSEE/USCG regulatory overlay applied");
    }

    // DEPLOY464 - FUNCTIONAL SAFETY asset class. A protective function (SIS / ESD / SIF / BMS / HIPPS)
    // is governed by FUNCTIONAL-SAFETY authority, not pressure-boundary FFS. Locking IEC 61511 makes
    // the class in-matrix so it passes the Asset Identity Gate and routes correctly (instead of
    // mis-routing to API 510 / AASHTO). CITE + ESCALATE ONLY: the platform names IEC 61511 / ISA 84 /
    // OSHA PSM and escalates to a functional safety engineer; it does NOT compute SIL or run LOPA.
    if (asset === "functional_safety") {
      authorities.push({ code: "IEC 61511", title: "Functional Safety - Safety Instrumented Systems for the Process Industry Sector", role: "primary_inspection", locked: true });
      authorities.push({ code: "ISA 84 (ANSI/ISA 61511)", title: "Safety Instrumented Systems for the Process Industries", role: "primary_construction", locked: true });
      supplementalCodes.push({ code: "OSHA PSM 29 CFR 1910.119", title: "Process Safety Management of Highly Hazardous Chemicals (incl. Management of Change)", role: "regulatory_overlay", locked: true });
      lockReasons.push("Functional-safety asset (protective function) -> IEC 61511 / ISA 84 functional-safety authority + OSHA PSM. Recognize and escalate to a functional safety engineer; the platform cites these - it does not compute SIL or run LOPA.");
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

    // HYBRID COMPOSITE/METAL — truly OOD, cannot lock into standard composite or metallic codes alone
    var isHybridComposite = isCompositeDomain && (asset.indexOf("hybrid") >= 0 || componentDescription.indexOf("hybrid") >= 0 ||
                            (componentDescription.indexOf("metal") >= 0 && componentDescription.indexOf("composite") >= 0));

    // COMPOSITE / NON-METALLIC — ASTM + OEM-directed NDE
    if (isCompositeDomain && !isNuclearDomain && !isHybridComposite) {
      authorities.push({ code: "ASTM D7136/D7137", title: "ASTM Composite Damage Tolerance Standards", role: "primary_inspection", locked: true });
      lockReasons.push("Composite domain detected -> ASTM composite standards primary authority");
      authorities.push({ code: "OEM Procedure Required", title: "Original Equipment Manufacturer Inspection/Acceptance Procedure", role: "program_authority", locked: true });
      lockReasons.push("Composite -> OEM procedure required for acceptance criteria");
      supplementalCodes.push({ code: "ASTM E2580/E2582", title: "ASTM Ultrasonic Examination of Composites", role: "nde_method_authority", locked: false });
      supplementalCodes.push({ code: "Physics-Based NDE", title: "UT C-scan, Thermography, Shearography (metallic corrosion logic suppressed)", role: "method_redirect", locked: true });
      lockReasons.push("Composite -> metallic corrosion logic SUPPRESSED; physics-based NDE methods required");
    }

    // HYBRID COMPOSITE/METAL — OOD: neither pure composite nor pure metallic codes suffice
    if (isHybridComposite && !isNuclearDomain) {
      lockReasons.push("Hybrid composite/metal material detected - standard composite and metallic codes insufficient - specialist assessment required");
    }

    // ============================================================
    // STANDARD DOMAIN ROUTING (skip if specialty domain already resolved)
    // ============================================================
    var specialtyDomainResolved = isNuclearDomain || isBridgeDomain || isAerospaceDomain || isRailDomain || (isCompositeDomain && !isHybridComposite);

    // PIPELINE
    if (!specialtyDomainResolved && (primaryRouteKey === "pipeline" || primaryRouteKey === "transmission_pipeline" || primaryRouteKey === "gathering_line")) {
      authorities.push({ code: "ASME B31.8", title: "Gas Transmission and Distribution Piping Systems", role: "primary_construction", locked: true });
      lockReasons.push("Pipeline asset -> ASME B31.8 primary authority");

      if (service.indexOf("liquid") >= 0 || service.indexOf("oil") >= 0 || service.indexOf("crude") >= 0) {
        authorities.push({ code: "ASME B31.4", title: "Pipeline Transportation Systems for Liquids and Slurries", role: "primary_construction", locked: true });
        lockReasons.push("Liquid/crude service -> ASME B31.4 co-authority");
      }

      if (mev.sour_service) {
        authorities.push({ code: "NACE MR0175/ISO 15156", title: "Materials for Use in H2S-Containing Environments", role: "material_suitability", locked: true });
        lockReasons.push("H2S/sour service evidence present -> NACE MR0175/ISO 15156 material authority locked");
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
          mech.indexOf("sohic") >= 0 || /(?:^|_)sour(?:_|$)/.test(mech) ||
          mech === "hydrogen_induced_cracking" || mech === "sulfide_stress_cracking") {
        hasSourCracking = true;
      }
      if (mech.indexOf("corrosion") >= 0 || mech.indexOf("wall_loss") >= 0 || mech.indexOf("pitting") >= 0 ||
          mech.indexOf("erosion") >= 0 || /(?:^|_)mic(?:_|$)/.test(mech) || mech.indexOf("co2") >= 0) {
        hasCorrosion = true;
      }
    });

    if (mev.confirmed === "cracking" && isPressureBoundary) {
      var hasApi579 = authorities.some(function(a) { return a.code.indexOf("API 579") >= 0; });
      if (!hasApi579) {
        authorities.push({ code: "API 579-1/ASME FFS-1", title: "Fitness-For-Service", role: "fitness_for_service", locked: true });
      }
      supplementalCodes.push({ code: "API 579-1 Part 9", title: "Assessment of Crack-Like Flaws", role: "crack_assessment", locked: true });
      lockReasons.push("Confirmed crack-like indication (direct evidence: " + mev.confirmed_basis + ") on pressure boundary -> API 579-1 Part 9 crack assessment");
    }

    // NACE: H2S-containing environment. Gated on the evidence verdict's negation-aware sour flag -
    // fires on stated H2S/sour service, NEVER on hydrogen presence ("hydrogen-rich gas" is not sour;
    // "No H2S present" is not sour). This kills NACE-on-hydrogen (TEST 30/31).
    if (mev.sour_service) {
      var hasNace = authorities.some(function(a) { return a.code.indexOf("NACE") >= 0 || a.code.indexOf("ISO 15156") >= 0; });
      if (!hasNace) {
        authorities.push({ code: "NACE MR0175/ISO 15156", title: "Materials for Use in H2S-Containing Environments", role: "material_suitability", locked: true });
        lockReasons.push("H2S/sour service evidence present -> NACE MR0175/ISO 15156 material authority locked");
      }
    }

    if (wallLossPercent > 20 && isPressureBoundary) {
      supplementalCodes.push({ code: "ASME B31G", title: "Manual for Determining the Remaining Strength of Corroded Pipelines", role: "remaining_strength", locked: true });
      supplementalCodes.push({ code: "Modified B31G (RSTRENG)", title: "Modified Criterion for Evaluating Corroded Pipe", role: "remaining_strength", locked: true });
      lockReasons.push("Wall loss " + wallLossPercent.toFixed(1) + "% > 20% threshold -> B31G remaining strength calculation required");
      triggerB31G = true;
    }

    if (mev.confirmed === "corrosion" && isPressureBoundary) {
      supplementalCodes.push({ code: "API 579-1 Part 4", title: "Assessment of General Metal Loss", role: "general_metal_loss", locked: true });
      supplementalCodes.push({ code: "API 579-1 Part 5", title: "Assessment of Local Metal Loss", role: "local_metal_loss", locked: true });
      lockReasons.push("Confirmed metal loss (direct evidence: " + mev.confirmed_basis + ") on pressure boundary -> API 579-1 Part 4/5 metal loss assessment");
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

    // HYBRID COMPOSITE/METAL OVERRIDE: even if FFS codes were added by cracking/corrosion gates,
    // the hybrid material domain is genuinely OOD — no single code set fully covers it
    if (isHybridComposite && status === "LOCKED") {
      status = "PARTIAL";
      confidence = "low";
      lockReasons.push("Asset type '" + asset + "' not in authority matrix - manual code assignment required");
    }

    // ============================================================
    // GLOBAL CODE INTELLIGENCE — JURISDICTION AWARENESS (v1.3)
    // ============================================================
    // If jurisdiction is non-US and resolved codes are US-only, override to PARTIAL
    // Non-US jurisdictions have their own primary standards that must govern
    var JURISDICTION_MAP = {
      "canada": { codes: ["CSA Z662", "CSA B51", "CSA W59"], region: "Canada", note: "Canadian Standards Association primary; API supplemental only if adopted by owner" },
      "alberta": { codes: ["CSA Z662", "ABSA"], region: "Canada/Alberta", note: "Alberta Boilers Safety Association + CSA standards govern" },
      "germany": { codes: ["PED 2014/68/EU", "EN 13445", "AD 2000"], region: "EU/Germany", note: "Pressure Equipment Directive + EN harmonized standards" },
      "eu": { codes: ["PED 2014/68/EU", "EN 13445", "EN 12952"], region: "European Union", note: "PED + EN harmonized standards govern; ASME not primary" },
      "uk": { codes: ["BS EN 1090", "BS 7910", "PER 1999"], region: "United Kingdom", note: "BS EN Eurocodes + Pressure Equipment Regulations" },
      "australia": { codes: ["AS/NZS 3788", "AS 4458", "AS 2885"], region: "Australia/NZ", note: "Australian/NZ Standards govern" },
      "norway": { codes: ["NORSOK M-001", "NORSOK M-501", "DNV-OS-F101"], region: "Norway", note: "NORSOK standards + DNV rules govern offshore" },
      "brazil": { codes: ["NR-13", "ABNT NBR"], region: "Brazil", note: "NR-13 regulatory + ABNT national standards" },
      "japan": { codes: ["JIS B 8265", "METI High Pressure Gas Safety Act"], region: "Japan", note: "JIS standards + METI regulations" },
      "singapore": { codes: ["SS CP 79", "WSH Act"], region: "Singapore", note: "Singapore Standards + Workplace Safety regulations" },
      "middle_east": { codes: ["ARAMCO Standards", "ADNOC Standards"], region: "Middle East", note: "Owner/national standards often adopt API with modifications" },
      "korea": { codes: ["KGS FP 111", "KOSHA"], region: "South Korea", note: "Korean Gas Safety + occupational safety standards" },
      "india": { codes: ["IS 2825", "IBR 1950", "OISD Standards"], region: "India", note: "Indian Boiler Regulations + OISD for petroleum" }
    };

    // GLOBAL CODE CROSSWALK — maps US codes to foreign equivalents with differences
    var CROSSWALK = {
      "API 570": {
        "canada": { equivalent: "CSA Z662", equivalence_type: "PARTIAL", differences: ["Pipeline vs process piping scope differences", "CSA governs nationally", "Provincial adoption requirements apply"], usage_rule: "CSA_PRIMARY" },
        "norway": { equivalent: "NORSOK M-001", equivalence_type: "PARTIAL", differences: ["Inspection interval basis differs", "Qualification requirements differ", "Owner/operator integrity programs dominate", "Acceptance criteria may vary"], usage_rule: "SUPPLEMENTAL_ONLY" },
        "eu": { equivalent: "EN 13480", equivalence_type: "PARTIAL", differences: ["PED compliance required", "Harmonized standards structure", "Not directly interchangeable with API"], usage_rule: "NOT_PRIMARY" },
        "uk": { equivalent: "BS EN 13480 / PER 1999", equivalence_type: "PARTIAL", differences: ["Pressure Equipment Regulations govern", "BS EN standards primary", "AWS not recognized for structural"], usage_rule: "NOT_PRIMARY" },
        "australia": { equivalent: "AS/NZS 3788", equivalence_type: "PARTIAL", differences: ["Australian in-service inspection standard governs", "Different risk-based interval methodology"], usage_rule: "NOT_PRIMARY" }
      },
      "API 510": {
        "canada": { equivalent: "CSA B51", equivalence_type: "PARTIAL", differences: ["CSA B51 covers boilers and pressure vessels", "Provincial jurisdiction applies", "CRN (Canadian Registration Number) required"], usage_rule: "CSA_PRIMARY" },
        "norway": { equivalent: "NORSOK + EN 13445", equivalence_type: "PARTIAL", differences: ["EN 13445 for design/fabrication", "NORSOK for offshore integrity", "DNV rules may apply"], usage_rule: "NOT_PRIMARY" },
        "eu": { equivalent: "EN 13445 + PED", equivalence_type: "PARTIAL", differences: ["PED 2014/68/EU mandatory", "EN 13445 for unfired pressure vessels", "CE marking required", "Notified Body involvement"], usage_rule: "NOT_PRIMARY" },
        "australia": { equivalent: "AS 1210 + AS/NZS 3788", equivalence_type: "PARTIAL", differences: ["AS 1210 for design", "AS/NZS 3788 for in-service inspection", "State/territory WorkSafe requirements"], usage_rule: "NOT_PRIMARY" }
      },
      "ASME Section VIII": {
        "eu": { equivalent: "EN 13445", equivalence_type: "PARTIAL", differences: ["Different design methodology (DBA vs DBF)", "PED Essential Safety Requirements apply", "Material specifications differ (EN vs ASTM)", "Fabrication tolerances differ"], usage_rule: "NOT_PRIMARY" },
        "germany": { equivalent: "AD 2000 Merkblätter / EN 13445", equivalence_type: "PARTIAL", differences: ["AD 2000 historically used (being replaced by EN)", "TÜV involvement required", "German pressure vessel regulation (BetrSichV)"], usage_rule: "NOT_PRIMARY" },
        "japan": { equivalent: "JIS B 8265 / JIS B 8266", equivalence_type: "PARTIAL", differences: ["METI High Pressure Gas Safety Act governs", "Different design allowable stress basis", "Material equivalence not direct"], usage_rule: "NOT_PRIMARY" }
      },
      "AWS D1.1": {
        "uk": { equivalent: "BS EN 1090 / EN ISO 15614", equivalence_type: "PARTIAL", differences: ["EN ISO 15614 for procedure qualification", "EN ISO 9606 for welder qualification", "Execution class system (EXC1-4) replaces AWS categories", "CE marking for structural steel"], usage_rule: "NOT_PRIMARY" },
        "eu": { equivalent: "EN 1090 / EN ISO 15614", equivalence_type: "PARTIAL", differences: ["EN 1090 for structural steel execution", "EN ISO 3834 for quality requirements", "Different acceptance criteria structure"], usage_rule: "NOT_PRIMARY" },
        "australia": { equivalent: "AS/NZS 1554", equivalence_type: "PARTIAL", differences: ["AS/NZS 1554 for structural steel welding", "Different category system (SP vs GP)", "Australian welder qualification per AS/NZS ISO 9606"], usage_rule: "NOT_PRIMARY" }
      },
      "AWS D1.5": {
        "uk": { equivalent: "BS EN 1090 / EN 1993 (Eurocode 3)", equivalence_type: "PARTIAL", differences: ["EN 1090-2 for bridge execution class EXC3/EXC4", "EN 1993-2 for steel bridge design", "BS 7608 for fatigue of welded joints", "No direct AWS D1.5 equivalent — Eurocode system replaces"], usage_rule: "NOT_PRIMARY" },
        "eu": { equivalent: "EN 1090-2 / EN 1993-2", equivalence_type: "PARTIAL", differences: ["EN 1090-2 execution standard for bridges", "EN 1993-2 design of steel bridges", "Execution class EXC3/EXC4 required for bridges", "Different fatigue classification system"], usage_rule: "NOT_PRIMARY" },
        "australia": { equivalent: "AS 5100 / AS/NZS 1554.4", equivalence_type: "PARTIAL", differences: ["AS 5100 Bridge Design standard", "AS/NZS 1554.4 for structural steel welding (bridges)", "Different fatigue detail categories"], usage_rule: "NOT_PRIMARY" }
      },
      "API 1104": {
        "australia": { equivalent: "AS 2885", equivalence_type: "PARTIAL", differences: ["AS 2885 for pipeline systems", "Different ECA approach", "Australian pipeline licensing requirements"], usage_rule: "NOT_PRIMARY" },
        "canada": { equivalent: "CSA Z662", equivalence_type: "PARTIAL", differences: ["CSA Z662 comprehensive pipeline code", "Includes welding + inspection + integrity", "NEB/CER regulatory oversight"], usage_rule: "CSA_PRIMARY" },
        "norway": { equivalent: "DNV-OS-F101 / NORSOK M-001", equivalence_type: "PARTIAL", differences: ["DNV for submarine pipelines", "NORSOK for topsides piping", "Different defect acceptance criteria"], usage_rule: "NOT_PRIMARY" }
      }
    };

    var jurisdictionResolved = null;
    var jurisdictionMismatch = false;

    // US-equivalent jurisdictions: treat as domestic (no jurisdiction mismatch)
    var US_JURISDICTIONS = /^(us|usa|united_states|domestic|refinery|petrochemical|chemical_plant|offshore_gulf_of_mexico|gulf_of_mexico|offshore_us|alaska|hawaii|continental_us)$/;
    var isUSJurisdiction = !jurisdiction || US_JURISDICTIONS.test(jurisdiction) || jurisdiction.indexOf("offshore_gulf") >= 0 || jurisdiction.indexOf("us_") >= 0;

    if (jurisdiction && !isUSJurisdiction) {
      // Check if jurisdiction maps to a known non-US region
      var jKeys = Object.keys(JURISDICTION_MAP);
      for (var ji = 0; ji < jKeys.length; ji++) {
        if (jurisdiction.indexOf(jKeys[ji]) >= 0 || jKeys[ji].indexOf(jurisdiction) >= 0) {
          jurisdictionResolved = JURISDICTION_MAP[jKeys[ji]];
          break;
        }
      }

      if (jurisdictionResolved) {
        // Non-US jurisdiction detected — US codes cannot be primary authority
        jurisdictionMismatch = true;
        if (status === "LOCKED") {
          status = "PARTIAL";
          confidence = "low";
        }
        lockReasons.push("Jurisdiction: " + jurisdictionResolved.region + " — " + jurisdictionResolved.note);
        lockReasons.push("U.S. codes (API/ASME) not primary authority in " + jurisdictionResolved.region + " — local standards govern");
        // Add jurisdiction-appropriate codes as supplemental guidance
        jurisdictionResolved.codes.forEach(function(jc) {
          supplementalCodes.push({ code: jc, title: jurisdictionResolved.region + " applicable standard", role: "jurisdiction_primary", locked: true });
        });
      } else if (jurisdiction !== "" && !US_JURISDICTIONS.test(jurisdiction) && jurisdiction.indexOf("offshore_gulf") < 0 && jurisdiction.indexOf("us_") < 0) {
        // Unknown non-US jurisdiction — flag it
        jurisdictionMismatch = true;
        if (status === "LOCKED") {
          status = "PARTIAL";
          confidence = "low";
        }
        lockReasons.push("Jurisdiction '" + jurisdiction + "' specified — U.S. codes may not be primary authority; verify local standards");
      }
    }

    // If NO jurisdiction provided and no location context available — this is acceptable
    // (backward compatible: existing US-centric behavior preserved when jurisdiction is empty)

    var allCodes = authorities.concat(supplementalCodes);
    var codeList = allCodes.map(function(c) { return c.code; });

    // UNIT SYSTEM MAP — which measurement system each jurisdiction uses
    var UNIT_SYSTEM_MAP = {
      "us": { system: "Imperial", thickness: "inches", pressure: "psi", temperature: "°F", length: "feet", stress: "ksi", note: "US codes use Imperial (inches, psi, °F)" },
      "canada": { system: "Metric", thickness: "mm", pressure: "MPa", temperature: "°C", length: "m", stress: "MPa", note: "CSA codes use SI metric (mm, MPa, °C)" },
      "alberta": { system: "Metric", thickness: "mm", pressure: "MPa", temperature: "°C", length: "m", stress: "MPa", note: "Alberta uses SI metric per CSA" },
      "eu": { system: "Metric", thickness: "mm", pressure: "bar/MPa", temperature: "°C", length: "m", stress: "MPa", note: "EN standards use SI metric (mm, MPa/bar, °C)" },
      "germany": { system: "Metric", thickness: "mm", pressure: "bar", temperature: "°C", length: "m", stress: "N/mm²", note: "German standards use SI metric (mm, bar, °C)" },
      "uk": { system: "Metric", thickness: "mm", pressure: "bar/MPa", temperature: "°C", length: "m", stress: "MPa", note: "BS EN standards use SI metric (mm, MPa, °C)" },
      "australia": { system: "Metric", thickness: "mm", pressure: "MPa", temperature: "°C", length: "m", stress: "MPa", note: "AS/NZS standards use SI metric (mm, MPa, °C)" },
      "norway": { system: "Metric", thickness: "mm", pressure: "bar/MPa", temperature: "°C", length: "m", stress: "MPa", note: "NORSOK/DNV use SI metric (mm, MPa, °C)" },
      "brazil": { system: "Metric", thickness: "mm", pressure: "kgf/cm²/MPa", temperature: "°C", length: "m", stress: "MPa", note: "NR-13/ABNT use SI metric (mm, MPa, °C)" },
      "japan": { system: "Metric", thickness: "mm", pressure: "MPa", temperature: "°C", length: "m", stress: "MPa", note: "JIS standards use SI metric (mm, MPa, °C)" },
      "singapore": { system: "Metric", thickness: "mm", pressure: "bar", temperature: "°C", length: "m", stress: "MPa", note: "Singapore standards use SI metric" },
      "middle_east": { system: "Mixed", thickness: "mm/inches", pressure: "psi/bar", temperature: "°C/°F", length: "m/ft", stress: "MPa/ksi", note: "Middle East often mixes Imperial (API-adopted) and Metric — verify per owner specification" },
      "korea": { system: "Metric", thickness: "mm", pressure: "MPa", temperature: "°C", length: "m", stress: "MPa", note: "KGS/KOSHA use SI metric" },
      "india": { system: "Metric", thickness: "mm", pressure: "kg/cm²/MPa", temperature: "°C", length: "m", stress: "MPa", note: "IS/IBR standards use SI metric (mm, kg/cm², °C)" }
    };

    // UNIT CONVERSION CONSTANTS — Imperial ↔ Metric
    var UNIT_CONVERSIONS = {
      thickness: { imperial_to_metric: 25.4, metric_to_imperial: 0.03937, from: "inches", to: "mm" },
      pressure_psi_mpa: { imperial_to_metric: 0.006895, metric_to_imperial: 145.038, from: "psi", to: "MPa" },
      pressure_psi_bar: { imperial_to_metric: 0.06895, metric_to_imperial: 14.504, from: "psi", to: "bar" },
      temperature: { imperial_to_metric_fn: "°C = (°F - 32) × 5/9", metric_to_imperial_fn: "°F = °C × 9/5 + 32" },
      length_ft_m: { imperial_to_metric: 0.3048, metric_to_imperial: 3.2808, from: "feet", to: "meters" },
      stress_ksi_mpa: { imperial_to_metric: 6.895, metric_to_imperial: 0.1450, from: "ksi", to: "MPa" },
      corrosion_rate: { imperial_to_metric: 0.0254, metric_to_imperial: 39.37, from: "mpy (mils/year)", to: "mm/year" }
    };

    // CROSSWALK REGION FALLBACK MAP — specific jurisdictions fall back to parent region
    var REGION_FALLBACK = {
      "germany": "eu",
      "france": "eu",
      "italy": "eu",
      "spain": "eu",
      "netherlands": "eu",
      "belgium": "eu",
      "alberta": "canada"
    };

    // Pre-compute jurisdiction key for crosswalk and unit system lookups
    var resolvedJKey = "";
    if (jurisdictionMismatch && jurisdiction) {
      var jKeys3 = Object.keys(JURISDICTION_MAP);
      for (var jk = 0; jk < jKeys3.length; jk++) {
        if (jurisdiction.indexOf(jKeys3[jk]) >= 0 || jKeys3[jk].indexOf(jurisdiction) >= 0) {
          resolvedJKey = jKeys3[jk]; break;
        }
      }
    }

    var result = {
      status: status,
      confidence: confidence,
      authority_chain: authorities,
      supplemental_codes: supplementalCodes,
      all_codes: codeList,
      lock_reasons: lockReasons,
      trigger_b31g: triggerB31G,
      trigger_crack_assessment: (mev.confirmed === "cracking") && isPressureBoundary,
      trigger_sour_service: mev.sour_service,
      mechanism_verdict: mev,
      jurisdiction_mismatch: jurisdictionMismatch,
      jurisdiction_codes: jurisdictionResolved ? jurisdictionResolved.codes : [],
      crosswalk: (function() {
        if (!jurisdictionMismatch || !jurisdictionResolved) return null;
        var cw = [];
        var jKey = resolvedJKey;
        if (jKey) {
          // Helper: fuzzy match authority code against CROSSWALK keys
          function findCrosswalkEntry(authCode, jurisdictionKey) {
            // Direct match first
            if (CROSSWALK[authCode] && CROSSWALK[authCode][jurisdictionKey]) {
              return { cwKey: authCode, jKey: jurisdictionKey };
            }
            // Try region fallback (e.g., "germany" → "eu")
            var fallbackRegion = REGION_FALLBACK[jurisdictionKey];
            if (fallbackRegion && CROSSWALK[authCode] && CROSSWALK[authCode][fallbackRegion]) {
              return { cwKey: authCode, jKey: fallbackRegion };
            }
            // Fuzzy match on code name — check if authority code CONTAINS a crosswalk key or vice versa
            var cwKeys = Object.keys(CROSSWALK);
            for (var ci = 0; ci < cwKeys.length; ci++) {
              if (authCode.indexOf(cwKeys[ci]) >= 0 || cwKeys[ci].indexOf(authCode) >= 0) {
                if (CROSSWALK[cwKeys[ci]][jurisdictionKey]) {
                  return { cwKey: cwKeys[ci], jKey: jurisdictionKey };
                }
                if (fallbackRegion && CROSSWALK[cwKeys[ci]][fallbackRegion]) {
                  return { cwKey: cwKeys[ci], jKey: fallbackRegion };
                }
              }
            }
            return null;
          }

          authorities.forEach(function(auth) {
            var match = findCrosswalkEntry(auth.code, jKey);
            if (match) {
              var mapping = CROSSWALK[match.cwKey][match.jKey];
              cw.push({
                us_code: auth.code,
                local_equivalent: mapping.equivalent,
                equivalence_type: mapping.equivalence_type,
                key_differences: mapping.differences,
                usage_rule: mapping.usage_rule
              });
            }
          });
        }
        return cw.length > 0 ? cw : null;
      })(),
      unit_system: (function() {
        // Determine unit system for resolved jurisdiction
        var resolvedJurisdiction = resolvedJKey || (jurisdiction && !jurisdiction.match(/^(us|usa|united_states|domestic|refinery|petrochemical|chemical_plant)$/) ? jurisdiction : "us");
        var unitInfo = UNIT_SYSTEM_MAP[resolvedJurisdiction] || UNIT_SYSTEM_MAP["us"];
        var usUnits = UNIT_SYSTEM_MAP["us"];
        var conversionRequired = unitInfo.system !== "Imperial";
        return {
          source_system: "Imperial",
          source_note: "US codes (API/ASME/AWS) use Imperial units",
          target_system: unitInfo.system,
          target_note: unitInfo.note,
          conversion_required: conversionRequired,
          conversions: conversionRequired ? UNIT_CONVERSIONS : null,
          target_units: conversionRequired ? {
            thickness: unitInfo.thickness,
            pressure: unitInfo.pressure,
            temperature: unitInfo.temperature,
            length: unitInfo.length,
            stress: unitInfo.stress
          } : null
        };
      })(),
      metadata: {
        engine: "authority-lock",
        version: "1.4",
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