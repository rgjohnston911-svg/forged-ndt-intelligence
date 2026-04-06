// PHOTO ANALYSIS ENGINE v1.3
// File: netlify/functions/photo-analysis.js
// NO TYPESCRIPT — PURE JAVASCRIPT
// v1.3: HIGH detail (frontend pre-resizes to 1024px) + rigorous senior inspector prompt

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

    // ================================================================
    // RIGOROUS SENIOR INSPECTOR PROMPT
    // ================================================================
    // Explicitly directs GPT-4o to look for what an experienced
    // inspector would check FIRST, not just describe the scene.

    var systemPrompt = "You are a senior NDT inspector and integrity engineer with 30+ years of field experience inspecting offshore platforms, refinery piping, pressure vessels, pipelines, and structural assets. " +
      "You have seen hundreds of failures and you know exactly what to look for in a field inspection photograph. " +
      "Your job is to perform a RIGOROUS visual inspection of the photograph - not a polite description. " +
      "An inspector who misses obvious damage indicators in a photograph could cause a catastrophic failure. " +
      "BE SKEPTICAL. BE THOROUGH. ASSUME DAMAGE IS PRESENT UNLESS YOU CAN AFFIRMATIVELY RULE IT OUT FROM THE IMAGE.";

    var userPromptText = "Perform a senior-level visual inspection of this photograph. ";
    if (assetType) userPromptText = userPromptText + "Asset type: " + assetType + ". ";
    if (serviceEnvironment) userPromptText = userPromptText + "Service environment: " + serviceEnvironment + ". ";
    if (contextTranscript) userPromptText = userPromptText + "Inspector field notes: " + contextTranscript + ". ";

    userPromptText = userPromptText + "\n\n" +
      "MANDATORY INSPECTION CHECKS - you MUST evaluate each of these explicitly:\n\n" +
      "1. STRUCTURAL ATTITUDE: Is the asset plumb and level? Look for lean, tilt, list, settling, foundation movement, or any deviation from designed vertical/horizontal alignment. On offshore structures, even a few degrees of lean is a CRITICAL finding indicating foundation, pile, or jacket failure.\n\n" +
      "2. ATMOSPHERIC CORROSION: Is there visible rust, scale, mill scale loss, paint failure, surface oxidation, or general weathering? Describe the severity (light/moderate/heavy/severe) and which surfaces are affected.\n\n" +
      "3. SPLASH ZONE / SUBMERGED ZONE (offshore/marine assets): Look for marine growth, accelerated corrosion at the waterline, spalling, exposed rebar, member loss, or missing wall thickness in the splash zone. This is the most critical inspection area on offshore assets.\n\n" +
      "4. STRUCTURAL DEFORMATION: Look for buckling, bending, denting, twisting, member misalignment, fractured connections, missing braces, or signs of impact damage.\n\n" +
      "5. COLOR PROGRESSION: Note any rust staining patterns, color gradients indicating corrosion progression, dark stains indicating leaks or process fluid release, or discoloration indicating thermal damage.\n\n" +
      "6. WELDS AND CONNECTIONS: Look at any visible welds, flanges, gussets, brace connections, or supports. Note cracking, distortion, or signs of stress.\n\n" +
      "7. APPURTENANCES: Note the condition of platforms, walkways, handrails, ladders, piping, vents, valves visible in the image.\n\n" +
      "8. GENERAL CONDITION: Compared to a new/well-maintained example of this asset type, how does this asset appear?\n\n" +
      "Return your assessment as a JSON object with these fields:\n" +
      "{\n" +
      '  "visible_damage": [array of specific observed damage indicators - one per item, be detailed],\n' +
      '  "structural_attitude": "PLUMB | LEANING | TILTED | UNKNOWN - and description of any deviation from vertical/horizontal",\n' +
      '  "corrosion_severity": "NONE | LIGHT | MODERATE | HEAVY | SEVERE",\n' +
      '  "corrosion_locations": [array of where corrosion is visible],\n' +
      '  "splash_zone_condition": "description if applicable, or N/A",\n' +
      '  "deformation_observed": "description of any deformation or NONE",\n' +
      '  "color_indicators": "rust staining patterns, leak stains, thermal discoloration",\n' +
      '  "welds_connections": "condition of visible welds and connections",\n' +
      '  "overall_condition": "NEW | GOOD | FAIR | DEGRADED | POOR | CRITICAL",\n' +
      '  "morphology": "overall damage pattern description",\n' +
      '  "extent": "rough estimate of affected area or extent",\n' +
      '  "geometric_features": [array of structural features visible],\n' +
      '  "image_quality": "ASSESSABLE | MARGINAL | INADEQUATE",\n' +
      '  "image_quality_reason": "brief explanation",\n' +
      '  "additional_inspection_needed": [array of specific NDE methods to follow up],\n' +
      '  "critical_findings": [array of any findings that warrant IMMEDIATE attention - leave empty if none],\n' +
      '  "confidence": "HIGH | MODERATE | LOW",\n' +
      '  "transcript_addendum": "factual sentence describing observations to append to inspection transcript - lead with most significant finding"\n' +
      "}\n\n" +
      "CRITICAL INSTRUCTIONS:\n" +
      "- Return ONLY valid JSON. No prose, no markdown fences, no commentary.\n" +
      "- Do NOT describe the asset as 'stable' or 'in good condition' unless you have explicitly verified plumbness, corrosion absence, and structural integrity.\n" +
      "- If you observe lean, tilt, heavy corrosion, deformation, or any concerning indicator - SAY SO EXPLICITLY in visible_damage and critical_findings.\n" +
      "- A senior inspector would rather flag a false positive than miss a real failure indicator.";

    var openaiPayload = {
      model: "gpt-4o",
      max_tokens: 1500,
      temperature: 0.1,
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

    // Native fetch with explicit timeout - frontend pre-resizes to 1024px so high detail fits in budget
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 9000);

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
          body: JSON.stringify({ error: "OpenAI request timed out (>9s). Image may be too large - check that frontend resize is working." })
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
      critical_findings: (analysis && analysis.critical_findings) || [],
      tokens_used: openaiResponse.usage ? openaiResponse.usage.total_tokens : 0,
      metadata: {
        engine: "photo-analysis",
        version: "1.3",
        model: "gpt-4o",
        detail_level: "high",
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
