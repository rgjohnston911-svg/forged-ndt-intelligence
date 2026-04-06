// PHOTO ANALYSIS ENGINE v1.2
// File: netlify/functions/photo-analysis.js
// NO TYPESCRIPT — PURE JAVASCRIPT
// v1.2: detail "low" + reduced max_tokens to fit in 10s Netlify timeout

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

    var dataUrl = "data:" + imageMimeType + ";base64," + cleanBase64;

    // Shorter, more focused prompt to reduce tokens and time
    var systemPrompt = "You are a senior NDT inspector analyzing a field inspection photograph. " +
      "Extract OBSERVABLE damage indicators only. Do NOT speculate about causes or mechanisms. " +
      "Return only valid JSON, no markdown.";

    var userPromptText = "Analyze this inspection photo. ";
    if (assetType) userPromptText = userPromptText + "Asset: " + assetType + ". ";
    if (serviceEnvironment) userPromptText = userPromptText + "Service: " + serviceEnvironment + ". ";

    userPromptText = userPromptText + "Return JSON with these fields: " +
      "visible_damage (array of observed damage), " +
      "morphology (damage pattern description), " +
      "extent (rough affected area), " +
      "color_indicators (staining/deposits visible), " +
      "surface_condition (description), " +
      "geometric_features (array of welds/nozzles/supports visible), " +
      "image_quality (ASSESSABLE | MARGINAL | INADEQUATE), " +
      "additional_inspection_needed (array of NDE methods to follow up), " +
      "confidence (HIGH | MODERATE | LOW), " +
      "transcript_addendum (one factual sentence to append to inspection transcript).";

    var openaiPayload = {
      model: "gpt-4o",
      max_tokens: 800,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPromptText },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } }
          ]
        }
      ]
    };

    // Native fetch with explicit timeout via AbortController
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 8500); // 8.5s, under 10s Netlify limit

    var openaiRes;
    try {
      openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify(openaiPayload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === "AbortError") {
        return {
          statusCode: 504,
          headers: headers,
          body: JSON.stringify({ error: "OpenAI request timed out (>8.5s). Try a smaller image or simpler scene." })
        };
      }
      return {
        statusCode: 500,
        headers: headers,
        body: JSON.stringify({ error: "Fetch error: " + (fetchErr.message || String(fetchErr)) })
      };
    }

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

    var rawContent = "";
    if (openaiResponse.choices && openaiResponse.choices[0] && openaiResponse.choices[0].message) {
      rawContent = openaiResponse.choices[0].message.content || "";
    }

    var analysis = null;
    var parseError = null;
    try {
      analysis = JSON.parse(rawContent);
    } catch (parseErr) {
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
        version: "1.2",
        model: "gpt-4o",
        detail_level: "low",
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
