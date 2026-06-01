// LLM PROXY v1.0 - File: netlify/functions/llm-proxy.js
// NO TYPESCRIPT - PURE JAVASCRIPT (var only, string concatenation, no template literals)
// ----------------------------------------------------------------------------
// Thin, auth-guarded chat-completion proxy used by the Phase-3 LLM hypothesis
// engine (src/lib/llmHypothesis.ts). It does NO prompt construction and NO
// schema work - that all lives in the testable TS lib. It only: authenticates,
// pins the model + temperature 0 (section 12 reproducibility floor), forwards
// the messages to OpenAI, and returns { content }. Keeping it this thin means
// the spend-bearing endpoint is small and the logic stays in the gated lib.
var authGuard = require("./auth-guard.cjs");

var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var ALLOWED_MODELS = { "gpt-4o": true };
var DEFAULT_MODEL = "gpt-4o";

var handler = async function (event) {
  if (event.httpMethod === "OPTIONS") { return { statusCode: 200, headers: CORS, body: "" }; }
  if (event.httpMethod !== "POST") { return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) }; }

  var auth = await authGuard.verifyAuth(event);
  if (!auth.ok) { return authGuard.denyResponse(auth, CORS); }

  var body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON body" }) }; }

  var messages = body.messages;
  if (!messages || Object.prototype.toString.call(messages) !== "[object Array]" || messages.length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "messages[] required" }) };
  }

  // Pin the model to the allow-list; temperature pinned to 0 unless explicitly 0..1.
  var model = (body.model && ALLOWED_MODELS[body.model]) ? body.model : DEFAULT_MODEL;
  var temperature = 0;
  if (typeof body.temperature === "number" && body.temperature >= 0 && body.temperature <= 1) { temperature = body.temperature; }

  var openaiKey = process.env.OPENAI_API_KEY || "";
  if (!openaiKey) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "OPENAI_API_KEY not configured" }) };
  }

  var payload = { model: model, temperature: temperature, messages: messages };
  if (body.response_format) { payload.response_format = body.response_format; }

  try {
    var resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + openaiKey },
      body: JSON.stringify(payload)
    });
    var data = await resp.json();
    if (!resp.ok) {
      var msg = (data && data.error && data.error.message) ? data.error.message : ("OpenAI error " + resp.status);
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: msg }) };
    }
    var content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ content: content, model: model, usage: data.usage || null })
    };
  } catch (e) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "LLM transport error: " + (e && e.message ? e.message : String(e)) }) };
  }
};

module.exports = { handler: handler };
