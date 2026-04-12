// @ts-nocheck
// DEPLOY198 -- decision-core.ts v2.9.15
// v2.9.15: DEPLOY198 -- Two system-level bugs fixed from helideck elite scenario test:
//   1. fire_damage false positive: bare hasWord(lt,"fire") matched inside "firefighting",
//      "fireproofing", etc. Replaced with specific fire-event phrases (fire damage, fire
//      exposure, jet fire, pool fire, post-fire, caught fire, etc.). Equipment with fire
//      suppression/protection gear no longer triggers fire_damage validation.
//   2. Missing marine/saltwater environment for offshore scenarios: Offshore platforms,
//      splash zones, seawater, Gulf of Mexico had no saltwater phase detection. Added
//      saltwater + liquid_water phase push for marine keywords and offshore_platform asset
//      class. Added "marine" atmosphere_class (checked before generic "atmospheric").
//      Added offshore_platform implied agents (atmospheric, chlorides, marine_environment)
//      so atmospheric_corrosion and pitting validate correctly without explicit "outdoor" text.
// v2.9.14: DEPLOY197 -- Four catalog vocabulary mismatches fixed:
//   1. erosion: flow_state_in ["high_velocity","turbulent"] -> ["high","turbulent"] to match physics engine output.
//   2. mic: flow_state_in ["stagnant","low_flow"] -> ["stagnant","low"] to match physics engine output.
//   3. mic: deposit_type_in ["biofilm_slime","sulfide_scale","unknown"] -> ["biofilm","sulfide","unspecified"].
//   4. underdeposit_corrosion: deposit_type_in ["ammonium_salt","carbonate_scale","sulfide_scale","unknown"] -> ["salt","sulfide","scale","unspecified"].
//   Plus: physics engine now emits flow_state="turbulent" when turbulence geometry is detected without explicit flow velocity.
//   5. Flow detection reordered: "high" checked before "low" to prevent "flow rate" matching "low rate" substring.
//   6. Phase detection: cooling water/sour water/water service/condensate now push liquid_water into phases_present.
// v2.9.11: DEPLOY194 -- Two system bugs fixed:
//   1. process_chemistry missing hydrogen_present/h2s_present/caustic_present flags.
//      These lived in physics.chemical but catalog evaluator read from process_chemistry.
//      HTHA (hydrogen_damage) could never fully validate. Now wired through.
//   2. Concrete material class overriding metallic materials. Cascading if-statements
//      let "concrete pedestal" overwrite "2.25Cr-1Mo steel". Now guarded: concrete
//      only sets if no metallic material already classified.
// v2.9.10: DEPLOY191 -- Fix ammonia SCC false-positive: tighten keyword detection to require compound phrases, not loose word combos. 41 mechanisms unchanged.
// Previous: v2.9.8 -- DEPLOY189 -- Add galvanic corrosion, atmospheric corrosion, soil-side corrosion, cavitation. Batch 3 of API 571 sweep.
// Previous: v2.9.7 -- DEPLOY188 -- Add carburization, metal dusting, high-temp oxidation, spheroidization, decarburization, graphitization. Batch 2 of API 571 sweep.
// Previous: v2.9.6 -- DEPLOY187 -- 885F embrittlement, sigma phase, temper embrittlement + ferritic/martensitic stainless material classifier.
// Previous: v2.9.5 -- DEPLOY186 -- Add amine cracking (amine SCC) + carbonate SCC to mechanism catalog. Harden austenitic stainless material classifier.
// Previous: v2.9.4 -- DEPLOY185 -- Add naphthenic acid corrosion + polythionic acid SCC to mechanism catalog.
// Previous: v2.9.3 -- DEPLOY183 -- Fix hasEvent() crash on object events (500 on computation paths), remove duplicate energy key.
// Previous: v2.9.2 -- DEPLOY182 -- NPS nominal wall inference + RSR data-quality gate (clean rebuild).
// Previous: v2.9.0 -- DEPLOY180 Consequence Reality fail-upward gate.
// Previous: v2.8.1 -- DEPLOY174 INDETERMINATE mechanism escalation.
// Previous: DEPLOY171.6 -- decision-core.ts v2.6.2
// v2.6.2 (superseded by v2.7.0): Catalog foundations -- behavior-preserving capability layer for DEPLOY172
//
// CONTEXT: DEPLOY172 will migrate the corrosion family (general_corrosion,
// pitting, co2_corrosion, erosion) to the catalog and add four new
// mechanisms (cscc, mic, sulfidation, underdeposit_corrosion). Those
// mechanisms cannot be expressed against the four precondition buckets
// shipped in DEPLOY171 (material, environment, geometry, thermal). They
// need to declare preconditions about process chemistry (chloride
// concentration band, sulfur content, amine type, ammonium salt
// potential), flow regime (stagnant / low-flow / turbulent / deadleg),
// and deposits (presence, type). DEPLOY171.6 is the foundation deploy
// that adds these three new buckets to the catalog evaluator, the
// matching structured extraction in resolvePhysicalReality, the
// AssetState builder updates, and the return JSON exposure -- without
// shipping any catalog entries that consume them.
//
// BEHAVIOR PRESERVATION GUARANTEE: The only mechanism currently in
// MECHANISM_CATALOG_V1 is CUI. CUI does not declare process_chemistry,
// flow_regime, or deposits preconditions. The new bucket handlers in
// evaluateMechanismFromCatalog are therefore unreached on every existing
// transcript. The new structured extraction populates fields on the
// physics object that have no consumer until DEPLOY172 ships catalog
// entries that read them. The new fields in buildAssetStateForCatalog
// are observable but not gated against. Net effect on the engine output
// for every existing transcript is zero, except that physical_reality
// in the response JSON gains three new structured fields
// (process_chemistry, flow_regime, deposits) that downstream UI consumers
// can ignore until they want to render them.
//
// This deploy is designed to be shipped and regression-tested in
// isolation. Run any existing transcript against v2.6.2 and it should
// produce the same disposition, primary mechanism, validated set,
// rejected set, indeterminate set, confidence, and gates as v2.6.1.
// The only difference will be three new fields on physical_reality.
// If any existing transcript produces a different disposition, that is
// a regression and DEPLOY171.6 should be rolled back.
//
// DEPLOY171.6 scope:
//   1. Add three new precondition bucket handlers to
//      evaluateMechanismFromCatalog: process_chemistry, flow_regime,
//      deposits. Each follows the existing material/environment/geometry/
//      thermal pattern of returning SATISFIED/VIOLATED/UNKNOWN per
//      declared check.
//   2. Add structured extraction in resolvePhysicalReality for the
//      vocabulary that drives those buckets -- chloride concentration
//      bands, sulfur content classes, amine types, ammonium salt
//      indicators, flow state classification, deadleg detection,
//      turbulence geometry, and deposit presence/type detection. All
//      extraction is additive; no existing physics field is modified.
//   3. Add a McConomy sulfidation rate helper function (computeSulfidationRate)
//      that takes temperature_F, sulfur_class, and material_class and
//      returns rate_mpy + severity_band per the published API 939-C
//      piecewise functional form. Pure helper, no caller in 171.6 --
//      DEPLOY172 sulfidation catalog entry will reference it. Encoded
//      in 171.6 so it can be visually reviewed before being wired up.
//   4. Update buildAssetStateForCatalog to expose the new physics fields
//      in the AssetState shape that the catalog evaluator walks.
//   5. Expose process_chemistry, flow_regime, deposits in the success-
//      path return JSON physical_reality block (matching how DEPLOY171.5
//      exposed material and environment).
//   6. Engine version bumped to v2.6.2 in BOTH success-path and refusal-
//      path return JSON.
//
// PRECONDITION SCHEMA REVIEW POINT (this is the checkpoint Richard asked
// for before DEPLOY172 catalog entries get written):
//
// process_chemistry bucket supports these check shapes:
//   chloride_band_min: "trace" | "low" | "medium" | "high"
//     Mechanism eligible only if extracted chloride_band is at or above
//     this level. Used by cscc to require non-trivial chlorides.
//   sulfur_required: true
//     Mechanism eligible only if any sulfur class is present. Used by
//     sulfidation, polythionic SCC.
//   amine_present: true
//     Mechanism eligible only if any amine type detected. Used by
//     amine corrosion and amine SCC mechanisms in later deploys.
//   nh4_salt_required: true
//     Mechanism eligible only if ammonium salt potential is detected.
//     Used by underdeposit corrosion in FCC overhead service.
//
// flow_regime bucket supports:
//   flow_state_in: array of allowed states from
//     ["stagnant", "low_flow", "normal", "high_velocity", "turbulent"]
//     Used by MIC (stagnant/low_flow), erosion (high_velocity/turbulent),
//     underdeposit corrosion (stagnant/low_flow).
//   deadleg_required: true
//     Used by MIC.
//   turbulence_geometry_required: true
//     Used by erosion-corrosion.
//
// deposits bucket supports:
//   deposits_required: true
//     Used by MIC, underdeposit corrosion.
//   deposit_type_in: array from
//     ["biofilm_slime", "ammonium_salt", "sulfide_scale",
//      "carbonate_scale", "unknown"]
//     Used by MIC (biofilm_slime), underdeposit corrosion
//     (ammonium_salt or unknown).
//
// If Richard wants different field names, different state vocabularies,
// or different check shapes -- this is the moment to redirect. After
// DEPLOY172 catalog entries are written against this schema, schema
// changes become a renaming exercise across nine mechanism records
// instead of one declaration block.
//
// DEPLOY171.5 -- decision-core.ts v2.6.1
// v2.6.1: Cascade-wide correction guard + physical_reality material/environment exposure
//
// MOTIVATING DEFECT (observed during DEPLOY171 validation on a nuclear PWR
// pressurizer surge line transcript):
//
// The transcript described a Type 316 / Alloy 82-182 dissimilar metal weld
// in a Pressurized Water Reactor primary loop at 580F / 2200 psi. Upstream
// classifier returned asset_class="nuclear_vessel". The expected behavior
// was for the SUPPORTED_DOMAINS gate (added in DEPLOY170) to refuse the
// report with domain_not_supported=true, since the build has no nuclear
// authority chain (10 CFR 50 App B, ASME Section XI), no nuclear mechanism
// catalog (PWSCC, IGSCC, irradiation embrittlement), and no nuclear
// consequence model. The observed behavior was that nuclear_vessel was
// silently force-promoted to pressure_vessel BEFORE the gate ever ran,
// then evaluated against API 510 + ASME Section VIII as if it were a
// refinery hydroprocessing reactor. The engine survived this only by luck:
// DEPLOY167's WEAK correction penalty + DEPLOY176 hard confidence gate
// held the line at overall confidence 0.52, blocking the disposition.
// Robustness was accidental, not designed.
//
// ROOT CAUSE: DEPLOY115 added a "piping lock" block that promotes any
// non-piping/non-pressure_vessel class to pressure_vessel when the
// transcript contains "pressure vessel", "reactor", "heat exchanger", or
// "autoclave". The transcript contained "Pressurized Water Reactor", so
// hasWord(lt, "reactor") returned true, and nuclear_vessel was rewritten.
// DEPLOY170 added a startingClassSupported guard to ONE override block
// (the field-language piping promotion) but left every other override
// block in the cascade unguarded. The same shape of bug was present in
// the hydrocracker block, the boiler block, the separator/drum block, the
// "Transcript describes piping" block, the storage tank block, and the
// DEPLOY115 piping lock -- six parallel holes, any of which could
// rewrite an unsupported class into a supported one and bypass the
// SUPPORTED_DOMAINS gate.
//
// DEPLOY171.5 scope:
//   1. Define a single shared correctionAllowedFrom constant + a single
//      correctionGuardOpen boolean at the top of the cascade. Every
//      override/promotion block below references this guard. Adding new
//      override blocks in the future requires only the guard reference;
//      adding new supported asset classes requires only one edit to the
//      shared constant. Eliminates the drift risk that produced this bug.
//   2. Add the guard to all six previously-unguarded override blocks.
//      The hyperbaric and structural domain locks are intentionally NOT
//      guarded -- they are explicit class identifiers, not corrections,
//      and should always fire when their keywords appear.
//   3. Refactor the DEPLOY170 field-language block to consume the shared
//      constants instead of declaring its own (which had a different
//      list -- the existing fieldOverrideAllowedFrom omitted the bridge
//      family classes). This unifies the two lists and reduces drift.
//   4. Expose physical_reality.material and physical_reality.environment
//      in the success-path return JSON. The DEPLOY171 catalog evaluator
//      already received these fields internally (the CUI rejection during
//      validation proves it), but the explicit field copy in the success-
//      path return JSON did not include them. Two-line addition. Makes
//      the catalog evaluator's input data visible for downstream UI
//      consumers and debugging.
//   5. Engine version bumped to v2.6.1 in BOTH success-path and refusal-
//      path return JSON.
//
// EXPECTED POST-DEPLOY171.5 BEHAVIOR ON NUCLEAR SCENARIO:
//   - asset_class arrives as "nuclear_vessel"
//   - correctionGuardOpen evaluates to false (nuclear_vessel not in
//     correctionAllowedFrom)
//   - Every override block in the cascade refuses to fire
//   - assetClass remains "nuclear_vessel" through the entire cascade
//   - SUPPORTED_DOMAINS gate refuses with domain_not_supported=true
//   - Refusal payload reports engine_version v2.6.1
//
// PARALLEL HOLES CLOSED BY DEPLOY171.5 (each previously rewrote
// nuclear_vessel/aircraft/spacecraft/marine_hull silently into a
// supported class):
//   - hydrocracker/hydrotreater/reactor_vessel/delayed_coker block
//   - boiler/steam_drum/economizer block
//   - separator/knockout_drum/flash_drum/surge_drum/accumulator block
//   - "Transcript describes piping" block
//   - storage tank block
//   - DEPLOY115 piping lock (pressure_vessel/reactor/heat_exchanger/autoclave)
//
// This is a tactical fix to the cascade architecture, not a strategic
// rebuild. The strategic fix remains the Domain Classification Engine
// proposed in the post-DEPLOY171 strategic pivot, which will replace the
// entire cascade with structured evidence weighting + explicit confidence
// + explicit unknown handling. DEPLOY171.5 stops the bleeding so the
// cascade is not the bottleneck while DEPLOY172 (catalog migration of
// CSCC, MIC, sulfidation, naphthenic acid, polythionic SCC, rouging) and
// the Domain Classification Engine ship.
//
// DEPLOY171 -- decision-core.ts v2.6.0
// v2.6.0: Mechanism catalog phase 1 -- CUI migration to data-driven preconditions
// This is the first concrete step in the long-running mechanism upgrade. The
// goal is to replace opaque MECH_DEFS predicates with a typed, data-driven
// catalog where every mechanism declares its preconditions in named buckets
// (material, environment, geometry, thermal, stress) and the evaluator walks
// each precondition against a typed AssetState. Motivating bug: in v2.5.5,
// CUI was defined as
//   pre: function(s, t) { return t.operating_temp_f >= 0 && <= 350; }
//   preLabels: ["Temperature in CUI range (0-350F)", "Insulated equipment"]
// The label asserted two preconditions; the predicate enforced one. CUI
// would silently fire on CMC thermal tiles in hard vacuum, on uninsulated
// piping, and on materials physically incapable of corroding by the CUI
// mechanism. The new shape forces preconditions to be declared as data and
// walked by a generic evaluator that returns one of three states per
// precondition: SATISFIED, VIOLATED, or UNKNOWN. The third state is the
// upgrade -- today's engine collapses UNKNOWN into FALSE and overcommits.
// Under the new shape, INDETERMINATE mechanisms are surfaced in a new
// damage_reality.indeterminate_mechanisms array so the engine can honestly
// say "I cannot confirm or rule out CUI on this asset because the inspector
// did not state material, insulation status, or temperature."
//
// DEPLOY171 scope (this deploy):
//   1. Add the schema, AssetState builder, and generic evaluator function.
//   2. Add structured material extraction (physics.material.class) inside
//      resolvePhysicalReality. New field on the physics object. All existing
//      physics consumers continue reading physics.chemical.* unchanged.
//      Pure addition.
//   3. Add structured phase / atmosphere extraction
//      (physics.environment.phases_present, physics.environment.atmosphere_class).
//      Same pattern: new field, no removals.
//   4. Migrate exactly ONE mechanism -- CUI -- from MECH_DEFS predicate path
//      to the catalog evaluator path inside resolveDamageReality. All other
//      mechanisms continue to use MECH_DEFS unchanged.
//   5. Surface INDETERMINATE catalog evaluations in
//      damage_reality.indeterminate_mechanisms. INDETERMINATE mechanisms do
//      NOT fire as validated and do NOT affect disposition logic in this
//      deploy -- they are observational so the schema can be validated against
//      real transcripts before more mechanisms migrate.
//   6. Engine version bumped to v2.6.0 in both success-path and refusal-path
//      return JSON.
//
// What CUI does under the new path:
//   - Spacecraft CMC tile in vacuum: REJECTED with three independent reasons
//     (material class violated, environment phase violated, geometry violated).
//   - Hot insulated 600F amine line: REJECTED -- temperature window violated;
//     metal stays dry above 350F. (Today this fires CUI incorrectly.)
//   - Carbon steel piping at 200F, sweating reported, insulation present:
//     ELIGIBLE -- all preconditions satisfied. Scored against observation
//     evidence as before.
//   - Carbon steel piping at 200F, no insulation status stated:
//     INDETERMINATE -- geometry.insulation_present is null. Surfaced for
//     manual review rather than silently firing.
//
// Future deploys in this track:
//   DEPLOY172: Migrate remaining corrosion family (general, pitting, CO2,
//     erosion) and add the new mechanisms the schema enables: CSCC on
//     austenitic stainless under chloride+stress, MIC, sulfidation per
//     McConomy curves, naphthenic acid corrosion, polythionic acid SCC on
//     sensitized stainless, rouging on 316L electropolished service.
//   DEPLOY173: Migrate cracking, fatigue, creep, brittle fracture, fire
// @ts-nocheck
//     damage, hydrogen damage. Delete MECH_DEFS entirely. Catalog becomes
//     the only damage mechanism source.
//   DEPLOY174+: Extract catalog into shared module consumed by both
//     decision-core.ts and the standalone failure-mode-dominance.js engine
//     (requires the standalone FMD engine source).
//
// DEPLOY170 -- decision-core.ts v2.5.5
// v2.5.5: Supported domain gate + field-language override guard
// DEPLOY170 FIX 1: The FIELD LANGUAGE PIPING OVERRIDE block (v2.3) had no
//   guard on the starting asset class. It would silently force ANY non-piping
//   class (aircraft, satellite, rocket_test_article, pharma, spacecraft) to
//   piping when the transcript contained common industrial words like "psi",
//   "inch", "support", "flow", "weld", or "insulation". This produced clean-
//   looking reports that were catastrophically wrong (spacecraft classified
//   as piping with API 570 authority and thermal burn consequence; aircraft
//   same path). DEPLOY170 adds startingClassSupported guard so the field-
//   language promotion only fires when the starting class is already in the
//   refinery/structural family or explicitly "unknown". Unsupported domains
//   now fall through to the new domain refusal gate below.
// DEPLOY170 FIX 2: New SUPPORTED_DOMAINS terminal gate after all correction
//   cascades. If assetClass is not in the supported set, the engine returns
//   DOMAIN_NOT_SUPPORTED immediately -- no physics pipeline, no force-fit,
//   no report. This is an explicit scope refusal, not a system failure.
//   Supported: piping, pipeline, pressure_vessel, tank, storage_tank, bridge,
//   rail_bridge, bridge_steel, bridge_concrete, offshore_platform,
//   heat_exchanger, boiler, unknown. Explicitly unsupported: aircraft,
//   spacecraft, rocket_test_article, satellite, rail (rolling stock),
//   marine_hull, nuclear_reactor_core, pharma_bioprocess, and all others.
// DEPLOY169 -- decision-core.ts v2.5.4
// v2.5.4: Same-family asset normalization no-op
// DEPLOY169: isSameAssetFamily() helper suppresses the DEPLOY167 tiered
//   penalty when upstream classifier returns a semantic synonym of the
//   canonical asset class (e.g. "process_piping" -> "piping" is a
//   normalization, not a correction). Silently discards the assetCorrected
//   flag for same-family cases so no warning, no penalty, no clutter in
//   the contradiction flags. Only true cross-family corrections (e.g.
//   "offshore_platform" -> "piping") still go through the tiered assessment.
// DEPLOY168 -- decision-core.ts v2.5.3
// v2.5.3: Hot-fluid human impact routing
// DEPLOY168: Universal thermal/flammable injury logic inside
//   resolveConsequenceReality. Reads physics.thermal.operating_temp_f +
//   physics.energy.stored_energy_significant + transcript flammable
//   context. Upgrades human_impact from "Low" to thermal burn / flash fire
//   language when a pressure-boundary thinning mechanism releases hot fluid.
//   Fixes Scenario 3 Human Impact: Low on 640F hot hydrocarbon process
//   line. Universal: no asset-class branches, degrades gracefully when
//   temperature or fluid context absent.
// DEPLOY167 -- decision-core.ts v2.5.2
// v2.5.2: Tiered asset correction penalty
// DEPLOY167: assessAssetCorrectionStrength() helper distinguishes clean
//   recovery (3+ class-specific signals in transcript) from genuine
//   ambiguity (0-1 signals). STRONG corrections carry NO confidence penalty
//   -- the decision-core successfully inferred the correct class despite
//   upstream error and should be rewarded, not punished. MODERATE gets
//   0.02. WEAK (legacy DEPLOY117 behavior) gets 0.05 + WARNING. Unblocks
//   Scenario 3 confidence drop on clean piping recoveries.
// DEPLOY162 -- decision-core.ts v2.5.1
// v2.5.1: Word-boundary matcher for asset resolver + hot hydrocarbon fix
// DEPLOY162: hasWordBoundary() helper + applied to train/car/jacket/bridge/span/
//   deck/pier/coal/brace/web/riser/rov. Prevents substring false positives:
//   "train" matching "restraint", "car" matching "carbon", "jacket" matching
//   "jacketing". Fixes Scenario 3 formal hot-hydrocarbon overhead line where
//   structural lock was falsely firing and derailment label was appearing on
//   a refinery line.
// DEPLOY122 -- decision-core.ts v2.5
// v2.5: Evidence Provenance Integration
// DEPLOY122: Accepts evidence_provenance from pipeline. Uses provenance trust weights
//   in damage mechanism scoring (State 2). Provenance trust band feeds into
//   contradiction detector as confidence penalty when evidence base is weak.
//   Provenance data included in output JSON for UI rendering.
// DEPLOY121 -- decision-core.ts v2.4.1
// v2.4.1: Implied-only fatigue penalty
// DEPLOY121 FIX: When fatigue prerequisites are ONLY implied defaults (piping auto-cyclic +
//   implied welds) and transcript has zero explicit fatigue indicators, reduce fatigue bonus.
//   Prevents corrosion/erosion transcripts from being classified as fatigue_mechanical.
// v2.4: Asset Classification Hardening + CUI Wall Loss Detection
// DEPLOY120 FIX 1: Raw thickness readings detected as wall loss evidence
//   "0.190 inch versus 0.280 nominal" = measured wall loss, triggers corrosion boost
// DEPLOY120 FIX 2: CUI evidence keywords -- sweating, wet insulation, wet lagging -> corrosive
// DEPLOY120 FIX 3: Separator/drum -> pressure_vessel classification
// DEPLOY120 FIX 4: Offshore platform detection from "unknown" (signal counting like bridge)
// DEPLOY120 FIX 5: Expanded piping detection -- "header", "elbow" as standalone line words
// DEPLOY120 FIX 6: Expanded process context -- propane, lpg, carbon steel, etc.
// v2.3.1: Evidence Hierarchy -- OBSERVED vs SUSPECTED scoring fix
// DEPLOY115 FIX 1: Wall loss evidence detection (wallLossReported, wallLossQuantified, wallLossMeasuredByNDE)
//   Includes field slang: "thinned out", "% down", "eating", "washed out", "corroded", "pitted"
// DEPLOY115 FIX 2: Corrosion mechanisms boosted when wall loss is measured by NDE
//                   Crack/fatigue mechanisms penalized when cracking is only "suspected" not confirmed
//                   Environmental cracking (SCC/SSC/HIC) gets gentler penalty than fatigue
// DEPLOY115 FIX 3: Physics narrative override constrained -- no longer flips corrosion/thinning
//                   narrative to fatigue/Paris Law on piping where cyclic+stress_conc are implied defaults
// DEPLOY115 FIX 4: Piping lock -- reactor/exchanger mentions no longer override established piping
//                   classification. "Hot hydro line coming off the reactor" = piping, not vessel.
//                   Added process context: hydro, intrados, downstream, upstream
// DEPLOY115 FIX 5: Structural domain lock -- bridges/offshore NEVER reclassified as piping/vessel.
//                   Prevents "steel" matching "tee", "line at weld toe" matching piping "line".
//                   Structural signals: girder, bridge, span, train, coal, gusset, brace, web, etc.
//                   Unknown assets auto-lock to bridge if 2+ bridge signals detected.
// v2.3: Industrial Context Intelligence Layer + Event-to-Physics Translation
// Context inference: hydrocracking->H2S+hydrogen, amine->H2S+caustic, etc.
// Event translation: rapid cooldown->thermal cycling, emergency shutdown, etc.
// System-wide: all fixes apply via State 1 physics -> all downstream engines benefit
// FIX 1: Consequence escalation -- structural instability + stored pressure energy -> AUTO CRITICAL
//         Fire exposure + stored pressure energy -> AUTO CRITICAL
//         Structural failure induces pressure boundary failure -- cannot be evaluated independently
// FIX 2: Inspection domain expansion -- fire exposure triggers materials testing track,
//         structural deformation triggers dimensional survey + bolt inspection track
// FIX 3: Creep time-at-temperature qualification -- short fire duration adds evidence_against note
//         distinguishing strength reduction / microstructural change from true creep accumulation
// v2.1: PVHO authority stack, mechanism uncertainty preservation (H2S), FFS gap check
// v2.0: Production Physics Sufficiency Engine (State 5 upgraded)
// PHYSICS-FIRST DECISION CORE -- Klein Bottle Architecture
// 6 States + Reality Confidence + Contradiction Detector + Physics Computations
// NO TEMPLATE LITERALS -- STRING CONCATENATION ONLY
// @ts-nocheck
import type { Handler, HandlerEvent } from "@netlify/functions";

// ============================================================================
// TYPES
// ============================================================================
interface StressState { primary_load_types: string[]; cyclic_loading: boolean; cyclic_source: string | null; stress_concentration_present: boolean; stress_concentration_locations: string[]; tensile_stress: boolean; compressive_stress: boolean; load_path_criticality: string; residual_stress_likely: boolean; }
interface ThermalState { operating_temp_c: number | null; operating_temp_f: number | null; thermal_cycling: boolean; fire_exposure: boolean; fire_duration_min: number | null; creep_range: boolean; cryogenic: boolean; }
interface ChemicalState { corrosive_environment: boolean; environment_agents: string[]; h2s_present: boolean; co2_present: boolean; chlorides_present: boolean; caustic_present: boolean; hydrogen_present: boolean; material_susceptibility: string[]; coating_intact: boolean | null; sour_service: boolean; }
interface EnergyState { pressure_cycling: boolean; vibration: boolean; impact_event: boolean; impact_description: string | null; flow_erosion_risk: boolean; cavitation: boolean; stored_energy_significant: boolean; }
interface TimeState { service_years: number | null; cycles_estimated: string | null; time_since_inspection_years: number | null; }
interface ValidatedMechanism { id: string; name: string; physics_basis: string; preconditions_met: string[]; reality_state: string; reality_score: number; evidence_for: string[]; evidence_against: string[]; observation_basis: boolean; severity: string; }
interface RejectedMechanism { id: string; name: string; rejection_reason: string; missing_precondition: string; met_preconditions?: string[]; }
interface MethodWeight { method: string; physics_principle: string; detects: string; cannot_detect: string; reliability: number; coverage: number; limitations: string[]; }
interface PrecedenceGate { gate: string; result: string; reason: string; required_action: string | null; }
interface RecoveryItem { priority: number; action: string; physics_reason: string; who: string; }
interface StrategyPhase { phase: number; name: string; objective: string; actions: string[]; gate: string; time_frame: string; }
interface HardLock { code: string; reason: string; disposition: string; physics_basis: string; }
interface FatigueResult { enabled: boolean; delta_k: number | null; growth_per_cycle_m: number | null; days_to_critical: number | null; status: string; narrative: string; }
interface CriticalFlawResult { enabled: boolean; critical_depth_mm: number | null; stress_ratio: number | null; status: string; narrative: string; }
interface WallLossResult { enabled: boolean; remaining_life_years: number | null; severity_ratio: number | null; status: string; narrative: string; }
interface LeakBurstResult { enabled: boolean; tendency: string; through_wall_risk: number | null; fracture_risk: number | null; narrative: string; }

// ============================================================================
// HELPERS
// ============================================================================
function hasWord(text: string, word: string): boolean { return text.indexOf(word) !== -1; }
function roundN(n: number, d: number): number { var f = Math.pow(10, d); return Math.round(n * f) / f; }

// ============================================================================
// v2.5.1: WORD-BOUNDARY MATCHER
// hasWord() is plain substring search and produces false positives whenever
// a short keyword is a substring of an unrelated word. Examples observed in
// production: "train" inside "restraint", "car" inside "carbon", "jacket"
// inside "jacketing". Use hasWordBoundary() for any keyword short enough to
// be a substring of process terminology.
// ============================================================================
function hasWordBoundary(text: string, word: string): boolean {
  var escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var re = new RegExp("\\b" + escaped + "\\b", "i");
  return re.test(text);
}

// ============================================================================
// DEPLOY117: NEGATION-AWARE EVIDENCE DETECTION
// "No cracks found" must NOT trigger visible_cracking = true.
// Checks for negation words within 25 chars before the keyword.
// Negation patterns: "no ", "not ", "without ", "none ", "negative ",
//   "ruled out", "no visible", "no evidence", "absent", "did not find",
//   "didn't find", "no sign", "no indication"
// ============================================================================
function hasWordNotNegated(text: string, word: string): boolean {
  var idx = text.indexOf(word);
  if (idx === -1) return false;

  // Check ALL occurrences -- if ANY is non-negated, return true
  var searchFrom = 0;
  while (idx !== -1) {
    var preStart = Math.max(0, idx - 25);
    var preBuf = text.substring(preStart, idx);

    var negated = false;
    if (preBuf.indexOf("no ") !== -1) negated = true;
    else if (preBuf.indexOf("not ") !== -1) negated = true;
    else if (preBuf.indexOf("without ") !== -1) negated = true;
    else if (preBuf.indexOf("none ") !== -1) negated = true;
    else if (preBuf.indexOf("negative") !== -1) negated = true;
    else if (preBuf.indexOf("ruled out") !== -1) negated = true;
    else if (preBuf.indexOf("no visible") !== -1) negated = true;
    else if (preBuf.indexOf("no evidence") !== -1) negated = true;
    else if (preBuf.indexOf("absent") !== -1) negated = true;
    else if (preBuf.indexOf("did not") !== -1) negated = true;
    else if (preBuf.indexOf("didn") !== -1) negated = true;
    else if (preBuf.indexOf("no sign") !== -1) negated = true;
    else if (preBuf.indexOf("no indication") !== -1) negated = true;

    if (!negated) return true; // Found non-negated occurrence

    searchFrom = idx + word.length;
    idx = text.indexOf(word, searchFrom);
  }
  return false; // All occurrences were negated
}
function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }

// ============================================================================
// v2.5.2 DEPLOY167: ASSET CORRECTION STRENGTH ASSESSMENT
// Distinguishes clean recovery (strong multi-signal evidence for the corrected
// class) from genuine ambiguity (weak single-signal correction). Clean
// recoveries carry NO confidence penalty -- the decision-core successfully
// inferred the correct class despite upstream error, which should be rewarded,
// not punished. Universal: signal lists are class-specific but scoring is
// identical for all asset types. Degrades gracefully on unknown classes.
// STRONG   = 3+ class-specific signals -> no penalty, no warning
// MODERATE = 2 class-specific signals -> 0.02 penalty, informational note
// WEAK     = 0-1 signals                -> 0.05 penalty + warning (legacy DEPLOY117)
// ============================================================================
function assessAssetCorrectionStrength(lt: string, correctedClass: string, originalClass: string): any {
  var signals: string[] = [];

  if (correctedClass === "piping" || correctedClass === "pipeline") {
    if (hasWord(lt, "process line")) signals.push("process line");
    if (hasWord(lt, "piping system")) signals.push("piping system");
    if (hasWord(lt, "overhead line") || hasWord(lt, "overhead piping") || hasWord(lt, "overhead process")) signals.push("overhead line");
    if (hasWord(lt, "a106") || hasWord(lt, "a 106")) signals.push("ASTM A106");
    if (hasWord(lt, "a53") || hasWord(lt, "a 53")) signals.push("ASTM A53");
    if (hasWord(lt, "a333") || hasWord(lt, "a 333")) signals.push("ASTM A333");
    if (hasWord(lt, "a312") || hasWord(lt, "a 312")) signals.push("ASTM A312");
    if (hasWord(lt, "nps ") || hasWord(lt, "nominal pipe size")) signals.push("NPS designation");
    if (hasWord(lt, "schedule 40") || hasWord(lt, "schedule 80") || hasWord(lt, "sch 40") || hasWord(lt, "sch 80") || hasWord(lt, "sch. 40") || hasWord(lt, "sch. 80") || hasWord(lt, "std wall") || hasWord(lt, "xs wall")) signals.push("pipe schedule");
    if (hasWord(lt, "dead leg")) signals.push("dead leg");
    if (hasWord(lt, "spring can") || hasWord(lt, "spring hanger")) signals.push("spring support");
    if (hasWord(lt, "long-radius elbow") || hasWord(lt, "long radius elbow") || hasWord(lt, "lr elbow")) signals.push("long-radius elbow");
    if (hasWord(lt, "branch connection") || hasWord(lt, "welded branch")) signals.push("branch connection");
    if (hasWord(lt, "pipe support")) signals.push("pipe support");
    if (/\d+[\s-]*inch\s+(pipe|line)/.test(lt)) signals.push("sized pipe/line");
  }

  if (correctedClass === "pressure_vessel") {
    if (hasWord(lt, "pressure vessel")) signals.push("pressure vessel");
    if (hasWord(lt, "shell and tube") || hasWord(lt, "shell-and-tube")) signals.push("shell and tube");
    if (hasWord(lt, "tube bundle")) signals.push("tube bundle");
    if (hasWord(lt, "u-tube") || hasWord(lt, "u tube")) signals.push("u-tube");
    if (hasWord(lt, "floating head")) signals.push("floating head");
    if (hasWord(lt, "hydrocracker") || hasWord(lt, "hydrotreater")) signals.push("hydroprocessing reactor");
    if (hasWord(lt, "reactor vessel")) signals.push("reactor vessel");
    if (hasWord(lt, "knockout drum") || hasWord(lt, "ko drum")) signals.push("knockout drum");
    if (hasWord(lt, "flash drum")) signals.push("flash drum");
    if (hasWord(lt, "surge drum")) signals.push("surge drum");
    if (hasWord(lt, "asme section viii") || hasWord(lt, "section viii")) signals.push("ASME VIII");
    if (hasWord(lt, "tangent line") || hasWord(lt, "tan-tan")) signals.push("tangent line");
    if (hasWord(lt, "head to shell") || hasWord(lt, "head-to-shell")) signals.push("head to shell junction");
    if (hasWord(lt, "man-way") || hasWord(lt, "manway")) signals.push("manway");
    if (hasWord(lt, "decompression chamber") || hasWord(lt, "hyperbaric")) signals.push("hyperbaric vessel");
  }

  if (correctedClass === "tank" || correctedClass === "storage_tank") {
    if (hasWord(lt, "storage tank")) signals.push("storage tank");
    if (hasWord(lt, "aboveground tank") || hasWord(lt, "aboveground storage")) signals.push("aboveground storage tank");
    if (hasWord(lt, "api 650") || hasWord(lt, "api-650")) signals.push("API 650");
    if (hasWord(lt, "api 653") || hasWord(lt, "api-653")) signals.push("API 653");
    if (hasWord(lt, "floating roof")) signals.push("floating roof");
    if (hasWord(lt, "fixed roof") || hasWord(lt, "cone roof") || hasWord(lt, "dome roof")) signals.push("fixed roof");
    if (hasWord(lt, "tank farm")) signals.push("tank farm");
    if (hasWord(lt, "rim seal")) signals.push("rim seal");
    if (hasWord(lt, "wind girder")) signals.push("wind girder");
    if (hasWord(lt, "tank shell")) signals.push("tank shell");
    if (hasWord(lt, "tank bottom") || hasWord(lt, "floor plate")) signals.push("tank bottom");
  }

  if (correctedClass === "bridge" || correctedClass === "rail_bridge" || correctedClass === "bridge_steel" || correctedClass === "bridge_concrete") {
    if (hasWordBoundary(lt, "bridge")) signals.push("bridge");
    if (hasWord(lt, "girder")) signals.push("girder");
    if (hasWord(lt, "truss")) signals.push("truss");
    if (hasWord(lt, "abutment")) signals.push("abutment");
    if (hasWordBoundary(lt, "pier")) signals.push("pier");
    if (hasWordBoundary(lt, "deck")) signals.push("bridge deck");
    if (hasWord(lt, "stringer")) signals.push("stringer");
    if (hasWord(lt, "floor beam")) signals.push("floor beam");
    if (hasWord(lt, "gusset")) signals.push("gusset");
    if (hasWord(lt, "aashto")) signals.push("AASHTO");
    if (hasWord(lt, "nbis")) signals.push("NBIS");
    if (hasWord(lt, "fracture critical") || hasWord(lt, "fracture-critical")) signals.push("fracture-critical member");
  }

  if (correctedClass === "offshore_platform") {
    if (hasWord(lt, "offshore platform")) signals.push("offshore platform");
    if (hasWordBoundary(lt, "jacket")) signals.push("jacket");
    if (hasWord(lt, "jacket leg")) signals.push("jacket leg");
    if (hasWord(lt, "topside")) signals.push("topside");
    if (hasWord(lt, "splash zone")) signals.push("splash zone");
    if (hasWordBoundary(lt, "riser")) signals.push("riser");
    if (hasWord(lt, "caisson")) signals.push("caisson");
    if (hasWord(lt, "boat landing")) signals.push("boat landing");
    if (hasWord(lt, "subsea")) signals.push("subsea");
    if (hasWord(lt, "api rp 2a") || hasWord(lt, "rp 2a")) signals.push("API RP 2A");
    if (hasWord(lt, "production platform")) signals.push("production platform");
    if (hasWord(lt, "fpso")) signals.push("FPSO");
  }

  var signalCount = signals.length;
  var strength = "WEAK";
  if (signalCount >= 3) strength = "STRONG";
  else if (signalCount === 2) strength = "MODERATE";

  return { strength: strength, signals: signals, signal_count: signalCount, corrected_class: correctedClass, original_class: originalClass };
}

// ============================================================================
// v2.5.4 DEPLOY169: SAME-FAMILY ASSET NORMALIZATION DETECTOR
// Some upstream classifiers return class names that are semantic synonyms of
// the canonical asset class (e.g. "process_piping" vs "piping", "vessel" vs
// "pressure_vessel", "rail_bridge" vs "bridge"). These are NORMALIZATIONS,
// not corrections, and should not trigger DEPLOY167's tiered penalty or
// produce an "Input ambiguity detected" warning. Only true cross-family
// corrections (e.g. "offshore_platform" -> "piping") should go through
// the tiered assessment. Universal: families table is declarative and
// extensible. Unrecognized class pairs default to "different family" so
// they still get the correction assessment.
// ============================================================================
function isSameAssetFamily(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  var FAMILIES: string[][] = [
    ["piping", "process_piping", "pipeline", "piping_system", "process_pipe", "pipe"],
    ["pressure_vessel", "vessel", "pressure_vessel_asme", "pv", "asme_viii_vessel"],
    ["tank", "storage_tank", "atmospheric_tank", "api_650_tank", "api_653_tank", "ast"],
    ["bridge", "rail_bridge", "bridge_steel", "bridge_concrete", "railroad_bridge", "railway_bridge", "highway_bridge", "truss_bridge"],
    ["offshore_platform", "platform", "jacket", "fixed_platform", "offshore_structure", "production_platform", "drilling_platform"],
    ["heat_exchanger", "exchanger", "shell_and_tube", "hx", "shell_tube_exchanger"],
    ["boiler", "steam_boiler", "fired_boiler", "package_boiler"],
    ["rail", "railcar", "rolling_stock", "rail_vehicle"]
  ];
  for (var fi = 0; fi < FAMILIES.length; fi++) {
    var fam = FAMILIES[fi];
    if (fam.indexOf(a) !== -1 && fam.indexOf(b) !== -1) return true;
  }
  return false;
}

// ============================================================================
// DEPLOY171 v2.6.0: MECHANISM CATALOG (PHASE 1 -- CUI MIGRATION)
//
// See header comment block at top of file for the full migration plan.
//
// Schema: every mechanism declares preconditions in named buckets. The
// evaluator walks each declared precondition against an AssetState and
// returns one of three states per precondition: SATISFIED, VIOLATED, or
// UNKNOWN. The mechanism overall status is:
//   ELIGIBLE       -- all declared preconditions SATISFIED
//   REJECTED       -- at least one VIOLATED
//   INDETERMINATE  -- no VIOLATED but at least one UNKNOWN
//
// Material class canonical IDs:
//   carbon_steel, low_alloy_steel, austenitic_stainless, duplex_stainless,
//   ferritic_stainless, martensitic_stainless, nickel_alloy, titanium_alloy,
//   aluminum_alloy, copper_alloy, cmc, ceramic, polymer, concrete
//
// Environment phase canonical IDs:
//   liquid_water, water_vapor_condensable, hydrocarbon_liquid,
//   hydrocarbon_vapor, steam, vacuum, dry_inert_gas, ambient_air
//
// Atmosphere class canonical IDs:
//   insulated, fireproofed, jacketed, buried, submerged, atmospheric,
//   vacuum, enclosed
// ============================================================================

// ============================================================================
// DEPLOY171.6 v2.6.2: McCONOMY SULFIDATION RATE HELPER (PURE FUNCTION)
//
// Encodes the published API 939-C / Couper-Gorman piecewise functional form
// for high-temperature sulfidation of carbon steel and Cr-Mo alloys in
// sulfur-bearing hydrocarbon service. Returns rate in mils-per-year and a
// severity band so the DEPLOY172 sulfidation catalog entry can both
// (a) gate eligibility on whether the operating point is in the active
// sulfidation regime and (b) score the eligible mechanism against the
// expected rate. Trace sulfur ("trace" class) yields ~half the rate of
// nominal sulfur service; "high" sulfur service yields ~2x rate. Cr-Mo
// grades reduce the carbon-steel rate by progressively larger factors per
// the McConomy family. Austenitic stainless is effectively immune below
// 1000F unless extreme conditions are present -- returns rate 0 with the
// "immune" basis string. Materials not in the table return enabled=false.
//
// Inputs:
//   tempF        -- operating temperature in F (number, may be null)
//   sulfurClass  -- "trace" | "low" | "nominal" | "high" | null
//   materialClass -- material.class canonical id from physics.material.class
//
// Output:
//   { enabled, rate_mpy, severity_band, basis, inputs_used }
//
// This function is a pure helper. It has NO caller in DEPLOY171.6 -- it
// exists so that (a) Richard can review the curve shape before it's wired
// up and (b) DEPLOY172 sulfidation catalog entry can reference it without
// adding new helpers in the same deploy. Adding a pure dead helper cannot
// change engine behavior on any existing transcript.
// ============================================================================

function computeSulfidationRate(tempF: number | null, sulfurClass: string | null, materialClass: string | null): any {
  if (tempF === null || tempF === undefined) {
    return { enabled: false, rate_mpy: null, severity_band: null, basis: "Operating temperature not stated; sulfidation rate cannot be computed.", inputs_used: { temp_f: null, sulfur_class: sulfurClass, material_class: materialClass } };
  }
  if (materialClass === null || materialClass === undefined) {
    return { enabled: false, rate_mpy: null, severity_band: null, basis: "Material class not identified; sulfidation rate cannot be computed.", inputs_used: { temp_f: tempF, sulfur_class: sulfurClass, material_class: null } };
  }

  // Below 500F: sulfidation kinetics are too slow to matter on any common
  // industrial inspection horizon for any of these materials.
  if (tempF < 500) {
    return { enabled: true, rate_mpy: 0, severity_band: "low", basis: "Operating temperature " + tempF + "F is below the McConomy active range (500F minimum). Sulfidation kinetics are negligible.", inputs_used: { temp_f: tempF, sulfur_class: sulfurClass, material_class: materialClass } };
  }

  // Austenitic stainless and nickel-base alloys: effectively immune across
  // refinery temperature ranges. Catalog entry will reject sulfidation
  // outright on these materials in DEPLOY172, but the helper still returns
  // a defined value so callers don't need a separate immunity check.
  if (materialClass === "austenitic_stainless" || materialClass === "duplex_stainless" || materialClass === "nickel_alloy") {
    if (tempF < 1000) {
      return { enabled: true, rate_mpy: 0, severity_band: "low", basis: "Material class '" + materialClass + "' is effectively immune to sulfidation below 1000F. Operating temperature " + tempF + "F is well within the immunity envelope.", inputs_used: { temp_f: tempF, sulfur_class: sulfurClass, material_class: materialClass } };
    }
  }

  // Carbon steel -- base McConomy curve. The published curve is roughly
  // exponential in temperature across the active range. The piecewise
  // approximation below is calibrated against published API 939-C values
  // at 500F, 600F, 700F, 800F, and 900F nominal-sulfur points.
  var baseRateMpy = 0;
  if (materialClass === "carbon_steel") {
    if (tempF < 550) baseRateMpy = 5;
    else if (tempF < 600) baseRateMpy = 8;
    else if (tempF < 650) baseRateMpy = 14;
    else if (tempF < 700) baseRateMpy = 22;
    else if (tempF < 750) baseRateMpy = 34;
    else if (tempF < 800) baseRateMpy = 50;
    else if (tempF < 850) baseRateMpy = 70;
    else if (tempF < 900) baseRateMpy = 95;
    else baseRateMpy = 125;
  } else if (materialClass === "low_alloy_steel") {
    // Cr-Mo grades -- published McConomy reductions: ~0.6x for 1.25Cr,
    // ~0.4x for 2.25Cr, ~0.2x for 5Cr, ~0.1x for 9Cr. Without finer
    // material identification we use a conservative single low-alloy
    // multiplier of 0.45 (between 1.25Cr and 2.25Cr). DEPLOY172 may
    // refine this if material extraction starts identifying specific
    // Cr percentages.
    var csRateForCrMo = 0;
    if (tempF < 550) csRateForCrMo = 5;
    else if (tempF < 600) csRateForCrMo = 8;
    else if (tempF < 650) csRateForCrMo = 14;
    else if (tempF < 700) csRateForCrMo = 22;
    else if (tempF < 750) csRateForCrMo = 34;
    else if (tempF < 800) csRateForCrMo = 50;
    else if (tempF < 850) csRateForCrMo = 70;
    else if (tempF < 900) csRateForCrMo = 95;
    else csRateForCrMo = 125;
    baseRateMpy = csRateForCrMo * 0.45;
  } else {
    // Material outside the carbon/low-alloy family but not in the
    // immunity set -- return enabled=false rather than guess.
    return { enabled: false, rate_mpy: null, severity_band: null, basis: "Material class '" + materialClass + "' is not represented in the McConomy carbon-steel / Cr-Mo family. Sulfidation rate cannot be computed for this alloy.", inputs_used: { temp_f: tempF, sulfur_class: sulfurClass, material_class: materialClass } };
  }

  // Sulfur multiplier -- applied to the base rate.
  //   trace:   0.5x
  //   low:     0.7x
  //   nominal: 1.0x
  //   high:    2.0x
  //   null:    1.0x with reduced confidence note
  var sulfurMult = 1.0;
  var sulfurNote = "Nominal sulfur loading assumed.";
  if (sulfurClass === "trace") { sulfurMult = 0.5; sulfurNote = "Trace sulfur -- rate reduced by 50%."; }
  else if (sulfurClass === "low") { sulfurMult = 0.7; sulfurNote = "Low sulfur -- rate reduced by 30%."; }
  else if (sulfurClass === "nominal") { sulfurMult = 1.0; sulfurNote = "Nominal sulfur loading."; }
  else if (sulfurClass === "high") { sulfurMult = 2.0; sulfurNote = "High sulfur loading -- rate doubled."; }
  else { sulfurMult = 1.0; sulfurNote = "Sulfur class not extracted; nominal assumed (lower confidence)."; }

  var finalRateMpy = Math.round(baseRateMpy * sulfurMult * 10) / 10;

  var severityBand = "low";
  if (finalRateMpy >= 80) severityBand = "very_high";
  else if (finalRateMpy >= 30) severityBand = "high";
  else if (finalRateMpy >= 10) severityBand = "moderate";
  else severityBand = "low";

  var basisStr = "McConomy/API 939-C: " + materialClass + " at " + tempF + "F base rate " + baseRateMpy + " mpy. " + sulfurNote + " Final rate " + finalRateMpy + " mpy (" + severityBand + " severity band).";

  return { enabled: true, rate_mpy: finalRateMpy, severity_band: severityBand, basis: basisStr, inputs_used: { temp_f: tempF, sulfur_class: sulfurClass || "unknown_assumed_nominal", material_class: materialClass } };
}

var MECHANISM_CATALOG_V1 = [
  {
    id: "cui",
    name: "Corrosion Under Insulation",
    family: "corrosion",
    severity: "medium",
    description: "External corrosion of insulated carbon steel or low-alloy steel driven by water ingress through insulation, jacketing, or fireproofing in the temperature window where liquid water can persist at the metal surface.",
    preconditions: {
      material: {
        class_in: ["carbon_steel", "low_alloy_steel"],
        class_not_in: ["cmc", "ceramic", "polymer", "titanium_alloy", "aluminum_alloy", "concrete", "nickel_alloy"]
      },
      environment: {
        phase_must_include: ["liquid_water", "water_vapor_condensable"],
        phase_must_exclude: ["vacuum", "dry_inert_gas"]
      },
      geometry: {
        insulation_present: true
      },
      thermal: {
        operating_temp_f_window: [0, 350]
      }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed", "wet_insulation_observed"],
    rejection_messages: {
      material: "CUI requires a CUI-susceptible metallic substrate (carbon steel or low-alloy steel). Non-corroding materials (CMC, ceramic, polymer) and corrosion-resistant alloys (titanium, aluminum, nickel-base) cannot corrode by the CUI mechanism. Austenitic stainless under insulation should be evaluated for chloride ESCC, not CUI.",
      environment_phase: "CUI requires liquid water or condensable water vapor at the metal surface. In hard vacuum or dry inert gas atmospheres, the precondition is physically impossible -- there is no water to drive the corrosion reaction.",
      geometry: "CUI by definition requires insulation. Without insulation present, the asset may corrode by atmospheric corrosion or another mechanism, but it cannot corrode by the CUI mechanism specifically.",
      thermal: "CUI is most active in the temperature window where liquid water can persist at the metal surface beneath insulation. Below 0F water freezes and corrosion stops; above 350F water evaporates faster than it can pool, and the metal surface stays dry."
    }
  },
  // =========================================================================
  // DEPLOY172 v2.7.0: CORROSION FAMILY MIGRATION + NEW MECHANISMS
  // 4 migrated from MECH_DEFS: general_corrosion, pitting, co2_corrosion, erosion
  // 4 new: cscc, mic, sulfidation, underdeposit_corrosion
  // =========================================================================
  {
    id: "general_corrosion",
    name: "General Corrosion",
    family: "corrosion",
    severity: "medium",
    description: "Uniform or near-uniform metal loss driven by electrochemical reaction between a susceptible metallic substrate and a corrosive environment containing water and dissolved species.",
    preconditions: {
      material: {
        class_in: ["carbon_steel", "low_alloy_steel"],
        class_not_in: ["cmc", "ceramic", "polymer", "titanium_alloy", "nickel_alloy"]
      },
      environment: {
        phase_must_include: ["liquid_water", "water_vapor_condensable", "aqueous_acid", "aqueous_alkaline", "wet_gas"]
      }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed", "leak_suspected"],
    rejection_messages: {
      material: "General corrosion requires a corrosion-susceptible metallic substrate. Non-metallic materials and corrosion-resistant alloys (titanium, nickel-base) do not corrode by the general aqueous mechanism in typical service.",
      environment_phase: "General corrosion requires an aqueous phase or condensable water vapor at the metal surface. Without water, the electrochemical corrosion cell cannot form."
    }
  },
  {
    id: "pitting",
    name: "Pitting Corrosion",
    family: "corrosion",
    severity: "high",
    description: "Localized metal loss driven by breakdown of passive film or concentration-cell effects in the presence of chlorides, CO2, or other pit-initiating species.",
    preconditions: {
      material: {
        class_in: ["carbon_steel", "low_alloy_steel", "austenitic_stainless", "duplex_stainless"],
        class_not_in: ["cmc", "ceramic", "polymer"]
      },
      process_chemistry: {
        chloride_band_min: "trace"
      }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed", "leak_confirmed"],
    rejection_messages: {
      material: "Pitting requires a metallic substrate susceptible to localized corrosion. Non-metallic materials cannot pit.",
      process_chemistry_chloride: "Pitting corrosion requires localized corrosive agents to break down the passive film. Without at least trace chloride or CO2 presence, the pit-initiation mechanism is not active."
    }
  },
  {
    id: "co2_corrosion",
    name: "CO2 (Sweet) Corrosion",
    family: "corrosion",
    severity: "medium",
    description: "Internal corrosion driven by dissolved CO2 forming carbonic acid in the presence of free water. Common in wet gas and multiphase production systems.",
    preconditions: {
      material: {
        class_in: ["carbon_steel", "low_alloy_steel"],
        class_not_in: ["austenitic_stainless", "duplex_stainless", "nickel_alloy", "cmc", "ceramic", "polymer"]
      },
      environment: {
        phase_must_include: ["liquid_water", "water_vapor_condensable", "wet_gas"]
      }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed"],
    rejection_messages: {
      material: "CO2 corrosion attacks carbon steel and low-alloy steel. CRAs (austenitic stainless, duplex, nickel-base) are resistant to sweet corrosion at typical refinery conditions.",
      environment_phase: "CO2 corrosion requires free water or condensable water vapor to form carbonic acid."
    }
  },
  {
    id: "erosion",
    name: "Erosion / Erosion-Corrosion",
    family: "corrosion",
    severity: "medium",
    description: "Metal loss driven by high-velocity fluid or entrained particles mechanically removing protective scale or base metal at flow-direction-change geometries (elbows, tees, reducers).",
    preconditions: {
      material: {
        class_in: ["carbon_steel", "low_alloy_steel", "austenitic_stainless", "duplex_stainless"]
      },
      flow_regime: {
        flow_state_in: ["high", "turbulent"]
      }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed"],
    rejection_messages: {
      material: "Erosion requires a metallic substrate susceptible to mechanical or electrochemical material removal under flow.",
      flow_regime_state: "Erosion-corrosion requires high-velocity or turbulent flow conditions. In stagnant or low-flow conditions, the erosive mechanism is not active."
    }
  },
  {
    id: "cscc",
    name: "Chloride Stress Corrosion Cracking",
    family: "cracking",
    severity: "critical",
    description: "Transgranular or intergranular cracking of austenitic stainless steel under the combined action of tensile stress and chloride-bearing environment above approximately 140F. Cracks are typically branching.",
    preconditions: {
      material: {
        class_in: ["austenitic_stainless", "duplex_stainless"]
      },
      process_chemistry: {
        chloride_band_min: "trace"
      },
      thermal: {
        operating_temp_f_window: [140, 1200]
      }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking"],
    rejection_messages: {
      material: "Chloride SCC requires an austenitic or duplex stainless steel substrate. Carbon steel and low-alloy steel are not susceptible to the chloride SCC mechanism.",
      process_chemistry_chloride: "Chloride SCC requires chlorides at the metal surface. Without at least trace chloride presence, the crack-initiation chemistry is absent.",
      thermal: "Chloride SCC is most active above approximately 140F. Below 140F the mechanism is kinetically dormant in typical process service."
    }
  },
  {
    id: "mic",
    name: "Microbiologically Influenced Corrosion",
    family: "corrosion",
    severity: "high",
    description: "Localized corrosion driven by microbial colonies (SRB, APB, IOB) that establish biofilm on internal surfaces in stagnant or low-flow zones. Produces pitting beneath biofilm deposits.",
    preconditions: {
      environment: {
        phase_must_include: ["liquid_water", "water_vapor_condensable", "wet_gas"]
      },
      flow_regime: {
        flow_state_in: ["stagnant", "low"]
      },
      deposits: {
        deposits_required: true,
        deposit_type_in: ["biofilm", "sulfide", "unspecified"]
      }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed", "leak_confirmed"],
    rejection_messages: {
      environment_phase: "MIC requires an aqueous phase to sustain microbial activity. In dry gas or anhydrous service, microbial colonies cannot establish.",
      flow_regime_state: "MIC requires stagnant or low-flow conditions for biofilm establishment. In high-velocity or turbulent flow, shear forces prevent biofilm attachment.",
      deposits_required: "MIC requires surface deposits (biofilm, slime, sulfide scale) as evidence of microbial colonization.",
      deposits_type: "MIC is associated with biofilm/slime deposits or sulfide scale from SRB activity. The observed deposit type does not match the MIC deposit signature."
    }
  },
  {
    id: "sulfidation",
    name: "High-Temperature Sulfidation",
    family: "corrosion",
    severity: "high",
    description: "Elevated-temperature corrosion of carbon steel and low-alloy steel driven by reaction with sulfur species above approximately 500F. Rate follows the McConomy/API 939-C curve family.",
    preconditions: {
      material: {
        class_in: ["carbon_steel", "low_alloy_steel"],
        class_not_in: ["austenitic_stainless", "duplex_stainless", "nickel_alloy"]
      },
      process_chemistry: {
        sulfur_required: true
      },
      thermal: {
        operating_temp_f_window: [500, 1200]
      }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed"],
    rejection_messages: {
      material: "High-temperature sulfidation attacks carbon steel and low-alloy (Cr-Mo) steel. Austenitic stainless, duplex, and nickel-base alloys are effectively immune below 1000F per the McConomy curve family.",
      process_chemistry_sulfur: "Sulfidation requires sulfur-bearing service. Without sulfur species in the process stream, the sulfidation reaction cannot proceed.",
      thermal: "Sulfidation kinetics are negligible below approximately 500F. Above 500F, the corrosion rate increases exponentially with temperature per the McConomy/API 939-C curve."
    }
  },
  {
    id: "underdeposit_corrosion",
    name: "Under-Deposit Corrosion",
    family: "corrosion",
    severity: "high",
    description: "Localized corrosion beneath surface deposits (ammonium salts, carbonate scale, sulfide scale) that create concentration cells or trap corrosive species against the metal surface.",
    preconditions: {
      deposits: {
        deposits_required: true,
        deposit_type_in: ["salt", "sulfide", "scale", "unspecified"]
      },
      process_chemistry: {
        nh4_salt_required: true
      }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed", "leak_confirmed"],
    rejection_messages: {
      deposits_required: "Under-deposit corrosion requires surface deposits that trap corrosive species against the metal surface.",
      deposits_type: "Under-deposit corrosion is associated with ammonium salts, carbonate scale, or sulfide scale. The observed deposit type does not match.",
      process_chemistry_nh4: "Under-deposit corrosion in FCC/crude overhead service requires ammonium salt formation conditions. Without ammonium salt potential, the primary deposit-driven corrosion mechanism is not active."
    }
  },
  // DEPLOY173 v2.8.0: 12 new mechanisms migrated from MECH_DEFS
  {
    id: "fatigue_mechanical",
    name: "Mechanical Fatigue",
    family: "fatigue",
    severity: "high",
    description: "Crack initiation and propagation driven by cyclic loading at stress concentration sites.",
    preconditions: {
      stress: { cyclic_required: true, stress_concentration_required: true }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking"],
    rejection_messages: { stress: "Mechanical fatigue requires cyclic loading and stress concentration." }
  },
  {
    id: "fatigue_thermal",
    name: "Thermal Fatigue",
    family: "fatigue",
    severity: "high",
    description: "Crack initiation from thermal cycling at stress concentration sites.",
    preconditions: {
      thermal: { thermal_cycling_required: true },
      stress: { stress_concentration_required: true }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking"],
    rejection_messages: { thermal: "Thermal fatigue requires thermal cycling and stress concentration." }
  },
  {
    id: "fatigue_vibration",
    name: "Vibration Fatigue",
    family: "fatigue",
    severity: "medium",
    description: "Crack initiation from vibration loading at stress concentration sites.",
    preconditions: {
      energy: { vibration_required: true },
      stress: { stress_concentration_required: true }
    },
    observation_evidence_keys: ["crack_confirmed"],
    rejection_messages: { energy: "Vibration fatigue requires vibration and stress concentration." }
  },
  {
    id: "scc_caustic",
    name: "Caustic Stress Corrosion Cracking",
    family: "cracking",
    severity: "critical",
    description: "Cracking of carbon steel under tensile stress and caustic environment.",
    preconditions: {
      stress: { tensile_required: true },
      process_chemistry: { caustic_required: true }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking"],
    rejection_messages: { stress: "Caustic SCC requires tensile stress.", process_chemistry: "Caustic SCC requires caustic environment." }
  },
  {
    id: "ssc_sulfide",
    name: "Sulfide Stress Cracking",
    family: "cracking",
    severity: "critical",
    description: "Cracking of steel under tensile stress and H2S environment.",
    preconditions: {
      stress: { tensile_required: true },
      process_chemistry: { h2s_required: true }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking"],
    rejection_messages: { stress: "SSC requires tensile stress.", process_chemistry: "SSC requires H2S." }
  },
  {
    id: "hic",
    name: "Hydrogen Induced Cracking",
    family: "cracking",
    severity: "high",
    description: "Subsurface cracking from hydrogen diffusion in H2S environment.",
    preconditions: {
      process_chemistry: { h2s_required: true }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking"],
    rejection_messages: { process_chemistry: "HIC requires H2S as hydrogen source." }
  },
  {
    id: "creep",
    name: "Creep Damage",
    family: "damage",
    severity: "critical",
    description: "Time-dependent deformation at elevated temperature under sustained stress.",
    preconditions: {
      thermal: { creep_range_required: true },
      stress: { tensile_required: true }
    },
    observation_evidence_keys: [],
    rejection_messages: { thermal: "Creep requires elevated temperature.", stress: "Creep requires sustained tensile stress." }
  },
  {
    id: "brittle_fracture",
    name: "Brittle Fracture",
    family: "damage",
    severity: "critical",
    description: "Low-ductility fracture at cryogenic temperature.",
    preconditions: {
      thermal: { cryogenic_required: true }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking"],
    rejection_messages: { thermal: "Brittle fracture requires cryogenic temperature." }
  },
  {
    id: "overload_buckling",
    name: "Mechanical Overload / Buckling",
    family: "damage",
    severity: "high",
    description: "Plastic deformation from compressive overload or impact energy.",
    preconditions: {
      stress: { compressive_required: true },
      energy: { impact_event_required: true }
    },
    observation_evidence_keys: ["visible_deformation", "dent_or_gouge_present"],
    rejection_messages: { stress: "Overload requires compressive stress or impact." }
  },
  {
    id: "fire_damage",
    name: "Fire / Thermal Damage",
    family: "thermal",
    severity: "high",
    description: "Material property degradation from fire exposure.",
    preconditions: {
      thermal: { fire_exposure_required: true }
    },
    observation_evidence_keys: ["fire_exposure"],
    rejection_messages: { thermal: "Fire damage requires fire exposure." }
  },
  {
    id: "hydrogen_damage",
    name: "High Temperature Hydrogen Attack",
    family: "damage",
    severity: "critical",
    description: "Internal void nucleation from hydrogen attack at elevated temperature.",
    preconditions: {
      process_chemistry: { hydrogen_required: true },
      thermal: { high_temp_hydrogen_range_required: true }
    },
    observation_evidence_keys: [],
    rejection_messages: { process_chemistry: "Hydrogen attack requires hydrogen.", thermal: "Hydrogen attack requires temperature > 400F." }
  },
  {
    id: "scc_chloride",
    name: "Chloride SCC",
    family: "cracking",
    severity: "critical",
    description: "Cracking of austenitic stainless under tensile stress, chlorides, and elevated temperature.",
    preconditions: {
      material: { class_in: ["austenitic_stainless", "duplex_stainless"] },
      process_chemistry: { chloride_band_min: "trace" },
      thermal: { operating_temp_f_window: [140, 1200] },
      stress: { tensile_required: true }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking"],
    rejection_messages: { material: "CSCC requires austenitic/duplex stainless.", process_chemistry: "CSCC requires chlorides.", thermal: "CSCC requires >140F.", stress: "CSCC requires tensile stress." }
  },
  // DEPLOY185: Naphthenic Acid Corrosion
  {
    id: "naphthenic_acid_corrosion",
    name: "Naphthenic Acid Corrosion",
    family: "corrosion",
    severity: "high",
    description: "Aggressive localized/general corrosion in crude and vacuum units processing high-TAN crudes. Naphthenic acids become corrosive above ~430F, peaking 500-750F, declining above 800F as acids decompose. Carbon steel and low-alloy steels (5Cr and below) are susceptible; 316SS / 317SS with Mo content are resistant.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel"] },
      process_chemistry: { naphthenic_acid_required: true },
      thermal: { operating_temp_f_window: [400, 800] }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed", "localized_thinning"],
    rejection_messages: { material: "Naphthenic acid corrosion primarily affects carbon steel and low-alloy steels (5Cr and below); higher alloys with Mo content are resistant.", process_chemistry_naphthenic: "Naphthenic acid corrosion requires naphthenic acid / high TAN environment; transcript does not indicate naphthenic acid service.", thermal: "Naphthenic acid corrosion is active in the 400-800F range (peak 500-750F); operating temperature is outside this window." }
  },
  // DEPLOY185: Polythionic Acid SCC
  {
    id: "polythionic_acid_scc",
    name: "Polythionic Acid Stress Corrosion Cracking",
    family: "cracking",
    severity: "critical",
    description: "Intergranular cracking of sensitized austenitic stainless steels during shutdown/turnaround when sulfide scale reacts with moisture and oxygen to form polythionic acid. Common in FCC, reformer, and hydroprocessing equipment after high-temperature sulfur service.",
    preconditions: {
      material: { class_in: ["austenitic_stainless", "duplex_stainless"] },
      process_chemistry: { polythionic_acid_required: true }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking", "intergranular_cracking"],
    rejection_messages: { material: "Polythionic acid SCC requires sensitized austenitic or duplex stainless steel.", process_chemistry_polythionic: "Polythionic acid SCC requires polythionic acid environment (sulfide scale + moisture + oxygen during shutdown); transcript does not indicate polythionic acid cracking context." }
  },
  // DEPLOY186: Amine Cracking (Amine SCC)
  {
    id: "amine_cracking",
    name: "Amine Stress Corrosion Cracking",
    family: "cracking",
    severity: "high",
    description: "Intergranular cracking of carbon steel and low-alloy steel in lean amine service (MEA, DEA, MDEA). Occurs at or near welds, particularly in non-PWHT'd components. Most common in amine absorbers, regenerators, and lean/rich amine piping. API 571 Section 5.1.2.2.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel"] },
      process_chemistry: { amine_cracking_required: true }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking"],
    rejection_messages: { material: "Amine SCC affects carbon steel and low-alloy steel; austenitic stainless and higher alloys are resistant.", process_chemistry_amine_cracking: "Amine SCC requires amine service environment (MEA, DEA, MDEA); transcript does not indicate amine service." }
  },
  // DEPLOY186: Carbonate SCC
  {
    id: "carbonate_scc",
    name: "Carbonate Stress Corrosion Cracking",
    family: "cracking",
    severity: "high",
    description: "Intergranular cracking of carbon steel in carbonate-rich alkaline sour water environments. Common in FCC main fractionator overhead systems, sour water strippers, and amine systems where CO2 absorption creates carbonate species. Occurs at welds and HAZ in non-PWHT'd equipment. API 571 Section 5.1.2.5.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel"] },
      process_chemistry: { carbonate_scc_required: true }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking"],
    rejection_messages: { material: "Carbonate SCC affects carbon steel and low-alloy steel.", process_chemistry_carbonate: "Carbonate SCC requires carbonate/alkaline sour water environment; transcript does not indicate carbonate cracking context." }
  },
  // DEPLOY187: 885F Embrittlement (475C Embrittlement)
  {
    id: "embrittlement_885f",
    name: "885F (475C) Embrittlement",
    family: "thermal_degradation",
    severity: "high",
    description: "Loss of toughness and ductility in ferritic stainless steels (400-series) and the ferrite phase of duplex stainless steels from prolonged exposure in the 600-1000F (315-540C) range. Caused by formation of alpha-prime phase in ferrite. API 571 Section 5.1.3.1.",
    preconditions: {
      material: { class_in: ["ferritic_stainless", "duplex_stainless", "martensitic_stainless"] },
      thermal: { operating_temp_f_window: [600, 1000] }
    },
    observation_evidence_keys: [],
    rejection_messages: { material: "885F embrittlement affects ferritic stainless (400-series), martensitic stainless, and the ferrite phase of duplex stainless. Austenitic stainless and carbon steel are not susceptible.", thermal: "885F embrittlement is active in the 600-1000F range; operating temperature is outside this window." }
  },
  // DEPLOY187: Sigma Phase Embrittlement
  {
    id: "sigma_phase_embrittlement",
    name: "Sigma Phase Embrittlement",
    family: "thermal_degradation",
    severity: "high",
    description: "Formation of hard, brittle sigma phase in austenitic and duplex stainless steels during prolonged exposure above 1000F (538C). Sigma phase depletes chromium from the matrix, reducing corrosion resistance and causing severe loss of toughness. Most common in 300-series SS and duplex in the 1000-1600F range. API 571 Section 5.1.3.2.",
    preconditions: {
      material: { class_in: ["austenitic_stainless", "duplex_stainless"] },
      thermal: { operating_temp_f_window: [1000, 1600] }
    },
    observation_evidence_keys: [],
    rejection_messages: { material: "Sigma phase embrittlement affects austenitic stainless (300-series) and duplex stainless steels. Carbon steel and low-alloy steel are not susceptible.", thermal: "Sigma phase formation requires prolonged exposure in the 1000-1600F range; operating temperature is outside this window." }
  },
  // DEPLOY187: Temper Embrittlement
  {
    id: "temper_embrittlement",
    name: "Temper Embrittlement",
    family: "thermal_degradation",
    severity: "critical",
    description: "Loss of toughness in Cr-Mo low-alloy steels (1Cr-0.5Mo, 1.25Cr-0.5Mo, 2.25Cr-1Mo, 3Cr-1Mo) from prolonged service in or slow cooling through the 650-1070F (345-575C) range. Tramp elements (P, Sn, As, Sb) segregate to grain boundaries. Common in hydroprocessing reactor vessels and hot-wall equipment. API 571 Section 5.1.3.3.",
    preconditions: {
      material: { class_in: ["low_alloy_steel"] },
      thermal: { operating_temp_f_window: [650, 1070] }
    },
    observation_evidence_keys: [],
    rejection_messages: { material: "Temper embrittlement primarily affects Cr-Mo low-alloy steels (1Cr through 3Cr); carbon steel and stainless steel are not typically susceptible.", thermal: "Temper embrittlement occurs from service in or slow cooling through the 650-1070F range; operating temperature is outside this window." }
  },
  // DEPLOY188: Carburization
  {
    id: "carburization",
    name: "Carburization",
    family: "thermal_degradation",
    severity: "high",
    description: "Carbon diffusion into steel alloys at temperatures above 1100F (593C) in hydrocarbon process environments. Results in increased hardness, reduced ductility, and potential for cracking. Common in fired heater tubes, reformer tubes, and ethylene cracker tubes. API 571 Section 5.1.3.4.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel", "austenitic_stainless"] },
      thermal: { operating_temp_f_window: [1100, 2000] }
    },
    observation_evidence_keys: [],
    rejection_messages: { material: "Carburization affects carbon steel, low-alloy steel, and austenitic stainless in high-temperature hydrocarbon service.", thermal: "Carburization requires temperatures above 1100F; operating temperature is below this threshold." }
  },
  // DEPLOY188: Metal Dusting
  {
    id: "metal_dusting",
    name: "Metal Dusting",
    family: "corrosion",
    severity: "critical",
    description: "Catastrophic form of carburization occurring in the 900-1500F (480-815C) range in environments with high carbon activity (CO-rich, syngas, reformer effluent). Metal disintegrates into powder mixture of metal particles, carbides, and carbon. API 571 Section 5.1.3.5.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel", "austenitic_stainless", "nickel_alloy"] },
      thermal: { operating_temp_f_window: [900, 1500] }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed"],
    rejection_messages: { material: "Metal dusting can affect carbon steel, low-alloy steel, austenitic stainless, and nickel alloys in CO-rich environments.", thermal: "Metal dusting is active in the 900-1500F range; operating temperature is outside this window." }
  },
  // DEPLOY188: High-Temperature Oxidation
  {
    id: "high_temp_oxidation",
    name: "High-Temperature Oxidation",
    family: "corrosion",
    severity: "medium",
    description: "Formation of oxide scale on metal surfaces at temperatures above 1000F (538C). Rate depends on alloy composition (chromium content provides resistance). Common on fired heater tubes, furnace internals, and high-temperature piping. API 571 Section 5.1.3.6.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel", "austenitic_stainless"] },
      thermal: { operating_temp_f_window: [1000, 2200] }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed"],
    rejection_messages: { material: "High-temperature oxidation affects most engineering alloys at sufficient temperature.", thermal: "Significant oxidation scaling requires temperatures above 1000F; operating temperature is below this threshold." }
  },
  // DEPLOY188: Spheroidization
  {
    id: "spheroidization",
    name: "Spheroidization",
    family: "thermal_degradation",
    severity: "medium",
    description: "Transformation of lamellar pearlite carbides to spheroidal form in carbon steel and C-0.5Mo steels at temperatures above 850F (454C) over long service periods. Reduces tensile and creep strength. Common in fired heater tubes and long-term elevated temperature service. API 571 Section 5.1.3.7.",
    preconditions: {
      material: { class_in: ["carbon_steel"] },
      thermal: { operating_temp_f_window: [850, 1400] }
    },
    observation_evidence_keys: [],
    rejection_messages: { material: "Spheroidization primarily affects carbon steel and C-0.5Mo steel; Cr-Mo steels and stainless are resistant.", thermal: "Spheroidization requires prolonged exposure above 850F; operating temperature is below this threshold." }
  },
  // DEPLOY188: Decarburization
  {
    id: "decarburization",
    name: "Decarburization",
    family: "thermal_degradation",
    severity: "medium",
    description: "Loss of carbon from the surface of steel at temperatures above 800F (427C), particularly in hydrogen-rich or strongly oxidizing environments. Reduces strength and hardness. Distinct from HTHA (which causes internal voids). API 571 Section 5.1.3.8.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel"] },
      thermal: { operating_temp_f_window: [800, 1400] }
    },
    observation_evidence_keys: [],
    rejection_messages: { material: "Decarburization affects carbon steel and low-alloy steels.", thermal: "Decarburization requires temperatures above 800F; operating temperature is below this threshold." }
  },
  // DEPLOY188: Graphitization
  {
    id: "graphitization",
    name: "Graphitization",
    family: "thermal_degradation",
    severity: "high",
    description: "Decomposition of pearlite into ferrite and graphite nodules in carbon steel and C-0.5Mo steels after long-term exposure above 800F (427C). Graphite nodules form preferentially at weld HAZ, creating planes of weakness. Can lead to sudden brittle failure. API 571 Section 5.1.3.9.",
    preconditions: {
      material: { class_in: ["carbon_steel"] },
      thermal: { operating_temp_f_window: [800, 1200] }
    },
    observation_evidence_keys: [],
    rejection_messages: { material: "Graphitization affects carbon steel and C-0.5Mo steel; Cr-Mo steels are resistant.", thermal: "Graphitization requires prolonged exposure above 800F; operating temperature is below this threshold." }
  },
  // DEPLOY189: Galvanic Corrosion
  {
    id: "galvanic_corrosion",
    name: "Galvanic Corrosion",
    family: "corrosion",
    severity: "medium",
    description: "Accelerated corrosion of the less noble (anodic) metal when two dissimilar metals are in electrical contact in the presence of an electrolyte. Rate depends on area ratio, potential difference, and electrolyte conductivity. API 571 Section 5.1.1.3.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel", "austenitic_stainless", "duplex_stainless", "ferritic_stainless", "martensitic_stainless", "nickel_alloy"] },
      environment: { galvanic_context_required: true }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed", "localized_thinning"],
    rejection_messages: { material: "Galvanic corrosion can affect most metallic materials when coupled to a more noble metal.", environment: "Galvanic corrosion requires dissimilar metal contact with an electrolyte present." }
  },
  // DEPLOY189: Atmospheric Corrosion
  {
    id: "atmospheric_corrosion",
    name: "Atmospheric Corrosion",
    family: "corrosion",
    severity: "low",
    description: "General or localized corrosion of metals exposed to the atmosphere, driven by moisture, oxygen, and contaminants (chlorides, SO2, industrial pollutants). Most common on uninsulated, uncoated carbon steel in outdoor service. API 571 Section 5.1.1.4.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel"] },
      environment: { atmospheric_exposure_required: true }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed"],
    rejection_messages: { material: "Atmospheric corrosion primarily affects carbon steel and low-alloy steels.", environment: "Atmospheric corrosion requires outdoor/weather exposure; no atmospheric exposure language detected." }
  },
  // DEPLOY189: Soil-Side Corrosion (Buried Piping)
  {
    id: "soil_corrosion",
    name: "Soil-Side Corrosion",
    family: "corrosion",
    severity: "medium",
    description: "External corrosion of buried or partially buried metallic piping and equipment driven by soil moisture, soil chemistry (pH, resistivity, chlorides, sulfates), stray currents, and microbiological activity. Coating condition and cathodic protection effectiveness are key mitigating factors. API 571 Section 5.1.1.5.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel"] },
      environment: { soil_burial_required: true }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed", "localized_thinning"],
    rejection_messages: { material: "Soil-side corrosion primarily affects carbon steel and low-alloy steel buried piping.", environment: "Soil-side corrosion requires buried or soil-contact conditions; no buried/soil language detected." }
  },
  // DEPLOY189: Cavitation
  {
    id: "cavitation",
    name: "Cavitation Damage",
    family: "corrosion",
    severity: "medium",
    description: "Material removal caused by formation and collapse of vapor bubbles in a liquid near a metal surface. Occurs at locations of sudden pressure drop such as pump impellers, valve seats, orifice plates, and restrictions. Produces characteristic rough, spongy or honeycomb surface damage. API 571 Section 5.1.2.3.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel", "austenitic_stainless", "duplex_stainless", "nickel_alloy"] },
      energy: { cavitation_required: true }
    },
    observation_evidence_keys: ["critical_wall_loss_confirmed", "localized_thinning"],
    rejection_messages: { material: "Cavitation can affect most metallic materials.", energy: "Cavitation requires evidence of vapor bubble collapse conditions (pumps, valves, restrictions); no cavitation language detected." }
  },
  // DEPLOY190: Ammonia SCC
  {
    id: "ammonia_scc",
    name: "Ammonia Stress Corrosion Cracking",
    family: "cracking",
    severity: "critical",
    description: "Stress corrosion cracking of carbon steel, brass, and copper alloys in anhydrous or aqueous ammonia environments. Particularly aggressive in anhydrous ammonia storage and refrigeration systems with air or oxygen contamination. Can also occur in refinery environments with high ammonia concentrations. API 571 Section 5.1.2.2.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel"] },
      process_chemistry: { ammonia_scc_required: true }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking"],
    rejection_messages: { material: "Ammonia SCC primarily affects carbon steel and brass/copper alloys in ammonia service.", process_chemistry: "Ammonia SCC requires ammonia environment; no ammonia service language detected." }
  },
  // DEPLOY190: Hydrogen Embrittlement
  {
    id: "hydrogen_embrittlement",
    name: "Hydrogen Embrittlement",
    family: "cracking",
    severity: "critical",
    description: "Loss of ductility and cracking susceptibility from absorption of atomic hydrogen into steel. Occurs during cathodic charging (cathodic protection, electroplating, pickling), welding with moist consumables, or service in hydrogen-bearing environments. High-strength steels (>90 ksi yield) are most susceptible. Distinct from HTHA which requires >400F. API 571 Section 5.1.2.4.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel", "martensitic_stainless"] },
      process_chemistry: { hydrogen_charging_required: true }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking"],
    rejection_messages: { material: "Hydrogen embrittlement primarily affects carbon steel, low-alloy steel, and high-strength martensitic stainless steels.", process_chemistry: "Hydrogen embrittlement requires a hydrogen charging source (cathodic protection, electroplating, pickling, welding, or H2 service); no hydrogen charging language detected." }
  },
  // DEPLOY190: Wet H2S Blistering / SOHIC
  {
    id: "wet_h2s_blister",
    name: "Wet H2S Blistering / SOHIC",
    family: "cracking",
    severity: "high",
    description: "Hydrogen blistering and stress-oriented hydrogen induced cracking (SOHIC) in carbon steel exposed to wet H2S (sour water) service. Atomic hydrogen from H2S corrosion diffuses into steel, recombines at inclusions forming blisters, or links up along through-thickness stress fields (SOHIC). Most common in sour water strippers, amine units, and FCC gas concentration units. Distinct from HIC (stepwise internal cracking) and SSC (external stress-driven). API 571 Section 5.1.2.5.",
    preconditions: {
      material: { class_in: ["carbon_steel", "low_alloy_steel"] },
      process_chemistry: { wet_h2s_required: true }
    },
    observation_evidence_keys: ["crack_confirmed", "visible_cracking"],
    rejection_messages: { material: "Wet H2S blistering/SOHIC primarily affects carbon steel and low-alloy steels.", process_chemistry: "Wet H2S blistering requires wet (aqueous) H2S service; no wet H2S / sour water language detected." }
  }
];

// Mechanisms migrated to the catalog evaluator path. All other mechanisms
// continue to use the MECH_DEFS predicate path. This list will grow as
// DEPLOY172 and DEPLOY173 ship.
var MIGRATED_TO_CATALOG = ["cui", "general_corrosion", "pitting", "co2_corrosion", "erosion", "cscc", "mic", "sulfidation", "underdeposit_corrosion", "fatigue_mechanical", "fatigue_thermal", "fatigue_vibration", "scc_caustic", "ssc_sulfide", "hic", "creep", "brittle_fracture", "overload_buckling", "fire_damage", "hydrogen_damage", "scc_chloride", "naphthenic_acid_corrosion", "polythionic_acid_scc", "amine_cracking", "carbonate_scc", "embrittlement_885f", "sigma_phase_embrittlement", "temper_embrittlement", "carburization", "metal_dusting", "high_temp_oxidation", "spheroidization", "decarburization", "graphitization", "galvanic_corrosion", "atmospheric_corrosion", "soil_corrosion", "cavitation", "ammonia_scc", "hydrogen_embrittlement", "wet_h2s_blister"];

function evaluateMechanismFromCatalog(mech: any, assetState: any): any {
  var satisfied: any[] = [];
  var violated: any[] = [];
  var unknown: any[] = [];

  // -------------------------------------------------------------------------
  // Material bucket
  // -------------------------------------------------------------------------
  if (mech.preconditions.material) {
    var mp = mech.preconditions.material;
    var matClass = assetState.material.class;

    if (mp.class_in && mp.class_in.length > 0) {
      if (matClass === null || matClass === undefined) {
        unknown.push({
          bucket: "material", field: "class_in", state: "UNKNOWN",
          detail: "Material class not identified in transcript. " + mech.name + " requires material in [" + mp.class_in.join(", ") + "]. Cannot confirm or rule out without explicit material identification."
        });
      } else if (mp.class_in.indexOf(matClass) !== -1) {
        satisfied.push({
          bucket: "material", field: "class_in", state: "SATISFIED",
          detail: "Material class '" + matClass + "' is in the susceptible set [" + mp.class_in.join(", ") + "]."
        });
      } else {
        var rmMat = mech.rejection_messages.material || (mech.name + " requires material in [" + mp.class_in.join(", ") + "]; observed material class is '" + matClass + "'.");
        violated.push({
          bucket: "material", field: "class_in", state: "VIOLATED", detail: rmMat
        });
      }
    }

    if (mp.class_not_in && mp.class_not_in.length > 0) {
      if (matClass === null || matClass === undefined) {
        unknown.push({
          bucket: "material", field: "class_not_in", state: "UNKNOWN",
          detail: "Material class not identified; cannot confirm material is not in the forbidden set [" + mp.class_not_in.join(", ") + "]."
        });
      } else if (mp.class_not_in.indexOf(matClass) !== -1) {
        var rmMat2 = mech.rejection_messages.material || (mech.name + " cannot occur on material class '" + matClass + "'.");
        violated.push({
          bucket: "material", field: "class_not_in", state: "VIOLATED", detail: rmMat2
        });
      } else {
        satisfied.push({
          bucket: "material", field: "class_not_in", state: "SATISFIED",
          detail: "Material class '" + matClass + "' is not in the forbidden set."
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Environment bucket
  // -------------------------------------------------------------------------
  if (mech.preconditions.environment) {
    var ep = mech.preconditions.environment;
    var phasesPresent = assetState.environment.phases_present || [];
    var phasesNegated = assetState.environment.phases_negated || [];

    if (ep.phase_must_include && ep.phase_must_include.length > 0) {
      var hasAny = false;
      var allNegated = true;
      var matchedPhase = "";
      for (var pmi = 0; pmi < ep.phase_must_include.length; pmi++) {
        if (phasesPresent.indexOf(ep.phase_must_include[pmi]) !== -1) {
          hasAny = true;
          matchedPhase = ep.phase_must_include[pmi];
          break;
        }
        if (phasesNegated.indexOf(ep.phase_must_include[pmi]) === -1) {
          allNegated = false;
        }
      }
      if (hasAny) {
        satisfied.push({
          bucket: "environment", field: "phase_must_include", state: "SATISFIED",
          detail: "Required phase observed in transcript: '" + matchedPhase + "'."
        });
      } else if (allNegated) {
        var rmEp = mech.rejection_messages.environment_phase || (mech.name + " requires the presence of " + ep.phase_must_include.join(" or ") + "; transcript explicitly negates all required phases.");
        violated.push({
          bucket: "environment", field: "phase_must_include", state: "VIOLATED", detail: rmEp
        });
      } else {
        unknown.push({
          bucket: "environment", field: "phase_must_include", state: "UNKNOWN",
          detail: mech.name + " requires the presence of " + ep.phase_must_include.join(" or ") + "; transcript neither confirms nor explicitly rules out the required phase."
        });
      }
    }

    if (ep.phase_must_exclude && ep.phase_must_exclude.length > 0) {
      var hasForbidden: string | null = null;
      for (var pej = 0; pej < ep.phase_must_exclude.length; pej++) {
        if (phasesPresent.indexOf(ep.phase_must_exclude[pej]) !== -1) {
          hasForbidden = ep.phase_must_exclude[pej];
          break;
        }
      }
      if (hasForbidden !== null) {
        var rmEp2 = mech.rejection_messages.environment_phase || (mech.name + " cannot occur in the presence of '" + hasForbidden + "'.");
        violated.push({
          bucket: "environment", field: "phase_must_exclude", state: "VIOLATED", detail: rmEp2
        });
      } else {
        satisfied.push({
          bucket: "environment", field: "phase_must_exclude", state: "SATISFIED",
          detail: "No forbidden phase (" + ep.phase_must_exclude.join(", ") + ") observed in transcript."
        });
      }
    }

    if (ep.atmosphere_class_in && ep.atmosphere_class_in.length > 0) {
      var atm = assetState.environment.atmosphere_class;
      if (atm === null || atm === undefined) {
        unknown.push({
          bucket: "environment", field: "atmosphere_class_in", state: "UNKNOWN",
          detail: "Atmosphere class not identified; " + mech.name + " requires atmosphere in [" + ep.atmosphere_class_in.join(", ") + "]."
        });
      } else if (ep.atmosphere_class_in.indexOf(atm) !== -1) {
        satisfied.push({
          bucket: "environment", field: "atmosphere_class_in", state: "SATISFIED",
          detail: "Atmosphere class '" + atm + "' is in the required set."
        });
      } else {
        var rmAtm = mech.rejection_messages.environment_atmosphere || (mech.name + " requires atmosphere class in [" + ep.atmosphere_class_in.join(", ") + "]; observed: '" + atm + "'.");
        violated.push({
          bucket: "environment", field: "atmosphere_class_in", state: "VIOLATED", detail: rmAtm
        });
      }
    }

    // DEPLOY189: galvanic_context_required -- dissimilar metals in electrolyte
    if (ep.galvanic_context_required === true) {
      var envAgents = assetState.environment.agents_present || [];
      if (envAgents.indexOf("galvanic") !== -1) {
        satisfied.push({
          bucket: "environment", field: "galvanic_context_required", state: "SATISFIED",
          detail: "Galvanic / dissimilar metal contact language detected in transcript."
        });
      } else {
        var rmGalv = mech.rejection_messages && mech.rejection_messages.environment ? mech.rejection_messages.environment : (mech.name + " requires dissimilar metal contact with electrolyte; no galvanic language detected.");
        violated.push({
          bucket: "environment", field: "galvanic_context_required", state: "VIOLATED", detail: rmGalv
        });
      }
    }

    // DEPLOY189: atmospheric_exposure_required -- outdoor/weather exposure
    if (ep.atmospheric_exposure_required === true) {
      var envAgents2 = assetState.environment.agents_present || [];
      if (envAgents2.indexOf("atmospheric") !== -1 || envAgents2.indexOf("environmental_exposure") !== -1) {
        satisfied.push({
          bucket: "environment", field: "atmospheric_exposure_required", state: "SATISFIED",
          detail: "Atmospheric / outdoor exposure language detected in transcript."
        });
      } else {
        var rmAtmoCorr = mech.rejection_messages && mech.rejection_messages.environment ? mech.rejection_messages.environment : (mech.name + " requires atmospheric exposure; no outdoor/weather language detected.");
        violated.push({
          bucket: "environment", field: "atmospheric_exposure_required", state: "VIOLATED", detail: rmAtmoCorr
        });
      }
    }

    // DEPLOY189: soil_burial_required -- buried/underground piping
    if (ep.soil_burial_required === true) {
      var envAgents3 = assetState.environment.agents_present || [];
      if (envAgents3.indexOf("soil_contact") !== -1) {
        satisfied.push({
          bucket: "environment", field: "soil_burial_required", state: "SATISFIED",
          detail: "Buried / soil-contact conditions detected in transcript."
        });
      } else {
        var rmSoil = mech.rejection_messages && mech.rejection_messages.environment ? mech.rejection_messages.environment : (mech.name + " requires buried or soil-contact conditions; no buried/soil language detected.");
        violated.push({
          bucket: "environment", field: "soil_burial_required", state: "VIOLATED", detail: rmSoil
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Geometry bucket
  // -------------------------------------------------------------------------
  if (mech.preconditions.geometry) {
    var gp = mech.preconditions.geometry;

    if (gp.insulation_present === true) {
      var ins = assetState.geometry.insulation_present;
      if (ins === true) {
        satisfied.push({
          bucket: "geometry", field: "insulation_present", state: "SATISFIED",
          detail: "Insulation observed in transcript."
        });
      } else if (ins === false) {
        var rmGeo = mech.rejection_messages.geometry || (mech.name + " requires insulation. Transcript indicates uninsulated asset.");
        violated.push({
          bucket: "geometry", field: "insulation_present", state: "VIOLATED", detail: rmGeo
        });
      } else {
        unknown.push({
          bucket: "geometry", field: "insulation_present", state: "UNKNOWN",
          detail: mech.name + " requires insulation; transcript does not state insulation status."
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Thermal bucket
  // -------------------------------------------------------------------------
  if (mech.preconditions.thermal) {
    var tp = mech.preconditions.thermal;

    if (tp.operating_temp_f_window) {
      var tLo = tp.operating_temp_f_window[0];
      var tHi = tp.operating_temp_f_window[1];
      var tF = assetState.thermal.operating_temp_f;
      if (tF === null || tF === undefined) {
        unknown.push({
          bucket: "thermal", field: "operating_temp_f_window", state: "UNKNOWN",
          detail: "Operating temperature not stated; " + mech.name + " requires temperature in [" + tLo + "F, " + tHi + "F]."
        });
      } else if (tF >= tLo && tF <= tHi) {
        satisfied.push({
          bucket: "thermal", field: "operating_temp_f_window", state: "SATISFIED",
          detail: "Operating temperature " + tF + "F is within the required window [" + tLo + "F, " + tHi + "F]."
        });
      } else {
        var rmTherm = mech.rejection_messages.thermal || (mech.name + " requires temperature in [" + tLo + "F, " + tHi + "F]; observed " + tF + "F is outside the physically active window.");
        violated.push({
          bucket: "thermal", field: "operating_temp_f_window", state: "VIOLATED", detail: rmTherm
        });
      }
    }
    if (tp.thermal_cycling_required === true) {
      var thc = assetState.thermal.thermal_cycling;
      if (thc === true) {
        satisfied.push({
          bucket: "thermal", field: "thermal_cycling_required", state: "SATISFIED",
          detail: "Thermal cycling confirmed (startup/shutdown or temperature variations)."
        });
      } else if (thc === false) {
        var rmThc = mech.rejection_messages && mech.rejection_messages.thermal ? mech.rejection_messages.thermal : (mech.name + " requires thermal cycling; equipment operates at steady temperature.");
        violated.push({
          bucket: "thermal", field: "thermal_cycling_required", state: "VIOLATED", detail: rmThc
        });
      } else {
        unknown.push({
          bucket: "thermal", field: "thermal_cycling_required", state: "UNKNOWN",
          detail: mech.name + " requires thermal cycling; temperature variation history not documented."
        });
      }
    }

    if (tp.creep_range_required === true) {
      var cr = assetState.thermal.creep_range;
      if (cr === true) {
        satisfied.push({
          bucket: "thermal", field: "creep_range_required", state: "SATISFIED",
          detail: "Operating temperature is in the creep range for the material."
        });
      } else if (cr === false) {
        var rmCr = mech.rejection_messages && mech.rejection_messages.thermal ? mech.rejection_messages.thermal : (mech.name + " requires service in the creep temperature range; operating temperature is below creep threshold.");
        violated.push({
          bucket: "thermal", field: "creep_range_required", state: "VIOLATED", detail: rmCr
        });
      } else {
        unknown.push({
          bucket: "thermal", field: "creep_range_required", state: "UNKNOWN",
          detail: mech.name + " requires elevated temperature in creep range; temperature not precisely determined."
        });
      }
    }

    if (tp.cryogenic_required === true) {
      var cryog = assetState.thermal.cryogenic;
      if (cryog === true) {
        satisfied.push({
          bucket: "thermal", field: "cryogenic_required", state: "SATISFIED",
          detail: "Cryogenic or sub-zero temperature service confirmed."
        });
      } else if (cryog === false) {
        var rmCryog = mech.rejection_messages && mech.rejection_messages.thermal ? mech.rejection_messages.thermal : (mech.name + " requires cryogenic temperature; equipment operates at or above ambient.");
        violated.push({
          bucket: "thermal", field: "cryogenic_required", state: "VIOLATED", detail: rmCryog
        });
      } else {
        unknown.push({
          bucket: "thermal", field: "cryogenic_required", state: "UNKNOWN",
          detail: mech.name + " requires cryogenic temperature; operating temperature not precisely determined."
        });
      }
    }

    if (tp.fire_exposure_required === true) {
      var fe = assetState.thermal.fire_exposure;
      if (fe === true) {
        satisfied.push({
          bucket: "thermal", field: "fire_exposure_required", state: "SATISFIED",
          detail: "Fire exposure or thermal event confirmed."
        });
      } else if (fe === false) {
        var rmFe = mech.rejection_messages && mech.rejection_messages.thermal ? mech.rejection_messages.thermal : (mech.name + " requires fire exposure; no fire event in history.");
        violated.push({
          bucket: "thermal", field: "fire_exposure_required", state: "VIOLATED", detail: rmFe
        });
      } else {
        unknown.push({
          bucket: "thermal", field: "fire_exposure_required", state: "UNKNOWN",
          detail: mech.name + " requires fire exposure; thermal event history not documented."
        });
      }
    }

    if (tp.high_temp_hydrogen_range_required === true) {
      var hth = assetState.thermal.operating_temp_f;
      if (hth === null || hth === undefined) {
        unknown.push({
          bucket: "thermal", field: "high_temp_hydrogen_range_required", state: "UNKNOWN",
          detail: "Operating temperature not stated; " + mech.name + " requires temperature above 400F."
        });
      } else if (hth > 400) {
        satisfied.push({
          bucket: "thermal", field: "high_temp_hydrogen_range_required", state: "SATISFIED",
          detail: "Operating temperature " + hth + "F exceeds 400F hydrogen attack threshold."
        });
      } else {
        var rmHth = mech.rejection_messages && mech.rejection_messages.thermal ? mech.rejection_messages.thermal : (mech.name + " requires temperature above 400F; operating temperature is " + hth + "F.");
        violated.push({
          bucket: "thermal", field: "high_temp_hydrogen_range_required", state: "VIOLATED", detail: rmHth
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // DEPLOY171.6 v2.6.2: Process chemistry bucket
  // Supports: chloride_band_min, sulfur_required, amine_present, nh4_salt_required.
  // No catalog mechanism in v2.6.2 declares this bucket -- handler is dead
  // code until DEPLOY172 ships cscc, sulfidation, mic, underdeposit_corrosion.
  // -------------------------------------------------------------------------
  if (mech.preconditions.process_chemistry) {
    var pcp = mech.preconditions.process_chemistry;
    var pc = assetState.process_chemistry || { chloride_band: null, sulfur_class: null, amine_type: null, nh4_salt_potential: null };

    if (pcp.chloride_band_min) {
      var bandRank: any = { "trace": 1, "low": 2, "medium": 3, "high": 4 };
      var requiredRank = bandRank[pcp.chloride_band_min] || 0;
      var observedBand = pc.chloride_band;
      if (observedBand === null || observedBand === undefined) {
        unknown.push({
          bucket: "process_chemistry", field: "chloride_band_min", state: "UNKNOWN",
          detail: "Chloride concentration not identified in transcript. " + mech.name + " requires chloride band at or above '" + pcp.chloride_band_min + "'."
        });
      } else if (observedBand === "none") {
        var rmCl = mech.rejection_messages && mech.rejection_messages.process_chemistry_chloride ? mech.rejection_messages.process_chemistry_chloride : (mech.name + " requires chlorides at or above '" + pcp.chloride_band_min + "' band; transcript explicitly indicates no chlorides.");
        violated.push({
          bucket: "process_chemistry", field: "chloride_band_min", state: "VIOLATED", detail: rmCl
        });
      } else {
        var observedRank = bandRank[observedBand] || 0;
        if (observedRank >= requiredRank) {
          satisfied.push({
            bucket: "process_chemistry", field: "chloride_band_min", state: "SATISFIED",
            detail: "Chloride band '" + observedBand + "' meets or exceeds required '" + pcp.chloride_band_min + "'."
          });
        } else {
          var rmCl2 = mech.rejection_messages && mech.rejection_messages.process_chemistry_chloride ? mech.rejection_messages.process_chemistry_chloride : (mech.name + " requires chloride band at or above '" + pcp.chloride_band_min + "'; observed band is '" + observedBand + "'.");
          violated.push({
            bucket: "process_chemistry", field: "chloride_band_min", state: "VIOLATED", detail: rmCl2
          });
        }
      }
    }

    if (pcp.sulfur_required === true) {
      var sc = pc.sulfur_class;
      if (sc === null || sc === undefined) {
        unknown.push({
          bucket: "process_chemistry", field: "sulfur_required", state: "UNKNOWN",
          detail: "Sulfur class not identified in transcript. " + mech.name + " requires sulfur-bearing service."
        });
      } else if (sc === "none") {
        var rmS = mech.rejection_messages && mech.rejection_messages.process_chemistry_sulfur ? mech.rejection_messages.process_chemistry_sulfur : (mech.name + " requires sulfur-bearing service; transcript explicitly indicates no sulfur.");
        violated.push({
          bucket: "process_chemistry", field: "sulfur_required", state: "VIOLATED", detail: rmS
        });
      } else {
        satisfied.push({
          bucket: "process_chemistry", field: "sulfur_required", state: "SATISFIED",
          detail: "Sulfur class '" + sc + "' satisfies requirement."
        });
      }
    }

    if (pcp.amine_present === true) {
      var at = pc.amine_type;
      if (at === null || at === undefined) {
        unknown.push({
          bucket: "process_chemistry", field: "amine_present", state: "UNKNOWN",
          detail: "Amine service not identified in transcript. " + mech.name + " requires amine service."
        });
      } else {
        satisfied.push({
          bucket: "process_chemistry", field: "amine_present", state: "SATISFIED",
          detail: "Amine type '" + at + "' detected."
        });
      }
    }

    if (pcp.nh4_salt_required === true) {
      var ns = pc.nh4_salt_potential;
      if (ns === true) {
        satisfied.push({
          bucket: "process_chemistry", field: "nh4_salt_required", state: "SATISFIED",
          detail: "Ammonium salt potential indicated by service context."
        });
      } else if (ns === false) {
        var rmN = mech.rejection_messages && mech.rejection_messages.process_chemistry_nh4 ? mech.rejection_messages.process_chemistry_nh4 : (mech.name + " requires ammonium salt potential; transcript explicitly negates ammonium salt formation conditions.");
        violated.push({
          bucket: "process_chemistry", field: "nh4_salt_required", state: "VIOLATED", detail: rmN
        });
      } else {
        unknown.push({
          bucket: "process_chemistry", field: "nh4_salt_required", state: "UNKNOWN",
          detail: "Ammonium salt potential not identified. " + mech.name + " requires ammonium salt formation conditions (chlorides or ammonia in condensing overhead service)."
        });
      }
    }    if (pcp.h2s_required === true) {
      var h2s = pc.h2s_present;
      if (h2s === true) {
        satisfied.push({
          bucket: "process_chemistry", field: "h2s_required", state: "SATISFIED",
          detail: "H2S present in process stream (hydrogen source)."
        });
      } else if (h2s === false) {
        var rmH2s = mech.rejection_messages && mech.rejection_messages.process_chemistry ? mech.rejection_messages.process_chemistry : (mech.name + " requires H2S; transcript indicates sweet service without H2S.");
        violated.push({
          bucket: "process_chemistry", field: "h2s_required", state: "VIOLATED", detail: rmH2s
        });
      } else {
        unknown.push({
          bucket: "process_chemistry", field: "h2s_required", state: "UNKNOWN",
          detail: mech.name + " requires H2S as hydrogen source; H2S presence not determined from transcript."
        });
      }
    }

    if (pcp.caustic_required === true) {
      var ca = pc.caustic_present;
      if (ca === true) {
        satisfied.push({
          bucket: "process_chemistry", field: "caustic_required", state: "SATISFIED",
          detail: "Caustic (NaOH) environment confirmed."
        });
      } else if (ca === false) {
        var rmCa = mech.rejection_messages && mech.rejection_messages.process_chemistry ? mech.rejection_messages.process_chemistry : (mech.name + " requires caustic environment; transcript indicates no caustic.");
        violated.push({
          bucket: "process_chemistry", field: "caustic_required", state: "VIOLATED", detail: rmCa
        });
      } else {
        unknown.push({
          bucket: "process_chemistry", field: "caustic_required", state: "UNKNOWN",
          detail: mech.name + " requires caustic environment; caustic presence not determined from transcript."
        });
      }
    }

    if (pcp.hydrogen_required === true) {
      var hy = pc.hydrogen_present;
      if (hy === true) {
        satisfied.push({
          bucket: "process_chemistry", field: "hydrogen_required", state: "SATISFIED",
          detail: "Hydrogen environment confirmed (refinery hydrogen, synthesis gas, etc.)."
        });
      } else if (hy === false) {
        var rmHy = mech.rejection_messages && mech.rejection_messages.process_chemistry ? mech.rejection_messages.process_chemistry : (mech.name + " requires hydrogen environment; service is non-hydrogen bearing.");
        violated.push({
          bucket: "process_chemistry", field: "hydrogen_required", state: "VIOLATED", detail: rmHy
        });
      } else {
        unknown.push({
          bucket: "process_chemistry", field: "hydrogen_required", state: "UNKNOWN",
          detail: mech.name + " requires hydrogen in process stream; hydrogen presence not determined from transcript."
        });
      }
    }

    // DEPLOY185: Naphthenic acid required
    if (pcp.naphthenic_acid_required === true) {
      var nap = pc.naphthenic_acid_present;
      if (nap === true) {
        satisfied.push({
          bucket: "process_chemistry", field: "naphthenic_acid_required", state: "SATISFIED",
          detail: "Naphthenic acid / high TAN environment confirmed (crude unit, high acid crude, or explicit TAN language)."
        });
      } else if (nap === false) {
        var rmNap = mech.rejection_messages && mech.rejection_messages.process_chemistry_naphthenic ? mech.rejection_messages.process_chemistry_naphthenic : (mech.name + " requires naphthenic acid / high TAN environment; transcript does not indicate naphthenic acid service.");
        violated.push({
          bucket: "process_chemistry", field: "naphthenic_acid_required", state: "VIOLATED", detail: rmNap
        });
      } else {
        unknown.push({
          bucket: "process_chemistry", field: "naphthenic_acid_required", state: "UNKNOWN",
          detail: mech.name + " requires naphthenic acid / high TAN environment; naphthenic acid presence not determined from transcript."
        });
      }
    }

    // DEPLOY185: Polythionic acid required
    if (pcp.polythionic_acid_required === true) {
      var pta = pc.polythionic_acid_present;
      if (pta === true) {
        satisfied.push({
          bucket: "process_chemistry", field: "polythionic_acid_required", state: "SATISFIED",
          detail: "Polythionic acid environment confirmed (sensitized stainless, shutdown/turnaround cracking context)."
        });
      } else if (pta === false) {
        var rmPta = mech.rejection_messages && mech.rejection_messages.process_chemistry_polythionic ? mech.rejection_messages.process_chemistry_polythionic : (mech.name + " requires polythionic acid environment; transcript does not indicate polythionic acid cracking context.");
        violated.push({
          bucket: "process_chemistry", field: "polythionic_acid_required", state: "VIOLATED", detail: rmPta
        });
      } else {
        unknown.push({
          bucket: "process_chemistry", field: "polythionic_acid_required", state: "UNKNOWN",
          detail: mech.name + " requires polythionic acid environment; polythionic acid presence not determined from transcript."
        });
      }
    }

    // DEPLOY186: Amine cracking required
    if (pcp.amine_cracking_required === true) {
      var amCrk = pc.amine_cracking_context;
      var amType = pc.amine_type;
      if (amCrk === true) {
        satisfied.push({
          bucket: "process_chemistry", field: "amine_cracking_required", state: "SATISFIED",
          detail: "Amine cracking context confirmed (amine service with cracking language" + (amType ? ", amine type: " + amType : "") + ")."
        });
      } else if (amType !== null && amType !== undefined) {
        // Amine service detected but no explicit cracking language -- still SATISFIED
        // because amine_present means the environment exists even without crack keywords
        satisfied.push({
          bucket: "process_chemistry", field: "amine_cracking_required", state: "SATISFIED",
          detail: "Amine service confirmed (" + amType + "); amine cracking environment present."
        });
      } else if (amCrk === false && (amType === null || amType === undefined)) {
        var rmAmCrk = mech.rejection_messages && mech.rejection_messages.process_chemistry_amine_cracking ? mech.rejection_messages.process_chemistry_amine_cracking : (mech.name + " requires amine service environment; transcript does not indicate amine service.");
        violated.push({
          bucket: "process_chemistry", field: "amine_cracking_required", state: "VIOLATED", detail: rmAmCrk
        });
      } else {
        unknown.push({
          bucket: "process_chemistry", field: "amine_cracking_required", state: "UNKNOWN",
          detail: mech.name + " requires amine service environment; amine presence not determined from transcript."
        });
      }
    }

    // DEPLOY186: Carbonate SCC required
    if (pcp.carbonate_scc_required === true) {
      var carbCtx = pc.carbonate_scc_context;
      if (carbCtx === true) {
        satisfied.push({
          bucket: "process_chemistry", field: "carbonate_scc_required", state: "SATISFIED",
          detail: "Carbonate SCC environment confirmed (carbonate/alkaline sour water language detected)."
        });
      } else if (carbCtx === false) {
        var rmCarb = mech.rejection_messages && mech.rejection_messages.process_chemistry_carbonate ? mech.rejection_messages.process_chemistry_carbonate : (mech.name + " requires carbonate/alkaline sour water environment; transcript does not indicate carbonate SCC context.");
        violated.push({
          bucket: "process_chemistry", field: "carbonate_scc_required", state: "VIOLATED", detail: rmCarb
        });
      } else {
        unknown.push({
          bucket: "process_chemistry", field: "carbonate_scc_required", state: "UNKNOWN",
          detail: mech.name + " requires carbonate/alkaline sour water environment; carbonate presence not determined from transcript."
        });
      }
    }

    // DEPLOY190: Ammonia SCC required
    if (pcp.ammonia_scc_required === true) {
      var amScc = pc.ammonia_scc_context;
      if (amScc === true) {
        satisfied.push({
          bucket: "process_chemistry", field: "ammonia_scc_required", state: "SATISFIED",
          detail: "Ammonia SCC environment confirmed (ammonia service / anhydrous ammonia language detected)."
        });
      } else {
        var rmAmScc = mech.rejection_messages && mech.rejection_messages.process_chemistry ? mech.rejection_messages.process_chemistry : (mech.name + " requires ammonia environment; no ammonia service language detected.");
        violated.push({
          bucket: "process_chemistry", field: "ammonia_scc_required", state: "VIOLATED", detail: rmAmScc
        });
      }
    }

    // DEPLOY190: Hydrogen charging required (HE -- distinct from HTHA hydrogen_required)
    if (pcp.hydrogen_charging_required === true) {
      var hCharge = pc.hydrogen_charging_context;
      if (hCharge === true) {
        satisfied.push({
          bucket: "process_chemistry", field: "hydrogen_charging_required", state: "SATISFIED",
          detail: "Hydrogen charging source confirmed (cathodic protection, electroplating, pickling, welding, or H2 service)."
        });
      } else {
        var rmHCharge = mech.rejection_messages && mech.rejection_messages.process_chemistry ? mech.rejection_messages.process_chemistry : (mech.name + " requires hydrogen charging source; no hydrogen charging language detected.");
        violated.push({
          bucket: "process_chemistry", field: "hydrogen_charging_required", state: "VIOLATED", detail: rmHCharge
        });
      }
    }

    // DEPLOY190: Wet H2S required (blistering/SOHIC -- distinct from HIC h2s_required)
    if (pcp.wet_h2s_required === true) {
      var wetH2s = pc.wet_h2s_context;
      if (wetH2s === true) {
        satisfied.push({
          bucket: "process_chemistry", field: "wet_h2s_required", state: "SATISFIED",
          detail: "Wet H2S / sour water environment confirmed (blistering/SOHIC conditions present)."
        });
      } else {
        var rmWetH2s = mech.rejection_messages && mech.rejection_messages.process_chemistry ? mech.rejection_messages.process_chemistry : (mech.name + " requires wet (aqueous) H2S service; no wet H2S / sour water blistering language detected.");
        violated.push({
          bucket: "process_chemistry", field: "wet_h2s_required", state: "VIOLATED", detail: rmWetH2s
        });
      }
    }

  }

  // -------------------------------------------------------------------------
  // DEPLOY171.6 v2.6.2: Flow regime bucket
  // Supports: flow_state_in, deadleg_required, turbulence_geometry_required.
  // No catalog mechanism in v2.6.2 declares this bucket -- handler is dead
  // code until DEPLOY172 ships mic, erosion (migrated), underdeposit_corrosion.
  // -------------------------------------------------------------------------
  if (mech.preconditions.flow_regime) {
    var fp = mech.preconditions.flow_regime;
    var fr = assetState.flow_regime || { flow_state: null, deadleg: null, turbulence_geometry_present: null };

    if (fp.flow_state_in && fp.flow_state_in.length > 0) {
      var fs = fr.flow_state;
      if (fs === null || fs === undefined) {
        unknown.push({
          bucket: "flow_regime", field: "flow_state_in", state: "UNKNOWN",
          detail: "Flow state not identified in transcript. " + mech.name + " requires flow state in [" + fp.flow_state_in.join(", ") + "]."
        });
      } else if (fp.flow_state_in.indexOf(fs) !== -1) {
        satisfied.push({
          bucket: "flow_regime", field: "flow_state_in", state: "SATISFIED",
          detail: "Flow state '" + fs + "' is in the required set [" + fp.flow_state_in.join(", ") + "]."
        });
      } else {
        var rmFs = mech.rejection_messages && mech.rejection_messages.flow_regime_state ? mech.rejection_messages.flow_regime_state : (mech.name + " requires flow state in [" + fp.flow_state_in.join(", ") + "]; observed flow state is '" + fs + "'.");
        violated.push({
          bucket: "flow_regime", field: "flow_state_in", state: "VIOLATED", detail: rmFs
        });
      }
    }

    if (fp.deadleg_required === true) {
      var dl = fr.deadleg;
      if (dl === true) {
        satisfied.push({
          bucket: "flow_regime", field: "deadleg_required", state: "SATISFIED",
          detail: "Deadleg geometry observed in transcript."
        });
      } else if (dl === false) {
        var rmDl = mech.rejection_messages && mech.rejection_messages.flow_regime_deadleg ? mech.rejection_messages.flow_regime_deadleg : (mech.name + " requires deadleg geometry; transcript indicates no deadleg.");
        violated.push({
          bucket: "flow_regime", field: "deadleg_required", state: "VIOLATED", detail: rmDl
        });
      } else {
        unknown.push({
          bucket: "flow_regime", field: "deadleg_required", state: "UNKNOWN",
          detail: mech.name + " requires deadleg geometry; transcript does not state deadleg presence."
        });
      }
    }

    if (fp.turbulence_geometry_required === true) {
      var tg = fr.turbulence_geometry_present;
      if (tg === true) {
        satisfied.push({
          bucket: "flow_regime", field: "turbulence_geometry_required", state: "SATISFIED",
          detail: "Turbulence geometry (elbow/tee/reducer with downstream attack) observed."
        });
      } else if (tg === false) {
        var rmTg = mech.rejection_messages && mech.rejection_messages.flow_regime_turbulence ? mech.rejection_messages.flow_regime_turbulence : (mech.name + " requires turbulence-inducing geometry; transcript indicates no such geometry.");
        violated.push({
          bucket: "flow_regime", field: "turbulence_geometry_required", state: "VIOLATED", detail: rmTg
        });
      } else {
        unknown.push({
          bucket: "flow_regime", field: "turbulence_geometry_required", state: "UNKNOWN",
          detail: mech.name + " requires turbulence-inducing geometry; transcript does not state geometry."
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // DEPLOY171.6 v2.6.2: Deposits bucket
  // Supports: deposits_required, deposit_type_in.
  // No catalog mechanism in v2.6.2 declares this bucket -- handler is dead
  // code until DEPLOY172 ships mic and underdeposit_corrosion.
  // -------------------------------------------------------------------------
  if (mech.preconditions.deposits) {
    var dp = mech.preconditions.deposits;
    var dep = assetState.deposits || { deposits_present: null, deposit_type: null, deposit_evidence: [] };

    if (dp.deposits_required === true) {
      var dpres = dep.deposits_present;
      if (dpres === true) {
        satisfied.push({
          bucket: "deposits", field: "deposits_required", state: "SATISFIED",
          detail: "Deposits observed in transcript: " + (dep.deposit_evidence && dep.deposit_evidence.length > 0 ? dep.deposit_evidence.join(", ") : "deposit language detected") + "."
        });
      } else if (dpres === false) {
        var rmDp = mech.rejection_messages && mech.rejection_messages.deposits_required ? mech.rejection_messages.deposits_required : (mech.name + " requires surface deposits; transcript indicates clean internal surface.");
        violated.push({
          bucket: "deposits", field: "deposits_required", state: "VIOLATED", detail: rmDp
        });
      } else {
        unknown.push({
          bucket: "deposits", field: "deposits_required", state: "UNKNOWN",
          detail: mech.name + " requires surface deposits; transcript does not state deposit presence."
        });
      }
    }

    if (dp.deposit_type_in && dp.deposit_type_in.length > 0) {
      var dt = dep.deposit_type;
      if (dt === null || dt === undefined) {
        unknown.push({
          bucket: "deposits", field: "deposit_type_in", state: "UNKNOWN",
          detail: "Deposit type not identified. " + mech.name + " requires deposit type in [" + dp.deposit_type_in.join(", ") + "]."
        });
      } else if (dp.deposit_type_in.indexOf(dt) !== -1) {
        satisfied.push({
          bucket: "deposits", field: "deposit_type_in", state: "SATISFIED",
          detail: "Deposit type '" + dt + "' is in the required set [" + dp.deposit_type_in.join(", ") + "]."
        });
      } else {
        var rmDt = mech.rejection_messages && mech.rejection_messages.deposits_type ? mech.rejection_messages.deposits_type : (mech.name + " requires deposit type in [" + dp.deposit_type_in.join(", ") + "]; observed deposit type is '" + dt + "'.");
        violated.push({
          bucket: "deposits", field: "deposit_type_in", state: "VIOLATED", detail: rmDt
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Stress bucket -- schema declared, no checks active in DEPLOY171.
  // Cracking/fatigue/creep migration in DEPLOY173 will use this bucket.
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // DEPLOY173 v2.8.0: Stress bucket
  // Supports: tensile_required, cyclic_required, compressive_required,
  // stress_concentration_required.
  // -------------------------------------------------------------------------
  if (mech.preconditions.stress) {
    var stp = mech.preconditions.stress;

    if (stp.tensile_required === true) {
      var tens = assetState.stress.tensile;
      if (tens === true) {
        satisfied.push({
          bucket: "stress", field: "tensile_required", state: "SATISFIED",
          detail: "Tensile stress confirmed in service conditions."
        });
      } else if (tens === false) {
        var rmTens = mech.rejection_messages && mech.rejection_messages.stress ? mech.rejection_messages.stress : (mech.name + " requires tensile stress; transcript indicates no tensile loading.");
        violated.push({
          bucket: "stress", field: "tensile_required", state: "VIOLATED", detail: rmTens
        });
      } else {
        unknown.push({
          bucket: "stress", field: "tensile_required", state: "UNKNOWN",
          detail: mech.name + " requires tensile stress; stress state not determined from transcript."
        });
      }
    }

    if (stp.cyclic_required === true) {
      var cyc = assetState.stress.cyclic;
      if (cyc === true) {
        satisfied.push({
          bucket: "stress", field: "cyclic_required", state: "SATISFIED",
          detail: "Cyclic loading confirmed in service history."
        });
      } else if (cyc === false) {
        var rmCyc = mech.rejection_messages && mech.rejection_messages.stress ? mech.rejection_messages.stress : (mech.name + " requires cyclic loading; transcript indicates sustained or static loading only.");
        violated.push({
          bucket: "stress", field: "cyclic_required", state: "VIOLATED", detail: rmCyc
        });
      } else {
        unknown.push({
          bucket: "stress", field: "cyclic_required", state: "UNKNOWN",
          detail: mech.name + " requires cyclic loading; transcript does not state whether loading cycles."
        });
      }
    }

    if (stp.compressive_required === true) {
      var comp = assetState.stress.compressive;
      if (comp === true) {
        satisfied.push({
          bucket: "stress", field: "compressive_required", state: "SATISFIED",
          detail: "Compressive stress or overload confirmed."
        });
      } else if (comp === false) {
        var rmComp = mech.rejection_messages && mech.rejection_messages.stress ? mech.rejection_messages.stress : (mech.name + " requires compressive stress or overload; transcript indicates tension or neutral loading only.");
        violated.push({
          bucket: "stress", field: "compressive_required", state: "VIOLATED", detail: rmComp
        });
      } else {
        unknown.push({
          bucket: "stress", field: "compressive_required", state: "UNKNOWN",
          detail: mech.name + " requires compressive stress or overload; stress state not determined from transcript."
        });
      }
    }

    if (stp.stress_concentration_required === true) {
      var stc = assetState.stress.stress_concentration_present;
      if (stc === true) {
        satisfied.push({
          bucket: "stress", field: "stress_concentration_required", state: "SATISFIED",
          detail: "Stress concentration present (weld, notch, dent, or discontinuity)."
        });
      } else if (stc === false) {
        var rmStc = mech.rejection_messages && mech.rejection_messages.stress ? mech.rejection_messages.stress : (mech.name + " requires a stress concentration site (weld, notch, dent); none detected.");
        violated.push({
          bucket: "stress", field: "stress_concentration_required", state: "VIOLATED", detail: rmStc
        });
      } else {
        unknown.push({
          bucket: "stress", field: "stress_concentration_required", state: "UNKNOWN",
          detail: mech.name + " requires a stress concentration site; geometry not fully characterized."
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // DEPLOY173 v2.8.0: Energy bucket
  // Supports: vibration_required, impact_event_required.
  // -------------------------------------------------------------------------
  if (mech.preconditions.energy) {
    var enp = mech.preconditions.energy;

    if (enp.vibration_required === true) {
      var vib = assetState.energy.vibration;
      if (vib === true) {
        satisfied.push({
          bucket: "energy", field: "vibration_required", state: "SATISFIED",
          detail: "Vibration loading confirmed in service."
        });
      } else if (vib === false) {
        var rmVib = mech.rejection_messages && mech.rejection_messages.energy ? mech.rejection_messages.energy : (mech.name + " requires vibration as an energy source; no vibration detected.");
        violated.push({
          bucket: "energy", field: "vibration_required", state: "VIOLATED", detail: rmVib
        });
      } else {
        unknown.push({
          bucket: "energy", field: "vibration_required", state: "UNKNOWN",
          detail: mech.name + " requires vibration; vibration presence not determined from transcript."
        });
      }
    }

    if (enp.impact_event_required === true) {
      var imp = assetState.energy.impact_event;
      if (imp === true) {
        satisfied.push({
          bucket: "energy", field: "impact_event_required", state: "SATISFIED",
          detail: "Impact energy or overload event confirmed."
        });
      } else if (imp === false) {
        var rmImp = mech.rejection_messages && mech.rejection_messages.energy ? mech.rejection_messages.energy : (mech.name + " requires impact energy or overload event; no such event in history.");
        violated.push({
          bucket: "energy", field: "impact_event_required", state: "VIOLATED", detail: rmImp
        });
      } else {
        unknown.push({
          bucket: "energy", field: "impact_event_required", state: "UNKNOWN",
          detail: mech.name + " requires impact energy or overload event; event history not fully documented."
        });
      }
    }

    // DEPLOY189: cavitation_required handler
    if (enp.cavitation_required === true) {
      var cavSt = assetState.energy.cavitation;
      if (cavSt === true) {
        satisfied.push({
          bucket: "energy", field: "cavitation_required", state: "SATISFIED",
          detail: "Cavitation conditions confirmed in transcript."
        });
      } else if (cavSt === false) {
        var rmCav = mech.rejection_messages && mech.rejection_messages.energy ? mech.rejection_messages.energy : (mech.name + " requires cavitation conditions; no cavitation language detected.");
        violated.push({
          bucket: "energy", field: "cavitation_required", state: "VIOLATED", detail: rmCav
        });
      } else {
        unknown.push({
          bucket: "energy", field: "cavitation_required", state: "UNKNOWN",
          detail: mech.name + " requires cavitation conditions; cavitation presence not determined from transcript."
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Determine overall status
  // -------------------------------------------------------------------------
  var status = "ELIGIBLE";
  if (violated.length > 0) {
    status = "REJECTED";
  } else if (unknown.length > 0) {
    status = "INDETERMINATE";
  }

  var rejectionSummary: string | null = null;
  if (status === "REJECTED") {
    var rrParts: string[] = [];
    for (var rri = 0; rri < violated.length; rri++) rrParts.push(violated[rri].detail);
    rejectionSummary = rrParts.join(" ");
  }

  var indeterminateSummary: string | null = null;
  if (status === "INDETERMINATE") {
    var iiParts: string[] = [];
    for (var iii = 0; iii < unknown.length; iii++) iiParts.push(unknown[iii].detail);
    indeterminateSummary = "Mechanism cannot be confirmed or ruled out from the available evidence. Missing data: " + iiParts.join(" ");
  }

  return {
    mechanism_id: mech.id,
    mechanism_name: mech.name,
    mechanism_family: mech.family,
    status: status,
    satisfied: satisfied,
    violated: violated,
    unknown: unknown,
    rejection_summary: rejectionSummary,
    indeterminate_summary: indeterminateSummary
  };
}

function buildAssetStateForCatalog(physics: any, transcript: string): any {
  var lt = transcript.toLowerCase();

  // Insulation status from explicit transcript language. Defaults to null
  // (unknown) -- null is the correct answer when the inspector did not state
  // whether the asset is insulated.
  var insulationPresent: boolean | null = null;
  if (hasWord(lt, "no insulation") || hasWord(lt, "uninsulated") || hasWord(lt, "not insulated") || hasWord(lt, "insulation removed") || hasWord(lt, "bare pipe") || hasWord(lt, "bare line") || hasWord(lt, "bare metal")) {
    insulationPresent = false;
  } else if (hasWord(lt, "insulated") || hasWord(lt, "insulation") || hasWord(lt, "lagging") || hasWord(lt, "jacketing") || hasWord(lt, "fireproofing") || hasWord(lt, "cladded") || hasWord(lt, "under the insulation") || hasWord(lt, "under insulation")) {
    insulationPresent = true;
  }

  return {
    material: physics.material || { class: null, class_confidence: 0, evidence: [] },
    environment: {
      phases_present: (physics.environment && physics.environment.phases_present) || [],
      phases_negated: (physics.environment && physics.environment.phases_negated) || [],
      atmosphere_class: (physics.environment && physics.environment.atmosphere_class) || null,
      agents_present: physics.chemical.environment_agents || [],
      agents_negated: []
    },
    geometry: {
      insulation_present: insulationPresent,
      welds_present: physics.stress.stress_concentration_locations.length > 0 ? true : null,
      stress_concentration_present: physics.stress.stress_concentration_present
    },
    thermal: {
      operating_temp_f: physics.thermal.operating_temp_f,
      fire_exposure: physics.thermal.fire_exposure,
      thermal_cycling: physics.thermal.thermal_cycling,
      creep_range: physics.thermal.creep_range || false,
      cryogenic: physics.thermal.cryogenic || false
    },
    stress: {
      tensile: physics.stress.tensile_stress,
      cyclic: physics.stress.cyclic_loading,
      sustained: physics.stress.tensile_stress,
      compressive: physics.stress.compressive_stress || false,
      stress_concentration_present: physics.stress.stress_concentration_present
    },
    process_chemistry: physics.process_chemistry || { chloride_band: null, sulfur_class: null, amine_type: null, nh4_salt_potential: null, h2s_present: false, caustic_present: false, hydrogen_present: false },
    energy: {
      vibration: physics.energy.vibration || false,
      impact_event: physics.energy.impact_event || false,
      cavitation: physics.energy.cavitation || false
    },
    flow_regime: physics.flow_regime || { flow_state: null, deadleg: null, turbulence_geometry_present: null },
    deposits: physics.deposits || { deposits_present: null, deposit_type: null, deposit_evidence: [] }
  };
}

// ============================================================================
// STATE 1: PHYSICAL REALITY ENGINE
// ============================================================================
function resolvePhysicalReality(transcript: string, events: string[], numVals: any, flags: any, assetClass: string) {
  var lt = transcript.toLowerCase();
  var fl = flags || {};
  var nv = numVals || {};
  var conf = 0.5;

  var loads: string[] = [];
  var cyclic = false; var cyclicSrc: string | null = null;
  var stressConc = false; var stressConcLocs: string[] = [];
  var tensile = false; var compress = false;
  var loadPath = "unknown"; var residual = false;

  function hasEvent(term: string): boolean {
    for (var ei = 0; ei < events.length; ei++) {
      var ev = events[ei];
      var evStr = (typeof ev === "string") ? ev : (ev && typeof ev === "object" ? (ev.type || "") + " " + (ev.location || "") + " " + (ev.severity || "") : String(ev));
      if (evStr.toLowerCase().indexOf(term) !== -1) return true;
    }
    return false;
  }
  if (hasEvent("cycl") || hasEvent("fatigue") || hasEvent("vibrat") || hasEvent("traffic") || hasEvent("train") || hasEvent("railroad") || hasEvent("operational_cycling")) {
    cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+parsed_event" : "parsed_event_cyclic";
  }
  if (hasEvent("impact") || hasEvent("collision") || hasEvent("struck") || hasEvent("hit")) {
    loads.push("impact"); compress = true;
  }
  if (hasEvent("crack") || hasEvent("indication") || hasEvent("flaw") || hasEvent("defect")) {
    stressConc = true; stressConcLocs.push("parsed_indication");
  }
  if (hasEvent("deform") || hasEvent("buckl") || hasEvent("dent") || hasEvent("alignment")) {
    compress = true; loads.push("deformation_indicator");
  }
  if (hasEvent("flood") || hasEvent("storm") || hasEvent("wave") || hasEvent("wind") || hasEvent("earthquake") || hasEvent("seismic")) {
    loads.push("environmental"); if (!cyclic) { cyclic = true; cyclicSrc = "environmental_event"; }
  }
  if (hasEvent("tension") || hasEvent("fracture") || hasEvent("overload") || hasEvent("pressure")) {
    tensile = true;
  }

  if (hasWord(lt, "pressure") || assetClass === "pressure_vessel" || assetClass === "piping" || assetClass === "pipeline") {
    tensile = true; loads.push("internal_pressure"); loads.push("biaxial_tension");
  }
  if (hasWord(lt, "cycl") || (hasWord(lt, "pressuri") && hasWord(lt, "depressuri")) || hasWord(lt, "startup") || hasWord(lt, "shutdown")) {
    cyclic = true; cyclicSrc = "pressure_or_operational_cycling";
  }
  if (hasWord(lt, "decompression") || hasWord(lt, "recompression") || hasWord(lt, "hyperbaric") || hasWord(lt, "autoclave") || hasWord(lt, "pressure test") || hasWord(lt, "hydro test") || hasWord(lt, "hydrotest")) {
    cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+inherent_pressure_cycling" : "inherent_pressure_cycling";
  }
  if ((assetClass === "pressure_vessel" || assetClass === "piping" || assetClass === "pipeline") && !cyclic) {
    cyclic = true; cyclicSrc = "operational_pressure_cycling_implied";
  }
  if ((hasWordNotNegated(lt, "crack") || hasWordNotNegated(lt, "indication")) && hasWord(lt, "weld") && (assetClass === "pressure_vessel" || assetClass === "piping")) {
    if (!cyclic) { cyclic = true; cyclicSrc = "crack_at_weld_implies_cyclic_history"; }
  }
  if (hasWord(lt, "vibrat")) { cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+vibration" : "vibration"; loads.push("vibration"); }
  if (hasWord(lt, "fatigue") || hasWord(lt, "cyclic load")) { cyclic = true; if (!cyclicSrc) cyclicSrc = "fatigue_indicated"; }
  if (hasWord(lt, "impact") || hasWord(lt, "struck") || hasWord(lt, "hit") || hasWord(lt, "collision") || hasWord(lt, "hard hit")) { loads.push("impact"); compress = true; }
  if (hasWord(lt, "wind") || hasWord(lt, "wave") || hasWord(lt, "current")) { loads.push("environmental"); cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+environmental" : "environmental"; }

  if (assetClass === "bridge" || assetClass === "rail_bridge" || hasWord(lt, "railroad") || hasWord(lt, "railway") || hasWord(lt, "train") || hasWord(lt, "rail bridge") || hasWord(lt, "highway bridge") || hasWord(lt, "traffic")) {
    if (!cyclic) { cyclic = true; cyclicSrc = "traffic_cyclic_loading"; }
    loads.push("traffic_loading");
    tensile = true;
  }
  if (hasWord(lt, "fracture-critical") || hasWord(lt, "fracture critical")) {
    tensile = true; loadPath = "primary";
    stressConc = true; stressConcLocs.push("fracture_critical_member");
  }
  if (hasWord(lt, "gusset")) { stressConc = true; stressConcLocs.push("gusset_connection"); }
  if (hasWord(lt, "rivet") || hasWord(lt, "bolt hole") || hasWord(lt, "bolted")) { stressConc = true; stressConcLocs.push("fastener_hole"); }
  if (hasWord(lt, "tension member") || hasWord(lt, "lower chord") || hasWord(lt, "bottom chord")) { tensile = true; loadPath = "primary"; }
  if (hasWord(lt, "floor beam") || hasWord(lt, "stringer")) { stressConc = true; stressConcLocs.push("beam_connection"); }
  if (hasWord(lt, "prior repair") || hasWord(lt, "repair") && hasWord(lt, "member")) { stressConc = true; stressConcLocs.push("prior_repair_zone"); residual = true; }
  if (assetClass === "offshore_platform" || hasWordBoundary(lt, "jacket") || hasWord(lt, "platform") && hasWord(lt, "offshore")) {
    tensile = true;
    if (!cyclic) { cyclic = true; cyclicSrc = "wave_current_cycling"; }
    loads.push("gravity_loading"); loads.push("wave_loading");
    loadPath = "primary";
  }
  if (hasWord(lt, "brace") || hasWord(lt, "node") || hasWord(lt, "leg") || hasWord(lt, "jacket leg")) {
    stressConc = true; stressConcLocs.push("structural_node_connection");
  }
  if (hasWord(lt, "boat landing") || hasWord(lt, "conductor") || hasWord(lt, "caisson") || hasWord(lt, "riser")) {
    stressConc = true; stressConcLocs.push("appurtenance_connection");
  }
  if (hasWord(lt, "splash zone")) { stressConc = true; stressConcLocs.push("splash_zone"); }

  if (hasWord(lt, "weld toe") || hasWord(lt, "weld root")) { stressConc = true; stressConcLocs.push("weld_toe_or_root"); }
  if (hasWord(lt, "nozzle") || hasWord(lt, "branch")) { stressConc = true; stressConcLocs.push("nozzle_junction"); }
  if (hasWord(lt, "circumferential weld") || hasWord(lt, "girth weld")) { stressConc = true; stressConcLocs.push("circumferential_weld"); }
  if (hasWord(lt, "weld") && !stressConc) { stressConc = true; stressConcLocs.push("weld_general"); residual = true; }
  if (fl.dent_or_gouge_present) { stressConc = true; stressConcLocs.push("dent_or_gouge"); }
  if (hasWord(lt, "notch") || hasWord(lt, "gouge") || hasWord(lt, "thread")) { stressConc = true; stressConcLocs.push("geometric_discontinuity"); }
  if (!stressConc && (assetClass === "pressure_vessel" || assetClass === "piping" || assetClass === "pipeline" || assetClass === "tank")) {
    stressConc = true; stressConcLocs.push("welds_implied_for_" + assetClass); residual = true;
  }
  if (assetClass === "pressure_vessel" && stressConcLocs.indexOf("nozzle_junction") === -1) {
    stressConcLocs.push("head_to_shell_junction_implied");
  }

  if (fl.primary_member_involved || hasWord(lt, "primary") || hasWord(lt, "jacket leg") || hasWord(lt, "main girder")) loadPath = "primary";
  else if (hasWord(lt, "brace") || hasWord(lt, "secondary") || hasWord(lt, "stiffener")) loadPath = "secondary";

  if (loads.length > 0) conf += 0.12;
  if (stressConc) conf += 0.08;

  var tempC: number | null = nv.temperature_c || nv.operating_temperature_c || null;
  var tempF: number | null = nv.temperature_f || nv.operating_temperature_f || null;

  // DEPLOY195: Transcript-based temperature extraction.
  // If no numeric temp was passed, try to extract from transcript text.
  // Handles: "850 degrees F", "minus 260 degrees F", "-260 F", "negative 320 degrees",
  // "1200F", "500 degrees fahrenheit", "operating at 650 degrees"
  if (tempF === null && tempC === null) {
    // Pattern 1: "minus/negative N degrees" or "minus/negative N F"
    var negTempMatch = lt.match(/(?:minus|negative)\s+(\d+\.?\d*)\s*(?:degrees?\s*(?:f|fahrenheit)?|f\b)/);
    if (negTempMatch) {
      tempF = -1 * parseFloat(negTempMatch[1]);
    }
    // Pattern 2: "-N degrees F" or "-NF" (with minus sign)
    if (tempF === null) {
      var dashNegMatch = lt.match(/-\s*(\d+\.?\d*)\s*(?:degrees?\s*(?:f|fahrenheit)?|f\b)/);
      if (dashNegMatch) {
        tempF = -1 * parseFloat(dashNegMatch[1]);
      }
    }
    // Pattern 3: Positive temps -- "N degrees F" or "NF" or "N degrees fahrenheit"
    if (tempF === null) {
      var posTempMatch = lt.match(/(\d+\.?\d*)\s*(?:degrees?\s*(?:f|fahrenheit)|f\b(?!caw|eet|oot|ull|ail|at |ire|law|low|lan|rom|or |ound|eed|i\b))/);
      if (posTempMatch) {
        tempF = parseFloat(posTempMatch[1]);
      }
    }
    // Pattern 4: Celsius temps -- "N degrees C" or "N celsius"
    if (tempF === null && tempC === null) {
      var celMatch = lt.match(/(?:minus|negative|-)\s*(\d+\.?\d*)\s*(?:degrees?\s*(?:c|celsius)|c\b)/);
      if (celMatch) {
        tempC = -1 * parseFloat(celMatch[1]);
      } else {
        var posCelMatch = lt.match(/(\d+\.?\d*)\s*(?:degrees?\s*(?:c|celsius))/);
        if (posCelMatch) {
          tempC = parseFloat(posCelMatch[1]);
        }
      }
    }
  }

  if (!tempC && tempF) tempC = Math.round((tempF - 32) * 5 / 9);
  if (!tempF && tempC) tempF = Math.round(tempC * 9 / 5 + 32);
  var thermalCyc = hasWord(lt, "thermal cycl") || (hasWord(lt, "startup") && hasWord(lt, "shutdown"));

  // ==========================================================================
  // EVENT-TO-PHYSICS TRANSLATION -- v2.3
  // Maps field language to physics preconditions.
  // Inspectors describe EVENTS, not physics.
  // Engine translates events -> physical state changes.
  // Includes field slang from Universal Field Language Interpreter v1/v2.
  // ==========================================================================
  if (!thermalCyc) {
    var thermalEventInferred = false;
    // Rapid temperature change -> thermal gradient -> differential contraction
    if (hasWord(lt, "rapid cool") || hasWord(lt, "rapid cooldown") || hasWord(lt, "cool-down rate") || hasWord(lt, "fast cooldown") || hasWord(lt, "crashed the temp") || hasWord(lt, "dropped temp fast")) thermalEventInferred = true;
    // Thermal shock / transient -> sudden thermal stress
    if (hasWord(lt, "thermal shock") || hasWord(lt, "thermal transient") || hasWord(lt, "thermal excursion") || hasWord(lt, "thermal upset") || hasWord(lt, "heat checked") || hasWord(lt, "heat check")) thermalEventInferred = true;
    // Quench (not heat treatment quench-and-temper)
    if (hasWord(lt, "quench") && !hasWord(lt, "quench and temper") && !hasWord(lt, "quenched and tempered")) thermalEventInferred = true;
    // Temperature swing / spike
    if (hasWord(lt, "temperature swing") || hasWord(lt, "temperature excursion") || hasWord(lt, "temperature spike") || hasWord(lt, "temp swing") || hasWord(lt, "temp excursion")) thermalEventInferred = true;
    // Emergency / unplanned shutdown -> rapid cooldown from operating temp
    if (hasWord(lt, "emergency shutdown") || hasWord(lt, "emergency depressur") || hasWord(lt, "unplanned shutdown") || hasWord(lt, "forced shutdown") || hasWord(lt, "unit trip") || hasWord(lt, "tripped the unit") || hasWord(lt, "e-stop") || hasWord(lt, "esd")) thermalEventInferred = true;
    // Steam-out events -> rapid heating/cooling of cold equipment
    if (hasWord(lt, "steam-out") || hasWord(lt, "steamout") || hasWord(lt, "steam out") || hasWord(lt, "steamed it out")) thermalEventInferred = true;
    // Intermittent / batch operation -> inherent thermal cycling
    if (hasWord(lt, "batch operation") || hasWord(lt, "intermittent") || hasWord(lt, "batch process") || hasWord(lt, "on-off service") || hasWord(lt, "swing service") || hasWord(lt, "cycling service")) thermalEventInferred = true;
    // Large temperature differential stated explicitly
    if ((hasWord(lt, "cooldown") || hasWord(lt, "cool down")) && (hasWord(lt, "200") || hasWord(lt, "300") || hasWord(lt, "400") || hasWord(lt, "500"))) thermalEventInferred = true;
    // Field slang for thermal events
    if (hasWord(lt, "burned up") || hasWord(lt, "fried") || hasWord(lt, "cooked") || hasWord(lt, "overheated")) thermalEventInferred = true;
    // Water hammer / process upset -> pressure + thermal transient
    if (hasWord(lt, "water hammer") || hasWord(lt, "hammered") && (hasWord(lt, "line") || hasWord(lt, "pipe") || hasWord(lt, "system")) || hasWord(lt, "slugging") || hasWord(lt, "process upset")) thermalEventInferred = true;
    if (thermalEventInferred) {
      thermalCyc = true;
    }
  }

  // DEPLOY198: Tighten fire detection. Bare "fire" matches inside "firefighting",
  // "fireproofing", "fire suppression", "fire extinguisher", "fire monitor", "fire watch",
  // "fire protection", "fire resistant", "fire retardant" -- none of which indicate an
  // actual fire event. Use specific fire-event phrases instead.
  var fireExp = !!fl.fire_exposure || hasWord(lt, "fire damage") || hasWord(lt, "fire exposure") || hasWord(lt, "post-fire") || hasWord(lt, "post fire") || hasWord(lt, "caught fire") || hasWord(lt, "fire incident") || hasWord(lt, "fire event") || hasWord(lt, "fire impingement") || hasWord(lt, "jet fire") || hasWord(lt, "pool fire") || hasWord(lt, "flash fire") || hasWord(lt, "on fire") || hasWord(lt, "fire engulfed") || hasWord(lt, "fire hit") || hasWord(lt, "was in a fire") || hasWord(lt, "fire broke out") || hasWord(lt, "fire occurred") || hasWord(lt, "fire history") || hasWord(lt, "burned in fire") || hasWord(lt, "fire affected");
  var fireDur = fl.fire_duration_minutes || nv.fire_duration_minutes || null;
  var creep = (tempF !== null && tempF > 700) || (tempC !== null && tempC > 370);
  var cryo = (tempF !== null && tempF < -20) || (tempC !== null && tempC < -29);
  // DEPLOY195: Keyword-based cryogenic detection.
  // Even without a parsed temperature, certain keywords conclusively indicate cryogenic service.
  if (!cryo) {
    if (hasWord(lt, "cryogenic") || hasWord(lt, "cryogen") || hasWord(lt, "lng service") || hasWord(lt, "lng storage") || hasWord(lt, "liquid nitrogen") || hasWord(lt, "liquid oxygen") || hasWord(lt, "liquid hydrogen") || hasWord(lt, "liquid helium") || hasWord(lt, "liquid methane") || hasWord(lt, "liquid natural gas") || hasWord(lt, "autorefrigerat") || hasWord(lt, "joule-thomson") || hasWord(lt, "joule thomson") || (hasWord(lt, "ethylene") && hasWord(lt, "liquid")) || (hasWord(lt, "propylene") && hasWord(lt, "liquid")) || hasWord(lt, "cold box") || hasWord(lt, "coldbox") || hasWord(lt, "liquefaction") || (hasWord(lt, "lng") && (hasWord(lt, "tank") || hasWord(lt, "vessel") || hasWord(lt, "pipe") || hasWord(lt, "spool")))) {
      cryo = true;
    }
  }
  if (fireExp) conf += 0.05;
  if (tempC !== null) conf += 0.05;

  var corrosive = false; var agents: string[] = [];
  var negMarine = hasWord(lt, "no marine") || hasWord(lt, "not marine") || hasWord(lt, "marine: no") || hasWord(lt, "marine environment: no") || hasWord(lt, "marine environment. no") || hasWord(lt, "non-marine") || hasWord(lt, "non marine");
  var negH2s = hasWord(lt, "no h2s") || hasWord(lt, "not sour") || hasWord(lt, "no sour") || hasWord(lt, "h2s: no");
  var negChloride = hasWord(lt, "no chloride") || hasWord(lt, "no chlor") || hasWord(lt, "chloride: no");
  var negCorrosion = hasWord(lt, "no corros") || hasWord(lt, "corrosion: no") || hasWord(lt, "not corroded");

  var h2s = !negH2s && (hasWord(lt, "h2s") || hasWord(lt, "hydrogen sulfide") || hasWord(lt, "sour"));
  var co2 = hasWord(lt, "co2") || hasWord(lt, "sweet corros");
  var chlorides = !negMarine && !negChloride && (hasWord(lt, "chloride") || hasWord(lt, "seawater") || hasWord(lt, "splash zone") || hasWord(lt, "salt"));
  if (!negMarine && hasWord(lt, "marine") && !hasWord(lt, "marine environment. no") && !hasWord(lt, "marine environment: no") && !hasWord(lt, "no. marine") && !hasWord(lt, "no marine")) {
    var marineIdx = lt.indexOf("marine");
    var preMarineChunk = lt.substring(Math.max(0, marineIdx - 15), marineIdx);
    if (preMarineChunk.indexOf("no") === -1 && preMarineChunk.indexOf("not") === -1 && preMarineChunk.indexOf("non") === -1) {
      chlorides = true;
    }
  }
  var caustic = hasWord(lt, "caustic") || hasWord(lt, "naoh") || hasWord(lt, "amine");
  var hydrogen = hasWord(lt, "hydrogen") && !h2s || hasWord(lt, "htha");
  if (h2s) { corrosive = true; agents.push("H2S"); }
  if (co2) { corrosive = true; agents.push("CO2"); }
  if (chlorides) { corrosive = true; agents.push("chlorides"); }
  if (caustic) { corrosive = true; agents.push("caustic"); }
  if (hydrogen) agents.push("hydrogen");
  if (!negCorrosion && (hasWord(lt, "corros") || hasWord(lt, "rust") || hasWord(lt, "scale"))) corrosive = true;
  // DEPLOY117: Wall loss / thinning indicators imply corrosive or erosive environment
  // If you have confirmed wall loss, the environment caused it -- corrosive by definition
  if (!negCorrosion && (hasWord(lt, "wall loss") || hasWord(lt, "metal loss") || hasWord(lt, "thinning") || hasWord(lt, "thinned") || hasWord(lt, "pitted") || hasWord(lt, "pitting") || hasWord(lt, "eating") || hasWord(lt, "washed out") || hasWord(lt, "corroded") || hasWord(lt, "worn"))) {
    if (!corrosive) { corrosive = true; if (agents.indexOf("implied_corrosive") === -1) agents.push("implied_corrosive"); }
  }
  // DEPLOY120: CUI evidence -- wet insulation + external rust = corrosive environment
  if (!negCorrosion && (hasWord(lt, "sweating") || hasWord(lt, "wet insulation") || hasWord(lt, "wet lagging") || hasWord(lt, "damaged insulation") || hasWord(lt, "rusty") || hasWord(lt, "rust spot") || hasWord(lt, "under the insulation") || hasWord(lt, "under insulation") || hasWord(lt, "paper thin"))) {
    if (!corrosive) { corrosive = true; if (agents.indexOf("cui_indicators") === -1) agents.push("cui_indicators"); }
  }
  if (hasWord(lt, "soil") || hasWord(lt, "buried")) { corrosive = true; agents.push("soil"); }
  if (hasWord(lt, "river") || hasWord(lt, "flood") || hasWord(lt, "creek") || hasWord(lt, "water") || hasWord(lt, "submerge")) { corrosive = true; agents.push("water_exposure"); }
  if (hasWord(lt, "atmospheric") || hasWord(lt, "outdoor") || hasWord(lt, "exposed") || hasWord(lt, "weather")) { corrosive = true; agents.push("atmospheric"); }
  if (hasWord(lt, "pack rust") || hasWord(lt, "rust stain") || hasWord(lt, "rust bleed") || hasWord(lt, "rusting")) { corrosive = true; if (agents.indexOf("atmospheric") === -1) agents.push("atmospheric"); }
  if ((assetClass === "bridge" || assetClass === "rail_bridge") && !corrosive) { corrosive = true; agents.push("atmospheric_implied_for_bridge"); }
  // DEPLOY198: Offshore platforms are definitionally in marine/atmospheric exposure.
  // Push atmospheric + chlorides + marine agents so atmospheric_corrosion, pitting, etc.
  // validate correctly even if the transcript doesn't say "outdoor" or "atmospheric".
  if (assetClass === "offshore_platform") {
    corrosive = true;
    if (agents.indexOf("atmospheric") === -1) agents.push("atmospheric");
    if (!negMarine && agents.indexOf("chlorides") === -1) { chlorides = true; agents.push("chlorides"); }
    if (agents.indexOf("marine_environment") === -1) agents.push("marine_environment");
  }
  if (hasEvent("corros") || hasEvent("rust") || hasEvent("oxide") || hasEvent("scale")) { corrosive = true; if (agents.indexOf("parsed_corrosion") === -1) agents.push("parsed_corrosion"); }
  if (hasEvent("flood") || hasEvent("water") || hasEvent("river") || hasEvent("rain") || hasEvent("weather") || hasEvent("atmospheric")) { corrosive = true; if (agents.indexOf("environmental_exposure") === -1) agents.push("environmental_exposure"); }
  if (hasEvent("marine") || hasEvent("salt") || hasEvent("seawater") || hasEvent("offshore")) { if (!negMarine) { chlorides = true; corrosive = true; if (agents.indexOf("chlorides") === -1) agents.push("chlorides"); } }


  // ==========================================================================
  // INDUSTRIAL CONTEXT INTELLIGENCE LAYER -- v2.3
  // Infers chemical environment from industrial unit/process context.
  // Field inspectors describe EQUIPMENT, not chemistry.
  // Engine must translate equipment context -> chemical environment.
  // This runs AFTER explicit keyword detection so it only ADDS flags --
  // it never overrides explicit negation (negH2s, negCorrosion, etc.)
  // ==========================================================================
  var contextInferred: string[] = [];

  // HYDROCRACKING / HYDROTREATING -> H2S + hydrogen service
  if (hasWord(lt, "hydrocrack") || hasWord(lt, "hydrotreater") || hasWord(lt, "hydrotreating") || hasWord(lt, "hydroprocessing") || hasWord(lt, "hydrodesulfur") || hasWord(lt, "the cracker") || hasWord(lt, "high pressure loop") || hasWord(lt, "recycle gas") || hasWord(lt, "h2 unit") || hasWord(lt, "hp separator") || hasWord(lt, "lp separator") || hasWord(lt, "reactor effluent")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("hydrocracking/hydrotreating -> H2S inferred"); }
    if (!hydrogen) { hydrogen = true; if (agents.indexOf("hydrogen") === -1) agents.push("hydrogen"); contextInferred.push("hydrocracking/hydrotreating -> hydrogen inferred"); }
  }

  // CATALYTIC REFORMING -> hydrogen service
  if (hasWord(lt, "catalytic reform") || hasWord(lt, "platformer") || hasWord(lt, "reformer unit") || hasWord(lt, "naphtha reform") || hasWord(lt, "ccr unit") || hasWord(lt, "the reformer") || hasWord(lt, "regen section") || hasWord(lt, "reformate")) {
    if (!hydrogen) { hydrogen = true; if (agents.indexOf("hydrogen") === -1) agents.push("hydrogen"); contextInferred.push("catalytic reformer -> hydrogen inferred"); }
  }

  // AMINE UNIT -> H2S + amine (caustic-like) environment
  if (hasWord(lt, "amine unit") || hasWord(lt, "amine service") || hasWord(lt, "amine system") || hasWord(lt, "amine contactor") || hasWord(lt, "amine regenerat") || hasWord(lt, "amine absorber") || hasWord(lt, "amine stripper") || hasWord(lt, "mdea") || hasWord(lt, "dea unit") || hasWord(lt, "mea unit") || hasWord(lt, "gas sweeten") || hasWord(lt, "acid gas scrubber") || hasWord(lt, "the scrubber") || hasWord(lt, "lean amine") || hasWord(lt, "rich amine")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("amine unit -> H2S inferred (acid gas service)"); }
    if (!caustic) { caustic = true; corrosive = true; if (agents.indexOf("caustic") === -1) agents.push("caustic"); contextInferred.push("amine unit -> amine/caustic environment inferred"); }
  }

  // CRUDE UNIT / DISTILLATION -> H2S + naphthenic acid potential
  if (hasWord(lt, "crude unit") || hasWord(lt, "crude distill") || hasWord(lt, "atmospheric distill") || hasWord(lt, "vacuum distill") || hasWord(lt, "crude tower") || hasWord(lt, "atmospheric tower") || hasWord(lt, "vacuum tower") || hasWord(lt, "pipe still") || hasWord(lt, "cdu") || hasWord(lt, "vdu") || hasWord(lt, "crude column") || hasWord(lt, "overhead system") || hasWord(lt, "crude side")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("crude unit -> H2S inferred"); }
    corrosive = true;
    if (agents.indexOf("naphthenic_acid") === -1) { agents.push("naphthenic_acid"); contextInferred.push("crude unit -> naphthenic acid potential inferred"); }
  }

  // FCC / FLUID CATALYTIC CRACKING -> H2S
  if (hasWord(lt, "fluid catalytic") || hasWord(lt, "cat cracker") || hasWord(lt, "fccu") || hasWord(lt, "the cat") || hasWord(lt, "cat unit") || hasWord(lt, "riser reactor") || hasWord(lt, "regenerator") && (hasWord(lt, "cat") || hasWord(lt, "fcc"))) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("FCC unit -> H2S inferred"); }
  }

  // SULFUR RECOVERY / CLAUS -> concentrated H2S
  if (hasWord(lt, "sulfur recovery") || hasWord(lt, "claus unit") || hasWord(lt, "claus reactor") || hasWord(lt, "tail gas") || hasWord(lt, "sulfur plant") || hasWord(lt, "the sru") || hasWord(lt, "sulfur block") || hasWord(lt, "tgtu")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("sulfur recovery -> concentrated H2S inferred"); }
  }

  // DELAYED COKER -> H2S + hydrogen + thermal cycling
  if (hasWord(lt, "delayed coker") || hasWord(lt, "coker drum") || hasWord(lt, "coke drum") || hasWord(lt, "the coker") || hasWord(lt, "coke cutting") || hasWord(lt, "decoking") || hasWord(lt, "coke heater")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("coker -> H2S inferred"); }
    if (!hydrogen) { hydrogen = true; if (agents.indexOf("hydrogen") === -1) agents.push("hydrogen"); contextInferred.push("coker -> hydrogen inferred"); }
    if (!thermalCyc) { thermalCyc = true; contextInferred.push("coker drum -> thermal cycling inferred (heat/quench cycles)"); }
  }

  // SOUR WATER / SOUR GAS / ACID GAS -> H2S
  if (hasWord(lt, "sour water") || hasWord(lt, "sour gas") || hasWord(lt, "acid gas") || hasWord(lt, "sour service") || hasWord(lt, "sour drum") || hasWord(lt, "knockout drum") || hasWord(lt, "ko drum") || hasWord(lt, "sour stripper") || hasWord(lt, "the sws")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("sour/acid gas service -> H2S inferred"); }
  }

  // HYDROGEN UNIT / HYDROGEN PLANT -> hydrogen environment
  if (hasWord(lt, "hydrogen plant") || hasWord(lt, "hydrogen unit") || hasWord(lt, "hydrogen makeup") || hasWord(lt, "h2 makeup") || hasWord(lt, "hydrogen compressor") || hasWord(lt, "hydrogen header") || hasWord(lt, "h2 plant") || hasWord(lt, "steam reform") || hasWord(lt, "smr unit") || hasWord(lt, "hydrogen loop") || hasWord(lt, "h2 recycle") || hasWord(lt, "psa unit") || hasWord(lt, "pressure swing adsorption")) {
    if (!hydrogen) { hydrogen = true; if (agents.indexOf("hydrogen") === -1) agents.push("hydrogen"); contextInferred.push("hydrogen unit -> hydrogen environment inferred"); }
  }

  // HIGH-TEMP HYDROGEN SERVICE MATERIAL -> HTHA susceptibility
  if (hydrogen && (hasWord(lt, "2.25cr") || hasWord(lt, "2-1/4cr") || hasWord(lt, "2 1/4 cr") || hasWord(lt, "1cr-1/2mo") || hasWord(lt, "c-1/2mo") || hasWord(lt, "carbon steel") || hasWord(lt, "c-mn") || hasWord(lt, "carbon-manganese"))) {
    if (agents.indexOf("HTHA_susceptible_material") === -1) { agents.push("HTHA_susceptible_material"); contextInferred.push("material + hydrogen -> HTHA susceptibility per Nelson curve"); }
  }

  // CAUSTIC SERVICE (explicit process)
  if (hasWord(lt, "caustic wash") || hasWord(lt, "caustic injection") || hasWord(lt, "naoh injection") || hasWord(lt, "caustic tower") || hasWord(lt, "caustic scrubber") || hasWord(lt, "spent caustic") || hasWord(lt, "caustic tree") || hasWord(lt, "caustic treating") || hasWord(lt, "the caustic") || hasWord(lt, "caustic drum")) {
    if (!caustic) { caustic = true; corrosive = true; if (agents.indexOf("caustic") === -1) agents.push("caustic"); contextInferred.push("caustic service -> caustic environment inferred"); }
  }

  // BOILER FEEDWATER / DEAERATOR -> oxygen corrosion
  if (hasWord(lt, "boiler feedwater") || hasWord(lt, "deaerator") || hasWord(lt, "bfw system")) {
    corrosive = true;
    if (agents.indexOf("dissolved_oxygen") === -1) { agents.push("dissolved_oxygen"); contextInferred.push("boiler feedwater -> dissolved oxygen corrosion potential"); }
  }

  // COOLING WATER -> chlorides + microbiological
  if (hasWord(lt, "cooling water") || hasWord(lt, "cooling tower") || hasWord(lt, "cw system") || hasWord(lt, "condenser water") || hasWord(lt, "circ water") || hasWord(lt, "the cooling") || hasWord(lt, "basin water") || hasWord(lt, "fin fan") || hasWord(lt, "air cooler") && hasWord(lt, "water")) {
    corrosive = true;
    if (!chlorides && !negChloride) { chlorides = true; if (agents.indexOf("chlorides") === -1) agents.push("chlorides"); contextInferred.push("cooling water -> chloride potential inferred"); }
  }

  // FLARE SYSTEM -> H2S + thermal cycling
  if (hasWord(lt, "flare header") || hasWord(lt, "flare stack") || hasWord(lt, "flare system") || hasWord(lt, "flare line") || hasWord(lt, "flare tip") || hasWord(lt, "the flare") || hasWord(lt, "lp flare") || hasWord(lt, "hp flare") || hasWord(lt, "flare ko drum") || hasWord(lt, "flare knockout")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("flare system -> H2S potential inferred"); }
    if (!thermalCyc) { thermalCyc = true; contextInferred.push("flare system -> thermal cycling inferred (intermittent flaring)"); }
  }

  // WET GAS / WET H2S -> aqueous H2S (most aggressive for HIC)
  if (hasWord(lt, "wet gas") || hasWord(lt, "wet h2s") || hasWord(lt, "wet sour")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("wet gas/wet H2S -> aqueous H2S (aggressive HIC risk)"); }
  }

  // STEAM SYSTEM -> thermal cycling + dissolved oxygen
  if (hasWord(lt, "steam header") || hasWord(lt, "steam line") || hasWord(lt, "steam trap") || hasWord(lt, "condensate return") || hasWord(lt, "condensate system") || hasWord(lt, "steam drum") && !hasWord(lt, "boiler")) {
    if (!thermalCyc) { thermalCyc = true; contextInferred.push("steam system -> thermal cycling inferred"); }
    corrosive = true;
    if (agents.indexOf("dissolved_oxygen") === -1) { agents.push("dissolved_oxygen"); contextInferred.push("steam/condensate -> dissolved oxygen + CO2 corrosion potential"); }
  }

  // FIRED HEATER / FURNACE -> thermal cycling + creep potential
  if (hasWord(lt, "fired heater") || hasWord(lt, "process heater") || hasWord(lt, "the heater") || hasWord(lt, "fire side") || hasWord(lt, "radiant section") || hasWord(lt, "convection section") || hasWord(lt, "tube went soft") || hasWord(lt, "furnace tube") || hasWord(lt, "heater tube") || hasWord(lt, "radiant tube") || hasWord(lt, "convection tube")) {
    if (!thermalCyc) { thermalCyc = true; contextInferred.push("fired heater -> thermal cycling inferred (startup/shutdown cycles)"); }
    contextInferred.push("fired heater/furnace -> elevated temperature service, creep potential");
  }

  // DEAD LEG -> stagnant corrosion risk
  if (hasWord(lt, "dead leg") || hasWord(lt, "dead end") && (hasWord(lt, "pipe") || hasWord(lt, "line")) || hasWord(lt, "no flow") || hasWord(lt, "stagnant line") || hasWord(lt, "stagnant") && hasWord(lt, "piping")) {
    corrosive = true;
    if (agents.indexOf("stagnant_corrosion") === -1) { agents.push("stagnant_corrosion"); contextInferred.push("dead leg -> stagnant/trapped fluid corrosion risk"); }
  }

  // HEAT EXCHANGER -> context depends on shell/tube side
  if (hasWord(lt, "exchanger") || hasWord(lt, "shell side") || hasWord(lt, "tube side") || hasWord(lt, "tube bundle") || hasWord(lt, "u-tube") || hasWord(lt, "floating head")) {
    corrosive = true;
    if (agents.indexOf("exchanger_service") === -1) { agents.push("exchanger_service"); contextInferred.push("heat exchanger -> multi-fluid service, corrosion potential on both sides"); }
  }

  // RAIN LINE ATTACK / OVERHEAD CORROSION
  if (hasWord(lt, "rain line") || hasWord(lt, "overhead corros") || hasWord(lt, "top of line") || hasWord(lt, "dew point") || hasWord(lt, "overhead system") || hasWord(lt, "overhead line")) {
    corrosive = true;
    if (!h2s && !negH2s) { h2s = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("overhead/rain line -> H2S + HCl condensation zone inferred"); }
    if (!chlorides && !negChloride) { chlorides = true; if (agents.indexOf("chlorides") === -1) agents.push("chlorides"); contextInferred.push("overhead/rain line -> chloride (HCl) condensation inferred"); }
  }

  // FIELD LEAK / SEEPAGE LANGUAGE -> flag corrosion + consequence
  // DEPLOY196: Added dictionary leak terms: crying, dribbling, spitting
  if (hasWord(lt, "sweating") || hasWord(lt, "weeping") || hasWord(lt, "seeping") || hasWord(lt, "leaker") || hasWord(lt, "dripping") || hasWord(lt, "active leak") || hasWord(lt, "crying") || hasWord(lt, "dribbling") || hasWord(lt, "spitting")) {
    corrosive = true;
    if (agents.indexOf("active_leak_indicator") === -1) { agents.push("active_leak_indicator"); contextInferred.push("field leak language detected -> active corrosion/degradation likely"); }
  }

  // DEPLOY185: NAPHTHENIC ACID DIRECT KEYWORD DETECTION
  // Crude unit inference (above) already pushes naphthenic_acid for CDU/VDU context.
  // This block catches explicit naphthenic acid / TAN language outside crude unit context.
  if (hasWord(lt, "naphthenic acid") || hasWord(lt, "naphthenic") || hasWord(lt, "high tan") || hasWord(lt, "tan number") || hasWord(lt, "total acid number") || hasWord(lt, "tan crude") || hasWord(lt, "high acid crude") || hasWord(lt, "acid corrosion")) {
    corrosive = true;
    if (agents.indexOf("naphthenic_acid") === -1) { agents.push("naphthenic_acid"); contextInferred.push("naphthenic acid / high TAN language detected"); }
  }

  // POLYTHIONIC ACID CRACKING CONTEXT
  if (hasWord(lt, "polythionic") || (hasWord(lt, "sensitized") && hasWord(lt, "stainless")) || hasWord(lt, "pta crack") || hasWord(lt, "polythionic acid") || hasWord(lt, "pta scc") || hasWord(lt, "intergranular") && hasWord(lt, "stainless")) {
    corrosive = true;
    if (agents.indexOf("polythionic_acid") === -1) { agents.push("polythionic_acid"); contextInferred.push("polythionic acid cracking context -> shutdown/turnaround risk for sensitized stainless"); }
  }

  // DEPLOY186: AMINE CRACKING DIRECT KEYWORD DETECTION
  // Amine unit detection (above) already pushes H2S + caustic for amine service.
  // This block specifically flags amine_cracking agent for amine SCC mechanism.
  if (hasWord(lt, "amine crack") || hasWord(lt, "amine scc") || hasWord(lt, "amine stress corrosion") || hasWord(lt, "lean amine crack") || hasWord(lt, "rich amine crack") || (hasWord(lt, "amine") && (hasWord(lt, "cracking") || hasWord(lt, "crack"))) || (hasWord(lt, "amine service") && (hasWord(lt, "crack") || hasWord(lt, "cracking") || hasWord(lt, "intergranular")))) {
    corrosive = true;
    if (agents.indexOf("amine_cracking") === -1) { agents.push("amine_cracking"); contextInferred.push("amine cracking language detected -> amine SCC risk for carbon steel in lean amine service"); }
  }

  // DEPLOY186: CARBONATE SCC DIRECT KEYWORD DETECTION
  // Carbonate SCC occurs in carbon steel exposed to carbonate-rich alkaline sour water
  // environments, common in FCC main fractionator overhead, sour water strippers.
  if (hasWord(lt, "carbonate crack") || hasWord(lt, "carbonate scc") || hasWord(lt, "carbonate stress") || hasWord(lt, "alkaline sour") || hasWord(lt, "carbonate environment") || hasWord(lt, "carbonate corrosion") || (hasWord(lt, "carbonate") && (hasWord(lt, "cracking") || hasWord(lt, "scc"))) || (hasWord(lt, "sour water") && hasWord(lt, "alkaline")) || (hasWord(lt, "fcc") && hasWord(lt, "carbonate"))) {
    corrosive = true;
    if (agents.indexOf("carbonate_scc") === -1) { agents.push("carbonate_scc"); contextInferred.push("carbonate SCC language detected -> carbonate stress corrosion cracking risk in alkaline sour water"); }
  }

  // DEPLOY187: EMBRITTLEMENT KEYWORD DETECTION
  // 885F embrittlement -- ferritic/duplex stainless in 600-1000F range
  if (hasWord(lt, "885") || hasWord(lt, "885f") || hasWord(lt, "885 f") || hasWord(lt, "885 degree") || hasWord(lt, "475c") || hasWord(lt, "475 c") || hasWord(lt, "alpha prime") || (hasWord(lt, "embrittlement") && (hasWord(lt, "ferritic") || hasWord(lt, "duplex") || hasWord(lt, "400 series") || hasWord(lt, "410") || hasWord(lt, "430")))) {
    if (agents.indexOf("885f_embrittlement") === -1) { agents.push("885f_embrittlement"); contextInferred.push("885F embrittlement language detected -> alpha-prime embrittlement risk for ferritic/duplex stainless"); }
  }

  // Sigma phase embrittlement -- austenitic/duplex stainless in 1000-1600F range
  if (hasWord(lt, "sigma phase") || hasWord(lt, "sigma embrittlement") || (hasWord(lt, "sigma") && (hasWord(lt, "stainless") || hasWord(lt, "embrittlement") || hasWord(lt, "duplex")))) {
    if (agents.indexOf("sigma_phase") === -1) { agents.push("sigma_phase"); contextInferred.push("sigma phase language detected -> sigma phase embrittlement risk for austenitic/duplex stainless at elevated temperature"); }
  }

  // Temper embrittlement -- Cr-Mo steels, 650-1070F range or slow cooling through that range
  if (hasWord(lt, "temper embrittlement") || hasWord(lt, "temper embrittled") || hasWord(lt, "step cooling") || hasWord(lt, "j-factor") || hasWord(lt, "x-factor") || hasWord(lt, "vTr") || (hasWord(lt, "embrittlement") && (hasWord(lt, "2.25cr") || hasWord(lt, "cr-mo") || hasWord(lt, "chrome moly") || hasWord(lt, "1cr") || hasWord(lt, "reactor vessel")))) {
    if (agents.indexOf("temper_embrittlement") === -1) { agents.push("temper_embrittlement"); contextInferred.push("temper embrittlement language detected -> Cr-Mo steel toughness degradation from service in or slow cooling through 650-1070F range"); }
  }

  // DEPLOY188: HIGH-TEMPERATURE DEGRADATION KEYWORD DETECTION
  // Carburization -- carbon diffusion into alloy at >1100F in hydrocarbon service
  if (hasWord(lt, "carburiz") || hasWord(lt, "carburis") || hasWord(lt, "carbon pickup") || hasWord(lt, "carbon ingress") || (hasWord(lt, "carbon") && hasWord(lt, "diffusion") && (hasWord(lt, "tube") || hasWord(lt, "heater") || hasWord(lt, "furnace")))) {
    if (agents.indexOf("carburization") === -1) { agents.push("carburization"); contextInferred.push("carburization language detected -> carbon diffusion at elevated temperature in hydrocarbon service"); }
  }

  // Metal dusting -- catastrophic carburization in high CO / syngas at 900-1500F
  if (hasWord(lt, "metal dusting") || hasWord(lt, "metal dust") || (hasWord(lt, "dusting") && (hasWord(lt, "syngas") || hasWord(lt, "reformer") || hasWord(lt, "co rich") || hasWord(lt, "carbon monoxide")))) {
    if (agents.indexOf("metal_dusting") === -1) { agents.push("metal_dusting"); contextInferred.push("metal dusting language detected -> catastrophic carburization in CO-rich / syngas environment"); }
  }

  // High-temperature oxidation -- scaling at >1000F
  if (hasWord(lt, "high temp oxidation") || hasWord(lt, "high temperature oxidation") || hasWord(lt, "oxide scale") || hasWord(lt, "scaling") && (tempF !== null && tempF > 900) || hasWord(lt, "oxidation") && (hasWord(lt, "heater") || hasWord(lt, "furnace") || hasWord(lt, "tube"))) {
    if (agents.indexOf("high_temp_oxidation") === -1) { agents.push("high_temp_oxidation"); contextInferred.push("high-temperature oxidation language detected -> oxide scaling at elevated temperature"); }
  }

  // Spheroidization -- C and C-0.5Mo steels at >850F long-term
  if (hasWord(lt, "spheroidiz") || hasWord(lt, "spheroidis") || (hasWord(lt, "carbide") && hasWord(lt, "spheroid")) || (hasWord(lt, "pearlite") && hasWord(lt, "degradation"))) {
    if (agents.indexOf("spheroidization") === -1) { agents.push("spheroidization"); contextInferred.push("spheroidization language detected -> carbide morphology change reducing strength in carbon/C-0.5Mo steel"); }
  }

  // Decarburization -- carbon loss at >800F in hydrogen-rich or oxidizing environments
  if (hasWord(lt, "decarburiz") || hasWord(lt, "decarburis") || hasWord(lt, "carbon depletion") || (hasWord(lt, "carbon loss") && (hasWord(lt, "hydrogen") || hasWord(lt, "surface")))) {
    if (agents.indexOf("decarburization") === -1) { agents.push("decarburization"); contextInferred.push("decarburization language detected -> surface carbon loss at elevated temperature"); }
  }

  // Graphitization -- graphite nodule formation in C and C-0.5Mo steels >800F long-term
  if (hasWord(lt, "graphitiz") || hasWord(lt, "graphitis") || hasWord(lt, "graphite nodule") || hasWord(lt, "graphite formation") || (hasWord(lt, "graphite") && (hasWord(lt, "steel") || hasWord(lt, "weld") || hasWord(lt, "haz")))) {
    if (agents.indexOf("graphitization") === -1) { agents.push("graphitization"); contextInferred.push("graphitization language detected -> graphite nodule formation in C/C-0.5Mo steel at elevated temperature long-term"); }
  }

  // DEPLOY189: GALVANIC CORROSION KEYWORD DETECTION
  if (hasWord(lt, "galvanic") || hasWord(lt, "dissimilar metal") || hasWord(lt, "dissimilar metals") || hasWord(lt, "bimetallic") || hasWord(lt, "bi-metallic") || hasWord(lt, "galvanic couple") || hasWord(lt, "galvanic cell") || (hasWord(lt, "copper") && hasWord(lt, "steel") && (hasWord(lt, "contact") || hasWord(lt, "connection") || hasWord(lt, "joint") || hasWord(lt, "coupled"))) || (hasWord(lt, "brass") && hasWord(lt, "steel") && (hasWord(lt, "contact") || hasWord(lt, "connection"))) || (hasWord(lt, "stainless") && hasWord(lt, "carbon steel") && (hasWord(lt, "contact") || hasWord(lt, "junction") || hasWord(lt, "transition")))) {
    corrosive = true;
    if (agents.indexOf("galvanic") === -1) { agents.push("galvanic"); contextInferred.push("galvanic / dissimilar metal contact language detected -> accelerated corrosion of anodic member"); }
  }

  // DEPLOY189: SOIL-SIDE CORROSION KEYWORD DETECTION
  if (hasWord(lt, "buried") || hasWord(lt, "underground") || hasWord(lt, "below grade") || hasWord(lt, "below-grade") || hasWord(lt, "soil side") || hasWord(lt, "soil-side") || hasWord(lt, "soil contact") || hasWord(lt, "soil corrosion") || hasWord(lt, "buried piping") || hasWord(lt, "underground piping") || hasWord(lt, "in soil") || hasWord(lt, "cathodic protection") || hasWord(lt, "cp system") || hasWord(lt, "soil resistivity") || (hasWord(lt, "external") && hasWord(lt, "buried"))) {
    corrosive = true;
    if (agents.indexOf("soil_contact") === -1) { agents.push("soil_contact"); contextInferred.push("buried / soil-contact language detected -> soil-side corrosion potential on external surface"); }
  }

  // DEPLOY190: AMMONIA SCC KEYWORD DETECTION
  if (hasWord(lt, "ammonia scc") || hasWord(lt, "ammonia stress") || hasWord(lt, "ammonia cracking") || hasWord(lt, "anhydrous ammonia") || hasWord(lt, "ammonia storage") || hasWord(lt, "ammonia refriger") || hasWord(lt, "ammonia service") || hasWord(lt, "nh3 scc") || hasWord(lt, "nh3 cracking") || hasWord(lt, "ammonia environment") || hasWord(lt, "ammonia corrosion") || (hasWord(lt, "anhydrous") && hasWord(lt, "nh3"))) {
    corrosive = true;
    if (agents.indexOf("ammonia_scc") === -1) { agents.push("ammonia_scc"); contextInferred.push("ammonia SCC language detected -> stress corrosion cracking risk in ammonia service"); }
  }

  // DEPLOY190: HYDROGEN EMBRITTLEMENT KEYWORD DETECTION
  // Distinct from HTHA (hydrogen_damage) -- HE is atomic hydrogen absorption at lower temps
  if (hasWord(lt, "hydrogen embrittlement") || hasWord(lt, "hydrogen embrit") || hasWord(lt, "hydrogen assisted crack") || hasWord(lt, "hydrogen induced crack") && !hasWord(lt, "hic") || hasWord(lt, "cathodic charging") || hasWord(lt, "cathodic hydrogen") || hasWord(lt, "hydrogen charging") || hasWord(lt, "electroplat") || hasWord(lt, "pickling") && (hasWord(lt, "hydrogen") || hasWord(lt, "embrittl")) || hasWord(lt, "hydrogen delayed fracture") || hasWord(lt, "high strength") && hasWord(lt, "hydrogen") || hasWord(lt, "hsc") && hasWord(lt, "hydrogen")) {
    if (agents.indexOf("hydrogen_charging") === -1) { agents.push("hydrogen_charging"); contextInferred.push("hydrogen embrittlement language detected -> atomic hydrogen absorption causing ductility loss / delayed cracking"); }
  }

  // DEPLOY190: WET H2S BLISTERING / SOHIC KEYWORD DETECTION
  // Distinct from HIC (stepwise internal) and SSC (external stress) -- this covers blistering + SOHIC
  if (hasWord(lt, "blister") || hasWord(lt, "blistering") || hasWord(lt, "hydrogen blister") || hasWord(lt, "sohic") || hasWord(lt, "stress oriented") && hasWord(lt, "hydrogen") || hasWord(lt, "wet h2s") && (hasWord(lt, "blister") || hasWord(lt, "sohic") || hasWord(lt, "damage")) || hasWord(lt, "sour water") && (hasWord(lt, "blister") || hasWord(lt, "bulge") || hasWord(lt, "sohic")) || (hasWord(lt, "h2s") && hasWord(lt, "blister"))) {
    corrosive = true;
    if (agents.indexOf("wet_h2s_blister") === -1) { agents.push("wet_h2s_blister"); contextInferred.push("wet H2S blistering/SOHIC language detected -> hydrogen blistering or stress-oriented HIC in sour water service"); }
  }

  var suscept: string[] = [];
  if (h2s && tensile) suscept.push("SSC");
  if (h2s) suscept.push("HIC");
  if (chlorides && (hasWord(lt, "stainless") || hasWord(lt, "austenitic"))) suscept.push("chloride_SCC");
  if (caustic && tensile) suscept.push("caustic_SCC");
  var coatingOk: boolean | null = null;
  if (hasWord(lt, "coating fail") || hasWord(lt, "coating breakdown") || hasWord(lt, "coating damage")) coatingOk = false;
  else if (hasWord(lt, "coating intact") || hasWord(lt, "coating good")) coatingOk = true;
  if (corrosive) conf += 0.05;

  var presCyc = cyclic && (hasWord(lt, "pressure") || assetClass === "pressure_vessel" || assetClass === "piping");
  var vib = hasWord(lt, "vibrat");
  var impactEv = hasWord(lt, "impact") || hasWord(lt, "struck") || hasWord(lt, "collision") || hasWord(lt, "dropped object");
  var flowEro = hasWord(lt, "erosion") || hasWord(lt, "high velocity");
  var cav = hasWord(lt, "cavitat");

  // FIELD SLANG -- vibration indicators
  // DEPLOY195: Use root forms to catch conjugations (chatter/chatters/chattering, buzz/buzzes/buzzing, etc.)
  // DEPLOY196: Added dictionary-sourced terms: ringing, talking (pipe/structure talking), wobbly, jumpy, lively, spongy
  if (!vib) {
    if (hasWord(lt, "singing") || hasWord(lt, "chatter") || hasWord(lt, "shaking") || hasWord(lt, "humming") || hasWord(lt, "buzz") || hasWord(lt, "rattl") || hasWord(lt, "shudder") || hasWord(lt, "springy") || hasWord(lt, "sway") || hasWord(lt, "flutter") || hasWord(lt, "oscillat") || hasWord(lt, "resonan") || hasWord(lt, "pulsing") || hasWord(lt, "throb") || hasWord(lt, "bounc") || hasWord(lt, "trembl") || hasWord(lt, "feels dead") || hasWord(lt, "feels soft") || hasWord(lt, "feels mushy") || hasWord(lt, "second motion") || hasWord(lt, "answers back") || hasWord(lt, "structure answers") || hasWord(lt, "ringing") || hasWord(lt, "talking") || hasWord(lt, "wobbly") || hasWord(lt, "jumpy") || hasWord(lt, "lively") || hasWord(lt, "spongy")) {
      vib = true;
      if (!cyclic) { cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+vibration_field_language" : "vibration_field_language"; }
    }
  }

  // DEPLOY196: FIELD SLANG -- structural dynamic movement indicators (dictionary: dynamic_movement, instability, load_path_shift, lean_out_of_plumb)
  // These indicate structural movement which implies cyclic loading and potential fatigue/overload
  var dynamicMovement = false;
  if (hasWord(lt, "dancing") || hasWord(lt, "walking") || hasWord(lt, "hunting") || hasWord(lt, "shifting") || hasWord(lt, "traveling") || hasWord(lt, "working") && (hasWord(lt, "beam") || hasWord(lt, "column") || hasWord(lt, "brace") || hasWord(lt, "structure") || hasWord(lt, "steel") || hasWord(lt, "joint") || hasWord(lt, "connection") || hasWord(lt, "support") || hasWord(lt, "base plate") || hasWord(lt, "pipe") || hasWord(lt, "leg")) || hasWord(lt, "not sitting right") || hasWord(lt, "carrying funny") || hasWord(lt, "loaded weird") || hasWord(lt, "taking load wrong") || hasWord(lt, "fighting itself") || hasWord(lt, "dragging load") || hasWord(lt, "load path") || hasWord(lt, "dog-legged") || hasWord(lt, "dog legged") || hasWord(lt, "kicked out") || hasWord(lt, "out of whack") || hasWord(lt, "racked") || hasWord(lt, "out of plumb") || hasWord(lt, "off plumb") || hasWord(lt, "listing") || hasWord(lt, "laying over") || hasWord(lt, "pitched over") || hasWord(lt, "cocked over") || hasWord(lt, "leaning")) {
    dynamicMovement = true;
    if (!cyclic) { cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+structural_movement_field_language" : "structural_movement_field_language"; }
    contextInferred.push("structural movement / instability field language detected -> dynamic loading, possible fatigue or overload");
  }

  // FIELD SLANG -- erosion / flow damage indicators
  // DEPLOY196: Added dictionary erosion_wear terms: cut away, worn a track, rubbing through, eaten in a line
  if (!flowEro) {
    if (hasWord(lt, "eating the elbow") || (hasWord(lt, "chewed up") && (hasWord(lt, "elbow") || hasWord(lt, "bend") || hasWord(lt, "tee"))) || hasWord(lt, "washed out") || hasWord(lt, "channeling") || hasWord(lt, "grooved") || (hasWord(lt, "thinned out") && hasWord(lt, "elbow")) || hasWord(lt, "cut away") || hasWord(lt, "worn a track") || hasWord(lt, "rubbing through") || hasWord(lt, "eaten in a line")) {
      flowEro = true;
    }
  }

  // FIELD SLANG -- impact indicators
  // DEPLOY195: Added wave slam, storm/hurricane impact, got kissed, got worked, beat her up, scarring
  // DEPLOY196: Added water hammer/slugging terms from dictionary (banging, kicking, thumping, slugging)
  if (!impactEv) {
    if (hasWord(lt, "got hit") || hasWord(lt, "took a hit") || hasWord(lt, "hammered") || hasWord(lt, "beat up") || hasWord(lt, "banged up") || hasWord(lt, "dented") || hasWord(lt, "dinged") || hasWord(lt, "wave slam") || hasWord(lt, "got kissed") || hasWord(lt, "got worked") || hasWord(lt, "beat her up") || hasWord(lt, "beat it up") || hasWord(lt, "scarring") || hasWord(lt, "impact scar") || hasWord(lt, "storm damage") || hasWord(lt, "hurricane damage") || hasWord(lt, "debris impact") || hasWord(lt, "ovalization") || hasWord(lt, "ovalized") || hasWord(lt, "bowed") || hasWord(lt, "buckled") || hasWord(lt, "crushed") || hasWord(lt, "water hammer") || hasWord(lt, "slugging") || hasWord(lt, "thumping") || hasWord(lt, "kicking") || hasWord(lt, "jumping when it hits")) {
      impactEv = true;
    }
  }

  // FIELD SLANG -- corrosion/damage descriptors -> wall loss confidence boost
  // DEPLOY196: Expanded with dictionary general_corrosion + pitting + erosion_wear + CUI terms
  if (hasWord(lt, "eaten up") || hasWord(lt, "rotted") || hasWord(lt, "eating away") || hasWord(lt, "rusted out") || hasWord(lt, "paper thin") || hasWord(lt, "necked down") || hasWord(lt, "metal loss") || hasWord(lt, "ate up") || hasWord(lt, "eaten alive") || hasWord(lt, "wore thin") || hasWord(lt, "wore through") || hasWord(lt, "dimpled") || hasWord(lt, "peppered") || hasWord(lt, "shotgunned") || hasWord(lt, "wormholed") || hasWord(lt, "pinholed") || hasWord(lt, "pitted up") || hasWord(lt, "cut away") || hasWord(lt, "grooved") || hasWord(lt, "worn a track") || hasWord(lt, "rubbing through") || hasWord(lt, "eaten in a line") || hasWord(lt, "flaking") || hasWord(lt, "scaled up") || hasWord(lt, "shelled") || hasWord(lt, "coming off in layers") || hasWord(lt, "delaminated") || hasWord(lt, "hidden rust") || hasWord(lt, "insulation got it") || hasWord(lt, "rusting under the lagging") || hasWord(lt, "sweating under the jacketing") || hasWord(lt, "wet under cover") || hasWord(lt, "wet under the wrap") || hasWord(lt, "bleeding rust") || hasWord(lt, "rust bleed") || hasWord(lt, "coating cracked") || hasWord(lt, "paint busted") || hasWord(lt, "paint line opened") || hasWord(lt, "line in the paint")) {
    corrosive = true;
    if (agents.indexOf("field_corrosion_language") === -1) agents.push("field_corrosion_language");
  }
  // DEPLOY196: FIELD SLANG -- welding defect language (dictionary: poor_fusion, porosity, slag_inclusion, undercut, burnthrough, overweld)
  // These indicate fabrication quality issues that can serve as stress concentrators -> fatigue/cracking initiation sites
  var weldDefectLanguage = false;
  if (hasWord(lt, "cold lap") || hasWord(lt, "cold lapped") || hasWord(lt, "didn't dig") || hasWord(lt, "didn't tie in") || hasWord(lt, "laid on top") || hasWord(lt, "no bite") || hasWord(lt, "sitting on top") || hasWord(lt, "bubbly weld") || hasWord(lt, "gassed up") || hasWord(lt, "porous") || hasWord(lt, "swiss cheese") || hasWord(lt, "worm tracks") || hasWord(lt, "dirty pass") || hasWord(lt, "junk in the weld") || hasWord(lt, "slag line") || hasWord(lt, "slag pocket") || hasWord(lt, "slagged up") || hasWord(lt, "trapped trash") || hasWord(lt, "bit the edge") || hasWord(lt, "cut the edge") || hasWord(lt, "grooved the toe") || hasWord(lt, "guttered") || hasWord(lt, "toed out") || hasWord(lt, "undercut") || hasWord(lt, "blew through") || hasWord(lt, "burned through") || hasWord(lt, "blew a hole") || hasWord(lt, "keyholed") || hasWord(lt, "dropped out") || hasWord(lt, "fell out") || hasWord(lt, "crowned up") || hasWord(lt, "fat bead") || hasWord(lt, "high cap") || hasWord(lt, "stacked too much") || hasWord(lt, "too proud") || hasWord(lt, "bird shit weld") || hasWord(lt, "booger weld") || hasWord(lt, "farmer weld") || hasWord(lt, "ugly but holding")) {
    weldDefectLanguage = true;
    if (!stressConc) { stressConc = true; stressConcLocs.push("weld_defect_field_language"); }
    contextInferred.push("welding defect field language detected -> fabrication flaw acts as stress concentrator for fatigue/cracking");
  }

  // DEPLOY196: FIELD SLANG -- fracture progression language (dictionary: fracture_progression)
  // These indicate advancing damage that raises severity and urgency
  var fractureProgression = false;
  if (hasWord(lt, "about gone") || hasWord(lt, "coming apart") || hasWord(lt, "fixing to pop") || hasWord(lt, "letting go") || hasWord(lt, "pulling apart") || hasWord(lt, "tearing out") || hasWord(lt, "opened up") || hasWord(lt, "split") || hasWord(lt, "checking")) {
    fractureProgression = true;
    contextInferred.push("fracture progression field language detected -> active damage advancement, elevated urgency");
  }

  // DEPLOY196: FIELD SLANG -- overheating / thermal damage language (dictionary: overheating, thermal_warp)
  // These indicate thermal exposure history even when no numeric temperature is given
  if (!fireExp) {
    if (hasWord(lt, "blued up") || hasWord(lt, "burnt up") || hasWord(lt, "cooked") || hasWord(lt, "got hot") || hasWord(lt, "heat checked") || hasWord(lt, "saw too much heat") || hasWord(lt, "banana'd") || hasWord(lt, "bananad") || hasWord(lt, "drew up") || hasWord(lt, "heat bent") || hasWord(lt, "pulled over") || hasWord(lt, "shrunk funny") || hasWord(lt, "warped from heat")) {
      fireExp = true;
      contextInferred.push("overheating / thermal damage field language detected -> material may have seen elevated temperature exposure");
    }
  }

  // DEPLOY196: FIELD SLANG -- restraint / binding language (dictionary: restraint)
  // Restraint + thermal cycling = thermal fatigue risk
  if (hasWord(lt, "bound up") || hasWord(lt, "can't move") || hasWord(lt, "fighting expansion") || hasWord(lt, "held tight") || hasWord(lt, "locked up") || hasWord(lt, "pinched")) {
    if (!stressConc) { stressConc = true; stressConcLocs.push("restraint_field_language"); }
    contextInferred.push("restraint / binding field language detected -> locked thermal expansion creates stress concentration");
  }

  // DEPLOY196: FIELD SLANG -- temporary fix / repeat failure language (dictionary: temporary_fix, repeat_failure)
  // These indicate maintenance history that raises inspection priority
  if (hasWord(lt, "band-aided") || hasWord(lt, "band aided") || hasWord(lt, "cowboy repair") || hasWord(lt, "field fix") || hasWord(lt, "held with a prayer") || hasWord(lt, "patch job") || hasWord(lt, "temporary that stayed") || hasWord(lt, "keeps coming back") || hasWord(lt, "never stays fixed") || hasWord(lt, "recurring issue") || hasWord(lt, "same old wound") || hasWord(lt, "same spot again") || hasWord(lt, "back in the same place")) {
    contextInferred.push("temporary fix / repeat failure field language detected -> maintenance history suggests unresolved root cause");
  }

  // DEPLOY196: FIELD SLANG -- fitup / geometry issues (dictionary: fitup_issue, high_low_mismatch, out_of_round)
  // These are fabrication geometry issues that create stress concentration
  if (hasWord(lt, "hi-lo") || hasWord(lt, "hi lo") || hasWord(lt, "high-low") || hasWord(lt, "mismatch") || hasWord(lt, "not flush") || hasWord(lt, "offset joint") || hasWord(lt, "stepped off") || hasWord(lt, "egg-shaped") || hasWord(lt, "egg shaped") || hasWord(lt, "lop-sided") || hasWord(lt, "out of round") || hasWord(lt, "ovaled") || hasWord(lt, "chasing the gap") || hasWord(lt, "fighting the fit") || hasWord(lt, "won't come home") || hasWord(lt, "won't line out")) {
    if (!stressConc) { stressConc = true; stressConcLocs.push("fitup_geometry_field_language"); }
    contextInferred.push("fitup / geometry field language detected -> misalignment creates stress concentration at weld joints");
  }

  var storedE = assetClass === "pressure_vessel" || assetClass === "piping" || assetClass === "pipeline" || assetClass === "offshore_platform" || hasWord(lt, "pressur") || hasWord(lt, "production platform") || hasWord(lt, "hydrocarbon");

  var svcYears: number | null = nv.service_years || null;
  var cyclesEst: string | null = cyclic ? (nv.cycle_count ? String(nv.cycle_count) : "cyclic_but_unknown_count") : null;
  var timeSinceInsp: number | null = nv.years_since_inspection || null;
  if (svcYears) conf += 0.05;
  if (dynamicMovement) conf += 0.05;
  if (weldDefectLanguage) conf += 0.05;
  if (fractureProgression) conf += 0.05;
  if (conf > 1) conf = 1;

  var parts: string[] = [];
  if (loads.length) parts.push("Loading: " + loads.join(", "));
  if (cyclic) parts.push("Cyclic: " + (cyclicSrc || "yes"));
  if (stressConc) parts.push("Stress concentrations: " + stressConcLocs.join(", "));
  if (fireExp) parts.push("Fire exposure" + (fireDur ? " (" + fireDur + "min)" : ""));
  if (corrosive) parts.push("Corrosive (" + agents.join(", ") + ")");
  if (dynamicMovement) parts.push("Structural movement / instability detected");
  if (weldDefectLanguage) parts.push("Welding defect language detected");
  if (fractureProgression) parts.push("Fracture progression language detected");
  if (suscept.length) parts.push("Susceptible: " + suscept.join(", "));
  if (storedE) parts.push("Stored pressure energy");
  if (contextInferred.length > 0) parts.push("Context inferred: " + contextInferred.join("; "));
  var summary = parts.length ? parts.join(". ") + "." : "Limited physical context from transcript.";

  var hotspots: string[] = [];
  var interactionScore = 0;
  var interactionWarnings: string[] = [];

  if (corrosive && cyclic) {
    interactionScore += 25;
    hotspots.push("Corrosion + cyclic stress at same location");
    interactionWarnings.push("Corrosion creates surface pits that become stress risers, accelerating fatigue crack initiation. Combined damage rate is faster than either mechanism alone.");
  }
  if (stressConc && cyclic) {
    interactionScore += 20;
    for (var hi = 0; hi < stressConcLocs.length; hi++) hotspots.push("Cyclic loading at " + stressConcLocs[hi]);
    interactionWarnings.push("Cyclic stress concentrates at geometric discontinuities (" + stressConcLocs.join(", ") + "). These are the most likely crack initiation sites.");
  }
  if (corrosive && stressConc) {
    interactionScore += 15;
    hotspots.push("Corrosion attack at stress concentration");
    interactionWarnings.push("Corrosion preferentially attacks areas of high stress and geometric change. Weld toes, crevices, and transitions are most vulnerable.");
  }
  if (fireExp && storedE) {
    interactionScore += 20;
    hotspots.push("Fire-exposed pressure boundary");
    interactionWarnings.push("Fire may degrade material properties while pressure maintains load. Reduced strength under sustained stress creates failure risk.");
  }
  if (h2s && tensile) {
    interactionScore += 25;
    hotspots.push("Sour environment under tensile stress");
    interactionWarnings.push("H2S charges hydrogen into material under tensile stress. This can cause sudden cracking with little warning. High-priority inspection zone.");
  }
  if (impactEv && storedE) {
    interactionScore += 15;
    hotspots.push("Impact damage on pressurized component");
    interactionWarnings.push("Impact creates local deformation and residual stress. Under pressure, this zone becomes a stress concentration that may initiate cracking.");
  }
  if (interactionScore > 100) interactionScore = 100;
  var interactionLevel = interactionScore >= 60 ? "HIGH" : interactionScore >= 30 ? "MODERATE" : "LOW";
  if (hotspots.length === 0) {
    interactionWarnings.push("No significant force interaction detected. Individual force assessment applies.");
  }

  // ==========================================================================
  // DEPLOY171 v2.6.0: STRUCTURED MATERIAL EXTRACTION
  // Today's code scans material keywords inline (e.g. inside the HTHA check).
  // The new mechanism catalog needs a typed material.class field on the
  // physics object so the catalog evaluator can run material preconditions
  // against an AssetState. This block reads from the same keyword vocabulary
  // today's code already uses but stores the result in a structured shape.
  // All existing physics consumers continue reading physics.chemical.* fields
  // unchanged. Pure addition.
  // ==========================================================================
  var materialClass: string | null = null;
  var materialEvidence: string[] = [];
  var materialConfidence = 0;

  // DEPLOY195: Multi-material tracking. Collect ALL matching materials, then pick
  // the highest-priority (most specific) as primary. Secondary materials are tracked
  // in evidence so Engine 2 and downstream consumers can see the full picture.
  // Priority: nickel_alloy > titanium > duplex > ferritic > martensitic > austenitic > low_alloy > carbon_steel > aluminum > cmc
  // Higher priority number wins. This fixes the cascade bug where plain if-statements
  // let a less-specific material (carbon_steel) overwrite a more-specific one (austenitic).
  var materialMatches: { cls: string; ev: string; priority: number }[] = [];

  // Carbon steel -- most common refinery material (lowest priority among metals)
  if (hasWord(lt, "carbon steel") || hasWord(lt, "c-mn") || hasWord(lt, "carbon-manganese") || hasWord(lt, "a106") || hasWord(lt, "a 106") || hasWord(lt, "a516") || hasWord(lt, "a 516") || hasWord(lt, "sa-106") || hasWord(lt, "sa 106") || hasWord(lt, "sa-516") || hasWord(lt, "sa516") || hasWord(lt, "a36") || hasWord(lt, "a572") || hasWord(lt, "a53") || hasWord(lt, "a333")) {
    materialMatches.push({ cls: "carbon_steel", ev: "carbon steel keyword or ASTM/ASME grade", priority: 1 });
  }

  // Low-alloy steel (Cr-Mo)
  if (hasWord(lt, "1.25cr") || hasWord(lt, "1-1/4 cr") || hasWord(lt, "1.25 cr") || hasWord(lt, "2.25cr") || hasWord(lt, "2-1/4cr") || hasWord(lt, "2 1/4 cr") || hasWord(lt, "2.25 cr") || hasWord(lt, "9cr") || hasWord(lt, "9 cr") || hasWord(lt, "p11") || hasWord(lt, "p22") || hasWord(lt, "p91") || hasWord(lt, "1cr-1/2mo") || hasWord(lt, "c-1/2mo") || hasWord(lt, "low alloy steel") || hasWord(lt, "low-alloy steel") || hasWord(lt, "cr-mo") || hasWord(lt, "chrome moly") || hasWord(lt, "chrome-moly")) {
    materialMatches.push({ cls: "low_alloy_steel", ev: "low-alloy / Cr-Mo grade", priority: 3 });
  }

  // Austenitic stainless -- DEPLOY195: Added bare grade numbers (304, 316, 321, 347)
  if (hasWord(lt, "316l") || hasWord(lt, "type 304") || hasWord(lt, "type 316") || hasWord(lt, "tp304") || hasWord(lt, "tp316") || hasWord(lt, "ss304") || hasWord(lt, "ss316") || hasWord(lt, "304 stainless") || hasWord(lt, "316 stainless") || hasWord(lt, "304l") || hasWord(lt, "304h") || hasWord(lt, "316h") || hasWord(lt, "321 stainless") || hasWord(lt, "347 stainless") || hasWord(lt, "austenitic") || hasWord(lt, "austenitic stainless") || hasWord(lt, "a312") || hasWord(lt, "a 312") || hasWordBoundary(lt, "304") || hasWordBoundary(lt, "316") || hasWordBoundary(lt, "321") || hasWordBoundary(lt, "347")) {
    materialMatches.push({ cls: "austenitic_stainless", ev: "austenitic stainless grade", priority: 4 });
  }

  // Duplex stainless
  if (hasWord(lt, "duplex stainless") || hasWord(lt, "duplex ss") || hasWord(lt, "2205") || hasWord(lt, "2507") || hasWord(lt, "super duplex")) {
    materialMatches.push({ cls: "duplex_stainless", ev: "duplex stainless grade", priority: 6 });
  }

  // DEPLOY187: Ferritic stainless (400-series, types 405, 409, 410S, 430, 446)
  if (hasWord(lt, "ferritic stainless") || hasWord(lt, "ferritic ss") || hasWord(lt, "type 405") || hasWord(lt, "type 409") || hasWord(lt, "type 430") || hasWord(lt, "type 446") || hasWord(lt, "405 stainless") || hasWord(lt, "409 stainless") || hasWord(lt, "430 stainless") || hasWord(lt, "446 stainless") || hasWord(lt, "410s") || hasWord(lt, "12 chrome") || hasWord(lt, "12cr") || hasWord(lt, "400 series stainless") || hasWord(lt, "400-series stainless")) {
    materialMatches.push({ cls: "ferritic_stainless", ev: "ferritic stainless grade (400-series)", priority: 5 });
  }

  // DEPLOY187: Martensitic stainless (types 410, 420, 440)
  if (hasWord(lt, "martensitic stainless") || hasWord(lt, "martensitic ss") || hasWord(lt, "type 410 ") || hasWord(lt, "type 420") || hasWord(lt, "type 440") || hasWord(lt, "410 stainless") || hasWord(lt, "420 stainless") || hasWord(lt, "ca-6nm") || hasWord(lt, "ca6nm") || hasWord(lt, "13cr")) {
    materialMatches.push({ cls: "martensitic_stainless", ev: "martensitic stainless grade", priority: 5 });
  }

  // Nickel alloy (highest priority among metals)
  if (hasWord(lt, "inconel") || hasWord(lt, "hastelloy") || hasWord(lt, "monel") || hasWord(lt, "incoloy") || hasWord(lt, "alloy 625") || hasWord(lt, "alloy 825") || hasWord(lt, "alloy 800") || hasWord(lt, "alloy 718") || hasWord(lt, "nickel alloy") || hasWord(lt, "nickel-base") || hasWord(lt, "nickel base")) {
    materialMatches.push({ cls: "nickel_alloy", ev: "nickel-base alloy", priority: 8 });
  }

  // Titanium
  if (hasWord(lt, "titanium") || hasWord(lt, "ti-6al") || hasWord(lt, "ti6al") || hasWord(lt, "ti-6al-4v") || hasWord(lt, "grade 2 ti") || hasWord(lt, "grade 5 ti")) {
    materialMatches.push({ cls: "titanium_alloy", ev: "titanium alloy", priority: 7 });
  }

  // Aluminum
  if (hasWord(lt, "aluminum") || hasWord(lt, "aluminium") || hasWord(lt, "al-li") || hasWord(lt, "2195") || hasWord(lt, "6061") || hasWord(lt, "5083") || hasWord(lt, "7075")) {
    materialMatches.push({ cls: "aluminum_alloy", ev: "aluminum alloy", priority: 2 });
  }

  // Ceramic matrix composite
  if (hasWord(lt, "cmc") || hasWord(lt, "ceramic matrix composite") || hasWord(lt, "ceramic matrix") || hasWord(lt, "thermal tile") || hasWord(lt, "ceramic tile") || hasWord(lt, "rcc tile") || hasWord(lt, "reinforced carbon-carbon")) {
    materialMatches.push({ cls: "cmc", ev: "ceramic matrix composite", priority: 2 });
  }

  // DEPLOY195: Pick highest-priority material as primary, track all others as secondary
  if (materialMatches.length > 0) {
    materialMatches.sort(function(a, b) { return b.priority - a.priority; });
    materialClass = materialMatches[0].cls;
    materialEvidence.push(materialMatches[0].ev);
    materialConfidence = 0.85;
    for (var mmi = 1; mmi < materialMatches.length; mmi++) {
      materialEvidence.push("secondary_material: " + materialMatches[mmi].cls + " (" + materialMatches[mmi].ev + ")");
    }
  }

  // Concrete -- DEPLOY194: Only classify as concrete if no metallic material already detected.
  // Many transcripts mention both metal components AND concrete foundations/pedestals.
  // The primary material class should always be the metal when both are present,
  // since the inspection analysis is about the metallic pressure boundary or structure.
  var metalClasses = ["carbon_steel", "low_alloy_steel", "austenitic_stainless", "duplex_stainless", "ferritic_stainless", "martensitic_stainless", "nickel_alloy", "titanium_alloy", "aluminum_alloy"];
  if (hasWord(lt, "concrete") || hasWord(lt, "reinforced concrete") || hasWord(lt, "rebar") || hasWord(lt, "prestressed")) {
    if (materialClass === null || metalClasses.indexOf(materialClass) === -1) {
      materialClass = "concrete";
      materialEvidence.push("concrete construction");
      materialConfidence = 0.80;
    } else {
      materialEvidence.push("concrete_also_present (foundation/pedestal -- not primary material)");
    }
  }

  // ==========================================================================
  // DEPLOY171 v2.6.0: STRUCTURED PHASE / ATMOSPHERE EXTRACTION
  // ==========================================================================
  var phasesPresent: string[] = [];
  var phasesNegated: string[] = [];
  var atmosphereClass: string | null = null;

  // DEPLOY197: Added "cooling water", "water service", "sour water", "boiler feedwater" as
  // liquid_water sources. These services obviously contain liquid water but the original
  // keyword list only caught CUI-style moisture language (sweating, wet insulation, etc.).
  // Without this, MIC's phase_must_include precondition returned UNKNOWN for cooling water
  // transcripts even though water is definitionally present.
  if (hasWord(lt, "sweating") || hasWord(lt, "wet insulation") || hasWord(lt, "wet lagging") || hasWord(lt, "condensation") || hasWord(lt, "water ingress") || hasWord(lt, "moisture") || hasWord(lt, "wet jacket") || hasWord(lt, "damp") || hasWord(lt, "weeping water") || hasWord(lt, "cooling water") || hasWord(lt, "water service") || hasWord(lt, "sour water") || hasWord(lt, "boiler feedwater") || hasWord(lt, "bfw system") || hasWord(lt, "condensate return") || hasWord(lt, "condensate system")) {
    if (phasesPresent.indexOf("liquid_water") === -1) phasesPresent.push("liquid_water");
  }
  if (hasWord(lt, "humid") || hasWord(lt, "dew point") || hasWord(lt, "condensable")) {
    if (phasesPresent.indexOf("water_vapor_condensable") === -1) phasesPresent.push("water_vapor_condensable");
  }
  if (hasWord(lt, "hydrocarbon") || hasWord(lt, "crude") || hasWord(lt, "naphtha") || hasWord(lt, "diesel") || hasWord(lt, "gasoline") || hasWord(lt, "kerosene") || hasWord(lt, "lpg") || hasWord(lt, "propane") || hasWord(lt, "butane") || hasWord(lt, "ngl") || hasWord(lt, "ethylene") || hasWord(lt, "methane") || hasWord(lt, "process fluid")) {
    if (phasesPresent.indexOf("hydrocarbon_liquid") === -1) phasesPresent.push("hydrocarbon_liquid");
  }
  if (hasWord(lt, "steam")) {
    if (phasesPresent.indexOf("steam") === -1) phasesPresent.push("steam");
  }
  if (hasWord(lt, "vacuum") || hasWord(lt, "hard vacuum") || hasWord(lt, "space environment") || hasWord(lt, "evacuated") || hasWord(lt, "in space") || hasWord(lt, "outer space")) {
    if (phasesPresent.indexOf("vacuum") === -1) phasesPresent.push("vacuum");
    if (phasesNegated.indexOf("liquid_water") === -1) phasesNegated.push("liquid_water");
    if (phasesNegated.indexOf("water_vapor_condensable") === -1) phasesNegated.push("water_vapor_condensable");
  }
  if (hasWord(lt, "nitrogen blanket") || hasWord(lt, "dry nitrogen") || hasWord(lt, "n2 blanket") || hasWord(lt, "inert gas blanket") || hasWord(lt, "nitrogen purge") || hasWord(lt, "argon blanket")) {
    if (phasesPresent.indexOf("dry_inert_gas") === -1) phasesPresent.push("dry_inert_gas");
  }
  // DEPLOY198: Marine/saltwater phase detection. Offshore platforms, splash zones,
  // seawater services, and marine environments definitionally involve saltwater exposure.
  // Without this, offshore scenarios show no water phases at all despite sitting in the ocean.
  // Push both "saltwater" and "liquid_water" -- saltwater IS liquid water plus chlorides.
  if (!negMarine && (hasWord(lt, "seawater") || hasWord(lt, "saltwater") || hasWord(lt, "salt water") || hasWord(lt, "salt spray") || hasWord(lt, "splash zone") || hasWord(lt, "marine growth") || hasWord(lt, "marine environment") || hasWord(lt, "gulf of mexico") || hasWord(lt, "north sea") || hasWord(lt, "offshore platform") || hasWord(lt, "tidal zone") || hasWord(lt, "wave zone") || hasWord(lt, "sea chest") || hasWord(lt, "ballast water"))) {
    if (phasesPresent.indexOf("saltwater") === -1) phasesPresent.push("saltwater");
    if (phasesPresent.indexOf("liquid_water") === -1) phasesPresent.push("liquid_water");
  }
  // Also infer saltwater for offshore_platform asset class even without explicit marine keywords --
  // an offshore platform is by definition in a marine environment.
  if (!negMarine && assetClass === "offshore_platform") {
    if (phasesPresent.indexOf("saltwater") === -1) phasesPresent.push("saltwater");
    if (phasesPresent.indexOf("liquid_water") === -1) phasesPresent.push("liquid_water");
  }

  // Atmosphere classification
  if (!hasWord(lt, "no insulation") && !hasWord(lt, "uninsulated") && !hasWord(lt, "not insulated") && !hasWord(lt, "bare pipe") && !hasWord(lt, "bare line") && !hasWord(lt, "bare metal")) {
    if (hasWord(lt, "insulated") || hasWord(lt, "insulation") || hasWord(lt, "lagging") || hasWord(lt, "jacketing") || hasWord(lt, "fireproofing") || hasWord(lt, "cladded") || hasWord(lt, "under the insulation") || hasWord(lt, "under insulation")) {
      atmosphereClass = "insulated";
    }
  }
  if (hasWord(lt, "buried") || hasWord(lt, "underground")) atmosphereClass = "buried";
  if (hasWord(lt, "submerged") || hasWord(lt, "subsea") || hasWord(lt, "underwater")) atmosphereClass = "submerged";
  if (hasWord(lt, "vacuum") || hasWord(lt, "hard vacuum") || hasWord(lt, "space environment")) atmosphereClass = "vacuum";
  // DEPLOY198: Marine atmosphere -- more specific than generic "atmospheric" for offshore.
  // Checked before atmospheric so offshore scenarios get "marine" not "atmospheric".
  if (atmosphereClass === null && !negMarine && (hasWord(lt, "marine") || hasWord(lt, "offshore") || hasWord(lt, "splash zone") || hasWord(lt, "seawater") || hasWord(lt, "gulf of mexico") || hasWord(lt, "north sea") || assetClass === "offshore_platform")) {
    atmosphereClass = "marine";
  }
  if (atmosphereClass === null && (hasWord(lt, "atmospheric") || hasWord(lt, "outdoor") || hasWord(lt, "exposed") || hasWord(lt, "weather"))) {
    atmosphereClass = "atmospheric";
  }

  // ==========================================================================
  // DEPLOY171.6 v2.6.2: STRUCTURED PROCESS CHEMISTRY EXTRACTION
  // Populates the typed fields read by the catalog evaluator's
  // process_chemistry bucket. No catalog mechanism in v2.6.2 declares this
  // bucket, so these values are dead state until DEPLOY172 ships sulfidation,
  // CSCC, MIC, and underdeposit_corrosion. Extraction is intentionally
  // conservative: fields default to null when the transcript is silent.
  // This preserves UNKNOWN as a first-class state at the catalog level --
  // INDETERMINATE mechanisms must remain distinct from REJECTED mechanisms.
  // ==========================================================================
  var sulfurClass: string | null = null;
  var chlorideBandPC: string | null = null;
  var amineTypePC: string | null = null;
  var nh4SaltPotential: boolean | null = null;

  // Sulfur class -- coarse band {trace, low, nominal, high, none}.
  // Explicit numeric wt% overrides keyword inference.
  var sulfurNumericMatch = lt.match(/(\d+(?:\.\d+)?)\s*(?:wt\s*)?(?:%|percent|wt%)\s*sulfur/i);
  if (sulfurNumericMatch) {
    var sPct = parseFloat(sulfurNumericMatch[1]);
    if (sPct < 0.1) sulfurClass = "trace";
    else if (sPct < 0.5) sulfurClass = "low";
    else if (sPct < 1.5) sulfurClass = "nominal";
    else sulfurClass = "high";
  }
  if (sulfurClass === null) {
    if (hasWord(lt, "high sulfur") || hasWord(lt, "sour crude") || hasWord(lt, "sulfur-rich") || hasWord(lt, "sulfur rich")) sulfurClass = "high";
    else if (hasWord(lt, "sulfur-bearing") || hasWord(lt, "sulfur bearing")) sulfurClass = "nominal";
    else if (hasWord(lt, "low sulfur")) sulfurClass = "low";
    else if (hasWord(lt, "trace sulfur") || hasWord(lt, "sweet crude")) sulfurClass = "trace";
    else if (h2s && (hasWord(lt, "crude unit") || hasWord(lt, "vacuum tower") || hasWord(lt, "atmospheric tower") || hasWord(lt, "fired heater") || hasWord(lt, "transfer line") || hasWord(lt, "coker") || hasWord(lt, "delayed coker"))) sulfurClass = "nominal";
  }
  if (sulfurClass === null && (negH2s || hasWord(lt, "no sulfur") || hasWord(lt, "sulfur-free") || hasWord(lt, "sulfur free"))) {
    sulfurClass = "none";
  }

  // Chloride band -- {trace, low, medium, high, none}.
  // Explicit numeric ppm overrides keyword inference.
  var chlorideNumericMatch = lt.match(/(\d+(?:\.\d+)?)\s*ppm\s*(?:chloride|cl[\s\-])/i);
  if (chlorideNumericMatch) {
    var clPpm = parseFloat(chlorideNumericMatch[1]);
    if (clPpm < 10) chlorideBandPC = "trace";
    else if (clPpm < 100) chlorideBandPC = "low";
    else if (clPpm < 1000) chlorideBandPC = "medium";
    else chlorideBandPC = "high";
  }
  if (chlorideBandPC === null && chlorides) {
    if (hasWord(lt, "seawater") || hasWord(lt, "brine") || hasWord(lt, "salt water") || hasWord(lt, "high chloride")) chlorideBandPC = "high";
    else if (hasWord(lt, "chlorides in service") || hasWord(lt, "chloride-bearing") || hasWord(lt, "chloride bearing")) chlorideBandPC = "medium";
    else if (hasWord(lt, "salty") || hasWord(lt, "chloride") || hasWord(lt, "salt")) chlorideBandPC = "low";
  }
  if (chlorideBandPC === null && negChloride) {
    chlorideBandPC = "none";
  }

  // Amine type -- named amines override generic
  if (hasWord(lt, "mdea") || hasWord(lt, "methyldiethanolamine")) amineTypePC = "MDEA";
  else if (hasWord(lt, "dea unit") || hasWord(lt, "diethanolamine")) amineTypePC = "DEA";
  else if (hasWord(lt, "mea unit") || hasWord(lt, "monoethanolamine")) amineTypePC = "MEA";
  else if (hasWord(lt, "amine unit") || hasWord(lt, "amine service") || hasWord(lt, "rich amine") || hasWord(lt, "lean amine") || hasWord(lt, "amine system") || hasWord(lt, "amine contactor") || hasWord(lt, "amine regenerat") || hasWord(lt, "amine absorber") || hasWord(lt, "amine stripper") || hasWord(lt, "amine tower")) amineTypePC = "amine_unspecified";

  // Ammonium salt potential -- explicit language, or condensing-overhead-with-cl-and-nitrogen heuristic
  if (hasWord(lt, "ammonium chloride") || hasWord(lt, "nh4cl") || hasWord(lt, "ammonium bisulfide") || hasWord(lt, "nh4hs") || hasWord(lt, "ammonium salt") || hasWord(lt, "nh4 salt")) {
    nh4SaltPotential = true;
  } else if ((hasWord(lt, "overhead") || hasWord(lt, "rain line") || hasWord(lt, "dew point") || hasWord(lt, "condensing")) && chlorideBandPC !== null && chlorideBandPC !== "none" && (h2s || hasWord(lt, "ammonia") || hasWord(lt, "nh3"))) {
    nh4SaltPotential = true;
  }

  // ==========================================================================
  // DEPLOY171.6 v2.6.2: STRUCTURED FLOW REGIME EXTRACTION
  // ==========================================================================
  var flowState: string | null = null;
  var deadlegPresent: boolean | null = null;
  var turbulenceGeometryPresent: boolean | null = null;

  // DEPLOY197: Reordered -- check "high" BEFORE "low" to prevent substring collision
  // where "flow rate" matched "low rate" (the substring "low rate" hides inside "flow rate").
  // Also removed "low rate" keyword entirely -- "low flow", "low velocity", and "rate cuts"
  // cover the intent without the false-positive risk.
  if (hasWord(lt, "dead leg") || hasWord(lt, "deadleg") || hasWord(lt, "stagnant") || hasWord(lt, "no flow") || hasWord(lt, "trapped fluid")) {
    flowState = "stagnant";
  } else if (hasWord(lt, "high velocity") || hasWord(lt, "high flow") || hasWord(lt, "high rate") || hasWord(lt, "fast flow")) {
    flowState = "high";
  } else if (hasWord(lt, "low flow") || hasWord(lt, "low velocity") || hasWord(lt, "rate cuts") || hasWord(lt, "low-flow") || hasWord(lt, "intermittent flow") || hasWord(lt, "intermittent operation")) {
    flowState = "low";
  } else if (hasWord(lt, "moderate velocity") || hasWord(lt, "continuous flow") || hasWord(lt, "normal flow") || hasWord(lt, "moderate flow")) {
    flowState = "moderate";
  }

  if (hasWord(lt, "dead leg") || hasWord(lt, "deadleg") || (hasWord(lt, "bypass spool") && (hasWord(lt, "stagnant") || hasWord(lt, "no flow")))) {
    deadlegPresent = true;
  }

  // Turbulence geometry -- only flag when a turbulence-inducing geometry word
  // co-occurs with downstream damage language. Prevents false positives on
  // every transcript that mentions an elbow.
  var hasGeoWord = hasWord(lt, "elbow") || hasWord(lt, " tee ") || hasWord(lt, " tee,") || hasWord(lt, " tee.") || hasWord(lt, "reducer") || hasWord(lt, "branch connection") || hasWord(lt, "long radius bend") || hasWord(lt, "long-radius bend");
  var hasDownstreamDamage = hasWord(lt, "downstream of") || hasWord(lt, "elbows worse") || hasWord(lt, "elbow worse") || hasWord(lt, "elbows getting hit") || hasWord(lt, "eaten") || hasWord(lt, "thinner at") || hasWord(lt, "wall loss at") || hasWord(lt, "metal loss at") || hasWord(lt, "turbulence") || hasWord(lt, "accelerated thinning") || hasWord(lt, "locally accelerated") || hasWord(lt, "washed out");
  if (hasGeoWord && hasDownstreamDamage) {
    turbulenceGeometryPresent = true;
    // DEPLOY197: Promote flow_state to "turbulent" when turbulence geometry + downstream
    // damage are both present but no explicit velocity keyword was given. This allows the
    // erosion catalog mechanism to reach SATISFIED on its flow_regime precondition.
    if (flowState === null) {
      flowState = "turbulent";
    }
  }

  // ==========================================================================
  // DEPLOY171.6 v2.6.2: STRUCTURED DEPOSITS EXTRACTION
  // Note schema: deposit_type is a SINGLE string (not a set). When multiple
  // deposit-type signals appear, the most specific one wins per the priority
  // ordering below (biofilm > salt > sulfide > scale > rust > unspecified).
  // ==========================================================================
  var depositsPresent: boolean | null = null;
  var depositType: string | null = null;
  var depositEvidence: string[] = [];

  if (hasWord(lt, "deposits") || hasWord(lt, "deposit ") || hasWord(lt, "tubercle") || hasWord(lt, "slime") || hasWord(lt, "fouling") || hasWord(lt, "crusty") || hasWord(lt, "junk") || hasWord(lt, "sediment") || hasWord(lt, "buildup") || hasWord(lt, "accumulation") || hasWord(lt, "goo") || hasWord(lt, "sludge") || hasWord(lt, "internal deposits")) {
    depositsPresent = true;
  }

  // Deposit type -- biofilm/MIC signals are highest priority because they
  // imply both deposits AND a biological vector that distinguishes MIC
  // from generic underdeposit corrosion.
  if (hasWord(lt, "black slime") || hasWord(lt, "biofilm") || hasWord(lt, "tubercle") || (hasWord(lt, "slime") && (hasWord(lt, "rotten egg") || hasWord(lt, "h2s") || hasWord(lt, "sour"))) || hasWord(lt, "bugs are helping") || hasWord(lt, "mic under")) {
    depositType = "biofilm";
    if (depositsPresent === null) depositsPresent = true;
    if (hasWord(lt, "black slime")) depositEvidence.push("black slime");
    if (hasWord(lt, "tubercle")) depositEvidence.push("tubercles");
    if (hasWord(lt, "biofilm")) depositEvidence.push("biofilm");
    if (hasWord(lt, "bugs")) depositEvidence.push("biological vector language");
  } else if (hasWord(lt, "ammonium chloride") || hasWord(lt, "ammonium salt") || hasWord(lt, "salt deposit") || hasWord(lt, "crusty junk") || (hasWord(lt, "salt") && (hasWord(lt, "overhead") || hasWord(lt, "condensing")))) {
    depositType = "salt";
    if (depositsPresent === null) depositsPresent = true;
    if (hasWord(lt, "ammonium")) depositEvidence.push("ammonium salt language");
    if (hasWord(lt, "crusty")) depositEvidence.push("crusty salt deposits");
  } else if (hasWord(lt, "iron sulfide") || hasWord(lt, "sulfide deposit") || hasWord(lt, "fes deposit") || hasWord(lt, "fes scale")) {
    depositType = "sulfide";
    if (depositsPresent === null) depositsPresent = true;
    depositEvidence.push("iron sulfide language");
  } else if (hasWord(lt, "scale") || hasWord(lt, "scaling")) {
    depositType = "scale";
    if (depositsPresent === null) depositsPresent = true;
    depositEvidence.push("scale language");
  } else if (hasWord(lt, "rust deposit") || hasWord(lt, "rust accumulation") || hasWord(lt, "iron oxide deposit")) {
    depositType = "rust";
    if (depositsPresent === null) depositsPresent = true;
    depositEvidence.push("rust accumulation language");
  } else if (depositsPresent === true) {
    depositType = "unspecified";
    depositEvidence.push("generic deposit language");
  }

  return {
    stress: { primary_load_types: loads, cyclic_loading: cyclic, cyclic_source: cyclicSrc, stress_concentration_present: stressConc, stress_concentration_locations: stressConcLocs, tensile_stress: tensile, compressive_stress: compress, load_path_criticality: loadPath, residual_stress_likely: residual } as StressState,
    thermal: { operating_temp_c: tempC, operating_temp_f: tempF, thermal_cycling: thermalCyc, fire_exposure: fireExp, fire_duration_min: fireDur, creep_range: creep, cryogenic: cryo } as ThermalState,
    chemical: { corrosive_environment: corrosive, environment_agents: agents, h2s_present: h2s, co2_present: co2, chlorides_present: chlorides, caustic_present: caustic, hydrogen_present: hydrogen, material_susceptibility: suscept, coating_intact: coatingOk, sour_service: h2s } as ChemicalState,
    energy: { pressure_cycling: presCyc, vibration: vib, impact_event: impactEv, impact_description: impactEv ? "Impact event in transcript" : null, flow_erosion_risk: flowEro, cavitation: cav, stored_energy_significant: storedE } as EnergyState,
    time: { service_years: svcYears, cycles_estimated: cyclesEst, time_since_inspection_years: timeSinceInsp } as TimeState,
    field_interaction: { hotspots: hotspots, interaction_score: interactionScore, interaction_level: interactionLevel, warnings: interactionWarnings },
    physics_summary: summary,
    physics_confidence: roundN(conf, 2),
    context_inferred: contextInferred,
    material: { class: materialClass, class_confidence: materialConfidence, evidence: materialEvidence },
    environment: { phases_present: phasesPresent, phases_negated: phasesNegated, atmosphere_class: atmosphereClass },
    // DEPLOY194: Added hydrogen_present, h2s_present, caustic_present from chemical state.
    // These flags were only in physics.chemical but the catalog evaluator reads from
    // assetState.process_chemistry. Without them, hydrogen_required (HTHA), h2s checks,
    // and caustic checks always returned UNKNOWN -- those mechanisms could never fully validate.
    process_chemistry: { chloride_band: chlorideBandPC, sulfur_class: sulfurClass, amine_type: amineTypePC, nh4_salt_potential: nh4SaltPotential, hydrogen_present: hydrogen, h2s_present: h2s, caustic_present: caustic, naphthenic_acid_present: agents.indexOf("naphthenic_acid") !== -1, polythionic_acid_present: agents.indexOf("polythionic_acid") !== -1, amine_cracking_context: agents.indexOf("amine_cracking") !== -1, carbonate_scc_context: agents.indexOf("carbonate_scc") !== -1, embrittlement_885f_context: agents.indexOf("885f_embrittlement") !== -1, sigma_phase_context: agents.indexOf("sigma_phase") !== -1, temper_embrittlement_context: agents.indexOf("temper_embrittlement") !== -1, ammonia_scc_context: agents.indexOf("ammonia_scc") !== -1, hydrogen_charging_context: agents.indexOf("hydrogen_charging") !== -1, wet_h2s_context: agents.indexOf("wet_h2s_blister") !== -1 },
    flow_regime: { flow_state: flowState, deadleg: deadlegPresent, turbulence_geometry_present: turbulenceGeometryPresent },
    deposits: { deposits_present: depositsPresent, deposit_type: depositType, deposit_evidence: depositEvidence }
  };
}

// ============================================================================
// STATE 2: DAMAGE REALITY ENGINE
// ============================================================================
var MECH_SCORING_TABLE = [
  { id: "cui", name: "Corrosion Under Insulation", sev: "medium", eKeys: ["critical_wall_loss_confirmed"], preLabels: ["Temperature in CUI range (0-350F)", "Insulated equipment"] },
  { id: "general_corrosion", name: "General Corrosion", sev: "medium", eKeys: ["critical_wall_loss_confirmed", "leak_suspected"], preLabels: ["Corrosive environment"] },
  { id: "pitting", name: "Pitting Corrosion", sev: "high", eKeys: ["critical_wall_loss_confirmed", "leak_confirmed"], preLabels: ["Localized corrosive agent (Cl-/CO2)"] },
  { id: "co2_corrosion", name: "CO2 (Sweet) Corrosion", sev: "medium", eKeys: ["critical_wall_loss_confirmed"], preLabels: ["CO2 present", "Water phase"] },
  { id: "erosion", name: "Erosion / Erosion-Corrosion", sev: "medium", eKeys: ["critical_wall_loss_confirmed"], preLabels: ["High flow velocity or erosive conditions"] },
  { id: "cscc", name: "Chloride Stress Corrosion Cracking", sev: "critical", eKeys: ["crack_confirmed", "visible_cracking"], preLabels: ["Austenitic/duplex stainless", "Chlorides", "Temperature > 140F"] },
  { id: "mic", name: "Microbiologically Influenced Corrosion", sev: "high", eKeys: ["critical_wall_loss_confirmed", "leak_confirmed"], preLabels: ["Stagnant/low-flow regime", "Deposits with biofilm"] },
  { id: "sulfidation", name: "High-Temperature Sulfidation", sev: "high", eKeys: ["critical_wall_loss_confirmed"], preLabels: ["Sulfur-bearing service", "Elevated temperature"] },
  { id: "underdeposit_corrosion", name: "Under-Deposit Corrosion", sev: "high", eKeys: ["critical_wall_loss_confirmed", "leak_confirmed"], preLabels: ["Deposits present", "Ammonium salt potential"] },
  { id: "fatigue_mechanical", name: "Mechanical Fatigue", sev: "high", eKeys: ["crack_confirmed", "visible_cracking"], preLabels: ["Cyclic loading", "Stress concentration"] },
  { id: "fatigue_thermal", name: "Thermal Fatigue", sev: "high", eKeys: ["crack_confirmed", "visible_cracking"], preLabels: ["Thermal cycling", "Stress concentration"] },
  { id: "fatigue_vibration", name: "Vibration Fatigue", sev: "medium", eKeys: ["crack_confirmed"], preLabels: ["Vibration", "Stress concentration"] },
  { id: "scc_chloride", name: "Chloride SCC", sev: "critical", eKeys: ["crack_confirmed"], preLabels: ["Tensile stress", "Chlorides", "Susceptible material (austenitic/duplex)"] },
  { id: "scc_caustic", name: "Caustic SCC", sev: "critical", eKeys: ["crack_confirmed"], preLabels: ["Tensile stress", "Caustic environment"] },
  { id: "ssc_sulfide", name: "Sulfide Stress Cracking", sev: "critical", eKeys: ["crack_confirmed"], preLabels: ["Tensile stress", "H2S present"] },
  { id: "hic", name: "Hydrogen Induced Cracking", sev: "high", eKeys: ["crack_confirmed", "visible_cracking"], preLabels: ["H2S present (hydrogen source)"] },
  { id: "creep", name: "Creep Damage", sev: "critical", eKeys: [], preLabels: ["Temperature in creep range", "Sustained tensile stress"] },
  { id: "brittle_fracture", name: "Brittle Fracture", sev: "critical", eKeys: ["crack_confirmed"], preLabels: ["Low temperature", "Pre-existing flaw"] },
  { id: "overload_buckling", name: "Mechanical Overload / Buckling", sev: "high", eKeys: ["visible_deformation", "dent_or_gouge_present"], preLabels: ["Compressive overload or impact energy"] },
  { id: "fire_damage", name: "Fire / Thermal Damage", sev: "high", eKeys: ["fire_exposure", "fire_property_degradation_confirmed"], preLabels: ["Fire or elevated temperature exposure"] },
  { id: "hydrogen_damage", name: "High Temp Hydrogen Attack", sev: "critical", eKeys: [], preLabels: ["Hydrogen environment", "Elevated temperature (>400F)"] },
  // DEPLOY185: Naphthenic Acid Corrosion + Polythionic Acid SCC
  { id: "naphthenic_acid_corrosion", name: "Naphthenic Acid Corrosion", sev: "high", eKeys: ["critical_wall_loss_confirmed", "localized_thinning"], preLabels: ["Naphthenic acid / high TAN service", "Temperature in NAC range (400-800F)"] },
  { id: "polythionic_acid_scc", name: "Polythionic Acid SCC", sev: "critical", eKeys: ["crack_confirmed", "visible_cracking", "intergranular_cracking"], preLabels: ["Polythionic acid cracking context", "Susceptible material (austenitic/duplex)"] },
  // DEPLOY186: Amine Cracking + Carbonate SCC
  { id: "amine_cracking", name: "Amine SCC", sev: "high", eKeys: ["crack_confirmed", "visible_cracking"], preLabels: ["Amine service environment", "Carbon steel / low-alloy steel"] },
  { id: "carbonate_scc", name: "Carbonate SCC", sev: "high", eKeys: ["crack_confirmed", "visible_cracking"], preLabels: ["Carbonate / alkaline sour water environment", "Carbon steel / low-alloy steel"] },
  // DEPLOY187: Embrittlement mechanisms
  { id: "embrittlement_885f", name: "885F Embrittlement", sev: "high", eKeys: [], preLabels: ["Ferritic/duplex stainless", "Temperature in 885F range (600-1000F)"] },
  { id: "sigma_phase_embrittlement", name: "Sigma Phase Embrittlement", sev: "high", eKeys: [], preLabels: ["Austenitic/duplex stainless", "Temperature in sigma range (1000-1600F)"] },
  { id: "temper_embrittlement", name: "Temper Embrittlement", sev: "critical", eKeys: [], preLabels: ["Cr-Mo low-alloy steel", "Temperature in temper embrittlement range (650-1070F)"] },
  // DEPLOY188: High-temperature degradation mechanisms
  { id: "carburization", name: "Carburization", sev: "high", eKeys: [], preLabels: ["Temperature above 1100F", "Hydrocarbon service"] },
  { id: "metal_dusting", name: "Metal Dusting", sev: "critical", eKeys: ["critical_wall_loss_confirmed"], preLabels: ["Temperature in metal dusting range (900-1500F)", "CO-rich / syngas environment"] },
  { id: "high_temp_oxidation", name: "High-Temp Oxidation", sev: "medium", eKeys: ["critical_wall_loss_confirmed"], preLabels: ["Temperature above 1000F"] },
  { id: "spheroidization", name: "Spheroidization", sev: "medium", eKeys: [], preLabels: ["Carbon steel", "Temperature above 850F"] },
  { id: "decarburization", name: "Decarburization", sev: "medium", eKeys: [], preLabels: ["Carbon/low-alloy steel", "Temperature above 800F"] },
  { id: "graphitization", name: "Graphitization", sev: "high", eKeys: [], preLabels: ["Carbon steel", "Temperature above 800F long-term"] },
  // DEPLOY189: Remaining corrosion mechanisms
  { id: "galvanic_corrosion", name: "Galvanic Corrosion", sev: "medium", eKeys: ["critical_wall_loss_confirmed", "localized_thinning"], preLabels: ["Dissimilar metal contact", "Electrolyte present"] },
  { id: "atmospheric_corrosion", name: "Atmospheric Corrosion", sev: "low", eKeys: ["critical_wall_loss_confirmed"], preLabels: ["Outdoor / atmospheric exposure", "Carbon/low-alloy steel"] },
  { id: "soil_corrosion", name: "Soil-Side Corrosion", sev: "medium", eKeys: ["critical_wall_loss_confirmed", "localized_thinning"], preLabels: ["Buried / soil contact", "Carbon/low-alloy steel"] },
  { id: "cavitation", name: "Cavitation Damage", sev: "medium", eKeys: ["critical_wall_loss_confirmed", "localized_thinning"], preLabels: ["Cavitation conditions (pumps, valves, restrictions)"] },
  // DEPLOY190: Remaining cracking mechanisms
  { id: "ammonia_scc", name: "Ammonia SCC", sev: "critical", eKeys: ["crack_confirmed", "visible_cracking"], preLabels: ["Ammonia service environment"] },
  { id: "hydrogen_embrittlement", name: "Hydrogen Embrittlement", sev: "critical", eKeys: ["crack_confirmed", "visible_cracking"], preLabels: ["Hydrogen charging source"] },
  { id: "wet_h2s_blister", name: "Wet H2S Blistering/SOHIC", sev: "high", eKeys: ["crack_confirmed", "visible_cracking"], preLabels: ["Wet H2S / sour water blistering environment"] }
];

function resolveDamageReality(physics: any, flags: any, transcript: string, provenance?: any) {
  var fl = flags || {};
  var lt = transcript.toLowerCase();
  var validated: ValidatedMechanism[] = [];
  var rejected: RejectedMechanism[] = [];
  var indeterminate: any[] = [];

  // DEPLOY171 v2.6.0: Build the AssetState once for the catalog evaluator.
  // Used by the catalog routing block inside the MECH_DEFS for-loop below.
  var assetStateForCatalog = buildAssetStateForCatalog(physics, transcript);

  // ============================================================================
  // EVIDENCE HIERARCHY -- DEPLOY115
  // ============================================================================
  var wallLossReported = hasWord(lt, "wall loss") || hasWord(lt, "metal loss") || hasWord(lt, "thinning") || hasWord(lt, "wall thinning") || hasWord(lt, "thickness loss") || hasWord(lt, "thinned") || hasWord(lt, "thinned out") || hasWord(lt, "corroded") || hasWord(lt, "pitted") || hasWord(lt, "washed out") || hasWord(lt, "eating") || hasWord(lt, "reduced thickness") || hasWord(lt, "reduced wall") || hasWord(lt, "paper thin") || /\d+\s*(?:percent|%)\s*(?:down|loss|gone|reduced)/i.test(transcript) || /\d+\.?\d*\s*(?:inch|in\.?|mm)\s*(?:versus|vs\.?|compared\s*to|from|against)\s*\d+\.?\d*/i.test(transcript) || (/(?:nominal|original|design|minimum)\s*(?:of\s*)?\d+\.?\d*/i.test(transcript) && /(?:shows|reads?|measured|found|actual)\s*\d+\.?\d*/i.test(transcript)) || (/\d+\.?\d*\s*(?:inch|in\.?|mm)/.test(transcript) && hasWord(lt, "nominal") && hasWord(lt, "versus"));
  var wallLossQuantified = wallLossReported && (/\d+\s*(?:percent|%)\s*(?:wall\s*loss|metal\s*loss|thinning|thickness\s*loss|down|loss|gone|reduced)/i.test(transcript) || /(?:wall\s*loss|metal\s*loss|thinning|thickness\s*loss)\s*(?:of\s*)?\d+/i.test(transcript) || /\d+[-\u2013\u2014]?\d*\s*(?:percent|%)\s*(?:down|loss|gone|reduced)/i.test(transcript) || /(?:wall\s*loss|metal\s*loss|thinning)[^.]{0,30}\d+\s*(?:percent|%)/i.test(transcript) || /\d+\s*(?:percent|%)[^.]{0,30}(?:wall\s*loss|metal\s*loss|thinning)/i.test(transcript) || /\d+\.?\d*\s*(?:inch|in\.?|mm)\s*(?:versus|vs\.?|compared\s*to|from|against)\s*\d+\.?\d*/i.test(transcript));
  var wallLossMeasuredByNDE = wallLossReported && (hasWord(lt, "ultrasonic") || hasWord(lt, "ut ") || hasWord(lt, "ut grid") || hasWord(lt, "thickness reading") || hasWord(lt, "thickness survey") || hasWord(lt, "paut") || hasWord(lt, "scan") || hasWord(lt, "confirmed") || hasWord(lt, "measured") || hasWord(lt, "inspection found") || hasWord(lt, "shows") || (hasWord(lt, "found") && hasWord(lt, "wall loss")) || (hasWord(lt, "ut") && /\d+\.?\d*/.test(transcript)));
  var crackingSuspectedOnly = (hasWordNotNegated(lt, "crack") || hasWordNotNegated(lt, "cracking")) && (hasWord(lt, "suspected") || hasWord(lt, "possible") || hasWord(lt, "potential") || hasWord(lt, "concern") || hasWord(lt, "may be") || hasWord(lt, "might be") || hasWord(lt, "or something") || hasWord(lt, "hard to tell") || hasWord(lt, "not sure") || hasWord(lt, "not clean") || hasWord(lt, "junk geometry")) && !hasWord(lt, "crack confirmed") && !hasWord(lt, "cracking confirmed") && !(!!fl.crack_confirmed);
  var s = physics.stress; var t = physics.thermal; var c = physics.chemical; var e = physics.energy;

  var preCheckMap: any = {
    "Cyclic loading": s.cyclic_loading,
    "Stress concentration": s.stress_concentration_present,
    "Thermal cycling": t.thermal_cycling,
    "Vibration": e.vibration,
    "Corrosive environment": c.corrosive_environment,
    "Localized corrosive agent (Cl-/CO2)": c.chlorides_present || c.co2_present,
    "Tensile stress": s.tensile_stress,
    "Chlorides": c.chlorides_present,
    "Susceptible material (austenitic/duplex)": c.material_susceptibility && c.material_susceptibility.indexOf("chloride_SCC") !== -1,
    "Caustic environment": c.caustic_present,
    "H2S present": c.h2s_present,
    "H2S present (hydrogen source)": c.h2s_present,
    "CO2 present": c.co2_present,
    "Water phase": c.corrosive_environment,
    "Temperature in creep range": t.creep_range,
    "Sustained tensile stress": s.tensile_stress,
    "Low temperature": t.cryogenic,
    "Pre-existing flaw": !!fl.crack_confirmed || !!fl.visible_cracking || !!fl.dent_or_gouge_present,
    "High flow velocity or erosive conditions": e.flow_erosion_risk,
    "Compressive overload or impact energy": s.compressive_stress || e.impact_event,
    "Fire or elevated temperature exposure": t.fire_exposure,
    "Temperature in CUI range (0-350F)": t.operating_temp_f !== null && t.operating_temp_f >= 0 && t.operating_temp_f <= 350,
    "Insulated equipment": false,
    "Hydrogen environment": c.hydrogen_present,
    "Elevated temperature (>400F)": t.operating_temp_f !== null && t.operating_temp_f > 400,
    // DEPLOY185: Naphthenic acid + polythionic acid preChecks
    "Naphthenic acid / high TAN service": c.environment_agents && c.environment_agents.indexOf("naphthenic_acid") !== -1,
    "Temperature in NAC range (400-800F)": t.operating_temp_f !== null && t.operating_temp_f >= 400 && t.operating_temp_f <= 800,
    "Polythionic acid cracking context": c.environment_agents && c.environment_agents.indexOf("polythionic_acid") !== -1,
    // DEPLOY186: Amine cracking + carbonate SCC preChecks
    "Amine service environment": c.environment_agents && (c.environment_agents.indexOf("amine_cracking") !== -1 || c.caustic_present),
    "Carbon steel / low-alloy steel": true,
    "Carbonate / alkaline sour water environment": c.environment_agents && c.environment_agents.indexOf("carbonate_scc") !== -1,
    // DEPLOY187: Embrittlement preChecks
    "Ferritic/duplex stainless": false,
    "Temperature in 885F range (600-1000F)": t.operating_temp_f !== null && t.operating_temp_f >= 600 && t.operating_temp_f <= 1000,
    "Austenitic/duplex stainless": false,
    "Temperature in sigma range (1000-1600F)": t.operating_temp_f !== null && t.operating_temp_f >= 1000 && t.operating_temp_f <= 1600,
    "Cr-Mo low-alloy steel": false,
    "Temperature in temper embrittlement range (650-1070F)": t.operating_temp_f !== null && t.operating_temp_f >= 650 && t.operating_temp_f <= 1070,
    // DEPLOY188: High-temp degradation preChecks
    "Temperature above 1100F": t.operating_temp_f !== null && t.operating_temp_f >= 1100,
    "Hydrocarbon service": c.corrosive_environment,
    "Temperature in metal dusting range (900-1500F)": t.operating_temp_f !== null && t.operating_temp_f >= 900 && t.operating_temp_f <= 1500,
    "CO-rich / syngas environment": c.environment_agents && c.environment_agents.indexOf("metal_dusting") !== -1,
    "Temperature above 1000F": t.operating_temp_f !== null && t.operating_temp_f >= 1000,
    "Carbon steel": false,
    "Temperature above 850F": t.operating_temp_f !== null && t.operating_temp_f >= 850,
    "Carbon/low-alloy steel": false,
    "Temperature above 800F": t.operating_temp_f !== null && t.operating_temp_f >= 800,
    "Temperature above 800F long-term": t.operating_temp_f !== null && t.operating_temp_f >= 800,
    // DEPLOY189: Remaining corrosion mechanism preChecks
    "Dissimilar metal contact": c.environment_agents && c.environment_agents.indexOf("galvanic") !== -1,
    "Electrolyte present": c.corrosive_environment,
    "Outdoor / atmospheric exposure": c.environment_agents && (c.environment_agents.indexOf("atmospheric") !== -1 || c.environment_agents.indexOf("environmental_exposure") !== -1),
    "Buried / soil contact": c.environment_agents && c.environment_agents.indexOf("soil_contact") !== -1,
    "Cavitation conditions (pumps, valves, restrictions)": e.cavitation,
    // DEPLOY190: Remaining cracking mechanism preChecks
    "Ammonia service environment": c.environment_agents && c.environment_agents.indexOf("ammonia_scc") !== -1,
    "Hydrogen charging source": c.environment_agents && c.environment_agents.indexOf("hydrogen_charging") !== -1,
    "Wet H2S / sour water blistering environment": c.environment_agents && c.environment_agents.indexOf("wet_h2s_blister") !== -1
  };

  for (var i = 0; i < MECH_SCORING_TABLE.length; i++) {
    var md = MECH_SCORING_TABLE[i];
    var score = 0;
    var evFor: string[] = [];
    var evAg: string[] = [];
    var obs = false;

    // ========================================================================
    // DEPLOY171 v2.6.0: CATALOG ROUTING FOR MIGRATED MECHANISMS
    // If this mechanism has been migrated to the data-driven catalog, run
    // the catalog evaluator instead of (or in addition to) the legacy
    // MECH_DEFS predicate. The catalog produces one of three statuses:
    //   REJECTED      -- physically impossible. Add to rejected[] and skip
    //                   the rest of the loop body for this mechanism.
    //   INDETERMINATE -- preconditions cannot be confirmed or ruled out from
    //                   available evidence. Add to indeterminate[] and skip
    //                   the rest of the loop body. Does NOT fire as a
    //                   validated mechanism in DEPLOY171 -- observational
    //                   only, surfaced for manual review.
    //   ELIGIBLE      -- all preconditions satisfied. Set skipOldPredicate
    //                   so the legacy md.pre(...) gate is bypassed (the
    //                   catalog has already verified preconditions), then
    //                   fall through to the existing scoring path which
    //                   computes reality_score against observation evidence.
    // ========================================================================
    var skipOldPredicate = false;
    if (MIGRATED_TO_CATALOG.indexOf(md.id) !== -1) {
      var catalogEntry: any = null;
      for (var cei = 0; cei < MECHANISM_CATALOG_V1.length; cei++) {
        if (MECHANISM_CATALOG_V1[cei].id === md.id) { catalogEntry = MECHANISM_CATALOG_V1[cei]; break; }
      }
      if (catalogEntry) {
        var evalResult = evaluateMechanismFromCatalog(catalogEntry, assetStateForCatalog);
        if (evalResult.status === "REJECTED") {
          var rejMet: string[] = [];
          for (var rmi = 0; rmi < evalResult.satisfied.length; rmi++) {
            rejMet.push(evalResult.satisfied[rmi].bucket + "." + evalResult.satisfied[rmi].field);
          }
          var rejMissing: string[] = [];
          for (var rmj = 0; rmj < evalResult.violated.length; rmj++) {
            rejMissing.push(evalResult.violated[rmj].bucket + "." + evalResult.violated[rmj].field);
          }
          rejected.push({
            id: md.id,
            name: md.name,
            rejection_reason: "CATALOG REJECTED: " + evalResult.rejection_summary,
            missing_precondition: rejMissing.join("; "),
            met_preconditions: rejMet
          });
          continue;
        }
        if (evalResult.status === "INDETERMINATE") {
          indeterminate.push({
            id: md.id,
            name: md.name,
            family: evalResult.mechanism_family,
            status: "INDETERMINATE",
            summary: evalResult.indeterminate_summary,
            satisfied: evalResult.satisfied,
            unknown: evalResult.unknown,
            violated: evalResult.violated
          });
          continue;
        }
        // status === "ELIGIBLE": fall through to scoring. Bypass the legacy
        // predicate because the catalog has already verified preconditions.
        skipOldPredicate = true;

        // DEPLOY172 v2.7.0: CATALOG-SPECIFIC SCORING BOOSTS
        // These fire only for catalog-routed ELIGIBLE mechanisms. They add
        // physics-derived scoring that the legacy evidence-key path cannot
        // provide because the legacy path only reads flags, not structured
        // physics state. Each boost reads the assetState that the catalog
        // evaluator already validated, so the physics basis is guaranteed
        // to be present.
        if (md.id === "sulfidation") {
          // Wire the McConomy helper for sulfidation rate scoring.
          var sulfRateResult = computeSulfidationRate(
            assetStateForCatalog.thermal.operating_temp_f,
            assetStateForCatalog.process_chemistry.sulfur_class,
            assetStateForCatalog.material.class
          );
          if (sulfRateResult.enabled && sulfRateResult.rate_mpy > 0) {
            // Scale bonus by severity band: low +0.05, moderate +0.10,
            // high +0.15, very_high +0.20
            if (sulfRateResult.severity_band === "very_high") { score += 0.20; evFor.push("McConomy rate " + sulfRateResult.rate_mpy + " mpy (very high severity)"); }
            else if (sulfRateResult.severity_band === "high") { score += 0.15; evFor.push("McConomy rate " + sulfRateResult.rate_mpy + " mpy (high severity)"); }
            else if (sulfRateResult.severity_band === "moderate") { score += 0.10; evFor.push("McConomy rate " + sulfRateResult.rate_mpy + " mpy (moderate severity)"); }
            else { score += 0.05; evFor.push("McConomy rate " + sulfRateResult.rate_mpy + " mpy (low severity)"); }
          }
        }
        if (md.id === "cscc") {
          // CSCC gets a boost from tensile stress presence (the catalog
          // checks material + chlorides + temperature, but stress is not
          // yet a catalog precondition -- it will be in DEPLOY173 when the
          // stress bucket activates). For now, read it from physics.
          if (assetStateForCatalog.stress.tensile) {
            score += 0.12;
            evFor.push("tensile stress present -- completes the CSCC triad (material + chlorides + stress)");
          }
          // Branching crack morphology is the classic CSCC signature
          if (hasWordNotNegated(lt, "branch") || hasWordNotNegated(lt, "branching") || hasWordNotNegated(lt, "transgranular")) {
            score += 0.10;
            evFor.push("branching/transgranular crack morphology -- classic CSCC signature");
          }
        }
        if (md.id === "mic") {
          // MIC boost for deadleg geometry (catalog checks flow_state
          // but deadleg is an independent strong indicator)
          if (assetStateForCatalog.flow_regime.deadleg === true) {
            score += 0.10;
            evFor.push("deadleg geometry -- classic MIC colonization site");
          }
          // Black slime / biofilm language
          if (hasWordNotNegated(lt, "slime") || hasWordNotNegated(lt, "biofilm") || hasWordNotNegated(lt, "black deposit") || hasWordNotNegated(lt, "black slime") || hasWordNotNegated(lt, "biological")) {
            score += 0.10;
            evFor.push("biofilm/slime language -- direct MIC indicator");
          }
        }
        if (md.id === "underdeposit_corrosion") {
          // NH4 salt-specific language boosts
          if (hasWordNotNegated(lt, "salt") || hasWordNotNegated(lt, "ammonium") || hasWordNotNegated(lt, "nh4") || hasWordNotNegated(lt, "ammoni")) {
            score += 0.10;
            evFor.push("ammonium salt language -- direct under-deposit indicator");
          }
          // Overhead / condensation zone context
          if (hasWord(lt, "overhead") || hasWord(lt, "fractionator") || hasWord(lt, "condenser") || hasWord(lt, "dew point") || hasWord(lt, "initial condensation")) {
            score += 0.08;
            evFor.push("overhead/condensation service context -- classic NH4 salt deposition zone");
          }
        }
      }
    }


    for (var ei = 0; ei < md.eKeys.length; ei++) {
      if (fl[md.eKeys[ei]]) { evFor.push(md.eKeys[ei].replace(/_/g, " ")); score += 0.2; obs = true; }
    }
    var words = md.name.toLowerCase().split(/[\s\/()]+/);
    for (var wi = 0; wi < words.length; wi++) { if (words[wi].length > 3 && hasWordNotNegated(lt, words[wi])) { score += 0.05; break; } }

    if (md.id === "fatigue_mechanical" || md.id === "fatigue_thermal" || md.id === "fatigue_vibration") {
      if (s.cyclic_loading) score += 0.10;
      if (s.stress_concentration_present) score += 0.08;
      if (s.cyclic_loading && s.stress_concentration_present) score += 0.07;
      var cyclicIsImpliedOnly = s.cyclic_source === "operational_pressure_cycling_implied";
      var stressConcIsImpliedOnly = true;
      for (var sci = 0; sci < s.stress_concentration_locations.length; sci++) {
        if (s.stress_concentration_locations[sci].indexOf("implied") === -1) { stressConcIsImpliedOnly = false; break; }
      }
      var hasExplicitFatigueEvidence = hasWord(lt, "fatigue") || hasWord(lt, "cyclic") || hasWord(lt, "vibrat") || hasWord(lt, "startup") || hasWord(lt, "shutdown") || hasWord(lt, "thermal cycl") || (!!fl.crack_confirmed) || hasWord(lt, "crack confirmed") || hasWord(lt, "cracking confirmed");
      if (cyclicIsImpliedOnly && stressConcIsImpliedOnly && !hasExplicitFatigueEvidence) {
        score -= 0.20;
      }
    }
    if (md.id === "general_corrosion" || md.id === "co2_corrosion" || md.id === "cui" || md.id === "erosion") {
      if (s.cyclic_loading && s.stress_concentration_present) {
        score -= 0.10;
      }
      if (!obs && !hasWord(lt, "corrosion") && !hasWord(lt, "thinning") && !hasWord(lt, "thinned") && !hasWord(lt, "wall loss") && !hasWord(lt, "metal loss") && !hasWord(lt, "eating") && !hasWord(lt, "washed out") && !hasWord(lt, "scale") && !hasWord(lt, "pitted") && !hasWord(lt, "corroded")) {
        score -= 0.05;
      }
    }
    if (md.id === "pitting") {
      if (hasWord(lt, "coating breakdown") || hasWord(lt, "coating damage") || hasWord(lt, "paint breakdown")) score += 0.05;
      if (hasWord(lt, "rust") || hasWord(lt, "stain")) score += 0.05;
    }

    var isCorrosionMech = md.id === "general_corrosion" || md.id === "pitting" || md.id === "co2_corrosion" || md.id === "cui" || md.id === "erosion" || md.id === "mic" || md.id === "sulfidation" || md.id === "underdeposit_corrosion";
    if (isCorrosionMech && wallLossReported) {
      score += 0.15;
      obs = true;
      evFor.push("wall loss reported in transcript");
      if (wallLossQuantified) {
        score += 0.10;
        evFor.push("wall loss quantified with percentage");
      }
      if (wallLossMeasuredByNDE) {
        score += 0.05;
        evFor.push("wall loss measured by NDE method");
      }
      if (s.cyclic_loading && s.stress_concentration_present) {
        score += 0.10;
      }
    }

    var isCrackMech = md.id.indexOf("fatigue") !== -1 || md.id.indexOf("scc") !== -1 || md.id.indexOf("ssc") !== -1 || md.id.indexOf("hic") !== -1;
    if (isCrackMech && crackingSuspectedOnly) {
      var isEnvCracking = md.id.indexOf("scc") !== -1 || md.id.indexOf("ssc") !== -1 || md.id.indexOf("hic") !== -1;
      if (isEnvCracking) {
        score -= 0.05;
        evAg.push("cracking suspected but not confirmed by crack-specific NDE method");
      } else {
        score -= 0.15;
        evAg.push("cracking suspected but not confirmed by crack-specific NDE method -- weak fatigue evidence");
      }
      if (wallLossMeasuredByNDE || wallLossQuantified) {
        score -= 0.05;
        evAg.push("measured wall loss is stronger observed evidence than suspected cracking");
      }
    }

    // DEPLOY117: ACTIVE NEGATION SUPPRESSION
    var crackNegated = hasWord(lt, "crack") && !hasWordNotNegated(lt, "crack");
    var corrosionNegated = (hasWord(lt, "corros") && !hasWordNotNegated(lt, "corros")) || (hasWord(lt, "rust") && !hasWordNotNegated(lt, "rust"));
    var deformNegated = (hasWord(lt, "deform") && !hasWordNotNegated(lt, "deform")) || (hasWord(lt, "dent") && !hasWordNotNegated(lt, "dent")) || (hasWord(lt, "buckl") && !hasWordNotNegated(lt, "buckl"));

    if (crackNegated && isCrackMech) {
      score -= 0.20;
      evAg.push("cracking explicitly ruled out or negated in transcript");
    }
    if (corrosionNegated && isCorrosionMech) {
      score -= 0.20;
      evAg.push("corrosion explicitly ruled out or negated in transcript");
    }
    if (deformNegated && md.id === "overload_buckling") {
      score -= 0.20;
      evAg.push("deformation explicitly ruled out or negated in transcript");
    }

    // DEPLOY122: EVIDENCE PROVENANCE TRUST WEIGHTING
    if (provenance && provenance.evidence && provenance.evidence.length > 0) {
      var mechKeywords = md.name.toLowerCase().split(/[\s\/()]+/);
      var relevantProvenance: any[] = [];
      for (var pei = 0; pei < provenance.evidence.length; pei++) {
        var pe = provenance.evidence[pei];
        var peClaimLower = (pe.claim || "").toLowerCase();
        for (var mki = 0; mki < mechKeywords.length; mki++) {
          if (mechKeywords[mki].length > 3 && peClaimLower.indexOf(mechKeywords[mki]) !== -1) {
            relevantProvenance.push(pe);
            break;
          }
        }
      }
      if (relevantProvenance.length > 0) {
        var avgProvenanceWeight = 0;
        for (var rpi = 0; rpi < relevantProvenance.length; rpi++) {
          avgProvenanceWeight += relevantProvenance[rpi].provenance_weight || 0.25;
        }
        avgProvenanceWeight = avgProvenanceWeight / relevantProvenance.length;
        var provenanceAdjust = (avgProvenanceWeight - 0.6) * 0.25;
        score += provenanceAdjust;
        if (provenanceAdjust > 0.01) {
          evFor.push("provenance: supporting evidence is " + relevantProvenance[0].provenance + " (trust weight " + roundN(avgProvenanceWeight, 2) + ")");
        } else if (provenanceAdjust < -0.01) {
          evAg.push("provenance: supporting evidence is " + relevantProvenance[0].provenance + " (trust weight " + roundN(avgProvenanceWeight, 2) + ") -- lower confidence");
        }
      }
    }

    if (score > 1) score = 1;
    if (score < 0) score = 0;
    var state = score >= 0.75 ? "confirmed" : score >= 0.55 ? "probable" : score >= 0.35 ? "possible" : "unverified";
    validated.push({ id: md.id, name: md.name, physics_basis: md.preLabels.join(" + "),
      preconditions_met: md.preLabels, reality_state: state, reality_score: roundN(score, 2),
      evidence_for: evFor, evidence_against: evAg, observation_basis: obs, severity: md.sev });
  }
  validated.sort(function(a, b) { if (b.reality_score !== a.reality_score) return b.reality_score - a.reality_score; if (a.observation_basis !== b.observation_basis) return a.observation_basis ? -1 : 1; return 0; });

  // MECHANISM UNCERTAINTY PRESERVATION -- DEPLOY106 PATCH 1
  if (physics.chemical.h2s_present) {
    var hydrogenUnresolved = false;
    for (var hci = 0; hci < validated.length; hci++) {
      var hcm = validated[hci];
      if ((hcm.id === "ssc_sulfide" || hcm.id === "hic") && hcm.reality_state !== "confirmed") {
        hydrogenUnresolved = true;
        break;
      }
    }
    if (hydrogenUnresolved) {
      for (var hcf = 0; hcf < validated.length; hcf++) {
        if (validated[hcf].id === "fatigue_mechanical" && validated[hcf].reality_state === "confirmed") {
          validated[hcf].reality_state = "probable";
          if (validated[hcf].reality_score > 0.74) { validated[hcf].reality_score = 0.74; }
          validated[hcf].evidence_against.push(
            "H2S present with unresolved SSC/HIC -- mechanism set not collapsed to single dominant until hydrogen susceptibility assessment complete"
          );
        }
      }
      validated.sort(function(a, b) { if (b.reality_score !== a.reality_score) return b.reality_score - a.reality_score; if (a.observation_basis !== b.observation_basis) return a.observation_basis ? -1 : 1; return 0; });
    }
  }

  // DEPLOY109 FIX 3: CREEP TIME-AT-TEMPERATURE QUALIFICATION
  if (physics.thermal.fire_exposure) {
    for (var cti = 0; cti < validated.length; cti++) {
      if (validated[cti].id === "creep") {
        if (physics.thermal.fire_duration_min !== null && physics.thermal.fire_duration_min < 60) {
          validated[cti].evidence_against.push(
            "Short fire duration (" + physics.thermal.fire_duration_min + " min) -- may cause strength reduction or microstructural change, but insufficient time-at-temperature for true creep strain accumulation. Classify as fire damage, not creep, unless temperature + duration data confirms otherwise."
          );
          if (validated[cti].reality_score > 0.55) validated[cti].reality_score = 0.55;
          if (validated[cti].reality_state === "confirmed" || validated[cti].reality_state === "probable") validated[cti].reality_state = "possible";
        } else if (physics.thermal.fire_duration_min === null) {
          validated[cti].evidence_against.push(
            "Fire exposure detected but duration unknown -- cannot distinguish (a) recoverable property reduction, (b) phase transformation, or (c) true creep accumulation without time-at-temperature data."
          );
        }
      }
    }
    validated.sort(function(a, b) { if (b.reality_score !== a.reality_score) return b.reality_score - a.reality_score; if (a.observation_basis !== b.observation_basis) return a.observation_basis ? -1 : 1; return 0; });
  }

  var primary = validated.length > 0 ? validated[0] : null;

  var avgS = 0; for (var vi = 0; vi < validated.length; vi++) avgS += validated[vi].reality_score;
  avgS = validated.length > 0 ? avgS / validated.length : 0.2;
  var dmgConf = Math.min(avgS + (validated.length > 0 ? 0.1 : 0), 1.0);
  if (dmgConf > physics.physics_confidence + 0.1) dmgConf = physics.physics_confidence + 0.1;

  var narr = "";
  if (primary) narr += "Primary: " + primary.name + " (score " + primary.reality_score + "). Physics: " + primary.physics_basis + ". ";
  narr += validated.length + " possible, " + rejected.length + " physically impossible.";

  return { validated: validated, rejected: rejected, indeterminate: indeterminate, primary: primary, damage_confidence: roundN(dmgConf, 2), physics_narrative: narr };
}

// ============================================================================
// STATE 3: CONSEQUENCE REALITY ENGINE
// ============================================================================
function resolveConsequenceReality(physics: any, damage: any, assetClass: string, transcript: string, flags: any) {
  var lt = transcript.toLowerCase();
  var fl = flags || {};
  var tier: string = "MEDIUM";
  var basis: string[] = [];
  var failMode = "equipment_degradation";
  var failPhysics = "";
  var humanImpact = "Low"; var envImpact = "Negligible"; var opImpact = "Operational disruption";
  var humanImpactSet = false; var envImpactSet = false; var opImpactSet = false;
  var requirements: string[] = [];

  var critKw = ["decompression chamber", "hyperbaric", "dive system", "diving bell", "life support", "human occupancy", "manned", "personnel basket", "escape capsule", "breathing air", "double lock", "saturation div", "recompression", "treatment chamber", "man-rated"];
  for (var ci = 0; ci < critKw.length; ci++) {
    if (hasWord(lt, critKw[ci])) { tier = "CRITICAL"; basis.push("PHYSICS: Human occupancy (" + critKw[ci] + ")"); humanImpact = "FATAL -- human occupancy during operation"; humanImpactSet = true; break; }
  }
  if (physics.energy.stored_energy_significant) {
    if (tier !== "CRITICAL") tier = "HIGH";
    basis.push("PHYSICS: Stored pressure energy -- release on failure");
    failMode = "pressure_boundary_failure";
  }
  if (physics.stress.load_path_criticality === "primary") {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("PHYSICS: Primary load-carrying member -- collapse risk");
  }
  if (physics.chemical.h2s_present || physics.chemical.caustic_present) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("PHYSICS: Toxic substance (" + physics.chemical.environment_agents.join(", ") + ")");
    humanImpact = "Serious injury/fatality from toxic release"; humanImpactSet = true;
    envImpact = "Environmental release"; envImpactSet = true;
  }
  if (physics.thermal.fire_exposure) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("PHYSICS: Fire exposure degrades material properties");
  }

  // DEPLOY109 FIX 1: CONSEQUENCE ESCALATION
  var structuralInstability = (!!fl.visible_deformation && !!fl.primary_member_involved) || !!fl.support_collapse_confirmed;
  if (structuralInstability && physics.energy.stored_energy_significant) {
    tier = "CRITICAL";
    basis.push("PHYSICS: Structural instability + stored pressure energy -- structural failure induces pressure boundary failure. Cannot be evaluated independently.");
    humanImpact = "FATAL -- structural collapse releases stored pressure energy"; humanImpactSet = true;
    failMode = "structural_pressure_cascade";
  }
  if (physics.thermal.fire_exposure && physics.energy.stored_energy_significant) {
    tier = "CRITICAL";
    basis.push("PHYSICS: Fire exposure + stored pressure energy -- fire degrades containment while pressure maintains load. Catastrophic release risk.");
    if (humanImpact.indexOf("FATAL") === -1) humanImpact = "FATAL -- fire-weakened pressure boundary under load"; humanImpactSet = true;
    failMode = "fire_pressure_cascade";
  }

  if (assetClass === "bridge" || assetClass === "rail_bridge") {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("PHYSICS: Public infrastructure -- civilian exposure");
    humanImpact = "Public fatality risk"; humanImpactSet = true;
  }
  if (hasWord(lt, "crude oil") || hasWord(lt, "petroleum") || hasWord(lt, "hazmat") || hasWord(lt, "flammable") || hasWord(lt, "toxic cargo") || hasWord(lt, "lng") || hasWord(lt, "lpg") || hasWord(lt, "ammonia") || hasWord(lt, "chlorine")) {
    tier = "CRITICAL";
    basis.push("CONSEQUENCE: Hazardous cargo -- release creates fatality/environmental catastrophe");
    humanImpact = "FATAL -- hazardous material release"; humanImpactSet = true;
    envImpact = "Major environmental contamination"; envImpactSet = true;
  }
  if (hasWord(lt, "fracture-critical") || hasWord(lt, "fracture critical")) {
    if (tier !== "CRITICAL") tier = "HIGH";
    basis.push("CONSEQUENCE: Fracture-critical member -- single-member failure = collapse");
    if (humanImpact === "Low") { humanImpact = "Fatality risk from structural collapse"; humanImpactSet = true; }
  }
  if ((hasWordBoundary(lt, "train") || hasWord(lt, "railroad") || hasWord(lt, "locomotive")) && (hasWord(lt, "loaded") || hasWordBoundary(lt, "car") || hasWord(lt, "freight"))) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("CONSEQUENCE: Loaded train -- derailment risk");
    if (humanImpact === "Low") { humanImpact = "Derailment fatality risk"; humanImpactSet = true; }
  }
  if (assetClass === "offshore_platform" || hasWord(lt, "offshore") || hasWord(lt, "platform") || hasWord(lt, "jacket structure")) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("CONSEQUENCE: Offshore platform -- personnel exposure, hydrocarbon systems, structural collapse risk");
    if (humanImpact === "Low") humanImpact = "Personnel fatality risk -- offshore structural failure";
    envImpact = "Hydrocarbon release / environmental contamination"; envImpactSet = true;
  }
  if (hasWord(lt, "hurricane") || hasWord(lt, "typhoon") || hasWord(lt, "cyclone") || hasWord(lt, "category") || (hasWord(lt, "storm") && (hasWord(lt, "major") || hasWord(lt, "severe")))) {
    if (tier !== "CRITICAL") tier = "HIGH";
    basis.push("CONSEQUENCE: Major storm/hurricane event -- structural integrity uncertain");
  }
  if ((hasWord(lt, "out of line") || hasWord(lt, "shifted") || hasWord(lt, "distort") || hasWord(lt, "buckl") || hasWord(lt, "different feel") || hasWord(lt, "alignment")) && (assetClass === "offshore_platform" || assetClass === "bridge" || assetClass === "rail_bridge")) {
    if (tier !== "CRITICAL") tier = "HIGH";
    basis.push("CONSEQUENCE: Visible deformation/shift indicators on structural asset -- load path may be compromised");
  }
  if (hasWord(lt, "production") && (hasWord(lt, "platform") || hasWord(lt, "offshore"))) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("CONSEQUENCE: Production platform -- hydrocarbon inventory");
  }
  if ((hasWord(lt, "underwater") || hasWord(lt, "subsea") || hasWord(lt, "below waterline") || hasWord(lt, "diver") || hasWord(lt, "splash zone") || hasWord(lt, "marine growth")) && (hasWord(lt, "unknown") || hasWord(lt, "hiding") || hasWord(lt, "uncertain") || hasWord(lt, "not sure"))) {
    if (tier !== "CRITICAL") tier = "HIGH";
    basis.push("CONSEQUENCE: Underwater/subsea condition uncertain -- critical zones uninspected");
  }

  // DEPLOY168 v2.5.3: HOT FLUID HUMAN IMPACT ROUTING
  var opTempF = physics.thermal.operating_temp_f;
  var hasStoredEnergy = physics.energy.stored_energy_significant;
  var primaryIsBoundaryThinning = damage.primary && (
    damage.primary.id.indexOf("corrosion") !== -1 ||
    damage.primary.id.indexOf("pitting") !== -1 ||
    damage.primary.id === "erosion" ||
    damage.primary.id === "cui" ||
    damage.primary.id === "co2_corrosion"
  );
  var flammableContext = hasWord(lt, "hydrocarbon") ||
    hasWord(lt, "crude") ||
    hasWord(lt, "naphtha") ||
    hasWord(lt, "diesel") ||
    hasWord(lt, "gasoline") ||
    hasWord(lt, "kerosene") ||
    hasWord(lt, "lpg") ||
    hasWord(lt, "propane") ||
    hasWord(lt, "butane") ||
    hasWord(lt, "ngl") ||
    hasWord(lt, "ethylene") ||
    hasWord(lt, "methane") ||
    hasWord(lt, "flammable") ||
    hasWord(lt, "combustible") ||
    hasWord(lt, "process fluid") ||
    (physics.chemical.environment_agents && physics.chemical.environment_agents.indexOf("naphthenic_acid") !== -1);

  if (opTempF !== null && opTempF >= 140 && hasStoredEnergy && primaryIsBoundaryThinning) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";

    if (opTempF >= 400 && flammableContext) {
      basis.push("PHYSICS: Hot hydrocarbon release at " + opTempF + "F with pressure boundary thinning mechanism -- thermal burn + flash fire/autoignition risk on release (fluid at or above hydrocarbon autoignition threshold)");
      if (humanImpact === "Low" || humanImpact === "Operational disruption") {
        humanImpact = "Serious injury/fatality from thermal burns + flash fire on release"; humanImpactSet = true;
      }
      if (envImpact === "Negligible") { envImpact = "Hydrocarbon release with fire risk"; envImpactSet = true; }
      if (failMode === "equipment_degradation") failMode = "hot_hydrocarbon_release";
    } else if (opTempF >= 400) {
      basis.push("PHYSICS: High-temperature fluid release at " + opTempF + "F with pressure boundary thinning mechanism -- severe thermal burn risk (fluid well above thermal injury threshold)");
      if (humanImpact === "Low" || humanImpact === "Operational disruption") {
        humanImpact = "Serious thermal burn injury from high-temperature release"; humanImpactSet = true;
      }
      if (failMode === "equipment_degradation") failMode = "hot_fluid_release";
    } else {
      basis.push("PHYSICS: Heated fluid release at " + opTempF + "F with pressure boundary thinning mechanism -- thermal burn/scald risk (above OSHA thermal contact threshold of 140F)");
      if (humanImpact === "Low" || humanImpact === "Operational disruption") {
        humanImpact = "Thermal burn injury from heated fluid release"; humanImpactSet = true;
      }
      if (failMode === "equipment_degradation") failMode = "heated_fluid_release";
    }
  }

  // ========================================================================
  // DEPLOY180: CONSEQUENCE REALITY FAIL-UPWARD GATE
  // When the consequence model cannot determine human/environmental/operational
  // impact from available evidence, the safe default is UNDETERMINED, not Low/
  // Negligible. On HIGH/CRITICAL assets, undetermined impact triggers explicit
  // escalation. The absence of evidence is NOT evidence of low consequence.
  // ========================================================================
  var consequenceUndetermined = false;
  var undeterminedImpacts: string[] = [];
  if (tier === "HIGH" || tier === "CRITICAL") {
    if (!humanImpactSet && humanImpact === "Low") {
      humanImpact = "UNDETERMINED -- insufficient evidence to classify human impact";
      undeterminedImpacts.push("human_impact");
      consequenceUndetermined = true;
    }
    if (!envImpactSet && envImpact === "Negligible") {
      envImpact = "UNDETERMINED -- insufficient evidence to classify environmental impact";
      undeterminedImpacts.push("environmental_impact");
      consequenceUndetermined = true;
    }
    if (!opImpactSet && opImpact === "Operational disruption") {
      opImpact = "UNDETERMINED -- insufficient evidence to classify operational impact";
      undeterminedImpacts.push("operational_impact");
      consequenceUndetermined = true;
    }
  }
  if (consequenceUndetermined) {
    basis.push("DEPLOY180: " + undeterminedImpacts.length + " impact dimension(s) UNDETERMINED on " + tier + " asset -- fail-upward applied");
  }

  if (basis.length === 0) basis.push("Standard asset -- default MEDIUM");

  var isRoutine = hasWord(lt, "routine") || hasWord(lt, "general condition") || hasWord(lt, "condition assessment") || hasWord(lt, "general inspection") || hasWord(lt, "periodic");
  var hasNoHistory = hasWord(lt, "no history") || hasWord(lt, "no damage") || hasWord(lt, "no previous") || hasWord(lt, "first inspection");
  var hasDamageEvidence = !!fl.crack_confirmed || !!fl.critical_wall_loss_confirmed || !!fl.leak_confirmed || !!fl.through_wall_leak_confirmed || !!fl.fire_property_degradation_confirmed || !!fl.support_collapse_confirmed;
  var hasAnyVisibleDamage = !!fl.visible_cracking || !!fl.visible_deformation || !!fl.dent_or_gouge_present || !!fl.leak_suspected;

  var degradationCertainty = "UNVERIFIED";
  if (hasDamageEvidence) { degradationCertainty = "CONFIRMED"; }
  else if (hasAnyVisibleDamage) { degradationCertainty = "SUSPECTED"; }
  else if (damage.primary && damage.primary.observation_basis) { degradationCertainty = "SUSPECTED"; }
  else if (damage.primary && damage.primary.reality_score >= 0.6) { degradationCertainty = "PROBABLE"; }
  else { degradationCertainty = "UNVERIFIED"; }

  if (isRoutine && degradationCertainty === "UNVERIFIED" && !hasDamageEvidence) {
    if (failMode === "equipment_degradation" || failMode === "pressure_boundary_failure") {
      failMode = "inspection_required";
    }
    if (humanImpact.indexOf("FATAL") !== -1) {
      humanImpact = "FATAL potential (life-safety asset) -- current degradation NOT confirmed"; humanImpactSet = true;
    }
    opImpact = "Routine inspection -- no immediate operational impact established"; opImpactSet = true;
  }

  var isStructuralAssetType = assetClass === "bridge" || assetClass === "rail_bridge" || assetClass === "bridge_steel" || assetClass === "bridge_concrete" || assetClass === "offshore_platform";

  if (damage.primary) {
    var pm = damage.primary.id;
    if (pm.indexOf("fatigue") !== -1) {
      if (isStructuralAssetType) {
        failPhysics = "Fatigue crack propagation at stress concentrations under cyclic loading (traffic, wind, operational). Crack grows incrementally per cycle until remaining section cannot sustain applied loads. Failure mode: member fracture, connection failure, or load path disruption.";
      } else {
        failPhysics = "Fatigue crack propagation per Paris Law. Cyclic stress drives incremental growth at stress concentrations. Critical crack size determined by fracture toughness vs applied stress. Failure mode: leak-before-break (ductile) or catastrophic burst (insufficient toughness).";
      }
    } else if (pm.indexOf("corrosion") !== -1 || pm.indexOf("pitting") !== -1 || pm === "co2_corrosion" || pm === "cui" || pm === "erosion") {
      if (isStructuralAssetType) {
        failPhysics = "Progressive section loss reduces load-carrying capacity. When remaining section falls below minimum for applied loads, failure occurs as local buckling, member instability, or connection failure. Section loss at critical locations (flange, web, connection) is more consequential than uniform loss.";
      } else {
        failPhysics = "Progressive wall thinning reduces load-bearing section. When remaining wall falls below minimum for hoop stress, failure occurs as plastic collapse or pinhole leak.";
      }
    } else if (pm.indexOf("scc") !== -1 || pm.indexOf("ssc") !== -1) {
      failPhysics = "Environmentally-assisted crack propagation under sustained tensile stress. Growth rate depends on stress intensity, environment, and material susceptibility. Failure can be sudden.";
    } else if (pm === "overload_buckling") {
      failPhysics = "Compressive overload exceeds stability limit or impact exceeds deformation capacity. Failure: buckling, permanent deformation, or fracture.";
    } else if (pm === "fire_damage") {
      failPhysics = "Elevated temperature degrades yield, tensile, and toughness. Post-fire properties may not recover. Phase changes possible above critical temps.";
    }
  }
  if (!failPhysics) failPhysics = "Damage progression reduces integrity below safe operating threshold.";

  if (physics.stress.cyclic_loading && physics.stress.stress_concentration_present && physics.energy.stored_energy_significant && !isStructuralAssetType) {
    var pmIsCorrosionType = damage.primary && (damage.primary.id.indexOf("corrosion") !== -1 || damage.primary.id.indexOf("pitting") !== -1 || damage.primary.id === "co2_corrosion" || damage.primary.id === "cui" || damage.primary.id === "erosion");
    if (!pmIsCorrosionType && (failPhysics.indexOf("wall thinning") !== -1 || failPhysics.indexOf("Damage progression") !== -1)) {
      failPhysics = "Cyclic pressure loading drives fatigue crack initiation at stress concentrations (weld toes, nozzles, geometric transitions). Crack propagates per Paris Law until critical size is reached. Failure mode: pressure boundary breach via crack-through (leak-before-break if ductile, catastrophic burst if insufficient toughness). Corrosion may accelerate initiation but crack propagation is the dominant failure path.";
      failMode = "crack_propagation_pressure_breach";
    }
  }

  if (tier === "CRITICAL") {
    requirements = ["Multi-method NDE (surface + volumetric)", "Zero uncertainty tolerance", "Full engineering review mandatory", "Human adjudication before return to service", "All evidence traceable"];
  } else if (tier === "HIGH") {
    requirements = ["Primary + supplemental method", "Engineering review recommended", "Code validation mandatory", "Evidence traceability for critical findings"];
  } else if (tier === "MEDIUM") {
    requirements = ["Primary method with adequate coverage", "Code reference recommended"];
  } else {
    requirements = ["Visual + primary method sufficient"];
  }

  var consConf = 0.7;
  if (basis.length > 1) consConf += 0.1;
  if (damage.primary && damage.primary.reality_score > 0.6) consConf += 0.1;
  if (consConf > 1) consConf = 1;

  var thresholdScore = 15;
  var thresholdReasons: string[] = [];
  if (physics.field_interaction && physics.field_interaction.interaction_score > 50) {
    thresholdScore += 18;
    thresholdReasons.push("Multiple damage forces are interacting and amplifying each other at this location.");
  }
  if (damage.primary && damage.primary.observation_basis) {
    thresholdScore += 15;
    thresholdReasons.push("Damage mechanism (" + damage.primary.name + ") is evidenced by direct observation -- this is not theoretical.");
  }
  if (damage.primary && (damage.primary.id.indexOf("fatigue") !== -1 || damage.primary.id.indexOf("scc") !== -1 || damage.primary.id.indexOf("ssc") !== -1)) {
    thresholdScore += 12;
    thresholdReasons.push("Active mechanism (" + damage.primary.name + ") has threshold behavior -- stable until critical size, then rapid failure.");
  }
  if (tier === "CRITICAL") { thresholdScore += 15; thresholdReasons.push("CRITICAL consequence means threshold crossing has catastrophic impact."); }
  else if (tier === "HIGH") { thresholdScore += 8; }
  if (physics.time.service_years && physics.time.service_years > 15) { thresholdScore += 8; thresholdReasons.push("Extended service life (" + physics.time.service_years + " years) increases accumulated damage."); }
  if (physics.time.time_since_inspection_years && physics.time.time_since_inspection_years > 3) { thresholdScore += 5; thresholdReasons.push("Gap since last inspection (" + physics.time.time_since_inspection_years + " years) means current state is less certain."); }
  if (thresholdScore > 100) thresholdScore = 100;

  if (degradationCertainty === "UNVERIFIED" && thresholdScore >= 55) {
    thresholdScore = 48;
    thresholdReasons.push("Threshold capped: no confirmed or suspected damage evidence supports APPROACHING_THRESHOLD state.");
  }
  if (degradationCertainty === "UNVERIFIED" && !hasDamageEvidence && !hasAnyVisibleDamage) {
    if (thresholdScore >= 40) {
      thresholdReasons.push("Note: damage state is based on physics potential, not confirmed observations. Inspection needed to verify actual condition.");
    }
  }

  var damageState = "STABLE";
  var damageTrajectory = "";
  var monitoringUrgency = "Routine";
  if (thresholdScore >= 75) {
    damageState = "TRANSITION_RISK";
    damageTrajectory = "Asset may be at or near a critical damage threshold. Damage progression could accelerate suddenly. Immediate characterization and engineering review required.";
    monitoringUrgency = "Immediate";
  } else if (thresholdScore >= 55) {
    damageState = "APPROACHING_THRESHOLD";
    damageTrajectory = "Damage indicators suggest the asset is moving toward a critical state. Accelerated inspection and monitoring recommended before the next operating cycle.";
    monitoringUrgency = "Within 7 days";
  } else if (thresholdScore >= 35) {
    damageState = "DEGRADING";
    damageTrajectory = "Active damage mechanism present with gradual progression. Standard monitoring intervals should be maintained or tightened.";
    monitoringUrgency = "Within 30 days";
  } else {
    damageTrajectory = "No significant threshold indicators. Damage state appears stable under current conditions.";
    monitoringUrgency = "Routine interval";
  }

  return {
    consequence_tier: tier, failure_mode: failMode, failure_physics: failPhysics,
    consequence_basis: basis, human_impact: humanImpact, environmental_impact: envImpact,
    operational_impact: opImpact, enforcement_requirements: requirements,
    degradation_certainty: degradationCertainty, is_routine_inspection: isRoutine,
    damage_state: damageState, damage_trajectory: damageTrajectory,
    threshold_score: thresholdScore, threshold_reasons: thresholdReasons,
    monitoring_urgency: monitoringUrgency,
    consequence_confidence: roundN(consConf, 2),
    consequence_undetermined: consequenceUndetermined,
    undetermined_impacts: undeterminedImpacts
  };
}

// ============================================================================
// DEPLOY182: NPS NOMINAL WALL INFERENCE (ASME B36.10M / B36.19M)
// ============================================================================
var NPS_WALL_TABLE: any = {
  "0.5_5": 1.65, "0.5_10": 1.65, "0.5_40": 2.11, "0.5_80": 3.73, "0.5_160": 4.75, "0.5_XXS": 7.47,
  "0.75_5": 1.65, "0.75_10": 1.65, "0.75_40": 2.31, "0.75_80": 3.91, "0.75_160": 5.56, "0.75_XXS": 7.82,
  "1_5": 1.65, "1_10": 1.65, "1_40": 2.77, "1_80": 3.91, "1_160": 6.35, "1_XXS": 8.74,
  "1.25_5": 1.65, "1.25_10": 1.65, "1.25_40": 2.77, "1.25_80": 4.32, "1.25_160": 6.35, "1.25_XXS": 8.74,
  "1.5_5": 1.65, "1.5_10": 2.11, "1.5_40": 2.77, "1.5_80": 4.32, "1.5_160": 7.14, "1.5_XXS": 8.74,
  "2_5": 1.65, "2_10": 2.11, "2_40": 3.91, "2_80": 5.54, "2_160": 8.74, "2_XXS": 11.07,
  "2.5_5": 2.11, "2.5_10": 3.05, "2.5_40": 5.16, "2.5_80": 7.01, "2.5_160": 9.53, "2.5_XXS": 14.02,
  "3_5": 2.11, "3_10": 3.05, "3_40": 5.49, "3_80": 7.62, "3_160": 11.13, "3_XXS": 15.24,
  "3.5_5": 2.11, "3.5_10": 3.05, "3.5_40": 5.74, "3.5_80": 8.08,
  "4_5": 2.11, "4_10": 3.05, "4_40": 6.02, "4_80": 8.56, "4_120": 11.13, "4_160": 13.49, "4_XXS": 17.12,
  "5_5": 2.77, "5_10": 3.40, "5_40": 6.55, "5_80": 9.53, "5_120": 12.70, "5_160": 15.88, "5_XXS": 19.05,
  "6_5": 2.77, "6_10": 3.40, "6_40": 7.11, "6_80": 10.97, "6_120": 14.27, "6_160": 18.26, "6_XXS": 21.95,
  "8_5": 2.77, "8_10": 3.76, "8_20": 6.35, "8_30": 7.04, "8_40": 8.18, "8_60": 10.31, "8_80": 12.70, "8_100": 15.09, "8_120": 18.26, "8_140": 20.62, "8_160": 23.01, "8_XXS": 22.23,
  "10_5": 3.40, "10_10": 4.19, "10_20": 6.35, "10_30": 7.80, "10_40": 9.27, "10_60": 12.70, "10_80": 15.09, "10_100": 18.26, "10_120": 21.44, "10_140": 25.40, "10_160": 28.58,
  "12_5": 3.96, "12_10": 4.57, "12_20": 6.35, "12_30": 8.38, "12_40": 10.31, "12_60": 14.27, "12_80": 17.48, "12_100": 21.44, "12_120": 25.40, "12_140": 28.58, "12_160": 33.32,
  "14_5": 3.96, "14_10": 6.35, "14_20": 7.92, "14_30": 9.53, "14_40": 11.13, "14_60": 15.09, "14_80": 19.05, "14_100": 23.83, "14_120": 27.79, "14_140": 31.75, "14_160": 35.71,
  "16_5": 4.19, "16_10": 6.35, "16_20": 7.92, "16_30": 9.53, "16_40": 12.70, "16_60": 16.66, "16_80": 21.44, "16_100": 26.19, "16_120": 30.96, "16_140": 36.53, "16_160": 40.49,
  "18_5": 4.19, "18_10": 6.35, "18_20": 7.92, "18_30": 11.13, "18_40": 14.27, "18_60": 19.05, "18_80": 23.83, "18_100": 29.36, "18_120": 34.93, "18_140": 39.67, "18_160": 45.24,
  "20_5": 4.78, "20_10": 6.35, "20_20": 9.53, "20_30": 12.70, "20_40": 15.09, "20_60": 20.62, "20_80": 26.19, "20_100": 32.54, "20_120": 38.10, "20_140": 44.45, "20_160": 50.01,
  "24_5": 5.54, "24_10": 6.35, "24_20": 9.53, "24_30": 14.27, "24_40": 17.48, "24_60": 24.61, "24_80": 30.96, "24_100": 38.89, "24_120": 46.02, "24_140": 52.37, "24_160": 59.54,
  "30_5": 6.35, "30_10": 7.92, "30_20": 12.70, "30_30": 15.88, "30_40": 19.05,
  "36_5": 6.35, "36_10": 9.53, "36_20": 12.70, "36_30": 15.88, "36_40": 19.05
};

var NPS_OD_TABLE: any = {
  "0.5": 21.3, "0.75": 26.7, "1": 33.4, "1.25": 42.2, "1.5": 48.3,
  "2": 60.3, "2.5": 73.0, "3": 88.9, "3.5": 101.6, "4": 114.3,
  "5": 141.3, "6": 168.3, "8": 219.1, "10": 273.1, "12": 323.9,
  "14": 355.6, "16": 406.4, "18": 457.2, "20": 508.0, "24": 609.6,
  "30": 762.0, "36": 914.4
};

function inferNominalWall(transcript: string, numVals: any) {
  var result: any = {
    nps_inch: null, schedule: null, nominal_wall_mm: null,
    outside_diameter_mm: null, wall_source: "NONE", inference_confidence: 0
  };
  if (numVals && (numVals.wall_thickness_mm || numVals.current_thickness_mm)) {
    result.wall_source = "MEASURED";
    result.inference_confidence = 1.0;
    result.nominal_wall_mm = numVals.wall_thickness_mm || numVals.current_thickness_mm;
    return result;
  }
  if (typeof transcript !== "string" || transcript.length === 0) return result;
  var lt = transcript.toLowerCase();
  var npsVal: number | null = null;
  var npsPatterns = [
    /nps\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*[\-]?\s*inch\s+(?:nominal|nom|nps|pipe)/i,
    /(\d+(?:\.\d+)?)\s*"\s*(?:nominal|nom|nps|pipe)/i,
    /(\d+(?:\.\d+)?)\s*inch\s+(?:line|pipe|piping|header)/i,
    /nominal\s+(?:pipe\s+)?size\s+(\d+(?:\.\d+)?)/i
  ];
  for (var pi = 0; pi < npsPatterns.length; pi++) {
    var npsMatch = npsPatterns[pi].exec(lt);
    if (npsMatch && npsMatch[1]) {
      var candidate = parseFloat(npsMatch[1]);
      if (candidate >= 0.5 && candidate <= 36) { npsVal = candidate; break; }
    }
  }
  if (npsVal === null) return result;
  var schVal: string | null = null;
  var schPatterns = [
    /schedule\s+(\d+|xxs|xs)/i,
    /sch\s*\.?\s*(\d+|xxs|xs)/i
  ];
  for (var si = 0; si < schPatterns.length; si++) {
    var schMatch = schPatterns[si].exec(lt);
    if (schMatch && schMatch[1]) {
      var raw = schMatch[1].toUpperCase();
      if (raw === "XS") raw = "80";
      if (raw === "STD" || raw === "STANDARD") raw = "40";
      schVal = raw;
      break;
    }
  }
  if (schVal === null) schVal = "40";
  var npsStr = String(npsVal);
  var key = npsStr + "_" + schVal;
  var wallMm = NPS_WALL_TABLE[key] || null;
  var odMm = NPS_OD_TABLE[npsStr] || null;
  if (wallMm === null) {
    var fallbackKey = npsStr + "_40";
    wallMm = NPS_WALL_TABLE[fallbackKey] || null;
    if (wallMm !== null) schVal = "40";
  }
  result.nps_inch = npsVal;
  result.schedule = schVal;
  result.nominal_wall_mm = wallMm;
  result.outside_diameter_mm = odMm;
  result.wall_source = wallMm !== null ? "INFERRED" : "NONE";
  result.inference_confidence = wallMm !== null ? 0.75 : 0;
  return result;
}

// ============================================================================
// PHYSICS COMPUTATIONS
// ============================================================================
function runPhysicsComputations(physics: any, numVals: any, assetClass: string, consequence: any) {
  var nv = numVals || {};
  var wallT = nv.wall_thickness_mm || null;
  var wallSource = wallT ? "MEASURED" : "NONE";
  // DEPLOY182: NPS inference fallback for wall thickness and OD
  var npsInference = nv._nps_inference || null;
  if (!wallT && npsInference && npsInference.nominal_wall_mm) {
    wallT = npsInference.nominal_wall_mm;
    wallSource = "INFERRED";
  }
  var flawD = nv.flaw_depth_mm || nv.crack_depth_mm || null;
  var pressMpa = nv.operating_pressure_mpa || (nv.operating_pressure_psi ? nv.operating_pressure_psi * 0.00689476 : null);
  var radiusMm = nv.inside_radius_mm || (nv.inside_diameter_mm ? nv.inside_diameter_mm / 2 : null) || (nv.outside_diameter_mm && wallT ? (nv.outside_diameter_mm - 2 * wallT) / 2 : null);
  // DEPLOY182: NPS OD fallback for radius
  if (!radiusMm && npsInference && npsInference.outside_diameter_mm && wallT) {
    radiusMm = (npsInference.outside_diameter_mm - 2 * wallT) / 2;
  }
  var cyclesPerDay = nv.cycles_per_day || null;
  var corrRate = nv.corrosion_rate_mm_per_year || null;
  var tMin = nv.minimum_thickness_mm || null;
  var currentT = nv.current_thickness_mm || wallT;

  var hoopMpa: number | null = null;
  if (pressMpa && radiusMm && wallT && wallT > 0) hoopMpa = pressMpa * (radiusMm / wallT);

  var parisC = nv.paris_c || 3e-13;
  var parisM = nv.paris_m || 3.1;
  var kic = nv.fracture_toughness || 120;
  var yieldMpa = nv.yield_strength_mpa || 250;
  var Y = nv.crack_shape_factor || 1.12;

  var fatigue: FatigueResult = { enabled: false, delta_k: null, growth_per_cycle_m: null, days_to_critical: null, status: "insufficient_input", narrative: "Fatigue computation requires flaw depth and stress data." };
  if (flawD && hoopMpa) {
    var aM = flawD / 1000;
    var deltaSigma = hoopMpa * 0.8;
    var deltaK = Y * deltaSigma * Math.sqrt(Math.PI * aM);
    if (deltaK < 5) {
      fatigue = { enabled: true, delta_k: roundN(deltaK, 2), growth_per_cycle_m: null, days_to_critical: null, status: "below_threshold", narrative: "Stress intensity range below practical propagation threshold." };
    } else {
      var envFactor = 1.0;
      if (physics.chemical.sour_service) envFactor *= 1.35;
      if (physics.chemical.chlorides_present) envFactor *= 1.2;
      if (physics.thermal.thermal_cycling) envFactor *= 1.15;
      var daPerCycle = parisC * Math.pow(deltaK, parisM) * envFactor;
      var daysToC: number | null = null;
      var aCritM = Math.pow(kic / (Y * (hoopMpa || 1)), 2) / Math.PI;
      var aCritMm = Math.min(aCritM * 1000, (wallT || 25) * 0.8);
      if (aCritMm > flawD && daPerCycle > 0) {
        var deltaAm = (aCritMm - flawD) / 1000;
        var cyclesToCrit = deltaAm / daPerCycle;
        if (cyclesPerDay && cyclesPerDay > 0) daysToC = roundN(cyclesToCrit / cyclesPerDay, 1);
      }
      fatigue = { enabled: true, delta_k: roundN(deltaK, 2), growth_per_cycle_m: daPerCycle, days_to_critical: daysToC,
        status: "active", narrative: daysToC !== null ? "Fatigue growth active. Estimated " + daysToC + " days to critical depth at current cycling." : "Fatigue growth active. Time-to-critical requires cycle rate data." };
    }
  }

  var critFlaw: CriticalFlawResult = { enabled: false, critical_depth_mm: null, stress_ratio: null, status: "insufficient_input", narrative: "Critical flaw computation requires stress and toughness data." };
  if (hoopMpa && kic && wallT) {
    var acM = Math.pow(kic / (Y * hoopMpa), 2) / Math.PI;
    var acMm = Math.min(acM * 1000, wallT * 0.8);
    var stressRatio = flawD ? roundN(flawD / acMm, 3) : null;
    critFlaw = { enabled: true, critical_depth_mm: roundN(acMm, 2), stress_ratio: stressRatio,
      status: "bounded", narrative: "Critical flaw depth estimated at " + roundN(acMm, 2) + "mm." + (stressRatio !== null ? " Current flaw is at " + roundN(stressRatio * 100, 1) + "% of critical." : "") };
  }

  var wallLoss: WallLossResult = { enabled: false, remaining_life_years: null, severity_ratio: null, status: "insufficient_input", narrative: "Wall loss computation requires thickness, minimum, and corrosion rate." };
  if (currentT && tMin && corrRate && corrRate > 0) {
    var yearsToTmin = (currentT - tMin) / corrRate;
    var sevRatio = 1 - ((currentT - tMin) / Math.max(currentT, 0.001));
    wallLoss = { enabled: true, remaining_life_years: roundN(yearsToTmin, 2), severity_ratio: roundN(sevRatio, 3),
      status: yearsToTmin <= 0 ? "critical" : "active",
      narrative: yearsToTmin <= 0 ? "Current thickness at or below minimum. Immediate action required." : "Estimated " + roundN(yearsToTmin, 2) + " years remaining to minimum thickness." };
  }

  var leakBurst: LeakBurstResult = { enabled: false, tendency: "INSUFFICIENT_INPUT", through_wall_risk: null, fracture_risk: null, narrative: "Leak-vs-burst requires flaw depth, wall thickness, and toughness." };
  if (flawD && wallT && hoopMpa && kic) {
    var twRisk = clamp(flawD / wallT, 0, 1);
    var pressSevRatio = clamp(hoopMpa / yieldMpa, 0, 1);
    var toughPenalty = kic < 60 ? 0.25 : kic < 100 ? 0.12 : 0.04;
    var fracRisk = clamp(0.45 * twRisk + 0.35 * pressSevRatio + toughPenalty, 0, 1);
    var tend = "LEAK_BEFORE_BREAK";
    if (pressSevRatio > 0.95) tend = "PLASTIC_COLLAPSE";
    else if (fracRisk > 0.75) tend = "BURST_FAVORED";
    else if (fracRisk > 0.6) tend = "UNSTABLE_FRACTURE";
    leakBurst = { enabled: true, tendency: tend, through_wall_risk: roundN(twRisk, 3), fracture_risk: roundN(fracRisk, 3),
      narrative: tend === "BURST_FAVORED" ? "Inputs favor catastrophic burst over benign leak. Escalation and volumetric characterization strongly indicated." :
        tend === "PLASTIC_COLLAPSE" ? "Stress approaches material capacity -- plastic collapse risk." :
        tend === "UNSTABLE_FRACTURE" ? "Elevated fracture instability risk. Treat as escalation-level." :
        "Leak-before-break tendency favored, but does not reduce inspection rigor." };
  }

  var dataQuality: any = {
    wall_source: wallSource,
    wall_thickness_used_mm: wallT,
    nps_inference_applied: (wallSource === "INFERRED"),
    confidence_note: wallSource === "MEASURED" ? "Wall thickness from direct measurement" : wallSource === "INFERRED" ? "Wall thickness inferred from NPS/schedule lookup (ASME B36.10M). Treat computed RSR/hoop as preliminary." : "No wall thickness available"
  };
  return { fatigue: fatigue, critical_flaw: critFlaw, wall_loss: wallLoss, leak_vs_burst: leakBurst, data_quality: dataQuality };
}


// ============================================================================
// STATE 4: AUTHORITY REALITY ENGINE
// ============================================================================
var AUTHORITY_MAP = [
  { kw: ["decompression chamber", "hyperbaric", "dive system", "diving bell", "human occupancy", "pvho", "double lock", "saturation div", "recompression", "treatment chamber", "man-rated"],
    ac: ["pressure_vessel"], pri: "ASME PVHO-1",
    sec: ["ASME FFS-1 / API 579 (crack fitness-for-service)", "ASME Section VIII (construction basis)", "API 510 (inspection)", "ASME Section V (NDE procedures)"],
    cond: [{ code: "ADCI Standards", cond: "diving ops" }, { code: "IMCA D 024", cond: "international diving" }, { code: "Owner/operator qualification + manufacturer repair requirements", cond: "repair or modification" }],
    dw: "DESIGN: PRESSURIZED SYSTEM -- current state may not represent design intent" },
  { kw: ["boiler", "steam drum", "superheater"], ac: ["pressure_vessel"],
    pri: "ASME Section I", sec: ["NB-23", "API 510"], cond: [], dw: null },
  { kw: ["pressure vessel", "separator", "column", "reactor vessel", "heat exchanger", "accumulator"],
    ac: ["pressure_vessel", "heat_exchanger"], pri: "API 510 + ASME Section VIII",
    sec: ["ASME Section V", "API 579-1"], cond: [{ code: "ASME PCC-2", cond: "repair" }], dw: null },
  { kw: ["piping", "pipe rack", "process piping", "header"],
    ac: ["piping"], pri: "API 570 + ASME B31.3", sec: ["ASME Section V", "API 579-1"],
    cond: [{ code: "ASME B31.1", cond: "power piping" }], dw: null },
  { kw: ["storage tank", "atmospheric tank"], ac: ["storage_tank", "tank"],
    pri: "API 653", sec: ["API 650", "API 579-1"], cond: [], dw: null },
  { kw: ["pipeline", "export corridor", "trunkline", "flowline", "riser"],
    ac: ["pipeline"], pri: "ASME B31.4/B31.8 + 49 CFR 192/195", sec: ["API 1160", "ASME B31G"],
    cond: [{ code: "DNV-ST-F101", cond: "submarine pipeline" }], dw: null },
  { kw: ["bridge", "overpass", "girder", "pier", "abutment", "railroad bridge", "rail bridge", "truss bridge", "through-truss"],
    ac: ["bridge", "rail_bridge"], pri: "AASHTO MBE + AWS D1.5", sec: ["AASHTO LRFD", "FHWA NBIS"], cond: [], dw: null },
  { kw: ["offshore", "platform", "jacket", "subsea", "fpso", "topside"],
    ac: ["offshore_platform"], pri: "API RP 2A", sec: ["API 579-1", "NACE SP0176"],
    cond: [{ code: "DNV-OS-C101", cond: "classification" }, { code: "BSEE", cond: "US federal waters" }], dw: null },
  { kw: ["rail", "railcar", "track", "thermite weld"],
    ac: ["rail"], pri: "AREMA Manual", sec: ["AAR Field Manual", "49 CFR 213"], cond: [], dw: null }
];

function resolveAuthorityReality(assetClass: string, transcript: string, consequence: any, physics: any) {
  var lt = transcript.toLowerCase();
  var matched: any = null;

  var keywordClassMatch: any = null;
  var genericClassMatch: any = null;

  for (var ai = 0; ai < AUTHORITY_MAP.length; ai++) {
    var entry = AUTHORITY_MAP[ai];
    var classMatches = false;
    for (var asi = 0; asi < entry.ac.length; asi++) {
      if (assetClass === entry.ac[asi]) { classMatches = true; break; }
    }
    if (classMatches) {
      var kwMatches = false;
      for (var ki = 0; ki < entry.kw.length; ki++) {
        if (hasWord(lt, entry.kw[ki])) { kwMatches = true; break; }
      }
      if (kwMatches && !keywordClassMatch) {
        keywordClassMatch = entry;
      }
      genericClassMatch = entry;
    }
  }

  matched = keywordClassMatch || genericClassMatch;

  if (!matched) {
    for (var ri = 0; ri < AUTHORITY_MAP.length; ri++) {
      var r = AUTHORITY_MAP[ri];
      for (var ki2 = 0; ki2 < r.kw.length; ki2++) { if (hasWord(lt, r.kw[ki2])) { matched = r; break; } }
      if (matched) break;
    }
  }
  if (!matched) {
    return { primary_authority: "UNRESOLVED", secondary_authorities: [], conditional_authorities: [],
      physics_code_alignment: "No authority matched -- engineering review required",
      code_gaps: ["No authority rule matched"], design_state_warning: null, authority_confidence: 0.3 };
  }
  var gaps: string[] = [];
  var alignment = "CONSISTENT -- " + matched.pri + " provides framework for " + assetClass;

  var hasCrackIndication = hasWordNotNegated(lt, "crack") || hasWordNotNegated(lt, "indication") || hasWordNotNegated(lt, "flaw") || hasWordNotNegated(lt, "linear");
  if (consequence.consequence_tier === "CRITICAL" && matched.pri.indexOf("PVHO") !== -1) {
    if (hasCrackIndication) {
      alignment = "DUAL AUTHORITY REQUIRED: PVHO-1 governs occupancy/pressure boundary requirements. ASME FFS-1 / API 579 governs crack fitness-for-service evaluation. Both required for in-service crack disposition -- PVHO-1 alone does not provide a crack acceptance basis.";
    } else {
      alignment = "CONSISTENT -- PVHO-1 requires multi-method NDE for pressure boundary welds, aligning with physics requirement for CRITICAL consequence";
    }
  }

  if ((physics.stress.cyclic_loading || physics.chemical.corrosive_environment) && consequence.consequence_tier !== "LOW") {
    var hasFFS = false;
    for (var si = 0; si < matched.sec.length; si++) {
      if (matched.sec[si].indexOf("579") !== -1 || matched.sec[si].indexOf("FFS") !== -1) { hasFFS = true; }
    }
    if (!hasFFS) {
      gaps.push("Fitness-for-service assessment (ASME FFS-1 / API 579) recommended but not in authority chain");
    }
  }
  if (matched.pri.indexOf("PVHO") !== -1 && hasCrackIndication) {
    gaps.push(
      "Authority layering required: PVHO-1 (occupancy/construction standard) + ASME FFS-1 (crack evaluation basis) + NDE procedure basis + owner/operator requirements. Single-code resolution is insufficient for in-service crack disposition on a PVHO."
    );
  }

  var conf = 0.85 - gaps.length * 0.1;
  if (conf < 0.3) conf = 0.3;
  return { primary_authority: matched.pri, secondary_authorities: matched.sec,
    conditional_authorities: matched.cond, physics_code_alignment: alignment,
    code_gaps: gaps, design_state_warning: matched.dw, authority_confidence: roundN(conf, 2) };
}

// ============================================================================
// STATE 5: PHYSICS SUFFICIENCY ENGINE
// ============================================================================
var METHOD_BASELINES: any = {
  UT:   { surfSens: 35, subSens: 88, planar: 82, volumetric: 65, sizing: 70, singleSide: 85, coatTol: 35, roughTol: 45, magnetic: false, couplant: true,  prin: "Acoustic impedance mismatch (wave mechanics)", det: "Internal flaws, wall thickness, crack depth", cant: "Coarse-grain scatter, near-surface dead zone" },
  PAUT: { surfSens: 40, subSens: 92, planar: 90, volumetric: 72, sizing: 82, singleSide: 88, coatTol: 30, roughTol: 45, magnetic: false, couplant: true,  prin: "Multi-element acoustic beam steering", det: "Complex geometry flaws, crack sizing, volumetric scanning", cant: "Requires setup discipline, coupling stability" },
  TOFD: { surfSens: 20, subSens: 95, planar: 93, volumetric: 38, sizing: 90, singleSide: 30, coatTol: 25, roughTol: 40, magnetic: false, couplant: true,  prin: "Diffracted wave timing", det: "Crack height/depth sizing with high accuracy", cant: "Surface/near-surface dead zone, thin sections" },
  MT:   { surfSens: 94, subSens: 55, planar: 88, volumetric: 10, sizing: 20, singleSide: 90, coatTol: 35, roughTol: 60, magnetic: true,  couplant: false, prin: "Magnetic flux leakage (Maxwell equations)", det: "Surface + near-surface in ferromagnetic materials", cant: "Subsurface >6mm, non-ferromagnetic, no depth sizing" },
  PT:   { surfSens: 96, subSens: 0,  planar: 85, volumetric: 0,  sizing: 18, singleSide: 94, coatTol: 5,  roughTol: 35, magnetic: false, couplant: false, prin: "Capillary action + fluorescence/contrast", det: "Surface-breaking discontinuities only", cant: "Subsurface, porous surfaces, coated surfaces, no sizing" },
  ET:   { surfSens: 86, subSens: 52, planar: 75, volumetric: 12, sizing: 42, singleSide: 95, coatTol: 62, roughTol: 40, magnetic: false, couplant: false, prin: "Electromagnetic induction (eddy currents)", det: "Surface/near-surface cracks, conductivity changes, coating thickness", cant: "Deep subsurface, ferromagnetic interference, lift-off sensitivity" },
  RT:   { surfSens: 30, subSens: 75, planar: 35, volumetric: 90, sizing: 45, singleSide: 15, coatTol: 50, roughTol: 70, magnetic: false, couplant: false, prin: "Differential radiation absorption (Beer-Lambert law)", det: "Volumetric flaws (porosity, inclusions, voids)", cant: "Tight planar cracks parallel to beam, requires backside access" }
};
var ALL_METHODS = ["UT", "PAUT", "TOFD", "MT", "PT", "ET", "RT"];

function scoreMethodPhysics(method: string, damage: any, physics: any, consequence: any, transcript: string, flags: any) {
  var bl = METHOD_BASELINES[method];
  if (!bl) return null;
  var fl = flags || {};
  var lt = transcript.toLowerCase();
  var pm = damage.primary;
  var pmId = pm ? pm.id : "";
  var reasonsFor: string[] = [];
  var reasonsAgainst: string[] = [];
  var blindSpots: string[] = [];
  var complementary: string[] = [];

  var detectScore = 50;
  var isCrackType = pmId.indexOf("fatigue") !== -1 || pmId.indexOf("crack") !== -1 || pmId.indexOf("scc") !== -1 || pmId.indexOf("ssc") !== -1 || pmId.indexOf("hic") !== -1;
  var isCorrosionType = pmId.indexOf("corrosion") !== -1 || pmId.indexOf("pitting") !== -1 || pmId.indexOf("erosion") !== -1 || pmId.indexOf("cui") !== -1 || pmId.indexOf("wall_loss") !== -1;
  var isDeformation = pmId.indexOf("overload") !== -1 || pmId.indexOf("buckl") !== -1;
  var isFire = pmId.indexOf("fire") !== -1;

  if (isCrackType) {
    detectScore = (bl.planar * 0.6 + bl.subSens * 0.4);
    reasonsFor.push("Scored against planar discontinuity detection capability");
    if (bl.subSens < 30) { reasonsAgainst.push("Method cannot detect subsurface crack propagation"); blindSpots.push("Subsurface crack growth invisible to this method"); }
    if (bl.sizing < 40) { reasonsAgainst.push("Method cannot size crack depth -- only length"); blindSpots.push("Crack depth unknown -- remaining life calculation impossible"); }
  } else if (isCorrosionType) {
    detectScore = (bl.subSens * 0.5 + bl.volumetric * 0.3 + bl.surfSens * 0.2);
    reasonsFor.push("Scored against wall loss / corrosion mapping capability");
    if (bl.volumetric < 20 && bl.subSens < 30) { reasonsAgainst.push("Method cannot quantify wall thickness loss"); blindSpots.push("Remaining wall thickness unknown"); }
  } else if (isDeformation) {
    detectScore = bl.surfSens * 0.8 + 10;
    reasonsFor.push("Deformation is primarily surface-observable");
  } else if (isFire) {
    detectScore = bl.surfSens * 0.4 + bl.subSens * 0.3 + 15;
    reasonsFor.push("Fire damage assessment requires surface + property evaluation");
  } else {
    detectScore = (bl.surfSens + bl.subSens) / 2;
  }

  var sizingScore = bl.sizing;
  if (isCrackType && method === "TOFD") { sizingScore += 8; reasonsFor.push("TOFD excels at crack depth sizing via diffraction timing"); }
  if (isCrackType && method === "PAUT") { sizingScore += 6; reasonsFor.push("PAUT provides crack sizing via beam steering"); }
  if (isCrackType && (method === "MT" || method === "PT")) { sizingScore -= 15; reasonsAgainst.push("Surface methods provide crack length only -- depth requires volumetric"); }
  if (isCorrosionType && (method === "UT" || method === "PAUT")) { sizingScore += 10; reasonsFor.push("UT/PAUT measures remaining wall thickness directly"); }

  var matScore = 75;
  if (method === "MT" && !hasWord(lt, "carbon steel") && !hasWord(lt, "ferritic") && !hasWord(lt, "low alloy")) {
    if (hasWord(lt, "stainless") || hasWord(lt, "austenitic") || hasWord(lt, "duplex") || hasWord(lt, "aluminum") || hasWord(lt, "titanium") || hasWord(lt, "nickel")) {
      matScore = 0; reasonsAgainst.push("MT PHYSICS GATE: Material is non-ferromagnetic -- magnetic flux leakage cannot occur"); blindSpots.push("Method completely invalid for this material");
    } else {
      matScore = 80; reasonsFor.push("Material assumed ferromagnetic (carbon steel default)");
    }
  }
  if (method === "ET" && hasWord(lt, "carbon steel")) { matScore -= 10; reasonsAgainst.push("Carbon steel ferromagnetic response can interfere with ET"); }
  if ((method === "UT" || method === "PAUT" || method === "TOFD") && (hasWord(lt, "cast") || hasWord(lt, "casting"))) {
    matScore -= 25; reasonsAgainst.push("Cast material grain structure may attenuate/scatter ultrasonic energy");
  }
  if (method === "PT") { matScore = 88; reasonsFor.push("PT is material-agnostic if surface is open and clean"); }

  var geoScore = 75;
  if (method === "TOFD" && hasWord(lt, "fillet")) { geoScore -= 30; reasonsAgainst.push("TOFD geometry problematic for fillet welds"); }
  if ((method === "UT" || method === "PAUT") && hasWord(lt, "butt") || hasWord(lt, "circumferential")) { geoScore += 8; reasonsFor.push("Butt/circumferential weld geometry suits ultrasonic scanning"); }
  if (method === "TOFD" && hasWord(lt, "nozzle")) { geoScore -= 20; reasonsAgainst.push("Nozzle geometry restricts TOFD probe arrangement"); }
  if ((method === "MT" || method === "PT") && hasWord(lt, "complex")) { geoScore -= 8; }

  var orientScore = 70;
  if (isCrackType) {
    if (method === "UT" || method === "PAUT") {
      if (hasWord(lt, "circumferential")) { orientScore = 85; reasonsFor.push("UT/PAUT beam can be oriented perpendicular to circumferential cracks"); }
      else { orientScore = 75; }
    }
    if (method === "TOFD") { orientScore = 82; reasonsFor.push("TOFD detects diffracted energy regardless of reflector orientation"); }
    if (method === "MT" || method === "PT") { orientScore = 80; reasonsFor.push("Surface methods detect surface-breaking cracks regardless of orientation"); }
  }
  if (isCorrosionType && method === "TOFD") { orientScore = 40; reasonsAgainst.push("TOFD is not a corrosion mapping method"); }

  var surfScore = 78;
  if (hasWord(lt, "coated") || hasWord(lt, "painted") || hasWord(lt, "coating")) {
    if (method === "PT") { surfScore = 0; reasonsAgainst.push("PT requires bare surface -- coating blocks capillary access"); blindSpots.push("Coating prevents penetrant application"); }
    if (method === "MT") { surfScore -= 25; reasonsAgainst.push("Coating reduces MT sensitivity -- flux leakage attenuated"); }
    if (method === "ET") { surfScore -= 10; }
  }
  if (hasWord(lt, "rough") || hasWord(lt, "corroded surface") || hasWord(lt, "scale")) {
    if (method === "PT") { surfScore -= 35; reasonsAgainst.push("Rough/contaminated surface reduces penetrant reliability"); }
    if (method === "UT" || method === "PAUT" || method === "TOFD") { surfScore -= 15; reasonsAgainst.push("Poor surface degrades ultrasonic coupling"); }
  }
  if (fl.underwater_access_limited) {
    if (method === "PT") { surfScore = 0; reasonsAgainst.push("PT not feasible underwater"); blindSpots.push("Underwater environment prevents penetrant testing"); }
    if (method === "MT") { surfScore -= 15; }
    if (method === "UT" || method === "PAUT") { surfScore -= 8; reasonsFor.push("UT feasible underwater with proper procedure"); }
  }

  var accessScore = 75;
  if (method === "TOFD") { accessScore -= 20; reasonsAgainst.push("TOFD requires dual-side or wrap-around access for probe pair"); }
  if (method === "RT") { accessScore -= 25; reasonsAgainst.push("RT requires backside access for film/detector placement"); }
  if (method === "PAUT") { accessScore += 5; reasonsFor.push("PAUT beam steering compensates for limited access"); }
  if (method === "MT" || method === "PT" || method === "ET") { accessScore += 10; reasonsFor.push("Single-side surface access sufficient"); }

  var execScore = 76;
  if ((method === "UT" || method === "PAUT" || method === "TOFD") && fl.underwater_access_limited) {
    execScore -= 10; reasonsAgainst.push("Underwater execution requires specialized procedure and signal validation");
  }
  if (method === "PAUT") { execScore -= 5; reasonsAgainst.push("PAUT requires qualified setup -- poor focal law strategy creates false confidence"); }

  var overall = (detectScore * 0.25 + sizingScore * 0.15 + matScore * 0.15 + geoScore * 0.10 + orientScore * 0.10 + surfScore * 0.10 + accessScore * 0.05 + execScore * 0.10);
  if (matScore === 0) overall = 0;
  if (surfScore === 0 && (method === "PT")) overall = 0;
  overall = clamp(overall, 0, 100);

  if ((method === "MT" || method === "PT") && isCrackType) { complementary.push("UT"); complementary.push("PAUT"); }
  if (method === "UT" && isCrackType) { complementary.push("TOFD"); complementary.push("MT"); }
  if (method === "PAUT" && isCrackType) { complementary.push("TOFD"); }
  if ((method === "MT" || method === "PT") && isCorrosionType) { complementary.push("UT"); }

  if (method === "PT") { blindSpots.push("Cannot detect subsurface discontinuities"); blindSpots.push("Cannot size depth"); }
  if (method === "MT") { blindSpots.push("Limited to ferromagnetic materials"); blindSpots.push("Depth penetration limited to ~6mm"); blindSpots.push("Cannot provide crack depth measurement"); }
  if (method === "UT") { blindSpots.push("Near-surface dead zone may miss shallow flaws"); blindSpots.push("Beam orientation mismatch can miss unfavorable reflectors"); }
  if (method === "PAUT") { blindSpots.push("Requires strong setup discipline"); blindSpots.push("Very rough surfaces reduce reliability"); }
  if (method === "TOFD") { blindSpots.push("Surface/near-surface dead zone"); blindSpots.push("Not effective for corrosion mapping"); }
  if (method === "RT") { blindSpots.push("Tight planar cracks parallel to beam are invisible"); blindSpots.push("Requires backside access"); }
  if (method === "ET") { blindSpots.push("Depth penetration limited"); blindSpots.push("Lift-off and geometry variation distort signals"); }

  return {
    method: method, physics_principle: bl.prin, detects: bl.det, cannot_detect: bl.cant,
    scores: { detectability: roundN(detectScore, 1), sizing: roundN(sizingScore, 1), material: roundN(matScore, 1),
      geometry: roundN(geoScore, 1), orientation: roundN(orientScore, 1), surface: roundN(surfScore, 1),
      access: roundN(accessScore, 1), execution: roundN(execScore, 1), overall: roundN(overall, 1) },
    verdict: overall >= 80 ? "SUFFICIENT" : overall >= 65 ? "SUFFICIENT_WITH_LIMITATIONS" : overall >= 50 ? "CONDITIONALLY_SUFFICIENT" : "INSUFFICIENT",
    reasons_for: reasonsFor, reasons_against: reasonsAgainst,
    blind_spots: blindSpots, complementary_methods: complementary,
    is_surface_only: bl.subSens < 30, is_volumetric: bl.subSens >= 60, can_size_depth: bl.sizing >= 60
  };
}

function resolveInspectionReality(damage: any, consequence: any, physics: any, transcript: string, flags: any) {
  var lt = transcript.toLowerCase();
  var fl = flags || {};
  var proposed: string[] = [];
  var nameMap: any = { "visual": "VT", "magnetic particle": "MT", "penetrant": "PT", "ultrasonic": "UT", "radiograph": "RT", "phased array": "PAUT", "eddy current": "ET", "x-ray": "RT", "tofd": "TOFD" };
  var keys = Object.keys(nameMap);
  for (var ki = 0; ki < keys.length; ki++) { if (hasWord(lt, keys[ki]) && proposed.indexOf(nameMap[keys[ki]]) === -1) proposed.push(nameMap[keys[ki]]); }
  for (var ai2 = 0; ai2 < ALL_METHODS.length; ai2++) { if (transcript.indexOf(ALL_METHODS[ai2]) !== -1 && proposed.indexOf(ALL_METHODS[ai2]) === -1) proposed.push(ALL_METHODS[ai2]); }

  var allScores: any[] = [];
  for (var mi = 0; mi < ALL_METHODS.length; mi++) {
    var score = scoreMethodPhysics(ALL_METHODS[mi], damage, physics, consequence, transcript, flags);
    if (score) allScores.push(score);
  }
  allScores.sort(function(a: any, b: any) { return b.scores.overall - a.scores.overall; });

  var assessments: MethodWeight[] = [];
  for (var pi = 0; pi < proposed.length; pi++) {
    var ms: any = null;
    for (var si = 0; si < allScores.length; si++) { if (allScores[si].method === proposed[pi]) { ms = allScores[si]; break; } }
    if (!ms) continue;
    assessments.push({ method: ms.method, physics_principle: ms.physics_principle, detects: ms.detects,
      cannot_detect: ms.cannot_detect, reliability: roundN(ms.scores.overall / 100, 2),
      coverage: roundN(ms.scores.detectability / 100, 2), limitations: ms.reasons_against });
  }

  var required: Array<{ method: string; physics_basis: string }> = [];
  var missing: string[] = [];

  var hasSurf = false; var hasVol = false; var hasDepthSizing = false;
  for (var asi = 0; asi < assessments.length; asi++) {
    var ms2: any = null;
    for (var si2 = 0; si2 < allScores.length; si2++) { if (allScores[si2].method === assessments[asi].method) { ms2 = allScores[si2]; break; } }
    if (ms2) { if (!ms2.is_volumetric && ms2.is_surface_only) hasSurf = true; if (ms2.is_volumetric) hasVol = true; if (ms2.can_size_depth) hasDepthSizing = true; }
  }

  var bestMethod = allScores.length > 0 ? allScores[0] : null;
  var bestProposed: any = null;
  for (var bpi =
