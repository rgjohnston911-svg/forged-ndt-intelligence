///////////////////////////////////////////////////////////////
// DEPLOY353 — Tier Access Gate
// 4D NDT Intelligence Platform
// Owner: Richard Johnston
// WHAT: Middleware function that checks user tier, enforces
//       rate limits, and gates engine access
// WHY:  Three-tier model (Assistant / Pro / Platform) requires
//       centralized access control
///////////////////////////////////////////////////////////////

var TIER_HIERARCHY: Record<string, number> = {
  assistant: 1,
  pro: 2,
  platform: 3
};

var TIER_LIMITS: Record<string, {
  dailyQueries: number;
  monthlySuperbrain: number;
  maxCases: number;
  maxConversations: number;
  batchEnabled: boolean;
  apiAccess: boolean;
  imageAnalysis: boolean;
  exportPdf: boolean;
  exportDocx: boolean;
  fleetAnalytics: boolean;
}> = {
  assistant: {
    dailyQueries: 20,
    monthlySuperbrain: 0,
    maxCases: 0,
    maxConversations: 50,
    batchEnabled: false,
    apiAccess: false,
    imageAnalysis: false,
    exportPdf: true,
    exportDocx: false,
    fleetAnalytics: false
  },
  pro: {
    dailyQueries: 500,
    monthlySuperbrain: 10,
    maxCases: 100,
    maxConversations: -1,
    batchEnabled: false,
    apiAccess: false,
    imageAnalysis: true,
    exportPdf: true,
    exportDocx: true,
    fleetAnalytics: false
  },
  platform: {
    dailyQueries: -1,
    monthlySuperbrain: -1,
    maxCases: -1,
    maxConversations: -1,
    batchEnabled: true,
    apiAccess: true,
    imageAnalysis: true,
    exportPdf: true,
    exportDocx: true,
    fleetAnalytics: true
  }
};

// Engine → minimum tier mapping (in-memory for fast lookups)
var ENGINE_TIER_MAP: Record<string, { minTier: string; accessMode: string }> = {
  // Assistant tier (15 engines)
  "health": { minTier: "assistant", accessMode: "readonly" },
  "physics-sufficiency-engine": { minTier: "assistant", accessMode: "limited" },
  "universal-code-authority": { minTier: "assistant", accessMode: "readonly" },
  "live-code-authority": { minTier: "assistant", accessMode: "readonly" },
  "inspection-effectiveness-engine": { minTier: "assistant", accessMode: "limited" },
  "api-standards-authority": { minTier: "assistant", accessMode: "readonly" },
  "formula-engine": { minTier: "assistant", accessMode: "full" },
  "method-capability": { minTier: "assistant", accessMode: "full" },
  "risk-calculator": { minTier: "assistant", accessMode: "full" },

  // Pro tier
  "comprehensive-assessment": { minTier: "pro", accessMode: "full" },
  "differential-diagnosis": { minTier: "pro", accessMode: "full" },
  "decision-spine": { minTier: "pro", accessMode: "full" },
  "contradiction-engine": { minTier: "pro", accessMode: "full" },
  "evidence-contract-engine": { minTier: "pro", accessMode: "full" },
  "authority-lock-system": { minTier: "pro", accessMode: "full" },
  "weld-acceptance-authority": { minTier: "pro", accessMode: "full" },
  "coatings-intelligence-authority": { minTier: "pro", accessMode: "full" },
  "corrosion-loop": { minTier: "pro", accessMode: "full" },
  "fatigue-vibration-proof": { minTier: "pro", accessMode: "full" },
  "mechanism-causality-engine": { minTier: "pro", accessMode: "full" },
  "uncertainty-boundary-engine": { minTier: "pro", accessMode: "full" },
  "sour-service-corrosion": { minTier: "pro", accessMode: "full" },
  "mic-intelligence-engine": { minTier: "pro", accessMode: "full" },
  "cfi-engine": { minTier: "pro", accessMode: "full" },
  "repair-pathway-engine": { minTier: "pro", accessMode: "full" },
  "nde-image-analysis": { minTier: "pro", accessMode: "full" },
  "tri-model-reasoning": { minTier: "pro", accessMode: "limited" },

  // Platform tier
  "multi-asset-cascade": { minTier: "platform", accessMode: "full" },
  "interaction-mesh-core": { minTier: "platform", accessMode: "full" },
  "convergence-reporter": { minTier: "platform", accessMode: "full" },
  "root-cause-prevention": { minTier: "platform", accessMode: "full" },
  "executive-decision-engine": { minTier: "platform", accessMode: "full" },
  "neurosymbolic-reasoning": { minTier: "platform", accessMode: "full" },
  "batch-processing-gateway": { minTier: "platform", accessMode: "full" },
  "subsea-structures-orchestrator": { minTier: "platform", accessMode: "full" },
  "marine-vessel-orchestrator": { minTier: "platform", accessMode: "full" },
  "floating-platform-assessment": { minTier: "platform", accessMode: "full" },
  "regression-test-authority": { minTier: "platform", accessMode: "full" },
  "decision-proof-recorder": { minTier: "platform", accessMode: "full" }
};

function checkTierAccess(userTier: string, requiredTier: string): boolean {
  var userLevel = TIER_HIERARCHY[userTier] || 0;
  var requiredLevel = TIER_HIERARCHY[requiredTier] || 999;
  return userLevel >= requiredLevel;
}

function getEngineAccess(engineName: string, userTier: string): { allowed: boolean; mode: string; reason: string } {
  var mapping = ENGINE_TIER_MAP[engineName];
  if (!mapping) {
    // Default: platform-only for unmapped engines
    if (!checkTierAccess(userTier, "platform")) {
      return { allowed: false, mode: "none", reason: "This engine requires Platform tier access" };
    }
    return { allowed: true, mode: "full", reason: "Platform tier: full access" };
  }
  if (!checkTierAccess(userTier, mapping.minTier)) {
    var tierNames: Record<string, string> = {
      assistant: "AI Assistant",
      pro: "AI Pro Assistant",
      platform: "Platform"
    };
    return {
      allowed: false,
      mode: "none",
      reason: "This engine requires " + (tierNames[mapping.minTier] || mapping.minTier) + " tier or higher"
    };
  }
  return { allowed: true, mode: mapping.accessMode, reason: "Access granted" };
}

exports.handler = async function(event: any) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "check_access";

    // get_registry — describe the tier system
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          engine: "tier-gate",
          version: "1.0.0",
          description: "Three-tier access control for AI Assistant, AI Pro, and Platform",
          tiers: Object.keys(TIER_LIMITS).map(function(t) {
            return {
              tier: t,
              displayName: t === "assistant" ? "AI Assistant" : t === "pro" ? "AI Pro Assistant" : "Platform",
              limits: TIER_LIMITS[t],
              engineCount: Object.values(ENGINE_TIER_MAP).filter(function(e) {
                return checkTierAccess(t, e.minTier);
              }).length
            };
          })
        })
      };
    }

    // check_access — check if a user tier can access an engine
    if (action === "check_access") {
      var userTier = body.user_tier || "assistant";
      var engineName = body.engine_name || "";

      if (!engineName) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            tier: userTier,
            limits: TIER_LIMITS[userTier] || TIER_LIMITS.assistant,
            accessible_engines: Object.entries(ENGINE_TIER_MAP)
              .filter(function(entry) { return checkTierAccess(userTier, entry[1].minTier); })
              .map(function(entry) { return { engine: entry[0], mode: entry[1].accessMode }; })
          })
        };
      }

      var access = getEngineAccess(engineName, userTier);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          engine: engineName,
          user_tier: userTier,
          allowed: access.allowed,
          access_mode: access.mode,
          reason: access.reason
        })
      };
    }

    // check_rate_limit — check if user has exceeded daily/monthly limits
    if (action === "check_rate_limit") {
      var userTier2 = body.user_tier || "assistant";
      var limits = TIER_LIMITS[userTier2] || TIER_LIMITS.assistant;
      var dailyUsage = body.daily_usage || 0;
      var monthlySuperbrain = body.monthly_superbrain_usage || 0;

      var dailyOk = limits.dailyQueries === -1 || dailyUsage < limits.dailyQueries;
      var superbrainOk = limits.monthlySuperbrain === -1 || monthlySuperbrain < limits.monthlySuperbrain;

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          tier: userTier2,
          daily: {
            used: dailyUsage,
            limit: limits.dailyQueries,
            remaining: limits.dailyQueries === -1 ? "unlimited" : Math.max(0, limits.dailyQueries - dailyUsage),
            allowed: dailyOk
          },
          superbrain: {
            used: monthlySuperbrain,
            limit: limits.monthlySuperbrain,
            remaining: limits.monthlySuperbrain === -1 ? "unlimited" : Math.max(0, limits.monthlySuperbrain - monthlySuperbrain),
            allowed: superbrainOk
          },
          overall_allowed: dailyOk && superbrainOk,
          upgrade_message: !dailyOk
            ? "You've reached your daily query limit. Upgrade to " + (userTier2 === "assistant" ? "AI Pro" : "Platform") + " for more."
            : !superbrainOk
            ? "You've used all your Superbrain analyses this month. Upgrade to Platform for unlimited."
            : null
        })
      };
    }

    // get_tier_features — return what features a tier includes
    if (action === "get_tier_features") {
      var requestedTier = body.tier || "assistant";
      var tierLimits = TIER_LIMITS[requestedTier] || TIER_LIMITS.assistant;
      var engines = Object.entries(ENGINE_TIER_MAP)
        .filter(function(entry) { return checkTierAccess(requestedTier, entry[1].minTier); })
        .map(function(entry) { return { engine: entry[0], mode: entry[1].accessMode }; });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          tier: requestedTier,
          limits: tierLimits,
          engines: engines,
          engine_count: engines.length
        })
      };
    }

    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Unknown action. Use: get_registry, check_access, check_rate_limit, get_tier_features" })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Tier gate error", detail: err.message })
    };
  }
};
