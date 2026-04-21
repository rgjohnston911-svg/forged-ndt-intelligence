#!/bin/bash
# Test Superbrain v5 Proof Engine — Gulf Platform Hurricane Scenario
# Run from terminal: bash test-v5-hurricane.sh
# Or copy the curl command below into Postman

curl -s -X POST "https://4dndt.netlify.app/api/tri-model-reasoning" \
  -H "Content-Type: application/json" \
  -d '{
  "action": "reason",
  "input": {
    "asset": "Fixed offshore production platform — Gulf of Mexico",
    "component": "Production system: subsea flowlines, risers, manifold, topsides separation, export",
    "domain": "offshore_oil_gas",
    "materials": [
      "carbon steel production flowlines",
      "carbon steel risers with splash-zone coating",
      "carbon steel manifold skid",
      "carbon steel separator and process piping",
      "structural steel riser bay and supports",
      "sacrificial anodes (zinc/aluminum)",
      "fireproofing on structural steel",
      "deck plate (carbon steel)",
      "subsea jumper (material cert missing)"
    ],
    "geometry": "Subsea tieback architecture: manifold skid on seabed, production flowlines to platform, steel catenary or hybrid risers through splash zone to topsides. Riser bay with clamps, guides, supports, structural columns. Topsides: separator, compressor, export piping. Multiple production loops from manifold.",
    "environments": [
      "seabed: marine sediment, scour-susceptible, cathodic protection",
      "subsea: full immersion, marine growth, CP-dependent",
      "splash zone: cyclic wetting, coating-dependent, highest corrosion risk",
      "atmospheric: salt spray, fireproofing-covered structural steel",
      "process internal: multiphase flow, sand production, slugging, CO2/H2S potential"
    ],
    "service_conditions": [
      "Post-hurricane restart — 16 days after major hurricane passage",
      "Multiphase production with sand from two wells",
      "Slugging in one production line post-restart",
      "Separator carryover for several hours",
      "Produced water chemistry drifted off normal",
      "Compressor tripped on vibration",
      "Intermittent pressure fluctuations on export side",
      "Manifold pressure imbalance between two production loops"
    ],
    "observed_evidence": [
      "EVENT 1 — HURRICANE DAMAGE: Seabed scour near manifold skid and along one flowline corridor. ROV video suggests developing free span on one production flowline. Marine growth stripped from some riser regions but denser in others. One anode hanging loose in riser bay. Splash-zone coating damage increased visibly after restart.",
      "EVENT 2 — RESTART UPSET: Slugging increased in one production line. Sand production spiked from two wells. Separator carryover for several hours. Produced water chemistry drifted off normal. One compressor tripped on vibration. Abnormal vibration at one riser guide. Intermittent pressure fluctuations on export side. One low-level hydrocarbon detector alarm near lower deck/riser access — self-cleared. Manifold pressure readings showed minor imbalance between two production loops.",
      "EVENT 3 — HUMAN REPORTS: Handrail at riser balcony feels loose. One deck plate section near riser support sounds hollow. Rust streaking under fireproofing near riser-adjacent structural column. Technician noticed clicking/ticking during cooldown in riser bay. Operator says one line always shakes there but vibration now looks worse.",
      "EVENT 4 — DATA INTEGRITY: Latest ILI data for one production flowline is incomplete. One riser clamp repair drawing does not match current field layout. Manifold repair package references bolt torque values copied from another job. One subsea jumper replacement material cert is missing. Structural model of riser bay does not include field-added bracket. Previous CP survey excluded one near-platform zone due to access limitations."
    ],
    "measured_data": [
      "ROV video: developing free span on one production flowline (length/sag TBD)",
      "Seabed scour depth and extent: observed but not precisely measured",
      "Sand production spike from two wells (quantity not specified)",
      "Separator carryover duration: several hours",
      "Compressor vibration: tripped on high vibration alarm",
      "Riser guide vibration: abnormal (not trended against baseline)",
      "Hydrocarbon detector alarm: low-level, self-cleared",
      "Manifold pressure imbalance: minor (delta not specified)",
      "Splash-zone coating damage: visible increase (extent not mapped)",
      "ILI data: incomplete for one production flowline"
    ],
    "history": [
      "Platform is existing production facility in hurricane-prone Gulf of Mexico",
      "One riser clamp repair was previously performed (drawing mismatch found)",
      "One subsea jumper was previously replaced (material cert missing)",
      "A field-added bracket exists in riser bay not captured in structural model",
      "Previous CP survey excluded one near-platform zone",
      "Operator reports one line has always had vibration at this location",
      "Manifold repair package may have copied bolt torque values from another job"
    ],
    "adjacent_assets": [
      "Subsea manifold skid (scour-exposed)",
      "Multiple production flowlines (one with developing free span)",
      "Subsea jumpers (one with missing material cert)",
      "Risers through splash zone (coating damage, loose anode, vibration at guide)",
      "Riser bay structural steel (rust under fireproofing, hollow deck plate, loose handrail, field bracket not in model)",
      "Separator and process train (carryover event, chemistry drift)",
      "Compressor (vibration trip)",
      "Export piping (pressure fluctuations)",
      "CP system (loose anode, excluded survey zone)"
    ],
    "human_exposure": [
      "Personnel regularly access riser balcony (loose handrail)",
      "Technicians work in riser bay (clicking/ticking sounds during cooldown)",
      "Operators near lower deck/riser access (hydrocarbon alarm location)",
      "Deck plate near riser support (hollow sound — structural concern under personnel)",
      "Structural column near riser bay (rust under fireproofing — if column is fire-rated, fire resistance may be compromised)"
    ],
    "inspection_context": "Post-hurricane and post-restart assessment. ROV survey performed subsea. Visual inspection topsides. No systematic UT thickness survey performed yet. No updated CP survey. ILI data incomplete. Riser clamp repair drawing mismatch discovered. Structural model outdated.",
    "code_context": [
      "API RP 2A (offshore structures)",
      "API 579-1/ASME FFS-1 (fitness for service)",
      "API RP 2MET (metocean)",
      "ASME B31.4 / B31.8 (pipeline/piping)",
      "API RP 1111 (subsea pipelines)",
      "DNV-RP-F105 (free spanning pipelines)",
      "DNV-RP-F101 (corroded pipelines)",
      "NACE SP0176 (CP monitoring)",
      "API RP 2I (in-service inspection)",
      "API RP 14C (safety systems)",
      "API RP 14J (fire/blast)",
      "NFPA 15 (fireproofing)"
    ]
  }
}' | python3 -m json.tool
