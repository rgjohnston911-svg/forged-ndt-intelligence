// @ts-nocheck
// ============================================================================
// DemoPage.tsx  -  PUBLIC, no-auth guided demo (the landing-page "Live Demo").
// FORGED 4D NDT  -  DEPLOY418
//
// Curated, vetted runs - deterministic, can't be broken or abused, costs nothing.
// Shows the hardened output: a provenance-verified single-asset decision, a
// deliberate HOLD/refusal, and fleet triage with the parallel systemic panel
// (rendered by the SAME production component as /fleet). Sign-in runs your own.
// ============================================================================
import { useState } from "react";
import { buildSystemicView, renderSystemicPanelHTML, renderCountChipHTML } from "../lib/systemicPanel";
import { DEMO_SINGLE, DEMO_FLEET } from "../lib/demoScenarios";

function dispoColor(d) {
  if (d === "no_go") { return "#dc2626"; }
  if (d === "hold_for_review") { return "#ca8a04"; }
  if (d === "monitor") { return "#3b82f6"; }
  return "#16a34a";
}
function bandColor(b) {
  if (b === "IMMEDIATE") { return "#dc2626"; }
  if (b === "PRIORITY") { return "#ea580c"; }
  if (b === "ELEVATED") { return "#ca8a04"; }
  return "#16a34a";
}
function tierColor(t) {
  if (t === "CRITICAL") { return "#dc2626"; }
  if (t === "HIGH") { return "#ea580c"; }
  if (t === "MEDIUM") { return "#ca8a04"; }
  return "#8b949e";
}

function SingleView(props) {
  var s = props.scenario;
  return (
    <div>
      <div style={{ fontSize: 12, color: "#8b949e", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>What the inspector said</div>
      <div style={{ background: "#0d1117", border: "1px solid #30363d", borderLeft: "3px solid #6e7681", borderRadius: 6, padding: "12px 14px", fontSize: 14, color: "#c9d1d9", fontStyle: "italic", marginBottom: 18 }}>
        &ldquo;{s.transcript}&rdquo;
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: tierColor(s.decision.consequence_tier), border: "1px solid " + tierColor(s.decision.consequence_tier), borderRadius: 6, padding: "5px 12px" }}>{s.decision.consequence_tier} consequence</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: dispoColor(s.decision.disposition), borderRadius: 6, padding: "5px 12px" }}>{s.decision.disposition_label}</span>
        <span style={{ fontSize: 12, color: "#8b949e", border: "1px solid #30363d", borderRadius: 6, padding: "5px 12px" }}>governing: {s.decision.governing}</span>
        <span style={{ fontSize: 12, color: "#8b949e", border: "1px solid #30363d", borderRadius: 6, padding: "5px 12px" }}>confidence: {s.decision.confidence_band}</span>
      </div>

      <div style={{ fontSize: 14, color: "#e6edf3", lineHeight: 1.7, marginBottom: 16 }}>{s.report_narrative}</div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.35)", borderRadius: 6, padding: "10px 12px" }}>
        <span style={{ color: "#2dd4bf", fontWeight: 700, fontSize: 14 }}>&#10003;</span>
        <span style={{ fontSize: 12.5, color: "#2dd4bf" }}>Provenance verified - every figure and the disposition in this report trace to a deterministic engine field. The synthesis layer cannot introduce a number the engines did not produce.</span>
      </div>
    </div>
  );
}

function FleetView() {
  var f = DEMO_FLEET;
  var sysView = buildSystemicView(f.systemic_findings);
  return (
    <div>
      <div style={{ fontSize: 14, color: "#c9d1d9", lineHeight: 1.6, marginBottom: 16 }}>{f.intro}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: "#8b949e", textTransform: "uppercase", fontWeight: 700 }}>Order of action</div>
        <span dangerouslySetInnerHTML={{ __html: renderCountChipHTML(sysView) }} />
      </div>
      {f.ranked.map(function (a, i) {
        var col = bandColor(a.band);
        return (
          <div key={i} style={{ border: "1px solid #30363d", borderLeft: "5px solid " + col, borderRadius: 8, padding: "11px 14px", marginBottom: 8, background: "#0d1117" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>#{a.rank}. {a.name}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: col }}>{a.band} - {a.score}/100</div>
            </div>
            <div style={{ fontSize: 12, color: "#8b949e", margin: "3px 0" }}>{a.tier} - {String(a.disposition).replace(/_/g, " ")}</div>
            <div style={{ fontSize: 12, color: "#c9d1d9" }}>{a.action}</div>
          </div>
        );
      })}
      <div dangerouslySetInnerHTML={{ __html: renderSystemicPanelHTML(sysView) }} />
    </div>
  );
}

export default function DemoPage() {
  var tabs = [];
  for (var i = 0; i < DEMO_SINGLE.length; i++) { tabs.push({ kind: "single", label: DEMO_SINGLE[i].title, badge: DEMO_SINGLE[i].badge, idx: i }); }
  tabs.push({ kind: "fleet", label: DEMO_FLEET.title, badge: "FLEET", idx: 0 });
  var [sel, setSel] = useState(0);
  var active = tabs[sel];

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ borderBottom: "1px solid #30363d", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>FORGED</span>
          <span style={{ fontSize: 12, color: "#8b949e" }}>NDT Intelligence OS - guided demo</span>
        </div>
        <a href="/" style={{ fontSize: 13, color: "#2dd4bf", textDecoration: "none", border: "1px solid rgba(45,212,191,0.4)", borderRadius: 6, padding: "7px 16px" }}>Sign in to run your own &rarr;</a>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px" }}>
        <div style={{ fontSize: 13, color: "#8b949e", marginBottom: 18, lineHeight: 1.6 }}>
          These are vetted example runs - real, deterministic output from the decision engines. One asset, a deliberate "I can't call this yet" hold, and a multi-asset fleet triage. Pick one:
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {tabs.map(function (t, i) {
            var on = i === sel;
            return (
              <button key={i} onClick={function () { setSel(i); }}
                style={{ fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 8, padding: "8px 14px", textAlign: "left",
                  background: on ? "#161b22" : "transparent", color: on ? "#e6edf3" : "#8b949e",
                  border: "1px solid " + (on ? "#2dd4bf" : "#30363d") }}>
                <div style={{ fontSize: 10, letterSpacing: "0.05em", color: on ? "#2dd4bf" : "#6e7681", marginBottom: 2 }}>{t.badge}</div>
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: 20 }}>
          {active.kind === "single" ? <SingleView scenario={DEMO_SINGLE[active.idx]} /> : <FleetView />}
        </div>

        <div style={{ fontSize: 12, color: "#6e7681", marginTop: 18, textAlign: "center" }}>
          Guided demo with curated scenarios. Sign in to run the live engines on your own assets.
        </div>
      </div>
    </div>
  );
}
