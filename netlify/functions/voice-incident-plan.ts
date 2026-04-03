// DEPLOY66b — voice-incident-plan.ts v4
// Fix: When LOCKED DETERMINISTIC CONTEXT is present, call GPT-4o to write
// readable prose from the chain data instead of running the old regex parser.
// Falls back to original parser if no locked context (backward compatible).
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

declare var process: any;
declare var require: any;
declare var Buffer: any;

var OPENAI_KEY = process.env.OPENAI_API_KEY || "";

var PROSE_SYSTEM_PROMPT = "You are a senior NDT inspection report writer. You will receive deterministic chain results from an automated inspection intelligence system, plus the original incident transcript.\n\n"
  + "YOUR JOB: Write a clear, professional, human-readable narrative summary that a field supervisor or inspection coordinator can act on immediately.\n\n"
  + "RULES:\n"
  + "1. Use the LOCKED DETERMINISTIC CONTEXT as your ONLY source of truth. Do NOT invent mechanisms, methods, or codes that are not in the chain data.\n"
  + "2. Write in clear professional prose. No JSON. No bullet points. No markdown formatting. Just readable paragraphs.\n"
  + "3. Structure: Start with a 1-2 sentence situation summary, then cover damage mechanisms, affected zones, recommended methods, code paths, and escalation timeline.\n"
  + "4. Include specific numbers (mechanisms count, zone count, method count) from the chain data.\n"
  + "5. If the chain identified a GO/NO-GO decision, state it prominently.\n"
  + "6. End with the most urgent action items.\n"
  + "7. Keep it under 400 words. Concise and actionable.\n"
  + "8. Write as if briefing a competent professional who needs to mobilize resources NOW.\n"
  + "9. Do NOT add disclaimers, hedging, or suggestions to 'consult an expert'. YOU are the expert.\n";


// ================================================================
// GPT-4o PROSE GENERATION — called when locked context is present
// ================================================================

async function generateProse(transcript: string): Promise<string> {
  if (!OPENAI_KEY) {
    return "AI narrative unavailable: No OPENAI_API_KEY configured.";
  }

  var https = require("https");

  var request_body = JSON.stringify({
    model: "gpt-4o",
    messages: [
      { role: "system", content: PROSE_SYSTEM_PROMPT },
      { role: "user", content: transcript }
    ],
    temperature: 0.3,
    max_tokens: 1500
  });

  var result: string = await new Promise(function(resolve, reject) {
    var options = {
      hostname: "api.openai.com",
      port: 443,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + OPENAI_KEY,
        "Content-Length": Buffer.byteLength(request_body)
      }
    };

    var req = https.request(options, function(res: any) {
      var chunks: any[] = [];
      res.on("data", function(chunk: any) { chunks.push(chunk); });
      res.on("end", function() { resolve(Buffer.concat(chunks).toString()); });
    });

    req.on("error", function(err: any) { reject(err); });
    req.setTimeout(50000, function() { req.destroy(new Error("Timeout")); });
    req.write(request_body);
    req.end();
  });

  var data = JSON.parse(result);

  if (data.choices && data.choices[0] && data.choices[0].message) {
    return (data.choices[0].message.content || "").trim();
  }

  if (data.error) {
    return "AI narrative error: " + (data.error.message || "Unknown");
  }

  return "AI narrative unavailable: No response from GPT-4o.";
}


/* ========================================================================
   LEGACY PARSER — kept for backward compatibility when no locked context
   ======================================================================== */

function lower(text: string): string { return text.toLowerCase().trim(); }

function includesAny(text: string, terms: string[]): boolean {
  for (var i = 0; i < terms.length; i++) { if (text.indexOf(terms[i]) !== -1) return true; }
  return false;
}

/* SPEECH CORRECTIONS */
var SPEECH_CORRECTIONS: Array<{ wrong: string; right: string }> = [
  { wrong: "wins ", right: "winds " },
  { wrong: "win speed", right: "wind speed" },
  { wrong: "steady wins", right: "steady winds" },
  { wrong: "sustained wins", right: "sustained winds" },
  { wrong: "gus ", right: "gust " },
  { wrong: "hearicane", right: "hurricane" },
  { wrong: "hurrican ", right: "hurricane " },
  { wrong: "tornato", right: "tornado" },
  { wrong: "waives", right: "waves" },
  { wrong: "wave hight", right: "wave height" },
  { wrong: "serge", right: "surge" },
  { wrong: "currant", right: "current" },
  { wrong: "hale", right: "hail" },
  { wrong: "lightening", right: "lightning" },
  { wrong: "earthquak", right: "earthquake" },
  { wrong: "earth quake", right: "earthquake" },
  { wrong: "corrision", right: "corrosion" },
  { wrong: "corrotion", right: "corrosion" },
  { wrong: "corosion", right: "corrosion" },
  { wrong: "crake", right: "crack" },
  { wrong: "coading", right: "coating" },
  { wrong: "codeing", right: "coating" },
  { wrong: "coating lost", right: "coating loss" },
  { wrong: "marine grow", right: "marine growth" },
  { wrong: "bio fouling", right: "biofouling" },
  { wrong: "plat form", right: "platform" },
  { wrong: "pipe line", right: "pipeline" },
  { wrong: "presure", right: "pressure" },
  { wrong: "pressure vestle", right: "pressure vessel" },
  { wrong: "pressure vessle", right: "pressure vessel" },
  { wrong: "sadel", right: "saddle" },
  { wrong: "sadle", right: "saddle" },
  { wrong: "off shore", right: "offshore" },
  { wrong: "sub sea", right: "subsea" },
  { wrong: "splash own", right: "splash zone" },
  { wrong: "miles per hour", right: "mph" },
  { wrong: "mile per hour", right: "mph" },
  { wrong: "miles an hour", right: "mph" },
  { wrong: "mile an hour", right: "mph" },
  { wrong: "feet waves", right: "ft waves" },
  { wrong: "foot waves", right: "ft waves" },
  { wrong: "it's a stained", right: "it sustained" },
  { wrong: "its a stained", right: "it sustained" },
  { wrong: "a stained", right: "sustained" },
  { wrong: "debree", right: "debris" },
  { wrong: "impacked", right: "impacted" },
  { wrong: "ancor", right: "anchor" },
  { wrong: "leek", right: "leak" },
  { wrong: "weld too", right: "weld toe" },
];

function correctSpeechErrors(raw: string): string {
  var text = raw;
  for (var i = 0; i < SPEECH_CORRECTIONS.length; i++) {
    var idx = text.toLowerCase().indexOf(SPEECH_CORRECTIONS[i].wrong);
    while (idx !== -1) {
      text = text.substring(0, idx) + SPEECH_CORRECTIONS[i].right + text.substring(idx + SPEECH_CORRECTIONS[i].wrong.length);
      idx = text.toLowerCase().indexOf(SPEECH_CORRECTIONS[i].wrong, idx + SPEECH_CORRECTIONS[i].right.length);
    }
  }
  return text;
}

function findAllNumbersWithUnits(text: string): any {
  var result: any = { wind_mph: null, impact_speed_mph: null, wave_height_ft: null, seismic_magnitude: null, diameter_ft: null, diameter_in: null, vessel_length_ft: null };
  var match;
  var mphPattern = /(\d+(?:\.\d+)?)\s*(?:mph|mile)/gi;
  var mphMatches: Array<{ value: number; index: number }> = [];
  while ((match = mphPattern.exec(text)) !== null) {
    mphMatches.push({ value: parseFloat(match[1]), index: match.index });
  }
  var ftWavePattern = /(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:wave|waves|surge|swell)/gi;
  while ((match = ftWavePattern.exec(text)) !== null) { result.wave_height_ft = parseFloat(match[1]); }
  var lt = lower(text);
  for (var m = 0; m < mphMatches.length; m++) {
    var val = mphMatches[m].value;
    var nearby = text.substring(Math.max(0, mphMatches[m].index - 60), mphMatches[m].index + 20).toLowerCase();
    if (includesAny(nearby, ["wind", "winds", "tornado", "hurricane", "gust", "sustained", "steady"])) {
      result.wind_mph = val;
    } else if (includesAny(nearby, ["truck", "car", "vehicle", "hit", "struck", "traveling", "travelling", "speed", "impact"])) {
      result.impact_speed_mph = val;
    } else {
      if (mphMatches.length === 1 && includesAny(lt, ["wind", "winds", "tornado", "hurricane", "storm"])) {
        result.wind_mph = val;
      } else if (mphMatches.length === 1 && includesAny(lt, ["hit", "struck", "truck", "car", "impact"])) {
        result.impact_speed_mph = val;
      } else {
        if (val >= 40 && !result.wind_mph) result.wind_mph = val;
        else if (!result.impact_speed_mph) result.impact_speed_mph = val;
      }
    }
  }
  if (!result.wave_height_ft) {
    var ftFallback = /(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)/gi;
    while ((match = ftFallback.exec(text)) !== null) {
      var nearbyW = text.substring(Math.max(0, match.index - 40), match.index + 30).toLowerCase();
      if (includesAny(nearbyW, ["wave", "waves", "surge", "swell", "sea"])) {
        result.wave_height_ft = parseFloat(match[1]);
      }
    }
  }
  return result;
}

function inferAssetType(text: string): string {
  if (includesAny(text, ["bridge support", "bridge pier", "concrete support"])) return "bridge_support";
  if (includesAny(text, ["gas pipeline", "pipeline", "gas line"])) return "gas_pipeline";
  if (includesAny(text, ["rudder"])) return "cargo_ship";
  if (includesAny(text, ["cargo ship", "ship", "vessel"])) return "cargo_ship";
  if (includesAny(text, ["pressure vessel", "vessel shell", "saddle"])) return "pressure_vessel";
  if (includesAny(text, ["oil platform", "offshore platform", "platform"])) return "offshore_platform";
  if (includesAny(text, ["storage tank", "tank farm"])) return "storage_tank";
  if (includesAny(text, ["pipe rack", "piping", "process piping"])) return "piping";
  return "unknown_asset";
}

function inferIntakePath(text: string): string {
  if (includesAny(text, ["found", "observed", "noticed", "crack", "corrosion", "dent", "leak", "coating loss"])) return "condition_driven";
  return "event_driven";
}

function parseTranscript(rawText: string): any {
  var corrected = correctSpeechErrors(rawText);
  var text = lower(corrected);
  var intake = inferIntakePath(text);
  var asset = inferAssetType(text);
  var nums = findAllNumbersWithUnits(text);
  return {
    raw_text: rawText,
    corrected_text: corrected !== rawText ? corrected : null,
    intake_path: intake,
    asset_type: asset,
    measured_values: { wind_mph: nums.wind_mph, impact_speed_mph: nums.impact_speed_mph, wave_height_ft: nums.wave_height_ft },
    confidence: asset !== "unknown_asset" ? 75 : 40
  };
}

function buildLegacyPlanSummary(p: any): string {
  var parts: string[] = [];
  parts.push("Legacy plan generated for " + (p.asset_type || "unknown asset").replace(/_/g, " ") + ".");
  parts.push("Intake path: " + (p.intake_path || "unknown").replace(/_/g, " ") + ".");
  if (p.measured_values) {
    if (p.measured_values.wind_mph) parts.push("Wind: " + p.measured_values.wind_mph + " mph.");
    if (p.measured_values.impact_speed_mph) parts.push("Impact speed: " + p.measured_values.impact_speed_mph + " mph.");
    if (p.measured_values.wave_height_ft) parts.push("Wave height: " + p.measured_values.wave_height_ft + " ft.");
  }
  parts.push("Note: This is the legacy parser output. The deterministic chain (Engines 1-7) provides the primary inspection intelligence.");
  return parts.join(" ");
}


/* ========================================================================
   HANDLER
   ======================================================================== */

var handler = async function(event: any): Promise<any> {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var transcript = body.transcript;
    if (!transcript || !transcript.trim()) {
      return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify({ error: "transcript is required" }) };
    }

    // ================================================================
    // NEW PATH: If locked deterministic context is present,
    // call GPT-4o to write prose from chain data.
    // This is the "demoted" role — AI writes prose, chain provides truth.
    // ================================================================
    if (transcript.indexOf("LOCKED DETERMINISTIC CONTEXT") !== -1) {
      try {
        var prose = await generateProse(transcript);
        return {
          statusCode: 200,
          headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true, plan: prose, mode: "prose_from_chain" })
        };
      } catch (proseErr: any) {
        return {
          statusCode: 200,
          headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true, plan: "AI narrative generation failed: " + (proseErr.message || "Unknown error"), mode: "prose_error" })
        };
      }
    }

    // ================================================================
    // LEGACY PATH: No locked context — run old parser (backward compat)
    // ================================================================
    var parsed = parseTranscript(transcript);
    var planText = buildLegacyPlanSummary(parsed);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, parsed: parsed, plan: planText, mode: "legacy_parser" }),
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message || "Unexpected error" })
    };
  }
};

export { handler };
