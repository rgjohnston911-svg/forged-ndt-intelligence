// ============================================================================
// demoScenarios.ts  -  curated, vetted runs for the public /demo surface.
// FORGED 4D NDT  -  DEPLOY418
//
// These are REAL outputs, not mockups: the fleet systemic findings drive the
// production renderSystemicPanelHTML, and every single-asset narrative is held to
// the report-provenance gate (demoScenarios.test.ts) - our own marketing demo is
// not allowed to ship a number that does not trace to a source field. The set
// deliberately includes a HOLD/refusal (the "correct refusal" beat): a system that
// says "I can't confidently call this, here's what's missing" is more credible
// than one that always answers.
// ============================================================================

export type DemoSingle = {
  id: string;
  title: string;
  badge: string;
  transcript: string;
  decision: { consequence_tier: string; disposition: string; disposition_label: string; governing: string; confidence_band: string };
  report_narrative: string;
  // for the provenance gate: the authoritative source the narrative must trace to
  provenance_source: any;
  provenance_disposition: string;
};

export var DEMO_SINGLE: DemoSingle[] = [
  {
    id: "sour-gas-cracking",
    title: "Sour gas line - confirmed cracking",
    badge: "DECISION",
    transcript:
      "Six inch sour gas line, wet H2S service. Mag particle picked up surface-breaking cracks at the long seam weld toe. Hardness on the weld came back above the NACE limit. Wall loss on UT is about 28 percent but the cracking is the concern.",
    decision: {
      consequence_tier: "CRITICAL",
      disposition: "no_go",
      disposition_label: "NO-GO",
      governing: "environmental cracking (wet H2S / SSC)",
      confidence_band: "HIGH"
    },
    report_narrative:
      "Confirmed surface-breaking cracking on a sour (wet H2S) gas line, with weld hardness above the NACE limit - the signature of sulfide stress cracking. Measured wall loss is 28%, but metal loss is not the governing concern here: the active cracking mechanism governs. Consequence is CRITICAL (toxic, high-pressure containment). Disposition: no-go - remove from service pending engineering assessment and crack characterization.",
    provenance_source: {
      decision_core: {
        consequence_reality: { consequence_tier: "CRITICAL" },
        decision_reality: { disposition: "no_go" }
      },
      remaining_strength: { wall_loss_fraction: 0.28 },
      failure_mode_dominance: { governing_failure_mode: "environmental_cracking", governing_basis: "wet H2S, weld hardness above NACE limit, surface-breaking cracks" }
    },
    provenance_disposition: "no_go"
  },
  {
    id: "insufficient-data-hold",
    title: "Pressure vessel - insufficient data (HOLD)",
    badge: "CORRECT REFUSAL",
    transcript:
      "Hydrocarbon pressure vessel, been in service a while. They want a fitness-for-service call but I don't have current wall thickness readings and there's no record of the last internal inspection date.",
    decision: {
      consequence_tier: "HIGH",
      disposition: "hold_for_review",
      disposition_label: "HOLD FOR REVIEW",
      governing: "insufficient evidence",
      confidence_band: "LOW"
    },
    report_narrative:
      "Hydrocarbon pressure vessel. The evidence provided is insufficient to render a fitness-for-service call: there is no current wall thickness and no last-inspection date. Rather than produce a confident answer the data cannot support, the system holds - confidence is capped at 0.4 until those two fields are supplied. This is the honest result: the missing inputs are named, and the call is deferred to the human with the evidence to make it. Disposition: hold for review.",
    provenance_source: {
      decision_core: {
        consequence_reality: { consequence_tier: "HIGH" },
        decision_reality: { disposition: "hold_for_review" },
        reality_confidence: { band: "LOW" }
      },
      evidence_contract: { missing_fields: ["current wall thickness", "last inspection date"], confidence_ceiling: 0.4 }
    },
    provenance_disposition: "hold_for_review"
  }
];

export type DemoRanked = { rank: number; name: string; band: string; score: number; tier: string; disposition: string; action: string };
export type DemoFleet = {
  id: string;
  title: string;
  intro: string;
  ranked: DemoRanked[];
  // fed to buildSystemicView -> renderSystemicPanelHTML (the production component)
  systemic_findings: any[];
};

export var DEMO_FLEET: DemoFleet = {
  id: "storm-path-fleet",
  title: "Five platforms in a hurricane's path",
  intro: "Several assets evaluated at once, ranked into a single defensible order of action - plus a parallel program-level read for the integrity owner.",
  ranked: [
    { rank: 1, name: "Platform B - riser, active leak", band: "IMMEDIATE", score: 92, tier: "CRITICAL", disposition: "no_go", action: "Address first. Shut-in / protective-action candidate before the storm arrives." },
    { rank: 2, name: "Platform A - sour line, moderate wall loss", band: "PRIORITY", score: 71, tier: "HIGH", disposition: "hold_for_review", action: "Address early. Engineering review and required NDE before continued-service approval." },
    { rank: 3, name: "Platform D - storage, wall loss near minimum", band: "ELEVATED", score: 48, tier: "MEDIUM", disposition: "monitor", action: "Schedule near-term review; monitor for change." },
    { rank: 4, name: "Platform C - utility line, cosmetic", band: "ROUTINE", score: 14, tier: "LOW", disposition: "continue_service", action: "Routine handling; no elevated action indicated." },
    { rank: 5, name: "Platform E - new piping, clean", band: "ROUTINE", score: 8, tier: "LOW", disposition: "continue_service", action: "Routine handling; no elevated action indicated." }
  ],
  systemic_findings: [
    {
      actor: "fixed_support", signal: "CLUSTER", cohort: "batch_1998", observed: 1.0, baseline: 0.0, n: 4,
      recommendation: "Program review (integrity/reliability owner): fixed_support degradation clusters in cohort \"batch_1998\" (100% vs 0% rest-of-fleet) - investigate localized common cause (coating batch / environment / install crew)."
    }
  ]
};
