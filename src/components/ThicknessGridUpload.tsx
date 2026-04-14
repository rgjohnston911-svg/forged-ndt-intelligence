// @ts-nocheck
/**
 * DEPLOY214 - ThicknessGridUpload.tsx
 * src/components/ThicknessGridUpload.tsx
 *
 * Evidence-tab widget: upload a CSV, POST it to /api/parse-thickness-csv,
 * display parsed grid + stats (min/max/avg, min-of-grid highlight, nominal
 * comparison + remaining thickness percent).
 *
 * DEPLOY214: after a successful parse, auto-POST to /api/run-authority
 * so the inspector does not have to click Run Authority Lock manually.
 * Emits optional onAuthorityRerun() callback so the parent page can
 * reload the case record + decision card after the lock re-runs.
 *
 * Reads back existing thickness_readings for the case on mount so
 * re-entering the tab shows prior uploads.
 */
import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

function fmt(n, d) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  var p = Math.pow(10, d);
  return (Math.round(n * p) / p).toFixed(d);
}

export default function ThicknessGridUpload(props) {
  var caseId = props.caseId;
  var onAuthorityRerun = props.onAuthorityRerun;
  var [readings, setReadings] = useState([]);
  var [loading, setLoading] = useState(false);
  var [uploading, setUploading] = useState(false);
  var [rerunning, setRerunning] = useState(false);
  var [rerunNote, setRerunNote] = useState("");
  var [error, setError] = useState("");
  var [lastStats, setLastStats] = useState(null);
  var fileRef = useRef(null);

  useEffect(function() { if (caseId) load(); }, [caseId]);

  async function load() {
    setLoading(true);
    setError("");
    var res = await supabase
      .from("thickness_readings")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    if (res.error) {
      setError("Failed to load readings: " + (res.error.message || String(res.error)));
      setReadings([]);
    } else {
      setReadings(res.data || []);
    }
    setLoading(false);
  }

  async function handleFile(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;
    var f = files[0];
    setUploading(true);
    setError("");
    try {
      var text = await f.text();
      var sess = await supabase.auth.getSession();
      var token = sess.data && sess.data.session ? sess.data.session.access_token : "";
      var resp = await fetch("/api/parse-thickness-csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ case_id: caseId, csv: text, filename: f.name })
      });
      var json = await resp.json();
      if (!resp.ok || !json.success) {
        setError(json.error || "Upload failed");
      } else {
        setLastStats(json);
        await load();
        // DEPLOY214: auto re-run authority lock so the disposition reflects
        // the new thickness data without the inspector having to click.
        await autoRunAuthority();
      }
    } catch (err) {
      setError("Upload error: " + String(err));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function autoRunAuthority() {
    if (!caseId) return;
    setRerunning(true);
    setRerunNote("Re-running authority lock with new thickness data...");
    try {
      var resp2 = await fetch("/api/run-authority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId })
      });
      var j2 = null;
      try { j2 = await resp2.json(); } catch (e) { j2 = null; }
      if (!resp2.ok) {
        setRerunNote("Authority re-run failed (" + resp2.status + "). Click Run Authority Lock manually.");
      } else {
        var disp = j2 && j2.disposition ? j2.disposition : (j2 && j2.final_decision ? j2.final_decision : "updated");
        setRerunNote("Authority lock re-ran automatically. Disposition: " + String(disp));
        if (typeof onAuthorityRerun === "function") {
          try { onAuthorityRerun(j2); } catch (cbErr) { console.error("onAuthorityRerun callback error:", cbErr); }
        }
      }
    } catch (err2) {
      setRerunNote("Authority re-run error: " + String(err2) + ". Click Run Authority Lock manually.");
    }
    setRerunning(false);
  }

  // Aggregate stats from all readings shown
  var stats = null;
  if (readings.length > 0) {
    var vals = readings.map(function(r) { return Number(r.thickness_in); }).filter(function(v) { return !isNaN(v) && v > 0; });
    if (vals.length > 0) {
      var sum = 0;
      for (var i = 0; i < vals.length; i++) sum += vals[i];
      stats = {
        count: vals.length,
        min: Math.min.apply(null, vals),
        max: Math.max.apply(null, vals),
        avg: sum / vals.length
      };
    }
  }

  // Group readings by (grid_row) to render a grid if present
  var hasGrid = false;
  var gridRows = {};
  var colSet = {};
  for (var r = 0; r < readings.length; r++) {
    if (readings[r].source_format === "grid_2d" && readings[r].grid_row && readings[r].grid_col) {
      hasGrid = true;
      if (!gridRows[readings[r].grid_row]) gridRows[readings[r].grid_row] = {};
      gridRows[readings[r].grid_row][readings[r].grid_col] = readings[r];
      colSet[readings[r].grid_col] = true;
    }
  }
  var colList = Object.keys(colSet).sort();
  var rowList = Object.keys(gridRows).sort();

  var flatReadings = readings.filter(function(r) { return r.source_format === "flat_list"; });

  var nominal = null;
  for (var n = 0; n < readings.length; n++) {
    if (readings[n].nominal_in) { nominal = Number(readings[n].nominal_in); break; }
  }

  function remainingPct(t) {
    if (!nominal || !t) return null;
    return Math.round((Number(t) / nominal) * 1000) / 10;
  }

  function cellStyle(t) {
    if (!t) return { backgroundColor: "#0d1117", color: "#8b949e" };
    if (!nominal) return { backgroundColor: "#161b22", color: "#c9d1d9" };
    var pct = (Number(t) / nominal) * 100;
    if (pct < 50) return { backgroundColor: "#7f1d1d", color: "#fecaca", fontWeight: 600 };
    if (pct < 80) return { backgroundColor: "#78350f", color: "#fde68a", fontWeight: 500 };
    return { backgroundColor: "#14532d", color: "#bbf7d0" };
  }

  return (
    <div style={{ marginTop: "16px", padding: "16px", backgroundColor: "#0d1117", border: "1px solid #30363d", borderRadius: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <h3 style={{ margin: 0, color: "#c9d1d9", fontSize: "15px" }}>Thickness Grid / CML Readings</h3>
        <div>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" style={{ display: "none" }} onChange={handleFile} disabled={uploading} />
          <button
            type="button"
            onClick={function() { if (fileRef.current) fileRef.current.click(); }}
            disabled={uploading}
            style={{ padding: "6px 14px", backgroundColor: uploading ? "#374151" : "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: uploading ? "wait" : "pointer", fontSize: "12px" }}>
            {uploading ? "Parsing..." : "Upload CSV"}
          </button>
        </div>
      </div>

      <div style={{ fontSize: "11px", color: "#8b949e", marginBottom: "12px", lineHeight: "1.5" }}>
        Accepts 2D grids (rows &times; cols) or flat lists (location, thickness). Optional first lines:<br/>
        <code style={{ color: "#58a6ff" }}>{"# units: in"}</code> or <code style={{ color: "#58a6ff" }}>{"# units: mm"}</code> (default: in) &nbsp;|&nbsp;
        <code style={{ color: "#58a6ff" }}>{"# nominal: 0.375"}</code>
      </div>

      {error && (
        <div style={{ padding: "10px", backgroundColor: "#7f1d1d44", border: "1px solid #ef4444", borderRadius: "6px", color: "#fecaca", fontSize: "12px", marginBottom: "12px" }}>
          {error}
        </div>
      )}

      {lastStats && (
        <div style={{ padding: "8px 12px", backgroundColor: "#14532d44", border: "1px solid #22c55e", borderRadius: "6px", color: "#bbf7d0", fontSize: "12px", marginBottom: "12px" }}>
          Parsed {lastStats.count} readings from {lastStats.filename} (format: {lastStats.format}, units declared: {lastStats.units_declared})
        </div>
      )}

      {(rerunning || rerunNote) && (
        <div style={{ padding: "8px 12px", backgroundColor: "#1e3a8a44", border: "1px solid #3b82f6", borderRadius: "6px", color: "#bfdbfe", fontSize: "12px", marginBottom: "12px" }}>
          {rerunning ? "Re-running authority lock with new thickness data..." : rerunNote}
        </div>
      )}

      {loading && <div style={{ color: "#8b949e", fontSize: "12px" }}>Loading readings...</div>}

      {stats && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
          <div style={{ padding: "8px 12px", backgroundColor: "#161b22", borderRadius: "6px", border: "1px solid #30363d" }}>
            <div style={{ fontSize: "10px", color: "#8b949e", textTransform: "uppercase" }}>Readings</div>
            <div style={{ fontSize: "18px", color: "#c9d1d9", fontWeight: 600 }}>{stats.count}</div>
          </div>
          <div style={{ padding: "8px 12px", backgroundColor: "#161b22", borderRadius: "6px", border: "1px solid #30363d" }}>
            <div style={{ fontSize: "10px", color: "#8b949e", textTransform: "uppercase" }}>Min (in)</div>
            <div style={{ fontSize: "18px", color: "#ef4444", fontWeight: 600 }}>{fmt(stats.min, 4)}</div>
            {nominal && <div style={{ fontSize: "10px", color: "#8b949e" }}>{fmt((stats.min / nominal) * 100, 1)}% of nominal</div>}
          </div>
          <div style={{ padding: "8px 12px", backgroundColor: "#161b22", borderRadius: "6px", border: "1px solid #30363d" }}>
            <div style={{ fontSize: "10px", color: "#8b949e", textTransform: "uppercase" }}>Avg (in)</div>
            <div style={{ fontSize: "18px", color: "#c9d1d9", fontWeight: 600 }}>{fmt(stats.avg, 4)}</div>
          </div>
          <div style={{ padding: "8px 12px", backgroundColor: "#161b22", borderRadius: "6px", border: "1px solid #30363d" }}>
            <div style={{ fontSize: "10px", color: "#8b949e", textTransform: "uppercase" }}>Max (in)</div>
            <div style={{ fontSize: "18px", color: "#c9d1d9", fontWeight: 600 }}>{fmt(stats.max, 4)}</div>
          </div>
          {nominal && (
            <div style={{ padding: "8px 12px", backgroundColor: "#161b22", borderRadius: "6px", border: "1px solid #30363d" }}>
              <div style={{ fontSize: "10px", color: "#8b949e", textTransform: "uppercase" }}>Nominal (in)</div>
              <div style={{ fontSize: "18px", color: "#c9d1d9", fontWeight: 600 }}>{fmt(nominal, 4)}</div>
            </div>
          )}
        </div>
      )}

      {hasGrid && (
        <div style={{ overflowX: "auto", marginBottom: "12px" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr>
                <th style={{ padding: "6px 8px", backgroundColor: "#161b22", color: "#8b949e", border: "1px solid #30363d" }}></th>
                {colList.map(function(c) {
                  return <th key={c} style={{ padding: "6px 8px", backgroundColor: "#161b22", color: "#c9d1d9", border: "1px solid #30363d" }}>{c}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {rowList.map(function(rk) {
                return (
                  <tr key={rk}>
                    <td style={{ padding: "6px 8px", backgroundColor: "#161b22", color: "#c9d1d9", border: "1px solid #30363d", fontWeight: 600 }}>{rk}</td>
                    {colList.map(function(ck) {
                      var cell = gridRows[rk][ck];
                      var t = cell ? Number(cell.thickness_in) : null;
                      var style = Object.assign({ padding: "6px 8px", border: "1px solid #30363d", textAlign: "center", minWidth: "60px" }, cellStyle(t));
                      var title = cell ? (fmt(t, 4) + " in" + (nominal ? " (" + remainingPct(t) + "% of nominal)" : "")) : "no reading";
                      return (
                        <td key={ck} style={style} title={title}>
                          {cell ? fmt(t, 3) : ""}
                          {cell && cell.is_min_of_grid ? " *" : ""}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: "10px", color: "#8b949e", marginTop: "6px" }}>* = min of grid &nbsp; | &nbsp; colors: red &lt;50% nominal, amber &lt;80%, green &ge;80%</div>
        </div>
      )}

      {flatReadings.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "11px", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ padding: "6px 8px", backgroundColor: "#161b22", color: "#c9d1d9", border: "1px solid #30363d", textAlign: "left" }}>Location</th>
                <th style={{ padding: "6px 8px", backgroundColor: "#161b22", color: "#c9d1d9", border: "1px solid #30363d", textAlign: "right" }}>Thickness (in)</th>
                <th style={{ padding: "6px 8px", backgroundColor: "#161b22", color: "#c9d1d9", border: "1px solid #30363d", textAlign: "right" }}>Thickness (mm)</th>
                {nominal && <th style={{ padding: "6px 8px", backgroundColor: "#161b22", color: "#c9d1d9", border: "1px solid #30363d", textAlign: "right" }}>% of Nominal</th>}
              </tr>
            </thead>
            <tbody>
              {flatReadings.map(function(row) {
                var t = Number(row.thickness_in);
                var style = Object.assign({ padding: "6px 8px", border: "1px solid #30363d", textAlign: "right" }, cellStyle(t));
                return (
                  <tr key={row.id}>
                    <td style={{ padding: "6px 8px", border: "1px solid #30363d", color: "#c9d1d9" }}>{row.location_ref}{row.is_min_of_grid ? " *" : ""}</td>
                    <td style={style}>{fmt(t, 4)}</td>
                    <td style={{ padding: "6px 8px", border: "1px solid #30363d", color: "#c9d1d9", textAlign: "right" }}>{fmt(Number(row.thickness_mm), 3)}</td>
                    {nominal && <td style={{ padding: "6px 8px", border: "1px solid #30363d", color: "#c9d1d9", textAlign: "right" }}>{fmt((t / nominal) * 100, 1)}%</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && readings.length === 0 && !error && (
        <div style={{ color: "#8b949e", fontSize: "12px", fontStyle: "italic" }}>
          No thickness readings uploaded yet for this case.
        </div>
      )}
    </div>
  );
}
