// DEPLOY107 — voice-incident-plan.ts v5
// FIX 1: inferAssetType ordering bug — "vessel" was matching cargo_ship before pressure_vessel check
// FIX 2: Accept body.decisionResult directly — no longer requires LOCKED DETERMINISTIC CONTEXT string in transcript
// FIX 3: Legacy parser eliminated for modern calls — GPT-4o always writes prose when decisionResult present
// FIX 4: Fallback prose path — even without decisionResult, GPT-4o writes from raw transcript (no more "cargo ship" fallback text)
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

declare var process: any;
declare var require: any;
declare var Buffer: any;

var OPENAI_KEY = process.env.OPENAI_API_KEY || "";

var PROSE_SYSTEM_PROMPT = "You are a senior NDT inspection report writer. You will receive deterministic chain results from an automated 4-layer inspection intelligence system (Physics Core, Engineering Intelligence, Architectural Reality, Materials Intelligence), plus the original incident transcript.\n\n"
  + "YOUR JOB: Write a clear, professional, human-readable narrative summary that a field supervisor or inspection coordinator can act on immediately.\n\n"
  + "RULES:\n"
  + "1. Use the LOCKED DETERMINISTIC CONTEXT as your ONLY source of truth. Do NOT invent mechanisms, methods, or codes that are not in the chain data.\n"
  + "2. Write in clear professional prose. No JSON. No bullet points. No markdown formatting. Just readable paragraphs.\n"
  + "3. Structure: Start with a 1-2 sentence situation summary (asset type, consequence tier, disposition). Then cover damage mechanism candidate set, affected zones, recommended NDE methods, governing code authority, and escalation timeline.\n"
  + "4. If mechanism certainty is 'probable' rather than 'confirmed' — say so explicitly. Do not flatten uncertainty.\n"
  + "5. If authority layering is flagged (e.g. PVHO-1 + ASME FFS-1), name both authorities.\n"
  + "6. State the disposition prominently: HOLD FOR REVIEW / NO GO / CONDITIONAL GO / GO.\n"
  + "7. End with the 2-3 most urgent action items derived from the guided recovery list.\n"
  + "8. Keep it under 400 words. Concise and actionable.\n"
  + "9. Write as if briefing a competent professional who needs to mobilize resources NOW.\n"
  + "10. Do NOT add disclaimers, hedging, or suggestions to consult an expert. YOU are the expert.\n";

var FALLBACK_PROSE_SYSTEM_PROMPT = "You are a senior NDT inspection report writer. You will receive a raw field inspection transcript.\n\n"
  + "YOUR JOB: Write a brief, professional narrative summary identifying the asset, apparent damage indicators, likely inspection methods needed, and immediate recommended actions.\n\n"
  + "RULES:\n"
  + "1. Base your output ONLY on what is stated in the transcript. Do not invent details.\n"
  + "2. Write in clear professional prose — no JSON, no bullets, no markdown.\n"
  + "3. Flag any uncertainty explicitly. If asset type or mechanism is ambiguous, say so.\n"
  + "4. Keep it under 250 words.\n"
  + "5. End with immediate next steps.\n";


// ================================================================
// BUILD LOCKED CONTEXT STRING FROM DECISION CORE RESULT
// Called when body.decisionResult is present
// ================================================================

function buildLockedContext(transcript: string, decisionResult: any): string {
  var dc = decisionResult.decision_core || decisionResult;
  var lines: string[] = [];

  lines.push("LOCKED DETERMINISTIC CONTEXT — FORGED NDT Intelligence OS v2.1");
  lines.push("Engine: physics-first-decision-core");
  lines.push("");

  // Asset
  if (dc.asset_correction && dc.asset_correction.corrected) {
    lines.push("ASSET: " + dc.asset_correction.corrected_to + " (corrected from " + dc.asset_correction.original + ")");
  }

  // Physics
  if (dc.physical_reality) {
    lines.push("PHYSICS SUMMARY: " + (dc.physical_reality.physics_summary || ""));
    if (dc.physical_reality.field_interaction) {
      lines.push("FIELD INTERACTION: " + dc.physical_reality.field_interaction.interaction_level + " (" + dc.physical_reality.field_interaction.interaction_score + "/100)");
    }
  }

  // Damage
  if (dc.damage_reality) {
    var dr = dc.damage_reality;
    lines.push("DAMAGE MECHANISMS: " + dr.mechanism_count.validated + " validated, " + dr.mechanism_count.rejected + " physically impossible");
    if (dr.primary_mechanism) {
      lines.push("PRIMARY MECHANISM: " + dr.primary_mechanism.name + " (" + dr.primary_mechanism.reality_state + ", score " + dr.primary_mechanism.reality_score + ")");
      if (dr.primary_mechanism.evidence_against && dr.primary_mechanism.evidence_against.length > 0) {
        lines.push("MECHANISM UNCERTAINTY: " + dr.primary_mechanism.evidence_against.join("; "));
      }
    }
    if (dr.validated_mechanisms && dr.validated_mechanisms.length > 0) {
      var mechList: string[] = [];
      for (var mi = 0; mi < dr.validated_mechanisms.length; mi++) {
        mechList.push(dr.validated_mechanisms[mi].name + " (" + dr.validated_mechanisms[mi].reality_state + ")");
      }
      lines.push("ALL VALIDATED MECHANISMS: " + mechList.join(", "));
    }
  }

  // Consequence
  if (dc.consequence_reality) {
    var cr = dc.consequence_reality;
    lines.push("CONSEQUENCE TIER: " + cr.consequence_tier);
    lines.push("FAILURE MODE: " + cr.failure_mode);
    lines.push("HUMAN IMPACT: " + cr.human_impact);
    lines.push("DAMAGE STATE: " + cr.damage_state + " — " + cr.damage_trajectory);
    lines.push("MONITORING URGENCY: " + cr.monitoring_urgency);
  }

  // Authority
  if (dc.authority_reality) {
    var ar = dc.authority_reality;
    lines.push("PRIMARY AUTHORITY: " + ar.primary_authority);
    if (ar.secondary_authorities && ar.secondary_authorities.length > 0) {
      lines.push("SECONDARY AUTHORITIES: " + ar.secondary_authorities.join(", "));
    }
    lines.push("CODE ALIGNMENT: " + ar.physics_code_alignment);
    if (ar.code_gaps && ar.code_gaps.length > 0) {
      lines.push("AUTHORITY GAPS: " + ar.code_gaps.join("; "));
    }
  }

  // Inspection
  if (dc.inspection_reality) {
    var ir = dc.inspection_reality;
    lines.push("INSPECTION VERDICT: " + ir.sufficiency_verdict);
    if (ir.missing_coverage && ir.missing_coverage.length > 0) {
      lines.push("MISSING COVERAGE: " + ir.missing_coverage.join("; "));
    }
    if (ir.recommended_package && ir.recommended_package.length > 0) {
      lines.push("RECOMMENDED METHOD PACKAGE: " + ir.recommended_package.join(" + "));
    }
    if (ir.best_method) {
      lines.push("BEST SCORING METHOD: " + ir.best_method.method + " (" + ir.best_method.overall_score + "/100)");
    }
  }

  // Confidence
  if (dc.reality_confidence) {
    var rc = dc.reality_confidence;
    lines.push("REALITY CONFIDENCE: " + rc.overall + " (" + rc.band + ")");
    if (rc.limiting_factors && rc.limiting_factors.length > 0) {
      lines.push("LIMITING FACTORS: " + rc.limiting_factors.join("; "));
    }
  }

  // Decision
  if (dc.decision_reality) {
    var dec = dc.decision_reality;
    lines.push("DISPOSITION: " + dec.disposition.toUpperCase().replace(/_/g, " "));
    lines.push("DISPOSITION BASIS: " + dec.disposition_basis);
    if (dec.guided_recovery && dec.guided_recovery.length > 0) {
      var recoveryLines: string[] = [];
      for (var ri = 0; ri < Math.min(dec.guided_recovery.length, 5); ri++) {
        recoveryLines.push("#" + dec.guided_recovery[ri].priority + " " + dec.guided_recovery[ri].action + " (" + dec.guided_recovery[ri].who + ")");
      }
      lines.push("GUIDED RECOVERY: " + recoveryLines.join(" | "));
    }
  }

  lines.push("");
  lines.push("ORIGINAL TRANSCRIPT: " + transcript);

  return lines.join("\n");
}


// ================================================================
// GPT-4o PROSE GENERATION
// ================================================================

async function generateProse(contextText: string, systemPrompt: string): Promise<string> {
  if (!OPENAI_KEY) {
    return "AI narrative unavailable: No OPENAI_API_KEY configured.";
  }

  var https = require("https");

  var request_body = JSON.stringify({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contextText }
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
   LEGACY PARSER
   Kept only for pure backward compatibility. Not called in modern flow.
   ======================================================================== */

function lower(text: string): string { return text.toLowerCase().trim(); }

function includesAny(text: string, terms: string[]): boolean {
  for (var i = 0; i < terms.length; i++) { if (text.indexOf(terms[i]) !== -1) return true; }
  return false;
}

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
  var result: any = { wind_mph: null, impact_speed_mph: null, wave_height_ft: null };
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

// FIX: Check specific compound terms BEFORE generic single words.
// Previous bug: "vessel" matched cargo_ship before "pressure vessel" check was reached.
// Rule: longest/most-specific match first, generic single words last.
function inferAssetType(text: string): string {
  // PVHO / hyperbaric — highest priority, most specific
  if (includesAny(text, ["decompression chamber", "recompression chamber", "hyperbaric chamber", "hyperbaric", "pvho", "diving bell", "dive system", "saturation div", "double lock", "man-rated chamber", "treatment chamber"])) return "pressure_vessel_pvho";
  // Specific vessel types — check compound phrases before generic "vessel"
  if (includesAny(text, ["pressure vessel", "vessel shell", "saddle"])) return "pressure_vessel";
  if (includesAny(text, ["bridge support", "bridge pier", "concrete support"])) return "bridge_support";
  if (includesAny(text, ["gas pipeline", "pipeline", "gas line"])) return "gas_pipeline";
  if (includesAny(text, ["oil platform", "offshore platform", "platform"])) return "offshore_platform";
  if (includesAny(text, ["storage tank", "tank farm"])) return "storage_tank";
  if (includesAny(text, ["pipe rack", "piping", "process piping"])) return "piping";
  // Generic single-word matches last — only after all compound checks clear
  if (includesAny(text, ["rudder", "cargo ship", "ship"])) return "cargo_ship";
  // "vessel" alone — only if no better match found above
  if (includesAny(text, ["vessel"])) return "pressure_vessel";
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
    // PATH 1: decisionResult passed directly from UI
    // This is the primary modern path.
    // UI passes body.decisionResult = the full decision-core JSON response.
    // Build locked context from it and generate prose.
    // ================================================================
    if (body.decisionResult) {
      try {
        var lockedContext = buildLockedContext(transcript, body.decisionResult);
        var prose = await generateProse(lockedContext, PROSE_SYSTEM_PROMPT);
        return {
          statusCode: 200,
          headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true, plan: prose, mode: "prose_from_decision_result" })
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
    // PATH 2: LOCKED DETERMINISTIC CONTEXT string in transcript body
    // Legacy call format — still supported.
    // ================================================================
    if (transcript.indexOf("LOCKED DETERMINISTIC CONTEXT") !== -1) {
      try {
        var prose2 = await generateProse(transcript, PROSE_SYSTEM_PROMPT);
        return {
          statusCode: 200,
          headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true, plan: prose2, mode: "prose_from_chain" })
        };
      } catch (proseErr2: any) {
        return {
          statusCode: 200,
          headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true, plan: "AI narrative generation failed: " + (proseErr2.message || "Unknown error"), mode: "prose_error" })
        };
      }
    }

    // ================================================================
    // PATH 3: Raw transcript only — no decision result available.
    // Call GPT-4o with fallback prompt. DO NOT run legacy parser.
    // Legacy parser output ("cargo ship", "condition driven") is
    // not useful and was confusing report consumers.
    // ================================================================
    try {
      var prose3 = await generateProse(transcript, FALLBACK_PROSE_SYSTEM_PROMPT);
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, plan: prose3, mode: "prose_from_transcript" })
      };
    } catch (proseErr3: any) {
      // Only reach here if GPT-4o is completely unavailable
      var parsed = parseTranscript(transcript);
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, plan: "AI narrative unavailable. Asset: " + parsed.asset_type.replace(/_/g, " ") + ". Run full inspection per physics core output.", mode: "legacy_fallback" })
      };
    }

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message || "Unexpected error" })
    };
  }
};

export { handler };
