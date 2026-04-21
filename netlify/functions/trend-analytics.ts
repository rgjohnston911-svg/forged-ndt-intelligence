// @ts-nocheck
/**
 * DEPLOY229 - trend-analytics.ts
 * netlify/functions/trend-analytics.ts
 *
 * TREND ANALYTICS ENGINE
 *
 * POST /api/trend-analytics { action: "failure_trends", period, group_by }
 *   -> Failure rates over time, grouped by month/week/quarter
 *
 * POST /api/trend-analytics { action: "repeat_offenders" }
 *   -> Components/assets with multiple findings or cases
 *
 * POST /api/trend-analytics { action: "damage_trends", period }
 *   -> Which damage types are increasing/decreasing over time
 *
 * POST /api/trend-analytics { action: "method_effectiveness" }
 *   -> Inspection method stats: cases per method, override rates, confidence
 *
 * POST /api/trend-analytics { action: "confidence_trends", period }
 *   -> System confidence over time (is the system getting better?)
 *
 * POST /api/trend-analytics { action: "executive_summary" }
 *   -> High-level KPIs for management: total cases, trends, risk areas
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function groupByPeriod(dateStr, period) {
  if (!dateStr) return "unknown";
  if (period === "quarter") {
    var month = parseInt(dateStr.substring(5, 7), 10);
    var q = Math.ceil(month / 3);
    return dateStr.substring(0, 4) + "-Q" + q;
  }
  if (period === "week") {
    var d = new Date(dateStr);
    var jan1 = new Date(d.getFullYear(), 0, 1);
    var weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    var wStr = weekNum < 10 ? "0" + weekNum : "" + weekNum;
    return d.getFullYear() + "-W" + wStr;
  }
  // Default: month
  return dateStr.substring(0, 7);
}

function sortByKey(arr) {
  arr.sort(function(a, b) {
    if (a.period < b.period) return -1;
    if (a.period > b.period) return 1;
    return 0;
  });
  return arr;
}

function calcTrend(data) {
  if (!data || data.length < 2) return "insufficient_data";
  var recent = data[data.length - 1].count;
  var previous = data[data.length - 2].count;
  if (recent > previous * 1.2) return "increasing";
  if (recent < previous * 0.8) return "decreasing";
  return "stable";
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action;
    var period = body.period || "month"; // month, week, quarter
    var sb = createClient(supabaseUrl, supabaseKey);
    var startTime = Date.now();

    // ── ACTION: failure_trends ──
    if (action === "failure_trends") {
      var groupBy = body.group_by || "disposition"; // disposition, damage_type, material, asset_type

      var casesResult = await sb.from("inspection_cases").select("id, created_at, disposition, damage_type, material, asset_type, state, confidence").order("created_at", { ascending: true });
      if (casesResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: casesResult.error.message }) };

      var cases = casesResult.data || [];
      var periodData = {};

      for (var i = 0; i < cases.length; i++) {
        var c = cases[i];
        var pKey = groupByPeriod(c.created_at, period);
        if (!periodData[pKey]) periodData[pKey] = { total: 0, groups: {} };
        periodData[pKey].total++;

        var groupVal = c[groupBy] || "unknown";
        if (!periodData[pKey].groups[groupVal]) periodData[pKey].groups[groupVal] = 0;
        periodData[pKey].groups[groupVal]++;
      }

      var trendArr = [];
      var periodKeys = Object.keys(periodData).sort();
      for (var pk = 0; pk < periodKeys.length; pk++) {
        trendArr.push({
          period: periodKeys[pk],
          total: periodData[periodKeys[pk]].total,
          breakdown: periodData[periodKeys[pk]].groups
        });
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          trend: trendArr,
          group_by: groupBy,
          period: period,
          overall_trend: calcTrend(trendArr),
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: repeat_offenders ──
    if (action === "repeat_offenders") {
      var repResult = await sb.from("inspection_cases").select("id, component_name, asset_type, material, damage_type, disposition, created_at");
      if (repResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: repResult.error.message }) };

      var repCases = repResult.data || [];
      var componentCounts = {};
      var assetCounts = {};

      for (var ri = 0; ri < repCases.length; ri++) {
        var rc = repCases[ri];

        // Track by component
        var comp = rc.component_name || "unknown";
        if (!componentCounts[comp]) componentCounts[comp] = { count: 0, cases: [], damage_types: {}, dispositions: {} };
        componentCounts[comp].count++;
        componentCounts[comp].cases.push({ id: rc.id, date: rc.created_at, disposition: rc.disposition });
        var rdt = rc.damage_type || "unknown";
        componentCounts[comp].damage_types[rdt] = (componentCounts[comp].damage_types[rdt] || 0) + 1;
        var rdisp = rc.disposition || "unknown";
        componentCounts[comp].dispositions[rdisp] = (componentCounts[comp].dispositions[rdisp] || 0) + 1;

        // Track by asset type
        var at = rc.asset_type || "unknown";
        if (!assetCounts[at]) assetCounts[at] = { count: 0, damage_types: {} };
        assetCounts[at].count++;
        assetCounts[at].damage_types[rdt] = (assetCounts[at].damage_types[rdt] || 0) + 1;
      }

      // Filter to repeat offenders (2+ cases)
      var repeatComponents = [];
      var compKeys = Object.keys(componentCounts);
      for (var cki = 0; cki < compKeys.length; cki++) {
        if (componentCounts[compKeys[cki]].count >= 2) {
          repeatComponents.push({
            component: compKeys[cki],
            case_count: componentCounts[compKeys[cki]].count,
            damage_types: componentCounts[compKeys[cki]].damage_types,
            dispositions: componentCounts[compKeys[cki]].dispositions,
            recent_cases: componentCounts[compKeys[cki]].cases.slice(-5)
          });
        }
      }
      repeatComponents.sort(function(a, b) { return b.case_count - a.case_count; });

      var repeatAssets = [];
      var atKeys = Object.keys(assetCounts);
      for (var aki = 0; aki < atKeys.length; aki++) {
        repeatAssets.push({
          asset_type: atKeys[aki],
          case_count: assetCounts[atKeys[aki]].count,
          damage_types: assetCounts[atKeys[aki]].damage_types
        });
      }
      repeatAssets.sort(function(a, b) { return b.case_count - a.case_count; });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          repeat_components: repeatComponents.slice(0, 20),
          asset_type_summary: repeatAssets.slice(0, 20),
          total_components_tracked: compKeys.length,
          components_with_repeats: repeatComponents.length,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: damage_trends ──
    if (action === "damage_trends") {
      var dmgResult = await sb.from("inspection_cases").select("damage_type, created_at").not("damage_type", "is", null).order("created_at", { ascending: true });
      if (dmgResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: dmgResult.error.message }) };

      var dmgCases = dmgResult.data || [];
      var dmgByPeriod = {};
      var allDamageTypes = {};

      for (var di = 0; di < dmgCases.length; di++) {
        var dc = dmgCases[di];
        var dPeriod = groupByPeriod(dc.created_at, period);
        var dType = dc.damage_type;
        allDamageTypes[dType] = true;

        if (!dmgByPeriod[dPeriod]) dmgByPeriod[dPeriod] = {};
        dmgByPeriod[dPeriod][dType] = (dmgByPeriod[dPeriod][dType] || 0) + 1;
      }

      var dmgPeriodKeys = Object.keys(dmgByPeriod).sort();
      var dmgTrend = [];
      for (var dpi = 0; dpi < dmgPeriodKeys.length; dpi++) {
        dmgTrend.push({
          period: dmgPeriodKeys[dpi],
          types: dmgByPeriod[dmgPeriodKeys[dpi]]
        });
      }

      // Calculate per-type trends
      var typeAnalysis = {};
      var dtKeys = Object.keys(allDamageTypes);
      for (var dti = 0; dti < dtKeys.length; dti++) {
        var dtk = dtKeys[dti];
        var dtSeries = [];
        for (var dsi = 0; dsi < dmgPeriodKeys.length; dsi++) {
          dtSeries.push({ period: dmgPeriodKeys[dsi], count: dmgByPeriod[dmgPeriodKeys[dsi]][dtk] || 0 });
        }
        typeAnalysis[dtk] = { series: dtSeries, trend: calcTrend(dtSeries) };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          timeline: dmgTrend,
          type_analysis: typeAnalysis,
          period: period,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: method_effectiveness ──
    if (action === "method_effectiveness") {
      var methResult = await sb.from("inspection_cases").select("inspection_method, confidence, inspector_override_active, adjudication_count, disposition, state");
      if (methResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: methResult.error.message }) };

      var methCases = methResult.data || [];
      var methodStats = {};

      for (var mi = 0; mi < methCases.length; mi++) {
        var mc = methCases[mi];
        var method = mc.inspection_method || "unknown";
        if (!methodStats[method]) {
          methodStats[method] = { total: 0, confidence_sum: 0, confidence_count: 0, overrides: 0, adjudicated: 0, dispositions: {} };
        }
        methodStats[method].total++;
        if (mc.confidence !== null && mc.confidence !== undefined) {
          methodStats[method].confidence_sum += mc.confidence;
          methodStats[method].confidence_count++;
        }
        if (mc.inspector_override_active) methodStats[method].overrides++;
        if (mc.adjudication_count && mc.adjudication_count > 0) methodStats[method].adjudicated++;
        var mDisp = mc.disposition || "unknown";
        methodStats[method].dispositions[mDisp] = (methodStats[method].dispositions[mDisp] || 0) + 1;
      }

      var methodArr = [];
      var mKeys = Object.keys(methodStats);
      for (var mki = 0; mki < mKeys.length; mki++) {
        var ms = methodStats[mKeys[mki]];
        methodArr.push({
          method: mKeys[mki],
          total_cases: ms.total,
          avg_confidence: ms.confidence_count > 0 ? Math.round((ms.confidence_sum / ms.confidence_count) * 1000) / 1000 : null,
          override_rate: ms.total > 0 ? Math.round((ms.overrides / ms.total) * 1000) / 10 : 0,
          review_rate: ms.total > 0 ? Math.round((ms.adjudicated / ms.total) * 1000) / 10 : 0,
          dispositions: ms.dispositions
        });
      }
      methodArr.sort(function(a, b) { return b.total_cases - a.total_cases; });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ methods: methodArr, response_ms: Date.now() - startTime }, null, 2)
      };
    }

    // ── ACTION: confidence_trends ──
    if (action === "confidence_trends") {
      var confResult = await sb.from("inspection_cases").select("confidence, created_at").not("confidence", "is", null).order("created_at", { ascending: true });
      if (confResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: confResult.error.message }) };

      var confCases = confResult.data || [];
      var confByPeriod = {};

      for (var ci2 = 0; ci2 < confCases.length; ci2++) {
        var cc2 = confCases[ci2];
        var cPeriod = groupByPeriod(cc2.created_at, period);
        if (!confByPeriod[cPeriod]) confByPeriod[cPeriod] = { sum: 0, count: 0, min: 1, max: 0 };
        confByPeriod[cPeriod].sum += cc2.confidence;
        confByPeriod[cPeriod].count++;
        if (cc2.confidence < confByPeriod[cPeriod].min) confByPeriod[cPeriod].min = cc2.confidence;
        if (cc2.confidence > confByPeriod[cPeriod].max) confByPeriod[cPeriod].max = cc2.confidence;
      }

      var confTrend = [];
      var cpKeys = Object.keys(confByPeriod).sort();
      for (var cpi = 0; cpi < cpKeys.length; cpi++) {
        var cp = confByPeriod[cpKeys[cpi]];
        confTrend.push({
          period: cpKeys[cpi],
          avg_confidence: Math.round((cp.sum / cp.count) * 1000) / 1000,
          min_confidence: Math.round(cp.min * 1000) / 1000,
          max_confidence: Math.round(cp.max * 1000) / 1000,
          case_count: cp.count
        });
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          trend: confTrend,
          period: period,
          overall_direction: calcTrend(confTrend.map(function(t) { return { period: t.period, count: Math.round(t.avg_confidence * 100) }; })),
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: executive_summary ──
    if (action === "executive_summary") {
      // Load all cases
      var execResult = await sb.from("inspection_cases").select("*");
      if (execResult.error) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: execResult.error.message }) };
      var allCases = execResult.data || [];

      var now = Date.now();
      var thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      var sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

      var total = allCases.length;
      var last30 = 0;
      var prev30 = 0;
      var openCases = 0;
      var overrideCount = 0;
      var confSum = 0;
      var confCount = 0;
      var criticalCount = 0;
      var dispositionCounts = {};
      var damageTypeCounts = {};

      for (var ei = 0; ei < allCases.length; ei++) {
        var ec = allCases[ei];
        var ecTime = new Date(ec.created_at).getTime();

        if (ecTime >= thirtyDaysAgo) last30++;
        else if (ecTime >= sixtyDaysAgo) prev30++;

        if (ec.status === "open" || ec.status === "in_progress") openCases++;
        if (ec.inspector_override_active) overrideCount++;
        if (ec.confidence !== null && ec.confidence !== undefined) { confSum += ec.confidence; confCount++; }

        var ecState = (ec.state || "").toLowerCase();
        if (ecState.indexOf("critical") >= 0 || ecState.indexOf("immediate") >= 0) criticalCount++;

        var eDisp = ec.disposition || "unknown";
        dispositionCounts[eDisp] = (dispositionCounts[eDisp] || 0) + 1;

        var eDmg = ec.damage_type || "unknown";
        damageTypeCounts[eDmg] = (damageTypeCounts[eDmg] || 0) + 1;
      }

      // Load escalation stats
      var escStats = { open: 0, overdue: 0 };
      var escResult = await sb.from("escalation_queue").select("status, deadline").in("status", ["open", "assigned", "in_review"]);
      if (!escResult.error && escResult.data) {
        escStats.open = escResult.data.length;
        for (var esi = 0; esi < escResult.data.length; esi++) {
          if (escResult.data[esi].deadline && new Date(escResult.data[esi].deadline).getTime() < now) {
            escStats.overdue++;
          }
        }
      }

      var caseVelocity = prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : null;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          summary: {
            total_cases: total,
            open_cases: openCases,
            cases_last_30_days: last30,
            case_velocity_pct: caseVelocity,
            critical_cases: criticalCount,
            avg_confidence: confCount > 0 ? Math.round((confSum / confCount) * 1000) / 1000 : null,
            override_rate: total > 0 ? Math.round((overrideCount / total) * 1000) / 10 : 0,
            escalations_open: escStats.open,
            escalations_overdue: escStats.overdue,
            top_dispositions: dispositionCounts,
            top_damage_types: damageTypeCounts
          },
          generated_at: new Date().toISOString(),
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Valid: failure_trends, repeat_offenders, damage_trends, method_effectiveness, confidence_trends, executive_summary" }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
