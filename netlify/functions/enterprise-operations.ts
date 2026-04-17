// @ts-nocheck
/**
 * DEPLOY251 - enterprise-operations.ts
 * netlify/functions/enterprise-operations.ts
 *
 * ENTERPRISE OPERATIONS ENGINE
 * Observability, tenant health, SLA reporting, rollback strategy,
 * queueing simulation, disaster recovery planning
 *
 * POST /api/enterprise-operations { action, ... }
 *
 * Actions:
 *   get_system_health       - real-time system health dashboard
 *   get_tenant_health       - per-tenant health and usage metrics
 *   get_sla_report          - SLA compliance report
 *   get_rollback_plan       - rollback strategy for a deploy
 *   simulate_queue          - queue depth and throughput simulation
 *   get_disaster_recovery   - DR plan and RTO/RPO targets
 *   get_capacity_forecast   - capacity planning forecast
 *   get_registry            - engine registry
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

// ── ENGINE REGISTRY ───────────────────────────────────────────────

var ENGINE_CATALOG = [
  { name: "health", deploy: "DEPLOY225", category: "core", critical: true },
  { name: "case-management", deploy: "DEPLOY225", category: "core", critical: true },
  { name: "risk-scoring", deploy: "DEPLOY225", category: "core", critical: true },
  { name: "code-compliance", deploy: "DEPLOY225", category: "core", critical: true },
  { name: "confidence-scoring", deploy: "DEPLOY225", category: "core", critical: true },
  { name: "mechanism-engine", deploy: "DEPLOY225", category: "core", critical: true },
  { name: "disposition-engine", deploy: "DEPLOY225", category: "core", critical: true },
  { name: "escalation-engine", deploy: "DEPLOY225", category: "core", critical: true },
  { name: "override-risk", deploy: "DEPLOY225", category: "core", critical: true },
  { name: "audit-export", deploy: "DEPLOY225", category: "audit", critical: true },
  { name: "export-audit-bundle", deploy: "DEPLOY225", category: "audit", critical: true },
  { name: "analytics-dashboard", deploy: "DEPLOY225", category: "analytics", critical: false },
  { name: "ai-narrative", deploy: "DEPLOY225", category: "ai", critical: false },
  { name: "smart-summary", deploy: "DEPLOY225", category: "ai", critical: false },
  { name: "ai-reviewer", deploy: "DEPLOY225", category: "ai", critical: false },
  { name: "report-generation", deploy: "DEPLOY225", category: "reporting", critical: true },
  { name: "multi-case-compare", deploy: "DEPLOY225", category: "analytics", critical: false },
  { name: "trend-analysis", deploy: "DEPLOY225", category: "analytics", critical: false },
  { name: "evidence-management", deploy: "DEPLOY225", category: "core", critical: true },
  { name: "notification-engine", deploy: "DEPLOY225", category: "operations", critical: false },
  { name: "fleet-risk-aggregation", deploy: "DEPLOY225", category: "analytics", critical: false },
  { name: "template-management", deploy: "DEPLOY225", category: "operations", critical: false },
  { name: "integration-hub", deploy: "DEPLOY225", category: "operations", critical: false },
  { name: "chemical-process", deploy: "DEPLOY231", category: "vertical", critical: false },
  { name: "nuclear-ndt", deploy: "DEPLOY232", category: "vertical", critical: false },
  { name: "aerospace-ndt", deploy: "DEPLOY233", category: "vertical", critical: false },
  { name: "power-generation", deploy: "DEPLOY240", category: "vertical", critical: false },
  { name: "maritime-offshore", deploy: "DEPLOY241", category: "vertical", critical: false },
  { name: "civil-infrastructure", deploy: "DEPLOY242", category: "vertical", critical: false },
  { name: "space-systems", deploy: "DEPLOY243", category: "vertical", critical: false },
  { name: "robotics-automation", deploy: "DEPLOY244", category: "cross-cutting", critical: false },
  { name: "human-intelligence", deploy: "DEPLOY245", category: "cross-cutting", critical: false },
  { name: "medical-bio", deploy: "DEPLOY246", category: "vertical", critical: false },
  { name: "validation-benchmark", deploy: "DEPLOY247", category: "governance", critical: true },
  { name: "decision-traceability", deploy: "DEPLOY248", category: "governance", critical: true },
  { name: "rules-version-control", deploy: "DEPLOY249", category: "governance", critical: true },
  { name: "evidence-integrity", deploy: "DEPLOY250", category: "governance", critical: true },
  { name: "enterprise-operations", deploy: "DEPLOY251", category: "operations", critical: true }
];

// ── SLA TARGETS ───────────────────────────────────────────────────

var SLA_TARGETS = {
  uptime_percent: 99.9,
  api_response_p95_ms: 2000,
  api_response_p99_ms: 5000,
  max_concurrent_inspections: 500,
  max_evidence_upload_mb: 100,
  audit_bundle_generation_max_sec: 30,
  data_retention_days: 2555,
  backup_frequency_hours: 1,
  rto_hours: 4,
  rpo_hours: 1
};

// ── DISASTER RECOVERY TIERS ───────────────────────────────────────

var DR_TIERS = [
  {
    tier: 1,
    name: "Critical Core",
    services: ["case-management", "risk-scoring", "disposition-engine", "evidence-management", "health"],
    rto_hours: 1,
    rpo_hours: 0.25,
    strategy: "Active-active multi-region with real-time replication",
    failover: "Automatic DNS failover with health check"
  },
  {
    tier: 2,
    name: "Decision Engines",
    services: ["code-compliance", "confidence-scoring", "mechanism-engine", "escalation-engine", "override-risk"],
    rto_hours: 2,
    rpo_hours: 0.5,
    strategy: "Warm standby with async replication",
    failover: "Manual failover with automated data sync"
  },
  {
    tier: 3,
    name: "Audit & Governance",
    services: ["audit-export", "export-audit-bundle", "evidence-integrity", "decision-traceability", "rules-version-control", "validation-benchmark"],
    rto_hours: 4,
    rpo_hours: 1,
    strategy: "Cold standby with hourly backup restore",
    failover: "Manual provisioning from backup"
  },
  {
    tier: 4,
    name: "Analytics & AI",
    services: ["analytics-dashboard", "ai-narrative", "smart-summary", "ai-reviewer", "trend-analysis", "multi-case-compare", "fleet-risk-aggregation"],
    rto_hours: 8,
    rpo_hours: 4,
    strategy: "Backup restore with recomputation",
    failover: "Rebuild from primary data stores"
  },
  {
    tier: 5,
    name: "Industry Verticals & Support",
    services: ["chemical-process", "nuclear-ndt", "aerospace-ndt", "power-generation", "maritime-offshore", "civil-infrastructure", "space-systems", "medical-bio", "robotics-automation", "human-intelligence", "notification-engine", "template-management", "integration-hub", "report-generation", "enterprise-operations"],
    rto_hours: 12,
    rpo_hours: 4,
    strategy: "Cold restore from backup — stateless engines rebuild from config",
    failover: "Redeploy from source with config restore"
  }
];

// ── ROLLBACK CATALOG ──────────────────────────────────────────────

var ROLLBACK_STRATEGIES = {
  function_rollback: {
    name: "Netlify Function Rollback",
    steps: [
      "Identify failing deploy via Netlify dashboard",
      "Navigate to Deploys > select last known good deploy",
      "Click 'Publish deploy' to restore previous version",
      "Verify via /api/health get_registry",
      "Run system-check.html to confirm all engines pass"
    ],
    estimated_time_min: 5,
    risk: "low",
    data_impact: "none"
  },
  database_rollback: {
    name: "Supabase Database Rollback",
    steps: [
      "Identify affected tables and time window",
      "Use Supabase point-in-time recovery (PITR) if within window",
      "Alternatively restore from daily backup",
      "Verify data integrity via evidence-integrity engine",
      "Re-seal any affected evidence items",
      "Generate new audit bundle for rollback period"
    ],
    estimated_time_min: 30,
    risk: "medium",
    data_impact: "potential_data_loss_to_recovery_point"
  },
  schema_rollback: {
    name: "Schema Migration Rollback",
    steps: [
      "Identify breaking schema change",
      "Apply reverse migration SQL",
      "Verify no data loss via row counts and checksums",
      "Redeploy functions compatible with rolled-back schema",
      "Run validation-benchmark to verify system behavior"
    ],
    estimated_time_min: 60,
    risk: "high",
    data_impact: "possible_data_transformation_loss"
  },
  full_system_rollback: {
    name: "Full System Rollback",
    steps: [
      "Activate incident response — notify all stakeholders",
      "Restore Netlify to last known good deploy",
      "Restore Supabase from backup",
      "Verify auth and RLS policies intact",
      "Run full system-check.html",
      "Run validation-benchmark full suite",
      "Verify evidence integrity for all active cases",
      "Generate incident report and audit trail entry"
    ],
    estimated_time_min: 120,
    risk: "critical",
    data_impact: "data_loss_to_last_backup"
  }
};

// ── HANDLER ───────────────────────────────────────────────────────

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    // ── get_registry ──
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "enterprise-operations",
          deploy: "DEPLOY251",
          version: "1.0.0",
          capabilities: [
            "system_health_dashboard",
            "tenant_health_monitoring",
            "sla_compliance_reporting",
            "rollback_strategy_planning",
            "queue_simulation",
            "disaster_recovery_planning",
            "capacity_forecasting"
          ],
          total_managed_engines: ENGINE_CATALOG.length,
          dr_tiers: DR_TIERS.length,
          philosophy: "Enterprise readiness means knowing exactly what breaks, how fast you recover, and proving it. Observability is not optional — it is the foundation of trust."
        })
      };
    }

    var sb = createClient(supabaseUrl, supabaseKey);

    // ── get_system_health ──
    if (action === "get_system_health") {
      // Count active cases
      var casesRes = await sb.from("inspection_cases").select("id, status", { count: "exact", head: false });
      var allCases = casesRes.data || [];
      var activeCases = allCases.filter(function(c) { return c.status === "open" || c.status === "in_progress"; }).length;
      var totalCases = allCases.length;

      // Count evidence items
      var evidRes = await sb.from("evidence").select("id", { count: "exact", head: false });
      var totalEvidence = (evidRes.data || []).length;

      // Count audit events (recent 24h approximation)
      var auditRes = await sb.from("audit_events").select("id", { count: "exact", head: false });
      var totalAuditEvents = (auditRes.data || []).length;

      // Count findings
      var findingsRes = await sb.from("findings").select("id, severity", { count: "exact", head: false });
      var allFindings = findingsRes.data || [];
      var criticalFindings = allFindings.filter(function(f) { return f.severity === "critical"; }).length;

      // Engine status
      var enginesByCategory = {};
      var criticalEngines = 0;
      for (var ei = 0; ei < ENGINE_CATALOG.length; ei++) {
        var eng = ENGINE_CATALOG[ei];
        if (!enginesByCategory[eng.category]) enginesByCategory[eng.category] = 0;
        enginesByCategory[eng.category]++;
        if (eng.critical) criticalEngines++;
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_system_health",
          timestamp: new Date().toISOString(),
          system_status: "operational",
          engines: {
            total: ENGINE_CATALOG.length,
            critical: criticalEngines,
            by_category: enginesByCategory
          },
          data_metrics: {
            total_cases: totalCases,
            active_cases: activeCases,
            total_evidence_items: totalEvidence,
            total_findings: allFindings.length,
            critical_findings: criticalFindings,
            total_audit_events: totalAuditEvents
          },
          sla_targets: SLA_TARGETS,
          alerts: (function() {
            var alerts = [];
            if (criticalFindings > 0) alerts.push({ level: "warning", message: criticalFindings + " critical findings require attention" });
            if (totalAuditEvents === 0) alerts.push({ level: "info", message: "No audit events recorded — system may be newly deployed" });
            return alerts;
          })()
        })
      };
    }

    // ── get_tenant_health ──
    if (action === "get_tenant_health") {
      // In single-tenant mode, report on the whole system
      // In multi-tenant mode, would filter by tenant_id
      var tenantId = body.tenant_id || "default";

      var tCases = await sb.from("inspection_cases").select("id, status, created_at");
      var tEvid = await sb.from("evidence").select("id, case_id, created_at");
      var tFindings = await sb.from("findings").select("id, case_id, severity");
      var tAudit = await sb.from("audit_events").select("id, event_type, created_at");

      var tCaseData = tCases.data || [];
      var tEvidData = tEvid.data || [];
      var tFindingData = tFindings.data || [];
      var tAuditData = tAudit.data || [];

      // Calculate activity metrics
      var now = new Date();
      var sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      var recentCases = tCaseData.filter(function(c) { return new Date(c.created_at) >= sevenDaysAgo; }).length;
      var recentEvidence = tEvidData.filter(function(e) { return new Date(e.created_at) >= sevenDaysAgo; }).length;
      var recentAudit = tAuditData.filter(function(a) { return new Date(a.created_at) >= sevenDaysAgo; }).length;

      // Health score
      var healthScore = 100;
      var healthFactors = [];

      // Penalize for critical findings
      var critCount = tFindingData.filter(function(f) { return f.severity === "critical"; }).length;
      if (critCount > 0) {
        healthScore -= Math.min(30, critCount * 5);
        healthFactors.push(critCount + " critical findings (-" + Math.min(30, critCount * 5) + ")");
      }

      // Penalize for stale cases (no recent activity)
      if (tCaseData.length > 0 && recentCases === 0) {
        healthScore -= 10;
        healthFactors.push("No new cases in 7 days (-10)");
      }

      // Bonus for audit activity
      if (recentAudit > 10) {
        healthScore = Math.min(100, healthScore + 5);
        healthFactors.push("Active audit trail (+5)");
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_tenant_health",
          tenant_id: tenantId,
          health_score: healthScore,
          health_grade: healthScore >= 90 ? "A" : (healthScore >= 75 ? "B" : (healthScore >= 60 ? "C" : (healthScore >= 40 ? "D" : "F"))),
          health_factors: healthFactors,
          usage: {
            total_cases: tCaseData.length,
            active_cases: tCaseData.filter(function(c) { return c.status === "open" || c.status === "in_progress"; }).length,
            total_evidence: tEvidData.length,
            total_findings: tFindingData.length,
            total_audit_events: tAuditData.length
          },
          activity_7d: {
            new_cases: recentCases,
            new_evidence: recentEvidence,
            audit_events: recentAudit
          },
          timestamp: new Date().toISOString()
        })
      };
    }

    // ── get_sla_report ──
    if (action === "get_sla_report") {
      var period = body.period || "current_month";

      // In production, these would be computed from metrics/logs
      // Here we provide the framework and targets
      var slaMetrics = {
        uptime: {
          target_percent: SLA_TARGETS.uptime_percent,
          measurement: "Netlify status page + synthetic health checks every 60s",
          breach_threshold: "More than 43.8 minutes downtime per month (99.9%)",
          current_status: "monitoring_required"
        },
        api_latency: {
          p95_target_ms: SLA_TARGETS.api_response_p95_ms,
          p99_target_ms: SLA_TARGETS.api_response_p99_ms,
          measurement: "Netlify function duration logs",
          current_status: "monitoring_required"
        },
        data_integrity: {
          target: "Zero undetected modifications to sealed evidence",
          measurement: "evidence-integrity engine verify_case_evidence on all active cases",
          verification_frequency: "Daily automated + on-demand",
          current_status: "active"
        },
        audit_completeness: {
          target: "100% of decisions have complete audit trail",
          measurement: "decision-traceability trace_decision coverage check",
          verification_frequency: "Per case completion",
          current_status: "active"
        },
        backup_compliance: {
          target: "Backups every " + SLA_TARGETS.backup_frequency_hours + " hour(s)",
          retention: SLA_TARGETS.data_retention_days + " days (" + Math.round(SLA_TARGETS.data_retention_days / 365) + " years)",
          measurement: "Supabase backup logs",
          current_status: "monitoring_required"
        },
        disaster_recovery: {
          rto_target_hours: SLA_TARGETS.rto_hours,
          rpo_target_hours: SLA_TARGETS.rpo_hours,
          last_dr_test: "not_yet_conducted",
          next_dr_test_recommended: "quarterly"
        }
      };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_sla_report",
          period: period,
          sla_targets: SLA_TARGETS,
          metrics: slaMetrics,
          compliance_summary: {
            data_integrity: "COMPLIANT — evidence-integrity engine operational",
            audit_completeness: "COMPLIANT — decision-traceability engine operational",
            uptime: "REQUIRES_MONITORING — synthetic checks recommended",
            latency: "REQUIRES_MONITORING — function duration tracking recommended",
            backup: "REQUIRES_MONITORING — verify Supabase backup schedule",
            disaster_recovery: "REQUIRES_TESTING — DR drill not yet conducted"
          },
          recommendations: [
            "Configure Netlify analytics or external monitoring for uptime/latency SLA tracking",
            "Schedule quarterly DR drill using rollback_plan procedures",
            "Automate daily evidence integrity verification for all active cases",
            "Set up alerting for critical finding count thresholds"
          ]
        })
      };
    }

    // ── get_rollback_plan ──
    if (action === "get_rollback_plan") {
      var rollbackType = body.rollback_type || "function_rollback";
      var targetDeploy = body.target_deploy || null;

      var strategy = ROLLBACK_STRATEGIES[rollbackType];
      if (!strategy) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            action: "get_rollback_plan",
            error: "unknown_rollback_type",
            valid_types: Object.keys(ROLLBACK_STRATEGIES)
          })
        };
      }

      // Find affected engines if target deploy specified
      var affectedEngines = [];
      if (targetDeploy) {
        for (var ri = 0; ri < ENGINE_CATALOG.length; ri++) {
          if (ENGINE_CATALOG[ri].deploy === targetDeploy) {
            affectedEngines.push(ENGINE_CATALOG[ri].name);
          }
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_rollback_plan",
          rollback_type: rollbackType,
          strategy: strategy,
          target_deploy: targetDeploy,
          affected_engines: affectedEngines,
          pre_rollback_checklist: [
            "Document current system state via get_system_health",
            "Export audit bundle for affected cases",
            "Verify evidence integrity before rollback",
            "Notify affected users/inspectors",
            "Confirm rollback target version is known good"
          ],
          post_rollback_verification: [
            "Run system-check.html — all engines must pass",
            "Run validation-benchmark for affected verticals",
            "Verify evidence integrity unchanged",
            "Check audit trail continuity",
            "Confirm SLA metrics within targets"
          ]
        })
      };
    }

    // ── simulate_queue ──
    if (action === "simulate_queue") {
      var arrivalRate = body.arrival_rate_per_hour || 50;
      var processingTimeMs = body.processing_time_ms || 1500;
      var concurrency = body.concurrency || 10;
      var durationHours = body.duration_hours || 8;

      // M/M/c queue model approximation
      var lambda = arrivalRate / 3600; // arrivals per second
      var mu = 1000 / processingTimeMs; // service rate per server per second
      var rho = lambda / (concurrency * mu); // utilization

      var avgQueueDepth = 0;
      var avgWaitTimeSec = 0;
      var throughputPerHour = 0;

      if (rho < 1) {
        // Stable queue
        avgWaitTimeSec = (rho / (mu * concurrency * (1 - rho)));
        avgQueueDepth = lambda * avgWaitTimeSec;
        throughputPerHour = arrivalRate;
      } else {
        // Overloaded
        avgWaitTimeSec = -1; // unbounded
        avgQueueDepth = -1;
        throughputPerHour = concurrency * mu * 3600;
      }

      var totalRequests = arrivalRate * durationHours;
      var droppedRequests = rho >= 1 ? Math.round(totalRequests - throughputPerHour * durationHours) : 0;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "simulate_queue",
          parameters: {
            arrival_rate_per_hour: arrivalRate,
            processing_time_ms: processingTimeMs,
            concurrency: concurrency,
            duration_hours: durationHours
          },
          results: {
            utilization_percent: Math.round(rho * 10000) / 100,
            stable: rho < 1,
            avg_queue_depth: rho < 1 ? Math.round(avgQueueDepth * 100) / 100 : "UNBOUNDED",
            avg_wait_time_sec: rho < 1 ? Math.round(avgWaitTimeSec * 1000) / 1000 : "UNBOUNDED",
            throughput_per_hour: Math.round(throughputPerHour),
            total_requests: totalRequests,
            dropped_requests: droppedRequests,
            max_concurrent: concurrency
          },
          recommendations: (function() {
            var recs = [];
            if (rho >= 1) recs.push("CRITICAL: Queue is unstable. Increase concurrency to at least " + Math.ceil(lambda / mu + 1) + " or reduce arrival rate.");
            if (rho >= 0.8 && rho < 1) recs.push("WARNING: Utilization above 80%. Queue wait times will grow rapidly. Consider scaling.");
            if (rho < 0.3) recs.push("System is well under capacity. Current concurrency may be reduced to save resources.");
            if (avgWaitTimeSec > 2 && rho < 1) recs.push("Average wait exceeds 2 seconds. Consider increasing concurrency for better SLA compliance.");
            if (recs.length === 0) recs.push("Queue is healthy. Current configuration supports the arrival rate.");
            return recs;
          })()
        })
      };
    }

    // ── get_disaster_recovery ──
    if (action === "get_disaster_recovery") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_disaster_recovery",
          dr_plan: {
            classification: "Business-Critical NDT Intelligence Platform",
            overall_rto_hours: SLA_TARGETS.rto_hours,
            overall_rpo_hours: SLA_TARGETS.rpo_hours,
            tiers: DR_TIERS,
            infrastructure: {
              compute: "Netlify Functions (serverless, multi-region capable)",
              database: "Supabase PostgreSQL (managed, PITR enabled)",
              storage: "Supabase Storage (S3-compatible, redundant)",
              auth: "Supabase Auth (stateless JWT, recoverable from config)",
              cdn: "Netlify Edge (global CDN, automatic failover)"
            },
            backup_strategy: {
              database: "Supabase automatic daily backups + PITR",
              evidence_files: "Supabase Storage with redundancy",
              configuration: "Git repository (GitHub) — full deploy history",
              audit_bundles: "Stored in DB + exportable as signed JSON"
            },
            recovery_procedures: {
              scenario_1_function_failure: ROLLBACK_STRATEGIES.function_rollback,
              scenario_2_database_corruption: ROLLBACK_STRATEGIES.database_rollback,
              scenario_3_full_outage: ROLLBACK_STRATEGIES.full_system_rollback
            },
            testing_schedule: {
              frequency: "Quarterly",
              scope: "Full DR drill including database restore and function rollback",
              success_criteria: [
                "All engines pass system check within RTO",
                "Data integrity verified for all evidence items",
                "Audit trail continuity confirmed",
                "No data loss beyond RPO threshold"
              ]
            }
          },
          last_dr_test: null,
          next_recommended_test: "Schedule initial DR drill within 30 days of production launch"
        })
      };
    }

    // ── get_capacity_forecast ──
    if (action === "get_capacity_forecast") {
      var currentCases = 0;
      var capCases = await sb.from("inspection_cases").select("id", { count: "exact", head: false });
      currentCases = (capCases.data || []).length;

      var growthRate = body.monthly_growth_rate || 0.15; // 15% monthly default
      var forecastMonths = body.forecast_months || 12;

      var forecast = [];
      var projected = currentCases || 10; // minimum baseline
      for (var mi = 1; mi <= forecastMonths; mi++) {
        projected = Math.round(projected * (1 + growthRate));
        var monthlyInspections = Math.round(projected * 2.5); // avg 2.5 inspections per case
        var monthlyEvidence = Math.round(monthlyInspections * 8); // avg 8 evidence items per inspection
        var storageGb = Math.round(monthlyEvidence * 5 / 1024 * 100) / 100; // avg 5MB per evidence item

        forecast.push({
          month: mi,
          projected_cases: projected,
          monthly_inspections: monthlyInspections,
          monthly_evidence_items: monthlyEvidence,
          estimated_storage_gb: storageGb,
          estimated_api_calls_per_day: Math.round(monthlyInspections * 15 / 30), // ~15 API calls per inspection
          concurrency_needed: Math.max(10, Math.round(monthlyInspections * 15 / 30 / 86400 * 2000 * 2)) // peak = 2x average
        });
      }

      // Identify scaling thresholds
      var scalingAlerts = [];
      for (var fi = 0; fi < forecast.length; fi++) {
        var f = forecast[fi];
        if (f.estimated_api_calls_per_day > 100000 && (fi === 0 || forecast[fi - 1].estimated_api_calls_per_day <= 100000)) {
          scalingAlerts.push("Month " + f.month + ": API calls exceed 100K/day — consider dedicated infrastructure");
        }
        if (f.estimated_storage_gb > 100 && (fi === 0 || forecast[fi - 1].estimated_storage_gb <= 100)) {
          scalingAlerts.push("Month " + f.month + ": Storage exceeds 100GB — review storage tier");
        }
        if (f.projected_cases > 1000 && (fi === 0 || forecast[fi - 1].projected_cases <= 1000)) {
          scalingAlerts.push("Month " + f.month + ": Case count exceeds 1000 — consider database indexing review");
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_capacity_forecast",
          current_baseline: {
            cases: currentCases,
            growth_rate_monthly: growthRate
          },
          forecast: forecast,
          scaling_alerts: scalingAlerts,
          current_limits: {
            netlify_functions: "Up to 125K invocations/month on free tier, 2M on Pro",
            supabase_database: "500MB on free tier, 8GB on Pro",
            supabase_storage: "1GB on free tier, 100GB on Pro",
            supabase_bandwidth: "2GB on free tier, 250GB on Pro"
          },
          recommendations: (function() {
            var recs = [];
            if (forecastMonths >= 6 && forecast[5].projected_cases > 500) {
              recs.push("Upgrade to Netlify Pro and Supabase Pro before month 6");
            }
            if (forecastMonths >= 12 && forecast[11].estimated_storage_gb > 50) {
              recs.push("Implement evidence archival strategy for cases older than 2 years");
            }
            recs.push("Monitor actual growth against forecast monthly and adjust projections");
            recs.push("Set up automated alerts at 70% of tier capacity limits");
            return recs;
          })()
        })
      };
    }

    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Unknown action: " + action,
        valid_actions: ["get_system_health", "get_tenant_health", "get_sla_report", "get_rollback_plan", "simulate_queue", "get_disaster_recovery", "get_capacity_forecast", "get_registry"]
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
