// @ts-nocheck
/**
 * DEPLOY227 - CaseSearchPanel.tsx
 * src/components/CaseSearchPanel.tsx
 *
 * Case Search & Analytics UI
 * Provides filter controls, results table, and analytics dashboard.
 */

import { useState, useEffect } from "react";

var API_BASE = "/api/case-search";

function post(body) {
  return fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(function(r) { return r.json(); });
}

var cardStyle = {
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "16px",
  color: "#e6edf3"
};

var inputStyle = {
  background: "#0d1117",
  border: "1px solid #30363d",
  borderRadius: "6px",
  padding: "8px 12px",
  color: "#e6edf3",
  fontSize: "13px",
  width: "100%"
};

var selectStyle = {
  background: "#0d1117",
  border: "1px solid #30363d",
  borderRadius: "6px",
  padding: "8px 12px",
  color: "#e6edf3",
  fontSize: "13px",
  width: "100%",
  cursor: "pointer"
};

var btnStyle = {
  padding: "10px 20px",
  borderRadius: "8px",
  border: "none",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer"
};

var primaryBtn = Object.assign({}, btnStyle, { background: "#238636", color: "#fff" });
var secondaryBtn = Object.assign({}, btnStyle, { background: "#30363d", color: "#e6edf3" });

var tabActive = {
  padding: "8px 16px",
  borderRadius: "6px",
  border: "none",
  background: "#238636",
  color: "#fff",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer"
};

var tabInactive = {
  padding: "8px 16px",
  borderRadius: "6px",
  border: "1px solid #30363d",
  background: "transparent",
  color: "#8b949e",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer"
};

var badgeStyle = function(color) {
  return {
    display: "inline-block",
    fontSize: "10px",
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: "4px",
    letterSpacing: "0.5px",
    background: color + "22",
    color: color,
    border: "1px solid " + color + "44"
  };
};

export default function CaseSearchPanel() {
  var filterOptionsState = useState(null);
  var filterOptions = filterOptionsState[0];
  var setFilterOptions = filterOptionsState[1];

  var filtersState = useState({});
  var filters = filtersState[0];
  var setFilters = filtersState[1];

  var resultsState = useState(null);
  var results = resultsState[0];
  var setResults = resultsState[1];

  var analyticsState = useState(null);
  var analytics = analyticsState[0];
  var setAnalytics = analyticsState[1];

  var loadingState = useState(false);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  var viewState = useState("search");
  var view = viewState[0];
  var setView = viewState[1];

  var pageState = useState(1);
  var page = pageState[0];
  var setPage = pageState[1];

  var expandedState = useState(true);
  var expanded = expandedState[0];
  var setExpanded = expandedState[1];

  // Load filter options on mount
  useEffect(function() {
    post({ action: "filter_options" }).then(function(data) {
      if (data.filter_options) setFilterOptions(data.filter_options);
    }).catch(function() {});
  }, []);

  function updateFilter(key, value) {
    var next = Object.assign({}, filters);
    if (value === "" || value === null || value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    setFilters(next);
  }

  function runSearch(p) {
    var searchPage = p || 1;
    setLoading(true);
    post({ action: "search", filters: filters, page: searchPage, page_size: 25, sort: { field: "created_at", direction: "desc" } })
      .then(function(data) {
        setResults(data);
        setPage(searchPage);
        setLoading(false);
      })
      .catch(function() { setLoading(false); });
  }

  function runAnalytics() {
    setLoading(true);
    post({ action: "analytics", filters: filters })
      .then(function(data) {
        setAnalytics(data);
        setLoading(false);
      })
      .catch(function() { setLoading(false); });
  }

  function clearFilters() {
    setFilters({});
    setResults(null);
    setAnalytics(null);
  }

  function activeFilterCount() {
    return Object.keys(filters).length;
  }

  // Render filter select
  function renderSelect(label, filterKey, options) {
    return (
      <div style={{ flex: "1 1 200px", minWidth: "180px" }}>
        <div style={{ fontSize: "11px", color: "#8b949e", marginBottom: "4px", fontWeight: 600 }}>{label}</div>
        <select
          style={selectStyle}
          value={filters[filterKey] || ""}
          onChange={function(e) { updateFilter(filterKey, e.target.value); }}
        >
          <option value="">All</option>
          {options && options.map(function(opt) {
            return <option key={opt} value={opt}>{opt}</option>;
          })}
        </select>
      </div>
    );
  }

  // Disposition color
  function dispColor(d) {
    if (!d) return "#8b949e";
    var dl = d.toLowerCase();
    if (dl.indexOf("repair") >= 0 || dl.indexOf("replace") >= 0) return "#ef4444";
    if (dl.indexOf("monitor") >= 0) return "#f59e0b";
    if (dl.indexOf("accept") >= 0 || dl.indexOf("pass") >= 0) return "#22c55e";
    return "#3b82f6";
  }

  function stateColor(s) {
    if (!s) return "#8b949e";
    var sl = s.toLowerCase();
    if (sl.indexOf("critical") >= 0) return "#ef4444";
    if (sl.indexOf("major") >= 0 || sl.indexOf("degrad") >= 0) return "#f59e0b";
    if (sl.indexOf("minor") >= 0 || sl.indexOf("acceptable") >= 0) return "#22c55e";
    return "#3b82f6";
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            Case Search & Analytics
            {activeFilterCount() > 0 && (
              <span style={badgeStyle("#3b82f6")}>{activeFilterCount() + " FILTER" + (activeFilterCount() > 1 ? "S" : "")}</span>
            )}
          </div>
          <div style={{ fontSize: "12px", color: "#8b949e", marginTop: "2px" }}>DEPLOY227 — Search by material, asset, method, damage type, dates</div>
        </div>
        <button
          style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: "18px" }}
          onClick={function() { setExpanded(!expanded); }}
        >{expanded ? "\u25B2" : "\u25BC"}</button>
      </div>

      {expanded && (
        <div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button style={view === "search" ? tabActive : tabInactive} onClick={function() { setView("search"); }}>Search Results</button>
            <button style={view === "analytics" ? tabActive : tabInactive} onClick={function() { setView("analytics"); }}>Analytics</button>
          </div>

          {/* Filters */}
          <div style={{ background: "#0d111788", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#8b949e", marginBottom: "12px" }}>FILTERS</div>

            {/* Row 1: Text search + Date range */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
              <div style={{ flex: "2 1 300px" }}>
                <div style={{ fontSize: "11px", color: "#8b949e", marginBottom: "4px", fontWeight: 600 }}>Search</div>
                <input
                  style={inputStyle}
                  placeholder="Search case number, component, material, notes..."
                  value={filters.search_text || ""}
                  onChange={function(e) { updateFilter("search_text", e.target.value); }}
                />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <div style={{ fontSize: "11px", color: "#8b949e", marginBottom: "4px", fontWeight: 600 }}>Date From</div>
                <input
                  style={inputStyle}
                  type="date"
                  value={filters.date_from ? filters.date_from.substring(0, 10) : ""}
                  onChange={function(e) { updateFilter("date_from", e.target.value ? e.target.value + "T00:00:00Z" : ""); }}
                />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <div style={{ fontSize: "11px", color: "#8b949e", marginBottom: "4px", fontWeight: 600 }}>Date To</div>
                <input
                  style={inputStyle}
                  type="date"
                  value={filters.date_to ? filters.date_to.substring(0, 10) : ""}
                  onChange={function(e) { updateFilter("date_to", e.target.value ? e.target.value + "T23:59:59Z" : ""); }}
                />
              </div>
            </div>

            {/* Row 2: Dropdowns */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
              {renderSelect("Status", "status", filterOptions ? filterOptions.statuses : [])}
              {renderSelect("Disposition", "disposition", filterOptions ? filterOptions.dispositions : [])}
              {renderSelect("State", "state", filterOptions ? filterOptions.states : [])}
              {renderSelect("Material", "material", filterOptions ? filterOptions.materials : [])}
            </div>

            {/* Row 3: More dropdowns */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
              {renderSelect("Asset Type", "asset_type", filterOptions ? filterOptions.asset_types : [])}
              {renderSelect("Inspection Method", "inspection_method", filterOptions ? filterOptions.inspection_methods : [])}
              {renderSelect("Damage Type", "damage_type", filterOptions ? filterOptions.damage_types : [])}
              {renderSelect("Severity", "severity", filterOptions ? filterOptions.severities : [])}
            </div>

            {/* Row 4: Special filters + buttons */}
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 150px" }}>
                <div style={{ fontSize: "11px", color: "#8b949e", marginBottom: "4px", fontWeight: 600 }}>Inspector Override</div>
                <select style={selectStyle} value={filters.inspector_override === true ? "true" : filters.inspector_override === false ? "false" : ""} onChange={function(e) {
                  if (e.target.value === "true") updateFilter("inspector_override", true);
                  else if (e.target.value === "false") updateFilter("inspector_override", false);
                  else updateFilter("inspector_override", null);
                }}>
                  <option value="">All</option>
                  <option value="true">Overridden Only</option>
                  <option value="false">Not Overridden</option>
                </select>
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <div style={{ fontSize: "11px", color: "#8b949e", marginBottom: "4px", fontWeight: 600 }}>Has Adjudication</div>
                <select style={selectStyle} value={filters.has_adjudication === true ? "true" : filters.has_adjudication === false ? "false" : ""} onChange={function(e) {
                  if (e.target.value === "true") updateFilter("has_adjudication", true);
                  else if (e.target.value === "false") updateFilter("has_adjudication", false);
                  else updateFilter("has_adjudication", null);
                }}>
                  <option value="">All</option>
                  <option value="true">Reviewed</option>
                  <option value="false">Not Reviewed</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "8px", flex: "0 0 auto" }}>
                <button style={primaryBtn} onClick={function() { if (view === "analytics") runAnalytics(); else runSearch(1); }} disabled={loading}>
                  {loading ? "Searching..." : (view === "analytics" ? "Run Analytics" : "Search")}
                </button>
                <button style={secondaryBtn} onClick={clearFilters}>Clear</button>
              </div>
            </div>
          </div>

          {/* SEARCH RESULTS VIEW */}
          {view === "search" && results && (
            <div>
              <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "12px" }}>
                {results.pagination ? results.pagination.total_results + " cases found" : "0 cases found"}
                {results.response_ms ? " \u00B7 " + results.response_ms + "ms" : ""}
              </div>

              {/* Results table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #30363d" }}>
                      <th style={{ padding: "8px", textAlign: "left", color: "#8b949e", fontWeight: 600 }}>Case</th>
                      <th style={{ padding: "8px", textAlign: "left", color: "#8b949e", fontWeight: 600 }}>Status</th>
                      <th style={{ padding: "8px", textAlign: "left", color: "#8b949e", fontWeight: 600 }}>State</th>
                      <th style={{ padding: "8px", textAlign: "left", color: "#8b949e", fontWeight: 600 }}>Disposition</th>
                      <th style={{ padding: "8px", textAlign: "left", color: "#8b949e", fontWeight: 600 }}>Material</th>
                      <th style={{ padding: "8px", textAlign: "left", color: "#8b949e", fontWeight: 600 }}>Method</th>
                      <th style={{ padding: "8px", textAlign: "left", color: "#8b949e", fontWeight: 600 }}>Confidence</th>
                      <th style={{ padding: "8px", textAlign: "left", color: "#8b949e", fontWeight: 600 }}>Override</th>
                      <th style={{ padding: "8px", textAlign: "left", color: "#8b949e", fontWeight: 600 }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.results && results.results.map(function(row) {
                      return (
                        <tr key={row.id} style={{ borderBottom: "1px solid #21262d" }}>
                          <td style={{ padding: "8px", fontWeight: 600 }}>{row.case_number || row.id.substring(0, 8)}</td>
                          <td style={{ padding: "8px" }}><span style={badgeStyle("#3b82f6")}>{(row.status || "—").toUpperCase()}</span></td>
                          <td style={{ padding: "8px" }}><span style={badgeStyle(stateColor(row.state))}>{(row.state || "—").toUpperCase()}</span></td>
                          <td style={{ padding: "8px" }}><span style={badgeStyle(dispColor(row.disposition))}>{(row.disposition || "—").toUpperCase()}</span></td>
                          <td style={{ padding: "8px", color: "#8b949e" }}>{row.material || "—"}</td>
                          <td style={{ padding: "8px", color: "#8b949e" }}>{row.inspection_method || "—"}</td>
                          <td style={{ padding: "8px" }}>
                            {row.confidence !== null && row.confidence !== undefined
                              ? (Math.round(row.confidence * 100) + "%")
                              : "—"}
                          </td>
                          <td style={{ padding: "8px" }}>
                            {row.inspector_override_active
                              ? <span style={badgeStyle("#ef4444")}>OVERRIDE</span>
                              : <span style={{ color: "#8b949e" }}>—</span>}
                          </td>
                          <td style={{ padding: "8px", color: "#8b949e", fontSize: "11px" }}>
                            {row.created_at ? row.created_at.substring(0, 10) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {results.pagination && results.pagination.total_pages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
                  <button
                    style={secondaryBtn}
                    disabled={!results.pagination.has_prev}
                    onClick={function() { runSearch(page - 1); }}
                  >Previous</button>
                  <span style={{ padding: "10px", color: "#8b949e", fontSize: "13px" }}>
                    {"Page " + page + " of " + results.pagination.total_pages}
                  </span>
                  <button
                    style={secondaryBtn}
                    disabled={!results.pagination.has_next}
                    onClick={function() { runSearch(page + 1); }}
                  >Next</button>
                </div>
              )}
            </div>
          )}

          {/* ANALYTICS VIEW */}
          {view === "analytics" && analytics && (
            <div>
              <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "16px" }}>
                {analytics.total_cases + " cases analyzed"}
                {analytics.response_ms ? " \u00B7 " + analytics.response_ms + "ms" : ""}
              </div>

              {/* Summary stats */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 120px", background: "#0d1117", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "#3b82f6" }}>{analytics.total_cases}</div>
                  <div style={{ fontSize: "11px", color: "#8b949e" }}>Total Cases</div>
                </div>
                <div style={{ flex: "1 1 120px", background: "#0d1117", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "#22c55e" }}>
                    {analytics.confidence && analytics.confidence.average !== null ? Math.round(analytics.confidence.average * 100) + "%" : "—"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#8b949e" }}>Avg Confidence</div>
                </div>
                <div style={{ flex: "1 1 120px", background: "#0d1117", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "#f59e0b" }}>
                    {analytics.override_rate ? analytics.override_rate.percentage + "%" : "0%"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#8b949e" }}>Override Rate</div>
                </div>
                <div style={{ flex: "1 1 120px", background: "#0d1117", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "#a855f7" }}>
                    {analytics.adjudication_rate ? analytics.adjudication_rate.percentage + "%" : "0%"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#8b949e" }}>Review Rate</div>
                </div>
              </div>

              {/* Breakdowns */}
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                {renderBreakdown("By Disposition", analytics.breakdowns ? analytics.breakdowns.by_disposition : [], dispColor)}
                {renderBreakdown("By State", analytics.breakdowns ? analytics.breakdowns.by_state : [], stateColor)}
                {renderBreakdown("By Material", analytics.breakdowns ? analytics.breakdowns.by_material : [])}
                {renderBreakdown("By Inspection Method", analytics.breakdowns ? analytics.breakdowns.by_inspection_method : [])}
                {renderBreakdown("By Asset Type", analytics.breakdowns ? analytics.breakdowns.by_asset_type : [])}
                {renderBreakdown("By Damage Type", analytics.breakdowns ? analytics.breakdowns.by_damage_type : [])}
              </div>

              {/* Monthly Trend */}
              {analytics.monthly_trend && analytics.monthly_trend.length > 0 && (
                <div style={{ marginTop: "16px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Monthly Trend</div>
                  <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "80px" }}>
                    {analytics.monthly_trend.map(function(m) {
                      var maxCount = 1;
                      for (var ti = 0; ti < analytics.monthly_trend.length; ti++) {
                        if (analytics.monthly_trend[ti].count > maxCount) maxCount = analytics.monthly_trend[ti].count;
                      }
                      var barHeight = Math.max(4, Math.round((m.count / maxCount) * 70));
                      return (
                        <div key={m.month} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                          <div style={{ fontSize: "10px", color: "#e6edf3", marginBottom: "2px" }}>{m.count}</div>
                          <div style={{ width: "100%", height: barHeight + "px", background: "#238636", borderRadius: "3px 3px 0 0", minWidth: "20px" }}></div>
                          <div style={{ fontSize: "9px", color: "#8b949e", marginTop: "4px" }}>{m.month.substring(5)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!results && !analytics && (
            <div style={{ textAlign: "center", padding: "40px", color: "#8b949e" }}>
              <div style={{ fontSize: "14px" }}>Set filters and click Search or Run Analytics</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderBreakdown(title, items, colorFn) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ flex: "1 1 250px", minWidth: "220px" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>{title}</div>
      {items.slice(0, 8).map(function(item) {
        var total = 0;
        for (var ii = 0; ii < items.length; ii++) total += items[ii].count;
        var pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
        var barColor = colorFn ? colorFn(item.value) : "#3b82f6";
        return (
          <div key={item.value} style={{ marginBottom: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "2px" }}>
              <span style={{ color: "#e6edf3" }}>{item.value}</span>
              <span style={{ color: "#8b949e" }}>{item.count + " (" + pct + "%)"}</span>
            </div>
            <div style={{ height: "4px", background: "#21262d", borderRadius: "2px" }}>
              <div style={{ height: "4px", background: barColor, borderRadius: "2px", width: pct + "%" }}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
