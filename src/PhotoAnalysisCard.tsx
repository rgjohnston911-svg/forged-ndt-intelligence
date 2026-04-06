// PHOTO ANALYSIS ENGINE v1.1
// File: netlify/functions/photo-analysis.js
// NO TYPESCRIPT — PURE JAVASCRIPT
// v1.1: Uses native fetch (Node 18+) instead of require("https") to avoid ESM conflict

var handler = async function(event) {
  "use strict";

  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var imageBase64 = body.image_base64 || "";
    var imageMimeType = body.image_mime_type || "image/jpeg";
    var contextTranscript = body.context_transcript || "";
    var assetType = body.asset_type || "";
    var serviceEnvironment = body.service_environment || "";

    if (!imageBase64) {
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ error: "image_base64 is required" })
      };
    }

    var apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: headers,
        body: JSON.stringify({ error: "OPENAI_API_KEY not configured" })
      };
    }

    // Strip data URL prefix if present
    var cleanBase64 = imageBase64;
    if (cleanBase64.indexOf(",") >= 0) {
      cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
    }

    // Build the data URL for vision API
    var dataUrl = "data:" + imageMimeType + ";base64," + cleanBase64;

    // Construct the analysis prompt
    var systemPrompt = "You are a senior NDT inspector and integrity engineer with 30+ years of field experience. " +
      "You are analyzing a photograph from a field inspection. Your job is to extract OBSERVABLE damage indicators " +
      "and translate them into structured, physics-traceable inspection findings. " +
      "DO NOT speculate about causes. DO NOT diagnose mechanisms. ONLY describe what is visible in the image. " +
      "Use the language of an inspection report - precise, technical, bounded by observation.";

    var userPromptText = "Analyze this inspection photograph and extract all OBSERVABLE damage indicators. ";
    if (assetType) userPromptText = userPromptText + "Asset type: " + assetType + ". ";
    if (serviceEnvironment) userPromptText = userPromptText + "Service environment: " + serviceEnvironment + ". ";
    if (contextTranscript) userPromptText = userPromptText + "Inspector context: " + contextTranscript + ". ";

    userPromptText = userPromptText + "\n\nReturn your analysis as a JSON object with the following structure:\n" +
      "{\n" +
      '  "visible_damage": [list of observable damage indicators - be specific],\n' +
      '  "morphology": "description of damage pattern (pitting, general, localized, etc.)",\n' +
      '  "extent": "rough estimate of affected area or length",\n' +
      '  "color_indicators": "any color changes, deposits, staining visible",\n' +
      '  "surface_condition": "description of surface condition",\n' +
      '  "geometric_features": [welds, nozzles, supports, or other features visible],\n' +
      '  "measurement_references": [any visible scales, rulers, or reference objects],\n' +
      '  "image_quality": "ASSESSABLE | MARGINAL | INADEQUATE",\n' +
      '  "image_quality_reason": "why image is or is not adequate for assessment",\n' +
      '  "additional_inspection_needed": [list of specific NDE methods that should follow up],\n' +
      '  "confidence": "HIGH | MODERATE | LOW",\n' +
      '  "transcript_addendum": "concise sentence to append to inspection transcript - factual observations only"\n' +
      "}\n\n" +
      "CRITICAL: Return ONLY valid JSON. No prose, no markdown fences, no commentary. " +
      "If you cannot see damage clearly, set image_quality to INADEQUATE and explain why.";

    var openaiPayload = {
      model: "gpt-4o",
      max_tokens: 1500,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPromptText },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } }
          ]
        }
      ]
    };

    // Use native fetch (Node 18+)
    var openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify(openaiPayload)
    });

    if (!openaiRes.ok) {
      var errText = await openaiRes.text();
      return {
        statusCode: 500,
        headers: headers,
        body: JSON.stringify({
          error: "OpenAI API status " + openaiRes.status,
          detail: errText.substring(0, 500)
        })
      };
    }

    var openaiResponse = await openaiRes.json();

    // Extract and parse the analysis
    var rawContent = "";
    if (openaiResponse.choices && openaiResponse.choices[0] && openaiResponse.choices[0].message) {
      rawContent = openaiResponse.choices[0].message.content || "";
    }

    var analysis = null;
    var parseError = null;
    try {
      analysis = JSON.parse(rawContent);
    } catch (parseErr) {
      // Try stripping markdown fences
      var cleaned = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      try {
        analysis = JSON.parse(cleaned);
      } catch (parseErr2) {
        parseError = "Could not parse OpenAI response as JSON";
      }
    }

    if (parseError) {
      return {
        statusCode: 500,
        headers: headers,
        body: JSON.stringify({
          error: "Photo analysis parse error: " + parseError,
          raw_content: rawContent.substring(0, 1000)
        })
      };
    }

    var result = {
      ok: true,
      analysis: analysis,
      transcript_addendum: (analysis && analysis.transcript_addendum) || "",
      image_quality: (analysis && analysis.image_quality) || "UNKNOWN",
      confidence: (analysis && analysis.confidence) || "UNKNOWN",
      tokens_used: openaiResponse.usage ? openaiResponse.usage.total_tokens : 0,
      metadata: {
        engine: "photo-analysis",
        version: "1.1",
        model: "gpt-4o",
        timestamp: new Date().toISOString()
      }
    };

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify(result)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: "Photo analysis error: " + (err.message || String(err)) })
    };
  }
};

module.exports = { handler: handler };
