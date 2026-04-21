// PHOTO ANALYSIS ENGINE v1.4
// File: netlify/functions/photo-analysis.js
// NO TYPESCRIPT — PURE JAVASCRIPT
// v1.4: Universal asset-agnostic prompt — works for offshore, refinery, piping, tanks,
//       structural steel, concrete, buried pipelines, vessels, columns, exchangers, etc.

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
    // UNIVERSAL SENIOR INSPECTOR PROMPT — works for ALL asset types
    // ================================================================

    var systemPrompt = "You are a senior NDT inspector and integrity engineer with 30+ years of cross-industry field experience. " +
      "You inspect every kind of industrial asset: offshore platforms, refinery vessels, storage tanks, piping systems, pipelines, structural steel, " +
      "concrete structures, heat exchangers, distillation columns, reactors, fired heaters, rotating equipment housings, valves, supports, foundations. " +
      "You have seen catastrophic failures across every industry. You know that the same physics governs all of them. " +
      "Your job is to perform a RIGOROUS visual inspection of the photograph using universal inspection principles - " +
      "not a polite description. " +
      "BE SKEPTICAL. BE THOROUGH. ASSUME DAMAGE IS PRESENT UNLESS YOU CAN AFFIRMATIVELY RULE IT OUT FROM THE IMAGE. " +
      "An inspector who misses obvious damage indicators in a photograph could cause a catastrophic failure.";

    var userPromptText = "Perform a senior-level visual inspection of this photograph. ";
    if (assetType) userPromptText = userPromptText + "Operator-provided asset type: " + assetType + ". ";
    if (serviceEnvironment) userPromptText = userPromptText + "Service environment: " + serviceEnvironment + ". ";
    if (contextTranscript) userPromptText = userPromptText + "Inspector field notes: " + contextTranscript + ". ";

    userPromptText = userPromptText + "\n\n" +
      "PHASE 1 - ASSET IDENTIFICATION:\n" +
      "First, identify what the asset actually is from the image. State its asset class clearly: " +
      "is this a pressure vessel? Storage tank? Piping segment? Pipeline? Distillation column? Heat exchanger? " +
      "Offshore platform? Structural steel? Concrete structure? Foundation? Reactor? Compressor housing? Valve? Support? " +
      "Note its expected geometry (vertical, horizontal, inclined) and its expected position in space.\n\n" +

      "PHASE 2 - UNIVERSAL INSPECTION CHECKS:\n" +
      "These eight checks apply to EVERY asset type. You must evaluate each one explicitly.\n\n" +

      "CHECK 1 - GEOMETRIC INTEGRITY (this is the FIRST thing a senior inspector checks for ANY asset):\n" +
      "Is the asset where it is supposed to be in space? Is it plumb, level, aligned, and unsettled?\n" +
      "  - Vertical assets (columns, vessels, tanks, platforms, buildings, towers): Are they PLUMB? Any lean, tilt, or list?\n" +
      "  - Horizontal assets (vessels, exchangers, piping runs, bridges): Are they LEVEL? Any sag, droop, or settling?\n" +
      "  - Foundations and supports: Any settlement, displacement, foundation movement, void formation?\n" +
      "  - Linear assets (pipelines, conduits): Any misalignment, kinks, lateral displacement?\n" +
      "  - All assets: Has anything moved from its designed position?\n" +
      "REQUIRED: Identify a horizontal or vertical reference in the image to judge against. Use one of:\n" +
      "  - Waterline (offshore/marine)\n" +
      "  - Horizon line\n" +
      "  - Ground line / grade level\n" +
      "  - Adjacent buildings, structures, or known-vertical objects\n" +
      "  - Level platforms, decks, or floors in the image\n" +
      "State which reference you used. If NO reference is available, say so.\n" +
      "DO NOT assume apparent lean is camera angle. Camera tilt rotates the entire image including the reference. " +
      "If the asset is rotated relative to a horizontal reference that remains horizontal in the frame, the lean is REAL.\n" +
      "You must AFFIRMATIVELY VERIFY plumbness/levelness - do not assume it.\n\n" +

      "CHECK 2 - MATERIAL DEGRADATION:\n" +
      "Visible rust, oxidation, scale, mill scale loss, paint/coating failure, surface deterioration, spalling (concrete), " +
      "weathering, discoloration from corrosion. Severity scale: NONE | LIGHT | MODERATE | HEAVY | SEVERE. " +
      "Note locations on the asset. Note pattern: uniform, localized, pitted, undercutting, exfoliating.\n\n" +

      "CHECK 3 - CRITICAL INTERFACE ZONE:\n" +
      "Every asset has a most-aggressive-degradation zone where it meets its environment. Identify which one applies " +
      "to THIS asset and inspect it specifically:\n" +
      "  - Offshore/marine: splash zone, waterline, submerged jacket\n" +
      "  - Buried pipelines: air-to-soil interface at grade\n" +
      "  - Insulated equipment: under-insulation surfaces, insulation seam failures (CUI risk)\n" +
      "  - Storage tanks: floor-to-shell weld, foundation interface, chime area\n" +
      "  - Concrete structures: chloride exposure zones, rebar cover loss areas\n" +
      "  - Piping at supports: at the support contact point (water trap, crevice corrosion)\n" +
      "  - Vessels at saddle supports: at the saddle contact point\n" +
      "  - Heat exchangers: tube-to-tubesheet area, channel covers\n" +
      "  - Buried-to-above-grade transitions on any asset\n" +
      "  - Atmospheric assets: any horizontal surface where water pools\n" +
      "Name the critical interface for THIS asset and describe its condition.\n\n" +

      "CHECK 4 - STRUCTURAL DEFORMATION:\n" +
      "Bending, buckling, denting, twisting, distortion, member misalignment, fractured connections, " +
      "missing braces, impact damage, bowing, warping, ovality, bulging, swelling.\n\n" +

      "CHECK 5 - PROCESS / SERVICE INDICATORS:\n" +
      "Leak stains, weep marks, discharge marks, dark stains indicating product release, thermal discoloration, " +
      "deposits, fouling, frost patterns, ice formation, vapor plumes, condensate trails, " +
      "any sign of containment loss or process abnormality.\n\n" +

      "CHECK 6 - WELDS, JOINTS, AND CONNECTIONS:\n" +
      "Visible welds, flanges, bolted connections, gussets, anchor points, supports, hangers, " +
      "tie-ins, branch connections, brace-to-leg nodes. Look for cracking, distortion, missing bolts, " +
      "leaking gaskets, loose connections, fractured welds, signs of stress at concentration points.\n\n" +

      "CHECK 7 - APPURTENANCES AND SECONDARY COMPONENTS:\n" +
      "Instruments, valves, ladders, walkways, handrails, platforms, drains, vents, monitoring devices, " +
      "insulation jacketing, fireproofing, lighting, electrical conduit, cathodic protection equipment.\n\n" +

      "CHECK 8 - OVERALL CONDITION:\n" +
      "Compared to a NEW or well-maintained example of this asset type, how does this asset appear?\n\n" +

      "PHASE 3 - REPORT:\n" +
      "Return your assessment as a JSON object with these exact fields:\n" +
      "{\n" +
      '  "asset_identification": "specific asset class identified from the image",\n' +
      '  "expected_geometry": "vertical | horizontal | inclined | linear | irregular",\n' +
      '  "geometric_integrity": "PLUMB | LEANING | TILTED | SETTLED | MISALIGNED | LEVEL | SAGGING | UNKNOWN - description of any deviation",\n' +
      '  "geometric_reference_used": "what horizontal/vertical reference you used to judge geometric integrity",\n' +
      '  "material_degradation_severity": "NONE | LIGHT | MODERATE | HEAVY | SEVERE",\n' +
      '  "material_degradation_pattern": "uniform | localized | pitting | spalling | exfoliating | undercutting | none",\n' +
      '  "material_degradation_locations": [array of where degradation is visible on the asset],\n' +
      '  "critical_interface_zone": "name of the most critical interface zone for THIS asset type",\n' +
      '  "critical_interface_condition": "description of condition at that interface",\n' +
      '  "deformation_observed": "description of any bending/buckling/distortion or NONE",\n' +
      '  "process_indicators": "leak stains, thermal discoloration, deposits visible, or NONE",\n' +
      '  "welds_connections": "condition of visible welds, joints, and connections",\n' +
      '  "appurtenances": "condition of secondary components, instruments, walkways, etc",\n' +
      '  "overall_condition": "NEW | GOOD | FAIR | DEGRADED | POOR | CRITICAL",\n' +
      '  "visible_damage": [array of specific observed damage indicators - lead with most significant],\n' +
      '  "morphology": "overall damage pattern description",\n' +
      '  "extent": "rough estimate of affected area or extent",\n' +
      '  "geometric_features": [array of structural features visible],\n' +
      '  "image_quality": "ASSESSABLE | MARGINAL | INADEQUATE",\n' +
      '  "image_quality_reason": "brief explanation",\n' +
      '  "additional_inspection_needed": [array of specific NDE methods to follow up],\n' +
      '  "critical_findings": [array of findings that warrant IMMEDIATE attention - leave empty if none],\n' +
      '  "confidence": "HIGH | MODERATE | LOW",\n' +
      '  "transcript_addendum": "factual sentence describing observations - lead with most significant finding"\n' +
      "}\n\n" +
      "CRITICAL INSTRUCTIONS:\n" +
      "- Return ONLY valid JSON. No prose, no markdown fences, no commentary.\n" +
      "- Do NOT describe the asset as 'stable' or 'in good condition' unless you have explicitly verified geometric integrity, " +
      "material condition, and structural integrity using visible evidence.\n" +
      "- If you observe lean, tilt, settlement, deformation, heavy degradation, or any concerning indicator - " +
      "SAY SO EXPLICITLY in visible_damage AND critical_findings.\n" +
      "- A senior inspector would rather flag a false positive than miss a real failure indicator.\n" +
      "- The same universal principles apply whether you are looking at an offshore platform, a refinery vessel, " +
      "a buried pipeline, a storage tank, a concrete foundation, or a structural steel column.";

    var openaiPayload = {
      model: "gpt-4o",
      max_tokens: 2000,
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
        version: "1.4",
        model: "gpt-4o",
        detail_level: "high",
        prompt_type: "universal_asset_agnostic",
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
