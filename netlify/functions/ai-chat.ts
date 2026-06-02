///////////////////////////////////////////////////////////////
// DEPLOY353 — AI Chat Backend
// 4D NDT Intelligence Platform
// Owner: Richard Johnston
// WHAT: Receives user chat messages, determines intent, routes
//       to appropriate engines based on tier, stores history,
//       returns AI-generated responses
// WHY:  Powers the mobile AI Assistant and AI Pro interfaces
//       for conversational inspection intelligence
///////////////////////////////////////////////////////////////

import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var anthropicKey = process.env.ANTHROPIC_API_KEY || "";
var siteUrl = process.env.URL || process.env.DEPLOY_URL || "https://4dndt.netlify.app";

// DEPLOY469 Tier 1A - auth-guard (top-level require per the contract: a bundling failure 500s the
// function rather than silently allowing). ai-chat fans out full-tier LLM calls, so it must never
// run for an anonymous caller and the tier must NEVER be read from the request body.
var authGuard = require("./auth-guard.cjs");
var CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
// Best-effort per-principal volume cap (defense-in-depth ON TOP of auth). In-memory => per warm
// instance only; auth is the real control. Bounds a single instance's burst from one principal.
var RL_WINDOW_MS = 60000; var RL_MAX = 30; var __rlHits: Record<string, number[]> = {};
function rateLimited(key: string): boolean {
  var now = Date.now();
  var arr = (__rlHits[key] || []).filter(function (t) { return now - t < RL_WINDOW_MS; });
  arr.push(now); __rlHits[key] = arr;
  return arr.length > RL_MAX;
}

var TIER_HIERARCHY: Record<string, number> = { assistant: 1, pro: 2, platform: 3 };

function hasTier(userTier: string, required: string): boolean {
  return (TIER_HIERARCHY[userTier] || 0) >= (TIER_HIERARCHY[required] || 999);
}

// ============================================================
// INTENT DETECTION — determine what the user is asking for
// ============================================================
type IntentResult = {
  intent: string;
  engine: string | null;
  params: Record<string, any>;
  confidence: number;
};

function detectIntent(message: string): IntentResult {
  var msg = message.toLowerCase().trim();

  // Formula calculations
  if (/(?:calculate|compute|what is|find)\s+(?:stress|strain|hoop|corrosion rate|remaining life|heat input|carbon equivalent|risk|uncertainty|pod|thickness)/i.test(msg)) {
    var formulaType = "general";
    if (/hoop\s*stress/i.test(msg)) formulaType = "hoop_stress";
    else if (/corrosion\s*rate/i.test(msg)) formulaType = "corrosion_rate";
    else if (/remaining\s*life/i.test(msg)) formulaType = "remaining_life";
    else if (/heat\s*input/i.test(msg)) formulaType = "heat_input";
    else if (/carbon\s*equiv/i.test(msg)) formulaType = "carbon_equivalent";
    else if (/stress/i.test(msg)) formulaType = "stress";
    else if (/strain/i.test(msg)) formulaType = "strain";
    else if (/thickness/i.test(msg)) formulaType = "ut_thickness";
    else if (/risk/i.test(msg)) formulaType = "risk";
    return { intent: "formula", engine: "formula-engine", params: { formula: formulaType, raw: msg }, confidence: 0.9 };
  }

  // Method capability questions
  if (/(?:which method|what method|can .+ detect|best method|ndt method|inspection method)\s/i.test(msg) ||
      /(?:paut|tofd|ut |mt |pt |rt |et |mfl|vt )\s/i.test(msg)) {
    return { intent: "method_capability", engine: "method-capability", params: { raw: msg }, confidence: 0.85 };
  }

  // Code reference lookups
  if (/(?:asme|api\s*\d|aws|dnv|norsok|astm|iso)\s/i.test(msg) ||
      /(?:code|standard|edition|clause|section)\s/i.test(msg)) {
    return { intent: "code_lookup", engine: "universal-code-authority", params: { raw: msg }, confidence: 0.85 };
  }

  // Damage mechanism questions
  if (/(?:damage mechanism|corrosion|cracking|fatigue|creep|erosion|htha|scc|mic|pitting|cui|hic|ssc)/i.test(msg)) {
    return { intent: "mechanism_info", engine: "differential-diagnosis", params: { raw: msg }, confidence: 0.8 };
  }

  // Physics sufficiency check
  if (/(?:physics|sufficient|adequate|can .+ find|will .+ detect|pod|probability of detection)/i.test(msg)) {
    return { intent: "physics_check", engine: "physics-sufficiency-engine", params: { raw: msg }, confidence: 0.8 };
  }

  // Full assessment request (Pro+ only)
  if (/(?:assess|evaluate|analyze|inspection plan|full analysis|comprehensive)/i.test(msg)) {
    return { intent: "full_assessment", engine: "comprehensive-assessment", params: { raw: msg }, confidence: 0.75 };
  }

  // Image analysis
  if (/(?:image|photo|picture|radiograph|weld image|analyze this)/i.test(msg)) {
    return { intent: "image_analysis", engine: "nde-image-analysis", params: { raw: msg }, confidence: 0.7 };
  }

  // Export / save / print
  if (/(?:export|save|print|pdf|word|document|report)/i.test(msg)) {
    return { intent: "export", engine: null, params: { raw: msg }, confidence: 0.8 };
  }

  // General question — use AI to answer from knowledge
  return { intent: "general_question", engine: null, params: { raw: msg }, confidence: 0.5 };
}

// ============================================================
// ENGINE ROUTER — call the right engine with the right params
// ============================================================
async function callEngine(engineName: string, params: any): Promise<any> {
  try {
    var response = await fetch(siteUrl + "/api/" + engineName, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    if (!response.ok) {
      return { error: "Engine returned " + response.status, engine: engineName };
    }
    return await response.json();
  } catch (err: any) {
    return { error: "Failed to reach engine: " + err.message, engine: engineName };
  }
}

// ============================================================
// AI RESPONSE GENERATOR — produce natural language response
// ============================================================
async function generateResponse(
  userMessage: string,
  intent: IntentResult,
  engineResult: any,
  userTier: string,
  conversationHistory: any[]
): Promise<string> {

  // Build context from engine result
  var engineContext = engineResult ? JSON.stringify(engineResult, null, 2) : "No engine was called.";

  var tierDescription = userTier === "assistant"
    ? "You are the AI Assistant (basic tier). You can help with formulas, method capabilities, code references, and basic physics checks. For full assessments, differential diagnosis, or advanced analysis, suggest the user upgrade to AI Pro."
    : userTier === "pro"
    ? "You are the AI Pro Assistant. You have access to full assessment pipelines, differential diagnosis, code authority, and advanced analysis. For fleet analytics and batch processing, suggest Platform tier."
    : "You are the Platform AI. You have full access to all 144 engines including fleet analytics, multi-asset analysis, and enterprise features.";

  var systemPrompt = `You are the 4D NDT Intelligence AI — a specialized assistant for Non-Destructive Testing, inspection engineering, and asset integrity management.

${tierDescription}

RULES:
1. Be precise and technical. Use correct engineering terminology.
2. Always cite the relevant code or standard when applicable.
3. If you performed a calculation, show the formula and values used.
4. If physics sufficiency is insufficient, explain WHY and recommend alternative methods.
5. Keep responses concise but complete. Mobile users need scannable answers.
6. If you don't know something, say so. Never fabricate inspection data.
7. Format numbers appropriately (2 decimal places for most, 4 for POD).
8. When discussing damage mechanisms, always mention applicable NDT methods.
9. If the user's question requires a higher tier, briefly explain what they'd get with an upgrade.
10. End technical responses with a clear conclusion or recommendation.

ENGINE RESULT (if available):
${engineContext}`;

  // Build message history
  var messages: any[] = [{ role: "system", content: systemPrompt }];

  // Add last 6 messages of conversation for context
  var recentHistory = conversationHistory.slice(-6);
  for (var i = 0; i < recentHistory.length; i++) {
    messages.push({
      role: recentHistory[i].role === "user" ? "user" : "assistant",
      content: recentHistory[i].content
    });
  }

  messages.push({ role: "user", content: userMessage });

  // Call Anthropic Claude for response generation
  try {
    var aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: messages.filter(function(m) { return m.role !== "system"; }),
        system: systemPrompt
      })
    });

    if (!aiResponse.ok) {
      var errText = await aiResponse.text();
      return "I encountered an issue generating a response. Error: " + aiResponse.status + ". Please try again.";
    }

    var aiData = await aiResponse.json();
    if (aiData.content && aiData.content.length > 0) {
      return aiData.content[0].text;
    }
    return "I wasn't able to generate a response. Please try rephrasing your question.";
  } catch (err: any) {
    return "Connection error: " + err.message + ". Please try again in a moment.";
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================
exports.handler = async function(event: any) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // DEPLOY469 Tier 1A - verified user/server key only; deny anonymous (kills uncapped anon spend).
  var auth = await authGuard.verifyAuth(event);
  if (!auth.ok) { return authGuard.denyResponse(auth, CORS); }
  // tier is derived server-side from the verified principal, NEVER from body.user_tier. Default to
  // the cheapest tier; wire profiles.tier here when that column exists. userId from the token.
  var verifiedTier = "assistant";
  var verifiedUserId = (auth.user && auth.user.id) ? auth.user.id : null;
  if (rateLimited(verifiedUserId || auth.principal || "srv")) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: "Rate limit exceeded; please slow down." }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "chat";

    // get_registry
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          engine: "ai-chat",
          version: "1.0.0",
          description: "Conversational AI interface for NDT inspection intelligence",
          capabilities: ["formula_calculation", "method_capability", "code_lookup", "mechanism_info", "physics_check", "full_assessment", "image_analysis", "export"],
          tiers: ["assistant", "pro", "platform"]
        })
      };
    }

    // chat — main conversation endpoint
    if (action === "chat") {
      var userMessage = body.message || "";
      var conversationId = body.conversation_id || null;
      var userTier = verifiedTier; // DEPLOY469: server-derived, never body
      var userId = verifiedUserId; // DEPLOY469: from verified token, never body

      if (!userMessage.trim()) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Message cannot be empty" })
        };
      }

      // 1. Detect intent
      var intent = detectIntent(userMessage);

      // 2. Check tier access for the detected engine
      var tierBlocked = false;
      var tierMessage = "";
      if (intent.engine) {
        if (intent.engine === "comprehensive-assessment" && !hasTier(userTier, "pro")) {
          tierBlocked = true;
          tierMessage = "Full assessments require AI Pro or higher. With AI Pro, you get access to differential diagnosis, classification engines, and code authority for defensible disposition decisions.";
        }
        if (intent.engine === "differential-diagnosis" && !hasTier(userTier, "pro")) {
          tierBlocked = true;
          tierMessage = "Differential diagnosis is available with AI Pro. It evaluates 143+ damage mechanisms across all industry domains.";
        }
        if (intent.engine === "nde-image-analysis" && !hasTier(userTier, "pro")) {
          // Assistant gets educational mode
          intent.params.tier = "basic";
        }
      }

      // 3. Call engine if applicable and allowed
      var engineResult: any = null;
      var engineCalls: any[] = [];
      if (intent.engine && !tierBlocked) {
        var engineParams: Record<string, any> = { action: "get_registry", ...intent.params };
        // For specific intents, format the engine call appropriately
        if (intent.intent === "code_lookup") {
          engineParams = { action: "lookup", query: userMessage };
        } else if (intent.intent === "physics_check") {
          engineParams = { action: "check", query: userMessage };
        }
        engineResult = await callEngine(intent.engine, engineParams);
        engineCalls.push({ engine: intent.engine, result_summary: engineResult ? "success" : "failed" });
      }

      // 4. Generate AI response
      var conversationHistory: any[] = [];
      if (conversationId && supabaseUrl && supabaseKey) {
        var sb = createClient(supabaseUrl, supabaseKey);
        var { data: history } = await sb
          .from("chat_messages")
          .select("role, content")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(10);
        if (history) conversationHistory = history;
      }

      var responseText: string;
      if (tierBlocked) {
        responseText = tierMessage;
      } else {
        responseText = await generateResponse(userMessage, intent, engineResult, userTier, conversationHistory);
      }

      // 5. Store in Supabase if user is authenticated
      var savedConversationId = conversationId;
      if (userId && supabaseUrl && supabaseKey) {
        var sb2 = createClient(supabaseUrl, supabaseKey);

        // Create conversation if new
        if (!savedConversationId) {
          var title = userMessage.length > 60 ? userMessage.substring(0, 57) + "..." : userMessage;
          var { data: newConv } = await sb2
            .from("conversations")
            .insert({ user_id: userId, title: title, tier: userTier })
            .select("id")
            .single();
          if (newConv) savedConversationId = newConv.id;
        }

        if (savedConversationId) {
          // Store user message
          await sb2.from("chat_messages").insert({
            conversation_id: savedConversationId,
            user_id: userId,
            role: "user",
            content: userMessage,
            metadata: { intent: intent.intent, engine: intent.engine }
          });

          // Store assistant response
          await sb2.from("chat_messages").insert({
            conversation_id: savedConversationId,
            user_id: userId,
            role: "assistant",
            content: responseText,
            metadata: { engine_calls: engineCalls, tier_blocked: tierBlocked },
            engine_calls: engineCalls
          });

          // Update conversation
          await sb2.from("conversations").update({
            message_count: conversationHistory.length + 2,
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq("id", savedConversationId);
        }

        // Track usage
        await sb2.from("usage_tracking").insert({
          user_id: userId,
          tier: userTier,
          endpoint: intent.engine || "ai-chat",
          action: intent.intent
        });
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          response: responseText,
          conversation_id: savedConversationId,
          intent: intent.intent,
          engine_used: intent.engine,
          tier_blocked: tierBlocked,
          confidence: intent.confidence
        })
      };
    }

    // list_conversations — get user's conversation history
    if (action === "list_conversations") {
      var userId2 = verifiedUserId; // DEPLOY469: verified token only (no IDOR via body.user_id)
      if (!userId2 || !supabaseUrl || !supabaseKey) {
        return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Authentication required" }) };
      }
      var sb3 = createClient(supabaseUrl, supabaseKey);
      var { data: convs, error: convErr } = await sb3
        .from("conversations")
        .select("id, title, tier, message_count, last_message_at, pinned, created_at")
        .eq("user_id", userId2)
        .eq("archived", false)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(50);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ conversations: convs || [], error: convErr?.message })
      };
    }

    // get_conversation — get messages for a conversation
    if (action === "get_conversation") {
      var convId = body.conversation_id;
      var userId3 = verifiedUserId; // DEPLOY469: verified token only (no IDOR via body.user_id)
      if (!convId || !userId3 || !supabaseUrl || !supabaseKey) {
        return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "conversation_id and user_id required" }) };
      }
      var sb4 = createClient(supabaseUrl, supabaseKey);
      var { data: msgs } = await sb4
        .from("chat_messages")
        .select("id, role, content, engine_calls, created_at")
        .eq("conversation_id", convId)
        .eq("user_id", userId3)
        .order("created_at", { ascending: true });
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ messages: msgs || [] })
      };
    }

    // get_usage — check daily/monthly usage
    if (action === "get_usage") {
      var userId4 = verifiedUserId; // DEPLOY469: from verified token
      var userTier3 = verifiedTier; // DEPLOY469: server-derived, never body
      if (!userId4 || !supabaseUrl || !supabaseKey) {
        return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Authentication required" }) };
      }
      var sb5 = createClient(supabaseUrl, supabaseKey);
      var today = new Date().toISOString().split("T")[0];
      var monthStart = today.substring(0, 7) + "-01";

      var { count: dailyCount } = await sb5
        .from("usage_tracking")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId4)
        .gte("called_at", today + "T00:00:00Z");

      var { count: monthlySuperbrain } = await sb5
        .from("usage_tracking")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId4)
        .eq("endpoint", "tri-model-reasoning")
        .gte("called_at", monthStart + "T00:00:00Z");

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          tier: userTier3,
          daily_queries: dailyCount || 0,
          monthly_superbrain: monthlySuperbrain || 0
        })
      };
    }

    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Unknown action. Use: get_registry, chat, list_conversations, get_conversation, get_usage" })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "AI chat error", detail: err.message })
    };
  }
};
