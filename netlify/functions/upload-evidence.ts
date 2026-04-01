/**
 * DEPLOY10_upload_evidence.ts
 * Netlify Function: upload-evidence
 * Deploy to: netlify/functions/upload-evidence.ts
 *
 * Handles evidence metadata recording.
 * Actual file upload goes direct to Supabase Storage from frontend.
 * This function records the evidence row and updates case status.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var supabase = createClient(supabaseUrl, supabaseKey);

export var handler: Handler = async function(event) {
  try {
    var body = JSON.parse(event.body || "{}");

    if (!body.case_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "case_id required" })
      };
    }

    if (!body.evidence_type) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "evidence_type required" })
      };
    }

    if (!body.uploaded_by) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "uploaded_by required" })
      };
    }

    var evidenceRow = {
      case_id: body.case_id,
      evidence_type: body.evidence_type,
      storage_path: body.storage_path || null,
      mime_type: body.mime_type || null,
      filename: body.filename || null,
      uploaded_by: body.uploaded_by,
      capture_source: body.capture_source || null,
      metadata_json: body.metadata_json || {}
    };

    var insertResult = await supabase
      .from("evidence")
      .insert(evidenceRow)
      .select()
      .single();

    if (insertResult.error) {
      throw insertResult.error;
    }

    // Update case status to evidence_uploaded if still in draft
    var caseResult = await supabase
      .from("inspection_cases")
      .select("status")
      .eq("id", body.case_id)
      .single();

    if (caseResult.data && caseResult.data.status === "draft") {
      await supabase
        .from("inspection_cases")
        .update({ status: "evidence_uploaded", updated_at: new Date().toISOString() })
        .eq("id", body.case_id);
    }

    // Log event
    await supabase.from("case_events").insert({
      case_id: body.case_id,
      event_type: "evidence_uploaded",
      actor_id: body.uploaded_by,
      event_json: {
        evidence_id: insertResult.data.id,
        evidence_type: body.evidence_type,
        filename: body.filename || null
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidence: insertResult.data })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "upload-evidence failed" })
    };
  }
};
