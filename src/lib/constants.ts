/**
 * DEPLOY36v2 — constants.ts
 * src/lib/constants.ts
 *
 * Complete replacement with ALL exports:
 *   - METHOD_LABELS, METHOD_COLORS, DISPOSITION_COLORS (original)
 *   - NDE_METHODS, WELDING_PROCESSES, WELD_POSITIONS, etc. (DEPLOY29)
 *   - INSPECTION_CONTEXT_OPTIONS, MATERIAL_CLASS_OPTIONS, etc. (DEPLOY36)
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
