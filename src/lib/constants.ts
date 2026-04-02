/**
 * DEPLOY64 — constants.ts
 * src/lib/constants.ts
 *
 * Complete replacement — adds:
 *   - ASSET_CLASSES (16 classes with icons)
 *   - ASSET_TYPES_BY_CLASS (150+ asset types by class)
 *   - PRIMARY_CODES_BY_CLASS
 *   - getAssetClassForType() helper
 *
 * Retains all DEPLOY42 exports.
 *
 * CONSTRAINT: No backtick template literals
 */

/* ================================================================
   METHOD LABELS + COLORS (used by MethodBadge, Cases, Dashboard, CaseDetail)
================================================================ */

export var METHOD_LABELS: Record<string, string> = {
  VT: "Visual Testing",
  PT: "Liquid Penetrant",
  MT: "Magnetic Particle",
  UT: "Ultrasonic Testing",
  RT: "Radiographic Testing",
  ET: "Electromagnetic Testing"
};

export var METHOD_COLORS: Record<string, string> = {
  VT: "#3b82f6",
  PT: "#ef4444",
  MT: "#a855f7",
  UT: "#06b6d4",
  RT: "#f59e0b",
  ET: "#10b981"
};

export var DISPOSITION_COLORS: Record<string, string> = {
  ACCEPT: "#059669",
  REJECT: "#dc2626",
  REPAIR: "#f59e0b",
  PENDING: "#6b7280",
  ESCALATE: "#a855f7"
};

/* ================================================================
   NDT METHODS (original)
================================================================ */

export var NDE_METHODS = [
  { value: "VT", label: "Visual Testing (VT)" },
  { value: "PT", label: "Liquid Penetrant Testing (PT)" },
  { value: "MT", label: "Magnetic Particle Testing (MT)" },
  { value: "UT", label: "Ultrasonic Testing (UT)" },
  { value: "RT", label: "Radiographic Testing (RT)" },
  { value: "ET", label: "Electromagnetic Testing (ET)" }
];

/* ================================================================
   WELDING PROCESSES (from DEPLOY29)
================================================================ */

export var WELDING_PROCESSES = [
  { value: "SMAW", label: "SMAW — Shielded Metal Arc Welding" },
  { value: "GMAW", label: "GMAW — Gas Metal Arc Welding (MIG)" },
  { value: "FCAW", label: "FCAW — Flux Cored Arc Welding" },
  { value: "GTAW", label: "GTAW — Gas Tungsten Arc Welding (TIG)" },
  { value: "SAW", label: "SAW — Submerged Arc Welding" }
];

export var WELD_POSITIONS = [
  { value: "1G", label: "1G — Flat (Groove)" },
  { value: "2G", label: "2G — Horizontal (Groove)" },
  { value: "3G", label: "3G — Vertical (Groove)" },
  { value: "4G", label: "4G — Overhead (Groove)" },
  { value: "1F", label: "1F — Flat (Fillet)" },
  { value: "2F", label: "2F — Horizontal (Fillet)" },
  { value: "3F", label: "3F — Vertical (Fillet)" },
  { value: "4F", label: "4F — Overhead (Fillet)" },
  { value: "6G", label: "6G — 45-Degree Fixed (Pipe)" },
  { value: "6GR", label: "6GR — Restricted (Pipe)" }
];

export var HEAT_INPUT_LEVELS = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" }
];

export var TRAVEL_SPEED_LEVELS = [
  { value: "SLOW", label: "Slow" },
  { value: "NORMAL", label: "Normal" },
  { value: "FAST", label: "Fast" }
];

/* ================================================================
   UNIVERSAL INSPECTION CONTEXT OPTIONS (DEPLOY36)
================================================================ */

export var INSPECTION_CONTEXT_OPTIONS = [
  { value: "WELD", label: "Weld" },
  { value: "BASE_MATERIAL", label: "Base Material" },
  { value: "HAZ", label: "Heat Affected Zone (HAZ)" },
  { value: "COMPONENT", label: "Component / Assembly" },
  { value: "COATING", label: "Coating / Liner" },
  { value: "UNKNOWN", label: "Unknown" }
];

export var MATERIAL_CLASS_OPTIONS = [
  { value: "METALLIC", label: "Metallic" },
  { value: "POLYMER", label: "Plastic / Polymer" },
  { value: "COMPOSITE", label: "Composite" },
  { value: "CERAMIC_GLASS", label: "Ceramic / Glass" },
  { value: "ELASTOMER", label: "Rubber / Elastomer" },
  { value: "CIVIL_MINERAL", label: "Concrete / Mineral" },
  { value: "COATING_LINER", label: "Coating / Liner" },
  { value: "UNKNOWN", label: "Unknown" }
];

export var MATERIAL_FAMILY_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  METALLIC: [
    { value: "CARBON_STEEL", label: "Carbon Steel" },
    { value: "LOW_ALLOY_STEEL", label: "Low Alloy Steel" },
    { value: "STAINLESS_STEEL", label: "Stainless Steel" },
    { value: "DUPLEX_STAINLESS", label: "Duplex Stainless" },
    { value: "ALUMINUM", label: "Aluminum" },
    { value: "NICKEL_ALLOY", label: "Nickel Alloy" },
    { value: "COPPER_ALLOY", label: "Copper Alloy" },
    { value: "TITANIUM", label: "Titanium" },
    { value: "CAST_IRON", label: "Cast Iron" },
    { value: "UNKNOWN_METALLIC", label: "Unknown Metallic" }
  ],
  POLYMER: [
    { value: "PVC", label: "PVC" },
    { value: "CPVC", label: "CPVC" },
    { value: "HDPE", label: "HDPE" },
    { value: "LDPE", label: "LDPE" },
    { value: "POLYPROPYLENE", label: "Polypropylene" },
    { value: "ABS", label: "ABS" },
    { value: "NYLON", label: "Nylon" },
    { value: "PTFE", label: "PTFE" },
    { value: "ACRYLIC", label: "Acrylic" },
    { value: "POLYCARBONATE", label: "Polycarbonate" },
    { value: "THERMOPLASTIC_GENERIC", label: "Generic Thermoplastic" },
    { value: "THERMOSET_GENERIC", label: "Generic Thermoset" },
    { value: "UNKNOWN_POLYMER", label: "Unknown Polymer" }
  ],
  COMPOSITE: [
    { value: "FRP_FIBERGLASS", label: "FRP / Fiberglass" },
    { value: "CARBON_FIBER", label: "Carbon Fiber" },
    { value: "ARAMID_KEVLAR", label: "Aramid / Kevlar" },
    { value: "GLASS_FILLED_POLYMER", label: "Glass-Filled Polymer" },
    { value: "HONEYCOMB_COMPOSITE", label: "Honeycomb Composite" },
    { value: "LAMINATED_COMPOSITE", label: "Laminated Composite" },
    { value: "UNKNOWN_COMPOSITE", label: "Unknown Composite" }
  ],
  CERAMIC_GLASS: [
    { value: "CERAMIC", label: "Ceramic" },
    { value: "REFRACTORY", label: "Refractory" },
    { value: "GLASS", label: "Glass" },
    { value: "PORCELAIN", label: "Porcelain" },
    { value: "UNKNOWN_CERAMIC_GLASS", label: "Unknown Ceramic / Glass" }
  ],
  ELASTOMER: [
    { value: "NATURAL_RUBBER", label: "Natural Rubber" },
    { value: "NEOPRENE", label: "Neoprene" },
    { value: "EPDM", label: "EPDM" },
    { value: "NITRILE", label: "Nitrile" },
    { value: "SILICONE", label: "Silicone" },
    { value: "POLYURETHANE_ELASTOMER", label: "Polyurethane Elastomer" },
    { value: "UNKNOWN_ELASTOMER", label: "Unknown Elastomer" }
  ],
  CIVIL_MINERAL: [
    { value: "CONCRETE", label: "Concrete" },
    { value: "MORTAR", label: "Mortar" },
    { value: "MASONRY", label: "Masonry" },
    { value: "STONE", label: "Stone" },
    { value: "CEMENTITIOUS_LINER", label: "Cementitious Liner" },
    { value: "UNKNOWN_CIVIL_MINERAL", label: "Unknown Civil / Mineral" }
  ],
  COATING_LINER: [
    { value: "PAINT_COATING", label: "Paint Coating" },
    { value: "EPOXY_COATING", label: "Epoxy Coating" },
    { value: "RUBBER_LINING", label: "Rubber Lining" },
    { value: "POLYMER_LINER", label: "Polymer Liner" },
    { value: "CERAMIC_LINER", label: "Ceramic Liner" },
    { value: "FUSION_BONDED_EPOXY", label: "Fusion Bonded Epoxy" },
    { value: "GALVANIZED_LAYER", label: "Galvanized Layer" },
    { value: "UNKNOWN_COATING_LINER", label: "Unknown Coating / Liner" }
  ],
  UNKNOWN: [
    { value: "UNKNOWN", label: "Unknown" }
  ]
};

export var SURFACE_TYPE_OPTIONS = [
  { value: "PIPE", label: "Pipe" },
  { value: "PLATE", label: "Plate" },
  { value: "VESSEL", label: "Vessel" },
  { value: "STRUCTURAL_MEMBER", label: "Structural Member" },
  { value: "TUBE", label: "Tube" },
  { value: "NOZZLE", label: "Nozzle" },
  { value: "FLANGE", label: "Flange" },
  { value: "FITTING", label: "Fitting" },
  { value: "VALVE_BODY", label: "Valve Body" },
  { value: "CASTING", label: "Casting" },
  { value: "FORGING", label: "Forging" },
  { value: "MACHINED_PART", label: "Machined Part" },
  { value: "TANK", label: "Tank" },
  { value: "RAIL", label: "Rail" },
  { value: "PANEL", label: "Panel" },
  { value: "LINER", label: "Liner" },
  { value: "COATING_LAYER", label: "Coating Layer" },
  { value: "CONCRETE_MEMBER", label: "Concrete Member" },
  { value: "GENERAL_COMPONENT", label: "General Component" },
  { value: "UNKNOWN", label: "Unknown" }
];

export var SERVICE_ENVIRONMENT_OPTIONS = [
  { value: "ATMOSPHERIC", label: "Atmospheric" },
  { value: "MARINE", label: "Marine" },
  { value: "BURIED", label: "Buried" },
  { value: "IMMERSION_FRESH_WATER", label: "Immersion — Fresh Water" },
  { value: "IMMERSION_SALT_WATER", label: "Immersion — Salt Water" },
  { value: "SOUR_SERVICE", label: "Sour Service (H2S)" },
  { value: "CHEMICAL_PROCESS", label: "Chemical Process" },
  { value: "HIGH_TEMPERATURE", label: "High Temperature" },
  { value: "LOW_TEMPERATURE", label: "Low Temperature" },
  { value: "ABRASIVE_FLOW", label: "Abrasive Flow" },
  { value: "CYCLIC_PRESSURE", label: "Cyclic Pressure" },
  { value: "UV_EXPOSURE", label: "UV Exposure" },
  { value: "STEAM_SERVICE", label: "Steam Service" },
  { value: "UNKNOWN", label: "Unknown" }
];

/* ================================================================
   CODE APPLICABILITY ROUTER OPTIONS (DEPLOY42)
================================================================ */

export var LIFECYCLE_STAGE_OPTIONS = [
  { value: "FABRICATION", label: "Fabrication" },
  { value: "NEW_CONSTRUCTION_ACCEPTANCE", label: "New Construction Acceptance" },
  { value: "IN_SERVICE", label: "In-Service" },
  { value: "REPAIR_OR_ALTERATION", label: "Repair / Alteration" },
  { value: "FITNESS_FOR_SERVICE", label: "Fitness-for-Service" },
  { value: "FAILURE_ANALYSIS", label: "Failure Analysis" },
  { value: "EDUCATIONAL_TRAINING", label: "Educational / Training" },
  { value: "UNKNOWN", label: "Unknown" }
];

export var INDUSTRY_SECTOR_OPTIONS = [
  { value: "STRUCTURAL_STEEL", label: "Structural Steel" },
  { value: "PIPELINE", label: "Pipeline" },
  { value: "PROCESS_PIPING", label: "Process Piping" },
  { value: "PRESSURE_VESSEL", label: "Pressure Vessel" },
  { value: "STORAGE_TANK", label: "Storage Tank" },
  { value: "POWER_GENERATION", label: "Power Generation" },
  { value: "SHIPBUILDING_MARINE", label: "Shipbuilding / Marine" },
  { value: "AEROSPACE", label: "Aerospace" },
  { value: "AUTOMOTIVE", label: "Automotive" },
  { value: "GENERAL_MANUFACTURING", label: "General Manufacturing" },
  { value: "COMMERCIAL_DIVING_MARINE", label: "Commercial Diving / Marine" },
  { value: "CIVIL_INFRASTRUCTURE", label: "Civil Infrastructure" },
  { value: "PLASTICS_PROCESSING", label: "Plastics Processing" },
  { value: "COMPOSITES_MANUFACTURING", label: "Composites Manufacturing" },
  { value: "UNKNOWN", label: "Unknown" }
];

export var ASSET_TYPE_OPTIONS = [
  { value: "WELDMENT", label: "Weldment" },
  { value: "PIPE", label: "Pipe" },
  { value: "PIPING_SYSTEM", label: "Piping System" },
  { value: "PRESSURE_VESSEL", label: "Pressure Vessel" },
  { value: "STORAGE_TANK", label: "Storage Tank" },
  { value: "STRUCTURAL_MEMBER", label: "Structural Member" },
  { value: "PLATE", label: "Plate" },
  { value: "TUBE", label: "Tube" },
  { value: "NOZZLE", label: "Nozzle" },
  { value: "FLANGE", label: "Flange" },
  { value: "VALVE", label: "Valve" },
  { value: "CASTING", label: "Casting" },
  { value: "FORGING", label: "Forging" },
  { value: "COMPOSITE_PANEL", label: "Composite Panel" },
  { value: "FRP_TANK", label: "FRP Tank" },
  { value: "PLASTIC_PIPE", label: "Plastic Pipe" },
  { value: "COATING", label: "Coating" },
  { value: "LINER", label: "Liner" },
  { value: "CIVIL_CONCRETE_MEMBER", label: "Concrete / Civil Member" },
  { value: "GENERAL_COMPONENT", label: "General Component" },
  { value: "UNKNOWN", label: "Unknown" }
];

/* ================================================================
   ASSET CLASS REGISTRY (DEPLOY64 — NEW)
   16 asset classes with "Other" catch-all
================================================================ */

export var ASSET_CLASSES = [
  { id: "pipeline", label: "Pipeline", icon: "\uD83D\uDEE2\uFE0F", desc: "Gas, oil, water, subsea, transmission" },
  { id: "offshore", label: "Offshore", icon: "\uD83C\uDF0A", desc: "Platforms, jackets, FPSOs, risers, subsea" },
  { id: "refinery_process", label: "Refinery / Process", icon: "\uD83C\uDFED", desc: "Vessels, exchangers, columns, piping, boilers" },
  { id: "marine_vessel", label: "Marine Vessel", icon: "\uD83D\uDEA2", desc: "Ships, tankers, barges, rudders, hulls" },
  { id: "wind_energy", label: "Wind Energy", icon: "\uD83C\uDF2C\uFE0F", desc: "Towers, monopiles, blades, nacelles, foundations" },
  { id: "bridge_civil", label: "Bridge / Civil", icon: "\uD83C\uDF09", desc: "Supports, decks, bearings, cables, walls" },
  { id: "dam_hydro", label: "Dam / Hydro", icon: "\uD83C\uDF0A", desc: "Dams, penstocks, lock gates, intakes, spillways" },
  { id: "nuclear", label: "Nuclear", icon: "\u2622\uFE0F", desc: "Reactor vessels, containment, fuel pools, piping" },
  { id: "storage_terminal", label: "Storage / Terminal", icon: "\uD83D\uDEE2\uFE0F", desc: "Tanks, terminal piping, loading arms" },
  { id: "mining", label: "Mining", icon: "\u26CF\uFE0F", desc: "Crushers, conveyors, haul trucks, tunnels" },
  { id: "rail", label: "Rail / Locomotive", icon: "\uD83D\uDE82", desc: "Bridges, locomotives, rolling stock, track" },
  { id: "aerospace", label: "Aerospace / Space", icon: "\uD83D\uDE80", desc: "Launch structures, ground support, spacecraft" },
  { id: "power_generation", label: "Power Generation", icon: "\u26A1", desc: "Turbines, boilers, HRSGs, condensers, stacks" },
  { id: "water_wastewater", label: "Water / Wastewater", icon: "\uD83D\uDEB0", desc: "Treatment plants, clarifiers, digesters, distribution" },
  { id: "telecom", label: "Telecommunications", icon: "\uD83D\uDCE1", desc: "Towers, antenna mounts, guy wires, shelters" },
  { id: "other", label: "Other", icon: "\uD83D\uDD27", desc: "Ag equipment, amusement, custom, specialty" },
];

/* ================================================================
   ASSET TYPES BY CLASS (DEPLOY64 — NEW)
   150+ asset types organized by class
================================================================ */

export var ASSET_TYPES_BY_CLASS: Record<string, Array<{ key: string; label: string }>> = {
  pipeline: [
    { key: "gas_pipeline", label: "Gas Pipeline" },
    { key: "oil_pipeline", label: "Oil Pipeline" },
    { key: "water_pipeline", label: "Water Pipeline" },
    { key: "subsea_pipeline", label: "Subsea Pipeline" },
    { key: "transmission_pipeline", label: "Transmission Pipeline" },
    { key: "gathering_line", label: "Gathering Line" },
    { key: "distribution_line", label: "Distribution Line" },
    { key: "flowline", label: "Flowline" },
    { key: "riser", label: "Riser" },
    { key: "j_tube", label: "J-Tube" },
  ],
  offshore: [
    { key: "fixed_platform", label: "Fixed Platform" },
    { key: "jacket_structure", label: "Jacket Structure" },
    { key: "platform_brace", label: "Platform Brace" },
    { key: "platform_node", label: "Platform Node" },
    { key: "platform_leg", label: "Platform Leg" },
    { key: "fpso", label: "FPSO" },
    { key: "spar", label: "Spar" },
    { key: "tlp", label: "TLP" },
    { key: "subsea_manifold", label: "Subsea Manifold" },
    { key: "subsea_tree", label: "Subsea Tree" },
    { key: "mooring_system", label: "Mooring System" },
    { key: "caisson", label: "Caisson" },
    { key: "conductor", label: "Conductor" },
  ],
  refinery_process: [
    { key: "pressure_vessel", label: "Pressure Vessel" },
    { key: "heat_exchanger", label: "Heat Exchanger" },
    { key: "distillation_column", label: "Distillation Column" },
    { key: "reactor", label: "Reactor" },
    { key: "process_piping", label: "Process Piping" },
    { key: "boiler", label: "Boiler" },
    { key: "fired_heater", label: "Fired Heater" },
    { key: "air_cooler", label: "Air Cooler" },
    { key: "relief_device", label: "Relief Device" },
    { key: "valve", label: "Valve" },
    { key: "flare_system", label: "Flare System" },
    { key: "pipe_rack", label: "Pipe Rack" },
  ],
  marine_vessel: [
    { key: "cargo_ship", label: "Cargo Ship" },
    { key: "tanker", label: "Tanker" },
    { key: "barge", label: "Barge" },
    { key: "rudder", label: "Rudder" },
    { key: "hull", label: "Hull" },
    { key: "propeller", label: "Propeller" },
    { key: "ballast_tank", label: "Ballast Tank" },
    { key: "deck_structure", label: "Deck Structure" },
    { key: "crane_pedestal", label: "Crane Pedestal" },
    { key: "anchor_system", label: "Anchor System" },
    { key: "tug", label: "Tug" },
    { key: "supply_vessel", label: "Supply Vessel" },
  ],
  wind_energy: [
    { key: "wind_tower", label: "Wind Tower" },
    { key: "monopile", label: "Monopile Foundation" },
    { key: "transition_piece", label: "Transition Piece" },
    { key: "blade", label: "Blade" },
    { key: "nacelle", label: "Nacelle" },
    { key: "rotor_hub", label: "Rotor Hub" },
    { key: "jacket_foundation", label: "Jacket Foundation" },
    { key: "gravity_base", label: "Gravity Base Foundation" },
    { key: "scour_protection", label: "Scour Protection" },
    { key: "j_tube_wind", label: "J-Tube / Cable Entry" },
    { key: "internal_platform", label: "Internal Platform / Ladder" },
  ],
  bridge_civil: [
    { key: "bridge_support", label: "Bridge Support / Pier" },
    { key: "bridge_deck", label: "Bridge Deck" },
    { key: "bridge_bearing", label: "Bridge Bearing" },
    { key: "bridge_cable", label: "Bridge Cable / Tendon" },
    { key: "abutment", label: "Abutment" },
    { key: "retaining_wall", label: "Retaining Wall" },
    { key: "culvert", label: "Culvert" },
    { key: "guardrail_system", label: "Guardrail / Barrier System" },
    { key: "expansion_joint", label: "Expansion Joint" },
  ],
  dam_hydro: [
    { key: "dam_face", label: "Dam Face" },
    { key: "spillway", label: "Spillway" },
    { key: "penstock", label: "Penstock" },
    { key: "lock_gate", label: "Lock Gate" },
    { key: "lock_chamber", label: "Lock Chamber" },
    { key: "intake_structure", label: "Intake Structure" },
    { key: "turbine_hydro", label: "Hydro Turbine" },
    { key: "stilling_basin", label: "Stilling Basin" },
    { key: "fish_ladder", label: "Fish Ladder" },
    { key: "tailrace", label: "Tailrace" },
  ],
  nuclear: [
    { key: "reactor_vessel", label: "Reactor Vessel" },
    { key: "containment_liner", label: "Containment Liner" },
    { key: "spent_fuel_pool", label: "Spent Fuel Pool" },
    { key: "suppression_pool", label: "Suppression Pool" },
    { key: "reactor_internals", label: "Reactor Internals" },
    { key: "steam_generator", label: "Steam Generator" },
    { key: "pressurizer", label: "Pressurizer" },
    { key: "nuclear_piping", label: "Nuclear Piping" },
    { key: "control_rod_drive", label: "Control Rod Drive Housing" },
    { key: "nozzle_safe_end", label: "Nozzle Safe End" },
    { key: "drywell", label: "Drywell" },
  ],
  storage_terminal: [
    { key: "aboveground_tank", label: "Aboveground Storage Tank" },
    { key: "underground_tank", label: "Underground Storage Tank" },
    { key: "tank_floor", label: "Tank Floor" },
    { key: "tank_shell", label: "Tank Shell" },
    { key: "tank_roof", label: "Tank Roof" },
    { key: "loading_arm", label: "Loading Arm" },
    { key: "terminal_piping", label: "Terminal Piping" },
    { key: "secondary_containment", label: "Secondary Containment" },
  ],
  mining: [
    { key: "crusher", label: "Crusher" },
    { key: "conveyor_structure", label: "Conveyor Structure" },
    { key: "haul_truck_frame", label: "Haul Truck Frame" },
    { key: "mine_support", label: "Mine Support Structure" },
    { key: "tunnel_lining", label: "Tunnel Lining" },
    { key: "dragline", label: "Dragline" },
    { key: "shovel_boom", label: "Shovel / Boom" },
  ],
  rail: [
    { key: "rail_bridge", label: "Rail Bridge" },
    { key: "locomotive_frame", label: "Locomotive Frame" },
    { key: "railcar_tank", label: "Railcar Tank" },
    { key: "track_structure", label: "Track Infrastructure" },
    { key: "signal_structure", label: "Signal Structure" },
    { key: "rail_tunnel", label: "Rail Tunnel" },
  ],
  aerospace: [
    { key: "launch_pad", label: "Launch Pad Structure" },
    { key: "launch_tower", label: "Launch Tower" },
    { key: "ground_support", label: "Ground Support Equipment" },
    { key: "spacecraft_component", label: "Spacecraft Component" },
    { key: "satellite_structure", label: "Satellite Structure" },
    { key: "propellant_tank", label: "Propellant Tank" },
    { key: "flame_deflector", label: "Flame Deflector" },
    { key: "umbilical_system", label: "Umbilical System" },
  ],
  power_generation: [
    { key: "gas_turbine", label: "Gas Turbine" },
    { key: "steam_turbine", label: "Steam Turbine" },
    { key: "hrsg", label: "HRSG" },
    { key: "condenser", label: "Condenser" },
    { key: "boiler_power", label: "Boiler" },
    { key: "stack", label: "Stack / Chimney" },
    { key: "cooling_tower", label: "Cooling Tower" },
    { key: "generator", label: "Generator" },
    { key: "penstock_power", label: "Penstock (Power)" },
  ],
  water_wastewater: [
    { key: "clarifier", label: "Clarifier" },
    { key: "digester", label: "Digester" },
    { key: "aeration_basin", label: "Aeration Basin" },
    { key: "distribution_pipe", label: "Distribution Piping" },
    { key: "treatment_tank", label: "Treatment Tank" },
    { key: "filter_structure", label: "Filter Structure" },
    { key: "pump_station", label: "Pump Station" },
    { key: "outfall", label: "Outfall" },
  ],
  telecom: [
    { key: "telecom_tower", label: "Telecommunications Tower" },
    { key: "antenna_mount", label: "Antenna Mount" },
    { key: "guy_wire", label: "Guy Wire" },
    { key: "equipment_shelter", label: "Equipment Shelter" },
    { key: "cable_tray", label: "Cable Tray / Infrastructure" },
  ],
  other: [
    { key: "ag_equipment", label: "Agricultural Equipment" },
    { key: "amusement_ride", label: "Amusement Ride / Structure" },
    { key: "crane", label: "Crane" },
    { key: "elevator_escalator", label: "Elevator / Escalator" },
    { key: "hvac_system", label: "HVAC System" },
    { key: "solar_structure", label: "Solar Panel Structure" },
    { key: "custom", label: "Custom (describe in notes)" },
  ],
};

/* ================================================================
   PRIMARY CODES BY ASSET CLASS (DEPLOY64 — NEW)
================================================================ */

export var PRIMARY_CODES_BY_CLASS: Record<string, string[]> = {
  pipeline: ["API 570", "API 1104", "ASME B31.3", "ASME B31.4", "ASME B31.8", "DOT PHMSA 49 CFR 192/195"],
  offshore: ["API RP 2A", "API RP 2SIM", "API RP 2I", "NORSOK N-004", "NORSOK M-501", "ISO 19902"],
  refinery_process: ["ASME VIII Div 1/2", "API 510", "API 653", "API 579-1/ASME FFS-1", "NBIC", "API RP 580/581"],
  marine_vessel: ["ABS Rules", "DNV Rules", "Lloyd's Register Rules", "Bureau Veritas Rules", "SOLAS", "IACS"],
  wind_energy: ["IEC 61400", "DNV-ST-0126", "DNVGL-ST-0437", "DNV-ST-0262", "DNV-OS-J101"],
  bridge_civil: ["AASHTO LRFD", "FHWA", "ACI 318", "ASCE 7", "State DOT Standards"],
  dam_hydro: ["FERC Part 12", "USACE ER 1110-2-100", "FEMA P-93", "State Dam Safety Programs", "ASCE/SEI"],
  nuclear: ["ASME Section XI", "10 CFR 50 Appendix B", "NRC Reg Guides", "EPRI MRP Guidance", "BWRVIP/PWROG"],
  storage_terminal: ["API 653", "API 650", "API 2610", "STI SP001", "NFPA 30"],
  mining: ["MSHA 30 CFR", "AS 4100", "CSA Standards"],
  rail: ["AREMA Manual", "FRA 49 CFR", "AAR Standards"],
  aerospace: ["NASA-STD-5009", "NASA-STD-5019", "ASTM E2375", "SAE AMS Standards"],
  power_generation: ["ASME PCC-2", "API 530", "EPRI Guidance", "NERC Standards"],
  water_wastewater: ["AWWA Standards", "EPA Regulations", "ASCE/WEF Standards"],
  telecom: ["TIA-222", "ANSI/EIA", "Local Building Codes"],
  other: [],
};

/* ================================================================
   HELPER: Get asset class from asset type key (DEPLOY64 — NEW)
================================================================ */

export function getAssetClassForType(assetType: string): string {
  var classes = Object.keys(ASSET_TYPES_BY_CLASS);
  for (var c = 0; c < classes.length; c++) {
    var types = ASSET_TYPES_BY_CLASS[classes[c]];
    for (var t = 0; t < types.length; t++) {
      if (types[t].key === assetType) return classes[c];
    }
  }
  return "other";
}
