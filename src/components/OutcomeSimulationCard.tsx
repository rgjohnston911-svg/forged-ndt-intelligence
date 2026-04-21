// @ts-nocheck
/**
 * DEPLOY221 - OutcomeSimulationCard.tsx
 * src/components/OutcomeSimulationCard.tsx
 *
 * Predictive Twins UI. Shows 3 scenarios (Do Nothing, Monitor, Repair)
 * with timeline projections, time-to-failure, and risk badges.
 * Includes crack growth and pitting projections if data exists.
 *
 * var only. String concatenation only. No backticks.
 */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

var RISK_COLOR = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#dc2626"
};

var SCENARIO_CONFIG = {
  do_nothing: { color: "#ef4444", icon: "!!", label: "Do Nothing" },
  monitor: { color: "#f59e0b", icon: "?", label: "Monitor" },
  repair_now: { color: "#22c55e", icon: "+", label: "Repair Now" }
};

export default function OutcomeSimulationCard(props) {
  var caseId = props.caseId;
  var [running, setRunning] = useState(false);
  var [error, setError] = useState("");
  var [sim, setSim] = useState(null);
  var [activeScenario, setActiveScenario] = useState("do_nothing");
  var [showCrack, setShowCrack] = useState(false);
  var [showPitting, setShowPitting] = useState(false);

  useEffect(function() { if (caseId) loadExisting(); }, [caseId]);

  async function loadExisting() {
    var res = await supabase
      .from("inspection_cases")
      .select("outcome_simulation, outcome_simulation_generated_at")
      .eq("id", caseId)
      .maybeSingle();
    if (!res.error && res.data && res.data.outcome_simulation) {
      setSim(res.data.outcome_simulation);
    }
  }

  async function runSim() {
    setRunning(true); setError("");
    try {
      var resp = await fetch("/api/outcome-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId })
      });
      var json = await resp.json();
      if (!resp.ok || !json.success) { setError(json.error || "Simulation failed"); }
      else { setSim(json.simulation); }
    } catch (err) { setError("Network error: " + String(err)); }
    setRunning(false);
  }

  // Find active scenario
  var scenario = null;
  if (sim && sim.scenarios) {
    for (var si = 0; si < sim.scenarios.length; si++) {
      if (sim.scenarios[si].scenario === activeScenario) scenario = sim.scenarios[si];
    }
  }

  // Time-to-failure comparison for the header
  var doNothingTTF = null;
  var repairTTF = null;
  if (sim && sim.scenarios) {
    for (var ci = 0; ci < sim.scenarios.length; ci++) {
      if (sim.scenarios[ci].scenario === "do_nothing") doNothingTTF = sim.scenarios[ci].time_to_failure_months;
      if (sim.scenarios[ci].scenario === "repair_now") repairTTF = sim.scenarios[ci].time_to_failure_months;
    }
  }

  return (
    <div style={{ marginTop: "16px", padding: "14px", backgroundColor: "#0d1117", border: "1px solid #30363d", borderRadius: "8px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div>
          <h3 style={{ margin: 0, color: "#c9d1d9", fontSize: "14px" }}>Predictive Twins</h3>
          <div style={{ fontSize: "10px", color: "#8b949e", marginTop: "2px" }}>
            Physics-based outcome simulation &middot; 3 scenarios &middot; deterministic projections
          </div>
        </div>
        <button type="button" onClick={runSim} disabled={running}
          style={{ padding: "5px 10px", fontSize: "11px", backgroundColor: running ? "#374151" : "#1f6feb", color: "#fff", border: "none", borderRadius: "4px", cursor: running ? "wait" : "pointer" }}>
          {running ? "Simulating..." : (sim ? "Re-simulate" : "Run simulation")}
        </button>
      </div>

      {error && (
        <div style={{ padding: "8px 10px", backgroundColor: "#7f1d1d44", border: "1px solid #ef4444", borderRadius: "4px", color: "#fecaca", fontSize: "11px", marginBottom: "10px" }}>
          {error}
        </div>
      )}

      {!sim && !running && !error && (
        <div style={{ color: "#8b949e", fontSize: "12px", fontStyle: "italic" }}>
          No simulation yet. Click "Run simulation" to project future outcomes based on current damage data.
        </div>
      )}

      {sim && (
        <div>
          {/* Time-to-failure headline */}
          {doNothingTTF && (
            <div style={{ padding: "10px 14px", backgroundColor: doNothingTTF < 12 ? "#7f1d1d44" : (doNothingTTF < 36 ? "#78350f44" : "#14532d44"), border: "1px solid " + (doNothingTTF < 12 ? "#ef4444" : (doNothingTTF < 36 ? "#f59e0b" : "#22c55e")), borderRadius: "6px", marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Projected Failure (Do Nothing)</div>
                  <div style={{ fontSize: "20px", color: doNothingTTF < 12 ? "#ef4444" : (doNothingTTF < 36 ? "#f59e0b" : "#22c55e"), fontWeight: 700 }}>
                    {doNothingTTF + " months"}
                    <span style={{ fontSize: "12px", fontWeight: 400, color: "#8b949e" }}>
                      {" (" + (Math.round(doNothingTTF / 12 * 10) / 10) + " years)"}
                    </span>
                  </div>
                </div>
                {repairTTF && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>If Repaired Now</div>
                    <div style={{ fontSize: "20px", color: "#22c55e", fontWeight: 700 }}>
                      {repairTTF + " months"}
                    </div>
                    <div style={{ fontSize: "10px", color: "#22c55e" }}>
                      {"+" + (repairTTF - doNothingTTF) + " months gained"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Corrosion data */}
          {sim.corrosion_data && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
              {sim.corrosion_data.min_thickness_in && (
                <div style={{ padding: "5px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
                  <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Min Thickness</div>
                  <div style={{ fontSize: "11px", color: "#c9d1d9", fontWeight: 600 }}>{sim.corrosion_data.min_thickness_in + " in"}</div>
                </div>
              )}
              {sim.corrosion_data.nominal_in && (
                <div style={{ padding: "5px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
                  <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Nominal</div>
                  <div style={{ fontSize: "11px", color: "#c9d1d9", fontWeight: 600 }}>{sim.corrosion_data.nominal_in + " in"}</div>
                </div>
              )}
              {sim.corrosion_data.active_rate_mpy && (
                <div style={{ padding: "5px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
                  <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Corrosion Rate</div>
                  <div style={{ fontSize: "11px", color: "#c9d1d9", fontWeight: 600 }}>{sim.corrosion_data.active_rate_mpy + " mpy"}</div>
                </div>
              )}
              {sim.corrosion_data.rate_source && (
                <div style={{ padding: "5px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
                  <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Rate Source</div>
                  <div style={{ fontSize: "11px", color: "#c9d1d9" }}>{sim.corrosion_data.rate_source.replace(/_/g, " ")}</div>
                </div>
              )}
              <div style={{ padding: "5px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
                <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Engine</div>
                <div style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>DETERMINISTIC</div>
              </div>
            </div>
          )}

          {/* Scenario tabs */}
          {sim.scenarios && sim.scenarios.length > 0 && (
            <div>
              <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                {sim.scenarios.map(function(s) {
                  var cfg = SCENARIO_CONFIG[s.scenario] || { color: "#8b949e", label: s.label };
                  var isActive = activeScenario === s.scenario;
                  return (
                    <button key={s.scenario} type="button"
                      onClick={function() { setActiveScenario(s.scenario); }}
                      style={{
                        padding: "6px 12px", fontSize: "11px", borderRadius: "4px", cursor: "pointer",
                        backgroundColor: isActive ? cfg.color : "#161b22",
                        color: isActive ? "#fff" : "#c9d1d9",
                        border: "1px solid " + (isActive ? cfg.color : "#30363d"),
                        fontWeight: isActive ? 700 : 400
                      }}>
                      {cfg.label}
                      {s.time_to_failure_months ? (" (" + s.time_to_failure_months + "mo)") : ""}
                    </button>
                  );
                })}
              </div>

              {/* Active scenario detail */}
              {scenario && (
                <div style={{ padding: "10px", backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "6px", marginBottom: "10px" }}>
                  <div style={{ fontSize: "12px", color: "#c9d1d9", marginBottom: "6px" }}>{scenario.description}</div>
                  {scenario.recommendation && (
                    <div style={{ fontSize: "11px", color: "#f59e0b", marginBottom: "8px", fontWeight: 600 }}>
                      {scenario.recommendation}
                    </div>
                  )}

                  {/* Timeline table */}
                  {scenario.timeline && scenario.timeline.length > 0 && (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #30363d" }}>
                            <th style={{ padding: "4px 8px", color: "#8b949e", textAlign: "left" }}>Months</th>
                            <th style={{ padding: "4px 8px", color: "#8b949e", textAlign: "right" }}>Thickness (in)</th>
                            <th style={{ padding: "4px 8px", color: "#8b949e", textAlign: "right" }}>% Nominal</th>
                            <th style={{ padding: "4px 8px", color: "#8b949e", textAlign: "center" }}>Risk</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scenario.timeline.map(function(row) {
                            var rc = RISK_COLOR[row.risk] || "#8b949e";
                            return (
                              <tr key={row.months} style={{ borderBottom: "1px solid #21262d" }}>
                                <td style={{ padding: "4px 8px", color: "#c9d1d9" }}>{row.months + " (" + row.years + " yr)"}</td>
                                <td style={{ padding: "4px 8px", color: row.breached_tmin ? "#ef4444" : "#c9d1d9", textAlign: "right", fontWeight: row.breached_tmin ? 700 : 400 }}>
                                  {row.projected_thickness_in.toFixed(4)}
                                  {row.breached_tmin ? " BELOW T-MIN" : ""}
                                </td>
                                <td style={{ padding: "4px 8px", color: "#c9d1d9", textAlign: "right" }}>
                                  {row.pct_of_nominal ? Math.round(row.pct_of_nominal * 100) + "%" : "-"}
                                </td>
                                <td style={{ padding: "4px 8px", textAlign: "center" }}>
                                  <span style={{ padding: "2px 6px", fontSize: "9px", color: "#fff", backgroundColor: rc, borderRadius: "3px", textTransform: "uppercase" }}>
                                    {row.risk}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Crack Growth Projection */}
          {sim.crack_projection && (
            <div style={{ marginBottom: "10px" }}>
              <button type="button" onClick={function() { setShowCrack(!showCrack); }}
                style={{ fontSize: "10px", color: "#58a6ff", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "4px" }}>
                {showCrack ? "Hide" : "Show"} Crack Growth Projection
              </button>
              {showCrack && (
                <div style={{ padding: "10px", backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "6px" }}>
                  <div style={{ fontSize: "10px", color: "#8b949e", marginBottom: "6px" }}>
                    {"Initial: " + (sim.crack_projection.initial_length_in ? sim.crack_projection.initial_length_in + " in length" : "") +
                     (sim.crack_projection.initial_depth_in ? ", " + sim.crack_projection.initial_depth_in + " in depth" : "") +
                     " | Model: " + sim.crack_projection.annual_growth_rate * 100 + "% annual"}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #30363d" }}>
                        <th style={{ padding: "4px 8px", color: "#8b949e", textAlign: "left" }}>Months</th>
                        {sim.crack_projection.initial_length_in && <th style={{ padding: "4px 8px", color: "#8b949e", textAlign: "right" }}>Length (in)</th>}
                        {sim.crack_projection.initial_depth_in && <th style={{ padding: "4px 8px", color: "#8b949e", textAlign: "right" }}>Depth (in)</th>}
                        <th style={{ padding: "4px 8px", color: "#8b949e", textAlign: "center" }}>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sim.crack_projection.projections.map(function(row) {
                        var rc = RISK_COLOR[row.risk] || "#8b949e";
                        return (
                          <tr key={row.months} style={{ borderBottom: "1px solid #21262d" }}>
                            <td style={{ padding: "4px 8px", color: "#c9d1d9" }}>{row.months}</td>
                            {sim.crack_projection.initial_length_in && <td style={{ padding: "4px 8px", color: "#c9d1d9", textAlign: "right" }}>{row.projected_length_in}</td>}
                            {sim.crack_projection.initial_depth_in && <td style={{ padding: "4px 8px", color: "#c9d1d9", textAlign: "right" }}>{row.projected_depth_in}</td>}
                            <td style={{ padding: "4px 8px", textAlign: "center" }}>
                              <span style={{ padding: "2px 6px", fontSize: "9px", color: "#fff", backgroundColor: rc, borderRadius: "3px", textTransform: "uppercase" }}>{row.risk}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{ fontSize: "9px", color: "#6e7681", marginTop: "6px", fontStyle: "italic" }}>
                    {sim.crack_projection.note}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pitting Projection */}
          {sim.pitting_projection && (
            <div style={{ marginBottom: "10px" }}>
              <button type="button" onClick={function() { setShowPitting(!showPitting); }}
                style={{ fontSize: "10px", color: "#58a6ff", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "4px" }}>
                {showPitting ? "Hide" : "Show"} Pitting Growth Projection
              </button>
              {showPitting && (
                <div style={{ padding: "10px", backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "6px" }}>
                  <div style={{ fontSize: "10px", color: "#8b949e", marginBottom: "6px" }}>
                    {"Initial depth: " + sim.pitting_projection.initial_depth_in + " in | Model: power law n=" + sim.pitting_projection.exponent}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #30363d" }}>
                        <th style={{ padding: "4px 8px", color: "#8b949e", textAlign: "left" }}>Months</th>
                        <th style={{ padding: "4px 8px", color: "#8b949e", textAlign: "right" }}>Depth (in)</th>
                        {sim.pitting_projection.initial_diameter_in && <th style={{ padding: "4px 8px", color: "#8b949e", textAlign: "right" }}>Diameter (in)</th>}
                        <th style={{ padding: "4px 8px", color: "#8b949e", textAlign: "center" }}>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sim.pitting_projection.projections.map(function(row) {
                        var rc = RISK_COLOR[row.risk] || "#8b949e";
                        return (
                          <tr key={row.months} style={{ borderBottom: "1px solid #21262d" }}>
                            <td style={{ padding: "4px 8px", color: "#c9d1d9" }}>{row.months}</td>
                            <td style={{ padding: "4px 8px", color: "#c9d1d9", textAlign: "right" }}>{row.projected_depth_in}</td>
                            {sim.pitting_projection.initial_diameter_in && <td style={{ padding: "4px 8px", color: "#c9d1d9", textAlign: "right" }}>{row.projected_diameter_in}</td>}
                            <td style={{ padding: "4px 8px", textAlign: "center" }}>
                              <span style={{ padding: "2px 6px", fontSize: "9px", color: "#fff", backgroundColor: rc, borderRadius: "3px", textTransform: "uppercase" }}>{row.risk}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {sim.summary && (
            <div style={{ padding: "10px", backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "6px", color: "#c9d1d9", fontSize: "12px", lineHeight: "1.55" }}>
              {sim.summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
