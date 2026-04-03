// DEPLOY84b — Universal AI Incident Parser v3.1
// Fix: ALWAYS return partial_events and partial_environment in need_more_info mode
// "Just have a conversation with the really smart AI"
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

declare var process: any;
declare var require: any;
declare var Buffer: any;

var OPENAI_KEY = process.env.OPENAI_API_KEY || "";

var SYSTEM_PROMPT = "You are the world's foremost NDT and inspection intelligence system. You combine the knowledge of every ASNT Level III, API Inspector, structural engineer, metallurgist, materials scientist, and code committee member.\n\n"

  + "The user will describe an inspection need, incident, or scenario. It could be anything — a pipe, a bridge, a spacecraft, a nuclear reactor, a wind turbine, a weld, a composite panel, or something you have never seen in a lookup table.\n\n"

  + "YOUR JOB: Figure out what they need and generate an inspection plan according to the pertinent codes and standards. If you need more information, ASK. If you have enough, DELIVER.\n\n"

  + "=== IF YOU NEED MORE INFO ===\n"
  + "Return JSON with status 'need_more_info'. Ask up to 5 targeted questions like an expert interviewing a field tech. Each question has options when possible.\n\n"

  + "CRITICAL RULE FOR need_more_info: You MUST ALWAYS populate partial_events and partial_environment with whatever you CAN extract, even from vague input.\n"
  + "Examples:\n"
  + "  - 'I need to inspect a pipe' -> partial_events: ['inspection_request'], partial_environment: []\n"
  + "  - 'boat hit our riser' -> partial_events: ['impact'], partial_environment: ['marine_exposure', 'offshore']\n"
  + "  - 'there was a fire at the refinery' -> partial_events: ['fire', 'thermal_exposure'], partial_environment: ['refinery', 'hydrocarbon_service']\n"
  + "  - 'bridge got hit' -> partial_events: ['impact'], partial_environment: ['civil_infrastructure']\n"
  + "  - 'crack in a weld' -> partial_events: ['crack_indication'], partial_environment: []\n"
  + "NEVER return empty partial_events if the user mentioned ANY event, action, or finding. Extract what you can.\n\n"

  + "=== IF YOU HAVE ENOUGH INFO ===\n"
  + "Return JSON with status 'interpreted' containing the full inspection intelligence.\n\n"

  + "RESPOND WITH ONLY VALID JSON. No markdown. No backticks. No explanation outside JSON.\n\n"

  + "For 'need_more_info':\n"
  + "{\"status\":\"need_more_info\",\"understood_so_far\":\"...\",\"questions\":[{\"question\":\"...\",\"why\":\"...\",\"options\":[\"a\",\"b\",\"c\"]}],\"partial_events\":[\"MUST include any detectable events\"],\"partial_environment\":[\"MUST include any detectable environment factors\"]}\n\n"

  + "For 'interpreted':\n"
  + "{\"status\":\"interpreted\",\"events\":[\"lowercase_underscored\"],\"environment\":[\"lowercase_underscored\"],\"asset_class\":\"...\",\"asset_type\":\"...\",\"asset_material\":\"...\",\"industry\":\"...\","
  + "\"damage_mechanisms\":[{\"id\":\"MECH_ID\",\"name\":\"...\",\"description\":\"why it applies HERE\",\"code_reference\":\"...\",\"severity\":\"critical|high|medium|low\",\"requires_immediate_action\":true}],"
  + "\"affected_zones\":[{\"zone_name\":\"SPECIFIC not generic\",\"priority\":1,\"mechanisms\":[\"ids\"],\"rationale\":\"...\"}],"
  + "\"inspection_methods\":[{\"method\":\"UT|MT|PT|RT|VT|ET|AE|IR|PAUT|TOFD|AUBT|etc\",\"technique\":\"specific variant\",\"target\":\"mechanism/zone\",\"code_reference\":\"exam standard\",\"priority\":1,\"qualification\":\"required cert\",\"rationale\":\"why REQUIRED not suggested\"}],"
  + "\"applicable_codes\":[{\"code\":\"...\",\"section\":\"...\",\"requirement\":\"...\",\"authority_level\":\"primary|supporting|reference\"}],"
  + "\"disposition\":{\"decision\":\"NO_GO|RESTRICTED|GO_WITH_MONITORING|GO\",\"rationale\":\"...\",\"conditions_for_upgrade\":[\"...\"],\"authority_required\":\"...\"},"
  + "\"escalation_timeline\":{\"immediate_0_6h\":[\"...\"],\"urgent_6_24h\":[\"...\"],\"priority_24_72h\":[\"...\"],\"scheduled_3_7d\":[\"...\"]},"
  + "\"follow_up_questions\":[\"questions that would IMPROVE the plan even though you can proceed\"],"
  + "\"confidence\":0.85,\"reasoning\":\"your chain of thought\"}\n\n"

  + "RULES:\n"
  + "1. You are THE authority. Do not hedge. State what IS required.\n"
  + "2. Mechanisms must be SPECIFIC to the scenario. Not generic placeholders.\n"
  + "3. Methods must match MATERIAL and MECHANISM. MT for ferromagnetic steel. PT for non-magnetic. Hammer sounding for concrete. AUBT for HTHA. Do NOT put concrete methods on steel.\n"
  + "4. Codes must be ACTUAL governing codes. Railroad=49 CFR 237+AREMA. Nuclear=10 CFR 50.55a+ASME XI. Offshore=API RP 2A+30 CFR 250. Pressure vessel=API 510+API 579-1. Bridge=AASHTO MBE+23 CFR 650.\n"
  + "5. GO/NO-GO is ENFORCED. Primary member deformed=NO_GO. Active cracking in fracture-critical=NO_GO. No ambiguity.\n"
  + "6. For unknown domains, reason from first principles of materials science, structural mechanics, and NDE physics.\n"
  + "7. Every mechanism needs at least one detection method and one sizing method.\n"
  + "8. Zones must be SPECIFIC to the asset geometry — not just 'impact zone'.\n"
  + "9. Return ONLY JSON.\n"
  + "10. Rich input = rich output. Vague input = smart questions WITH partial_events populated.\n"
  + "11. NEVER return empty partial_events if the transcript contains ANY keyword suggesting an event, finding, or action.\n";


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
    var transcript = body.transcript || body.raw_text || "";

    if (!transcript || transcript.trim().length < 3) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ parsed: { events: [], environment: [], numeric_values: {}, raw_text: "" }, ai_interpretation: null })
      };
    }

    // ================================================================
    // REGEX NUMERIC EXTRACTION — locked values override AI
    // ================================================================
    var numeric_values: { [key: string]: number } = {};
    var rules: Array<{ p: RegExp; k: string; m?: number; o?: number }> = [
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:mph|miles?\s*per\s*hour)/i, k: "speed_mph" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:knots?|kts?)/i, k: "speed_mph", m: 1.151 },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:km\/h|kph)/i, k: "speed_mph", m: 0.621 },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:psi|psig)/i, k: "pressure_psi" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:bar|barg)\b/i, k: "pressure_psi", m: 14.5038 },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:mpa)\b/i, k: "pressure_psi", m: 145.038 },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:degrees?\s*f|°f|fahrenheit)/i, k: "temperature_f" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:degrees?\s*c|°c|celsius)/i, k: "temperature_f", m: 1.8, o: 32 },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:foot|feet|ft)\s*(?:wave|sea|swell)/i, k: "wave_height_ft" },
      { p: /(?:wave|sea|swell)s?\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*(?:foot|feet|ft)/i, k: "wave_height_ft" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:inch(?:es)?|in\.?)\s*(?:thick|wall|nominal)/i, k: "thickness_in" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:mm)\s*(?:thick|wall)/i, k: "thickness_in", m: 0.03937 },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:inch(?:es)?|in\.?)\s*(?:diam|od|id)/i, k: "diameter_in" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i, k: "duration_hours" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:minutes?|mins?)\s*(?:exposure|fire|burn|duration)/i, k: "duration_hours", m: 0.01667 },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:foot|feet|ft)\s*(?:deep|depth|below|under)/i, k: "depth_ft" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:meters?|m)\s*(?:deep|depth|below)/i, k: "depth_ft", m: 3.281 },
      { p: /(\d+)\s*(?:years?\s*old|year[\s-]*old)/i, k: "age_years" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:miles?|mi)\b/i, k: "distance_miles" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:km|kilometers?)\b/i, k: "distance_miles", m: 0.621 },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:tons?|tonnes?)\b/i, k: "weight_tons" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/i, k: "weight_lbs" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:mw|megawatt)/i, k: "power_mw" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:gallons?|gal)\b/i, k: "volume_gallons" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:barrels?|bbls?)\b/i, k: "volume_barrels" },
      { p: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:rpm)\b/i, k: "rotation_rpm" },
      { p: /(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:wall|loss|reduction|strain)/i, k: "percent_value" }
    ];

    for (var r = 0; r < rules.length; r++) {
      var rl = rules[r];
      var mt = rl.p.exec(transcript);
      if (mt && !numeric_values[rl.k]) {
        var v = parseFloat(mt[1].replace(/,/g, ""));
        if (rl.m) v = v * rl.m;
        if (rl.o) v = v + rl.o;
        numeric_values[rl.k] = Math.round(v * 100) / 100;
      }
    }

    // ================================================================
    // GPT-4o INTERPRETATION — the Level III brain
    // ================================================================
    var ai_interpretation = null;
    var ai_events: string[] = [];
    var ai_environment: string[] = [];
    var ai_error = null;

    if (!OPENAI_KEY) {
      ai_error = "No OPENAI_API_KEY — set in Netlify environment variables";
    } else {
      try {
        var https = require("https");

        var ai_request_body = JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: transcript }
          ],
          temperature: 0.1,
          max_tokens: 4000
        });

        var ai_result: string = await new Promise(function(resolve, reject) {
          var options = {
            hostname: "api.openai.com",
            port: 443,
            path: "/v1/chat/completions",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + OPENAI_KEY,
              "Content-Length": Buffer.byteLength(ai_request_body)
            }
          };

          var req = https.request(options, function(res: any) {
            var chunks: any[] = [];
            res.on("data", function(chunk: any) { chunks.push(chunk); });
            res.on("end", function() { resolve(Buffer.concat(chunks).toString()); });
          });

          req.on("error", function(err: any) { reject(err); });
          req.setTimeout(50000, function() { req.destroy(new Error("Timeout")); });
          req.write(ai_request_body);
          req.end();
        });

        var ai_data = JSON.parse(ai_result);

        if (ai_data.choices && ai_data.choices[0] && ai_data.choices[0].message) {
          var raw_content = (ai_data.choices[0].message.content || "").trim();
          // Strip markdown fencing if present
          var bt = String.fromCharCode(96);
          var fence = bt + bt + bt;
          if (raw_content.indexOf(fence) === 0) {
            raw_content = raw_content.replace(new RegExp("^" + fence + "(?:json)?\\s*", "i"), "").replace(new RegExp("\\s*" + fence + "\\s*$", "i"), "").trim();
          }

          try {
            ai_interpretation = JSON.parse(raw_content);

            // Extract chain-compatible events and environment
            if (ai_interpretation.events) ai_events = ai_interpretation.events;
            if (ai_interpretation.environment) ai_environment = ai_interpretation.environment;
            if (ai_interpretation.partial_events) ai_events = ai_interpretation.partial_events;
            if (ai_interpretation.partial_environment) ai_environment = ai_interpretation.partial_environment;

            // SAFETY NET: If AI returned need_more_info but forgot partial_events,
            // do a basic keyword scan to populate them anyway
            if (ai_interpretation.status === "need_more_info" && ai_events.length === 0) {
              var lt = transcript.toLowerCase();
              if (lt.indexOf("impact") !== -1 || lt.indexOf("hit") !== -1 || lt.indexOf("struck") !== -1 || lt.indexOf("collision") !== -1) ai_events.push("impact");
              if (lt.indexOf("fire") !== -1 || lt.indexOf("burn") !== -1) ai_events.push("fire");
              if (lt.indexOf("crack") !== -1) ai_events.push("crack_indication");
              if (lt.indexOf("corrosion") !== -1 || lt.indexOf("rust") !== -1) ai_events.push("corrosion");
              if (lt.indexOf("leak") !== -1) ai_events.push("leak");
              if (lt.indexOf("hurricane") !== -1 || lt.indexOf("storm") !== -1 || lt.indexOf("wind") !== -1) ai_events.push("weather_event");
              if (lt.indexOf("earthquake") !== -1 || lt.indexOf("seismic") !== -1) ai_events.push("seismic_event");
              if (lt.indexOf("inspect") !== -1 || lt.indexOf("check") !== -1 || lt.indexOf("assess") !== -1) ai_events.push("inspection_request");
              if (lt.indexOf("weld") !== -1) ai_events.push("weld_assessment");
              // Also scan for environment clues
              if (lt.indexOf("offshore") !== -1 || lt.indexOf("platform") !== -1 || lt.indexOf("marine") !== -1) ai_environment.push("marine_exposure");
              if (lt.indexOf("sour") !== -1 || lt.indexOf("h2s") !== -1) ai_environment.push("sour_service");
              if (lt.indexOf("high temp") !== -1 || lt.indexOf("hot") !== -1 || lt.indexOf("elevated temp") !== -1) ai_environment.push("high_temperature");
              if (lt.indexOf("refinery") !== -1 || lt.indexOf("process") !== -1) ai_environment.push("hydrocarbon_service");
              if (lt.indexOf("bridge") !== -1) ai_environment.push("civil_infrastructure");
              if (lt.indexOf("nuclear") !== -1) ai_environment.push("nuclear");
              if (lt.indexOf("underwater") !== -1 || lt.indexOf("subsea") !== -1) ai_environment.push("underwater");
            }

          } catch (pe) {
            ai_error = "AI returned invalid JSON";
            ai_interpretation = { status: "parse_error", raw: raw_content.substring(0, 500) };
          }
        } else {
          ai_error = ai_data.error ? ("OpenAI: " + (ai_data.error.message || "")) : "No response from AI";
        }

      } catch (fetch_err: any) {
        ai_error = "AI call failed: " + (fetch_err.message || "Unknown");
      }
    }

    // ================================================================
    // BUILD OUTPUT
    // ================================================================

    var parsed = {
      events: ai_events,
      environment: ai_environment,
      numeric_values: numeric_values,
      raw_text: transcript
    };

    var response_body: any = {
      parsed: parsed,
      ai_interpretation: ai_interpretation,
      regex_numerics: numeric_values
    };

    if (ai_error) {
      response_body.ai_error = ai_error;
    }

    // If AI said need_more_info, flag it
    if (ai_interpretation && ai_interpretation.status === "need_more_info") {
      response_body.needs_input = true;
      response_body.questions = ai_interpretation.questions || [];
      response_body.understood = ai_interpretation.understood_so_far || "";
    }

    // If AI gave full interpretation, extract asset info for resolve-asset compatibility
    if (ai_interpretation && ai_interpretation.status === "interpreted") {
      response_body.resolved = {
        asset_class: ai_interpretation.asset_class || "unknown",
        asset_type: ai_interpretation.asset_type || "unknown",
        confidence: ai_interpretation.confidence || 0.5,
        material: ai_interpretation.asset_material || "unknown",
        industry: ai_interpretation.industry || "unknown"
      };
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify(response_body)
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ error: "parse-incident error", message: err.message || "Unknown", stack: err.stack || "" })
    };
  }
};

export { handler };
