/**
 * DEPLOY11_observation_layer.ts
 * Netlify Function: observation-layer
 * Deploy to: netlify/functions/observation-layer.ts
 *
 * GPT-4o Vision - The Observer
 * Sees evidence and extracts what is directly observable.
 * Does NOT interpret causally. Does NOT make accept/reject decisions.
 * Reports only what it can directly observe.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var supabase = createClient(supabaseUrl, supabaseKey);

var openaiKey = process.env.OPENAI_API_KEY || "";

var SYSTEM_PROMPT = "You are the observation layer for a universal NDT intelligence platform called FORGED NDT Intelligence OS. "
  + "Your job is to describe ONLY what is directly observable from the provided evidence. "
  + "You must NOT make final accept/reject decisions. "
  + "You must NOT invent code limits or standards references. "
  + "You must NOT pretend certainty where evidence is weak. "
  + "If the evidence is insufficient, say so clearly. "
  + "\n\nFor Visual Testing (VT), focus on: visible discontinuities, weld profile, crack presence, undercut, porosity, overlap, spatter, arc strikes, geometry. "
  + "For Penetrant Testing (PT), focus on: visible bleed-out indications, directionality, shape, linear vs rounded, dwell behavior. "
  + "For Magnetic Particle (MT), focus on: particle accumulation patterns, orientation, cluster shape, field interaction. "
  + "For Ultrasonic (UT), focus on: peaks, gates, echo timing, backwall presence/absence, screen readings. "
  + "For Radiographic (RT), focus on: density differences, linear vs rounded dark regions, contrast, suspected discontinuity regions. "
  + "For Eddy Current (ET), focus on: amplitude/phase anomalies, repeatable perturbation regions, signal variation. "
  + "\n\nReturn strict JSON with this format: "
  + "{\"summary\": \"short objective summary\", "
  + "\"observations\": [{\"label\": \"observation label\", \"confidence\": 0.0, \"location_ref\": \"optional location\", \"severity_hint\": \"low|medium|high|critical\", \"structured_json\": {}}], "
  + "\"measurements\": {}, "
  + "\"signal_notes\": {}}";

export var handler: Handler = async function(event) {
  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;

    if (!caseId) {
      return { statusCode: 400, body: JSON.stringify({ error: "case_id required" }) };
    }

    if (!openaiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "OPENAI_API_KEY not configured" }) };
    }

    // Fetch case
    var caseResult = await supabase
      .from("inspection_cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (caseResult.error) throw caseResult.error;
    var inspectionCase = caseResult.data;

    // Fetch evidence
    var evidenceResult = await supabase
      .from("evidence")
      .select("*")
      .eq("case_id", caseId);

    var evidenceRows = evidenceResult.data || [];

    // Fetch physics model
    var physicsResult = await supabase
      .from("physics_reality_models")
      .select("*")
      .eq("case_id", caseId)
      .single();

    var physicsModel = physicsResult.data;

    // Build context for GPT-4o
    var contextText = "NDT Method: " + inspectionCase.method + "\n"
      + "Material: " + inspectionCase.material_class + "\n"
      + "Load Condition: " + inspectionCase.load_condition + "\n"
      + "Thickness: " + (inspectionCase.thickness_mm || "unknown") + " mm\n"
      + "Joint Type: " + (inspectionCase.joint_type || "unknown") + "\n"
      + "Code: " + (inspectionCase.code_family || "") + " " + (inspectionCase.code_edition || "") + "\n"
      + "Component: " + (inspectionCase.component_name || "unknown") + "\n"
      + "Evidence count: " + evidenceRows.length + "\n";

    if (physicsModel && physicsModel.probable_discontinuities_json) {
      contextText = contextText + "\nPredicted probable discontinuities for this material/process:\n";
      physicsModel.probable_discontinuities_json.forEach(function(d: any) {
        contextText = contextText + "- " + (d.type || d.label || "unknown")
          + " (probability: " + (d.probability || "unknown")
          + ", typical location: " + (d.typical_location || "unknown") + ")\n";
      });
    }

    // Build messages array
    var messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT }
    ];

    // Add evidence as image content if available
    var userContent: any[] = [
      { type: "text", text: "Analyze this NDT inspection evidence.\n\nContext:\n" + contextText }
    ];

    // Process image evidence - get signed URLs
    for (var i = 0; i < evidenceRows.length; i++) {
      var ev = evidenceRows[i];
      if (ev.storage_path && (ev.evidence_type === "image" || ev.evidence_type === "radiograph")) {
        var signedResult = await supabase.storage
          .from("ndt-evidence")
          .createSignedUrl(ev.storage_path, 300);

        if (signedResult.data && signedResult.data.signedUrl) {
          userContent.push({
            type: "image_url",
            image_url: { url: signedResult.data.signedUrl, detail: "high" }
          });
        }
      }
    }

    // DEPLOY208: Add method-tagged evidence metadata for smarter analysis
    if (evidenceRows.length > 0) {
      var metadataText = "\nEvidence metadata:\n";
      // Collect unique NDE methods for method-specific analysis guidance
      var methodsUsed: string[] = [];
      evidenceRows.forEach(function(ev: any) {
        var ndeMethod = ev.nde_method || (ev.metadata_json && ev.metadata_json.nde_method) || null;
        var methodLabel = (ev.metadata_json && ev.metadata_json.nde_method_label) || ndeMethod || "unknown";
        metadataText = metadataText + "- NDE Method: " + methodLabel
          + ", Type: " + ev.evidence_type
          + ", File: " + (ev.filename || "none") + "\n";
        if (ndeMethod && methodsUsed.indexOf(ndeMethod) === -1) methodsUsed.push(ndeMethod);
      });

      // Add method-specific analysis instructions
      if (methodsUsed.length > 0) {
        metadataText = metadataText + "\nMethod-specific analysis guidance:\n";
        for (var mi = 0; mi < methodsUsed.length; mi++) {
          var meth = methodsUsed[mi];
          if (meth === "UT_thickness") metadataText = metadataText + "- UT Thickness: Report measured wall thickness values, grid locations, min/max readings, corrosion rate if calculable from previous data.\n";
          else if (meth === "UT_shear_wave") metadataText = metadataText + "- UT Shear Wave: Report indication depth, length, amplitude, beam angle, DAC/TCG level, reflector characterization (planar vs volumetric).\n";
          else if (meth === "UT_PAUT") metadataText = metadataText + "- PAUT: Report S-scan/B-scan indication location, depth, through-wall extent, length, classification per applicable code. Note focal law and scan plan details if visible.\n";
          else if (meth === "UT_TOFD") metadataText = metadataText + "- TOFD: Report lateral wave, backwall signal, diffraction tips, indication height sizing, through-wall position.\n";
          else if (meth === "RT_film" || meth === "RT_digital") metadataText = metadataText + "- Radiography: Report density variations, indication type (porosity/slag/crack/LOF/IP), indication dimensions, film quality (density, contrast, artifacts).\n";
          else if (meth === "ET_conventional" || meth === "ET_array") metadataText = metadataText + "- Eddy Current: Report impedance plane trajectory, amplitude, phase angle, signal-to-noise, indication depth estimate, liftoff effects.\n";
          else if (meth === "AE") metadataText = metadataText + "- Acoustic Emission: Report hit rate, amplitude distribution, source location clusters, Kaiser/Felicity effect, emission during load/hold.\n";
          else if (meth === "IR") metadataText = metadataText + "- Infrared Thermography: Report hot/cold spots, temperature gradients, thermal anomalies, pattern shape and location.\n";
          else if (meth === "HARDNESS") metadataText = metadataText + "- Hardness Testing: Report HB/HRC/HV values, test locations (base/HAZ/weld), hardness traverse if available, compliance with max hardness limits.\n";
          else if (meth === "PMI") metadataText = metadataText + "- PMI: Report alloy identification, element percentages, compliance with material specification, any mismatch flags.\n";
          else if (meth === "REPLICA") metadataText = metadataText + "- Metallographic Replica: Report microstructure (grain size, phase distribution), creep voids, sigma phase, graphitization, sensitization, carburization evidence.\n";
        }
      }

      userContent.push({ type: "text", text: metadataText });
    }

    messages.push({ role: "user", content: userContent });

    // Call GPT-4o
    var openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + openaiKey
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 2000,
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    var openaiJson = await openaiResp.json();

    if (!openaiResp.ok) {
      throw new Error("OpenAI API error: " + JSON.stringify(openaiJson));
    }

    var visionOutput = JSON.parse(openaiJson.choices[0].message.content);

    // Store findings from observations
    if (visionOutput.observations && visionOutput.observations.length > 0) {
      var findingRows = visionOutput.observations.map(function(o: any) {
        return {
          case_id: caseId,
          source: "openai",
          finding_type: "discontinuity",
          label: o.label,
          location_ref: o.location_ref || null,
          severity: o.severity_hint || null,
          confidence: o.confidence || null,
          structured_json: o.structured_json || {}
        };
      });
      await supabase.from("findings").insert(findingRows);
    }

    // Log AI run
    await supabase.from("ai_runs").insert({
      case_id: caseId,
      provider: "openai",
      model: "gpt-4o",
      run_type: "vision",
      prompt_version: "v1",
      input_json: { context: contextText, evidence_count: evidenceRows.length },
      output_json: visionOutput
    });

    // Update case status
    await supabase
      .from("inspection_cases")
      .update({ status: "vision_complete", ai_openai_summary: visionOutput.summary || "", updated_at: new Date().toISOString() })
      .eq("id", caseId);

    // Log event
    await supabase.from("case_events").insert({
      case_id: caseId,
      event_type: "observation_complete",
      actor_id: null,
      event_json: { observations_count: (visionOutput.observations || []).length, summary: visionOutput.summary || "" }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(visionOutput)
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "observation-layer failed" })
    };
  }
};
