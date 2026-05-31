// ============================================================================
// systemicPanel.ts  -  pure view model + renderer for the /fleet "Systemic
// Patterns" panel.  FORGED 4D NDT  -  DEPLOY416
//
// The panel is PARALLEL to the order of action, never coupled to it. That
// discipline lives in the engine; on screen it can leak, so this module is the
// single source of truth for what the panel renders, and systemicPanel.test.ts
// gates it. Locked design (placement rules, all machine-checkable here):
//   1. FIREBREAK   panel content lives in its OWN region (data-region="systemic");
//                  it is built from findings only and can carry no urgency identity.
//   2. NO COUPLING palette is DISJOINT from the urgency band ramp - teal (confirmed)
//                  and gray (provisional) only; never a band colour/word.
//   3. PROVISIONAL a PREVALENCE_PROVISIONAL / ELEVATED_NO_CONTRAST finding always
//                  renders WITH its "cannot confirm" caveat.
//   4. HONEST CHIP the count chip encodes confidence ("N patterns / M confirmed")
//                  and its count equals the number of rendered findings.
//   +  graceful degrade: zero findings -> one calm line, never an empty scary box.
//
// Palette (disjoint from the band ramp red #dc2626 / orange #ea580c / amber
// #ca8a04 / green #16a34a): teal #2dd4bf (confirmed), gray #8b949e (provisional).
// ============================================================================

export var TEAL = "#2dd4bf";
export var GRAY = "#8b949e";

// Band tokens the panel must NEVER contain (the gate asserts their absence).
export var URGENCY_BAND_COLORS = ["#dc2626", "#ea580c", "#ca8a04", "#16a34a"];
export var URGENCY_BAND_NAMES = ["IMMEDIATE", "PRIORITY", "ELEVATED", "ROUTINE"];

type Finding = {
  actor?: string;
  signal?: string;
  cohort?: string;
  observed?: number | null;
  baseline?: number | null;
  n?: number;
  recommendation?: string;
};

type Item = {
  signal: string;
  confirmed: boolean;
  palette: "teal" | "gray";
  label: string;
  title: string;
  detail: string;
  caveat: string;
};

type SystemicView = {
  empty: boolean;
  chip: { total: number; confirmed: number; label: string };
  items: Item[];
};

var SIGNAL_META: { [k: string]: { confirmed: boolean; palette: "teal" | "gray"; label: string; caveat: string } } = {
  CLUSTER: { confirmed: true, palette: "teal", label: "cluster", caveat: "" },
  PREVALENCE: { confirmed: true, palette: "teal", label: "prevalence", caveat: "" },
  PREVALENCE_PROVISIONAL: {
    confirmed: false, palette: "gray", label: "prevalence · provisional",
    caveat: "cannot confirm systemic until a sourced baseline backs it - a flag to establish the rate, not a confirmed program failure"
  },
  ELEVATED_NO_CONTRAST: {
    confirmed: false, palette: "gray", label: "elevated · no baseline",
    caveat: "cannot confirm systemic - no expected rate exists for this context; establish one"
  }
};

function pct(x: number | null | undefined): string {
  if (x === null || x === undefined) { return ""; }
  return Math.round(x * 100) + "%";
}
function actorLabel(a?: string): string { return String(a || "actor").replace(/_/g, " "); }

export function buildSystemicView(findings: Finding[] | null | undefined): SystemicView {
  var list = findings || [];
  var items: Item[] = [];
  var confirmed = 0;
  for (var i = 0; i < list.length; i++) {
    var f = list[i] || {};
    var meta = SIGNAL_META[String(f.signal)] || { confirmed: false, palette: "gray", label: String(f.signal || "signal"), caveat: "" };
    if (meta.confirmed) { confirmed++; }
    var title = actorLabel(f.actor) + (f.cohort && f.cohort !== "fleet" ? " · cohort " + f.cohort : " · fleet-wide");
    var detail = f.recommendation
      ? String(f.recommendation)
      : (actorLabel(f.actor) + " incidence " + pct(f.observed) + (f.baseline != null ? " vs " + pct(f.baseline) + " expected" : ""));
    items.push({
      signal: String(f.signal), confirmed: meta.confirmed, palette: meta.palette,
      label: meta.label, title: title, detail: detail, caveat: meta.caveat
    });
  }
  return {
    empty: items.length === 0,
    chip: { total: items.length, confirmed: confirmed, label: items.length + (items.length === 1 ? " pattern" : " patterns") + " · " + confirmed + " confirmed" },
    items: items
  };
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The count chip: unmissable pointer at the top, anchors DOWN to the panel (never
// forces the panel open or sits adjacent to the ranked rows). data-count is gated.
export function renderCountChipHTML(view: SystemicView): string {
  if (view.empty) { return ""; }
  return '<a href="#systemic-panel" data-count="' + view.chip.total + '" data-confirmed="' + view.chip.confirmed + '" ' +
    'style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-size:12px;color:' + TEAL + ';' +
    'border:1px solid rgba(45,212,191,0.35);background:rgba(45,212,191,0.10);padding:5px 11px;border-radius:8px;">' +
    '↓ ' + esc(view.chip.label) + '</a>';
}

// The panel itself. data-region="systemic" wraps EVERYTHING (firebreak); each
// finding carries data-signal; provisional items render their caveat.
export function renderSystemicPanelHTML(view: SystemicView): string {
  var head =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
      '<div style="display:flex;align-items:center;gap:9px;">' +
        '<span style="font-size:16px;font-weight:700;">Systemic patterns</span>' +
      '</div>' +
      '<span style="font-size:11px;color:' + TEAL + ';border:1px solid rgba(45,212,191,0.35);padding:4px 10px;border-radius:8px;">for: integrity / reliability owner</span>' +
    '</div>' +
    '<div style="font-size:12px;color:' + GRAY + ';background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:9px 11px;margin-bottom:12px;">' +
      'Program-level. Runs parallel to the order of action - it does <b>not</b> re-rank or disposition any asset above.' +
    '</div>';

  var bodyHTML: string;
  if (view.empty) {
    bodyHTML = '<div data-empty="1" style="font-size:13px;color:' + GRAY + ';">No program-level patterns detected across this fleet.</div>';
  } else {
    var rows = "";
    for (var i = 0; i < view.items.length; i++) {
      var it = view.items[i];
      var color = it.palette === "teal" ? TEAL : GRAY;
      var chipBg = it.palette === "teal" ? "rgba(45,212,191,0.12)" : "rgba(139,148,158,0.12)";
      rows +=
        '<div data-signal="' + esc(it.signal) + '" style="background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:11px 13px;margin-bottom:8px;">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">' +
            '<span style="font-size:11px;font-weight:700;color:' + color + ';background:' + chipBg + ';padding:3px 9px;border-radius:6px;">' + esc(it.label) + '</span>' +
            '<span style="font-size:14px;font-weight:700;">' + esc(it.title) + '</span>' +
          '</div>' +
          '<div style="font-size:13px;color:' + GRAY + ';line-height:1.6;">' + esc(it.detail) + '</div>' +
          (it.caveat ? '<div data-caveat="1" style="font-size:12px;color:' + GRAY + ';margin-top:5px;font-style:italic;">' + esc(it.caveat) + '</div>' : '') +
        '</div>';
    }
    bodyHTML = rows;
  }

  return '<div id="systemic-panel" data-region="systemic" style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px;margin-top:16px;">' +
    head + bodyHTML + '</div>';
}
