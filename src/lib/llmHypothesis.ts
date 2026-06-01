// ============================================================================
// llmHypothesis.ts - PHASE 3 of the Stabilization Directive: the LLM reasons
// HOLISTICALLY and FIRST, producing a structured hypothesis BEFORE any
// deterministic engine commits. The deterministic suite then verifies /
// calculates / constrains / cites against this hypothesis (Phases 5-9).
//
// Design:
//  - buildHypothesisPrompt(transcript)  -> chat messages (JSON-only contract)
//  - parseAndValidateHypothesis(raw)    -> a fully schema-valid LLMHypothesis;
//                                          NEVER throws; malformed input
//                                          degrades to a low-confidence UNKNOWN.
//  - generateHypothesis(transcript,opts)-> orchestrates: build -> callModel ->
//                                          parse/validate. callModel is INJECTED
//                                          (default posts to the llm-proxy
//                                          serverless function) so the gates can
//                                          exercise the full path offline and
//                                          deterministically with a fake model.
//
// Reproducibility (section 12): the model + temperature are pinned. A varying
// hypothesis is acceptable because it still hits the same deterministic wall;
// reproducibility lives in the verification layer, not here.
// ============================================================================
import {
  PhysicalCondition, AssuranceState, OperationalChange,
  toPhysicalCondition, toAssuranceState, toOperationalChange, clampConfidence
} from "./governingAxes";

export var HYPOTHESIS_MODEL = "gpt-4o";
export var HYPOTHESIS_TEMPERATURE = 0;

export interface ConfidencedValue {
  value: string;
  confidence: number;
  evidence: string[];
}
export interface AuthorityValue {
  value: string;
  confidence: number;
  derivedFrom: string;
}
export interface SuspectedMechanism {
  value: string | null;
  confidence: number;
  evidence: string[];
}
export interface HypothesisMeta {
  ok: boolean;            // false => this is a degraded/fallback hypothesis
  model: string;
  cached: boolean;
  parseError: string | null;
}
export interface LLMHypothesis {
  asset: ConfidencedValue;
  domain: ConfidencedValue;
  authority: AuthorityValue;
  physicalCondition: PhysicalCondition;
  assuranceState: AssuranceState;
  operationalChange: OperationalChange;
  suspectedMechanism: SuspectedMechanism;
  disposition: string;
  evidence: string[];
  missingEvidence: string[];
  uncertainty: string[];
  meta: HypothesisMeta;
}

// ---------------------------------------------------------------------------
// PROMPT
// ---------------------------------------------------------------------------
var SYSTEM_PROMPT = [
  "You are the hypothesis engine of an industrial NDT / fitness-for-service decision system.",
  "You read a raw field inspection account and produce ONE structured engineering hypothesis.",
  "",
  "ABSOLUTE RULES:",
  "1. Output VALID JSON ONLY. No prose, no markdown, no code fences.",
  "2. Every conclusion must be grounded in the transcript. For each field that has an 'evidence'",
  "   array, quote or closely paraphrase the exact transcript phrases that justify it. If there is",
  "   no supporting text, you MUST leave the value empty/null and record what is missing in",
  "   'missingEvidence'. Never invent numbers, codes, measurements, asset types, or mechanisms.",
  "3. FACTS AND PHYSICS ONLY. Never infer human behavior, motive, intent, or states of mind",
  "   (no complacency, negligence, ego, fear, laziness, carelessness). These are unprovable.",
  "4. A physical damage mechanism may be called CONFIRMED_DAMAGE only with DIRECT evidence",
  "   (measured wall loss / NDT crack indication / measured deformation or settlement beyond",
  "   allowable / failed support / engineering declaration). Consequence, missing records, a",
  "   high-risk asset class, or failures elsewhere are NEVER sufficient for CONFIRMED_DAMAGE -",
  "   they support at most SUSPECTED.",
  "",
  "THREE-AXIS GOVERNING REALITY (assign each independently):",
  "- physicalCondition: ACCEPTABLE | SUSPECTED | CONFIRMED_DAMAGE | UNKNOWN",
  "    ACCEPTABLE = findings within limits; SUSPECTED = indirect indicators only;",
  "    CONFIRMED_DAMAGE = direct evidence; UNKNOWN = cannot tell from the account.",
  "- assuranceState: ESTABLISHED | DEGRADED | UNKNOWN_STATE | LOST_DESIGN_BASIS",
  "    Can we even establish the asset's condition? Lost baselines/records/monitoring or an",
  "    unreviewed external change degrade or destroy the assurance basis even when findings",
  "    are within limits.",
  "- operationalChange: STABLE | CHANGED_UNREASSESSED | FLEET_PATTERN",
  "    A throughput/software/operating-envelope change without reassessment = CHANGED_UNREASSESSED;",
  "    a common change with failures across sister units = FLEET_PATTERN.",
  "",
  "It is correct and expected to conclude 'physically ACCEPTABLE today' while assuranceState or",
  "operationalChange make the asset NOT acceptable for final disposition. Represent both.",
  "Do NOT force a corrosion/cracking/fatigue/instability mechanism when none is evidenced.",
  "",
  "OUTPUT SCHEMA (all keys required):",
  "{",
  '  "asset": {"value": string, "confidence": 0..1, "evidence": [string]},',
  '  "domain": {"value": string, "confidence": 0..1, "evidence": [string]},',
  '  "authority": {"value": string, "confidence": 0..1, "derivedFrom": string},',
  '  "physicalCondition": one of the enum,',
  '  "assuranceState": one of the enum,',
  '  "operationalChange": one of the enum,',
  '  "suspectedMechanism": {"value": string|null, "confidence": 0..1, "evidence": [string]},',
  '  "disposition": string,',
  '  "evidence": [string],',
  '  "missingEvidence": [string],',
  '  "uncertainty": [string]',
  "}"
].join("\n");

export function buildHypothesisPrompt(transcript: string): Array<{ role: string; content: string }> {
  var t = String(transcript == null ? "" : transcript);
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: "FIELD INSPECTION ACCOUNT:\n\n" + t + "\n\nReturn the JSON hypothesis now." }
  ];
}

// ---------------------------------------------------------------------------
// PARSE + VALIDATE (never throws)
// ---------------------------------------------------------------------------
function asStringArray(x: any): string[] {
  if (!x) { return []; }
  if (Object.prototype.toString.call(x) !== "[object Array]") {
    return (typeof x === "string" && x.trim()) ? [x.trim()] : [];
  }
  var out: string[] = [];
  for (var i = 0; i < x.length; i++) {
    var s = (x[i] == null) ? "" : String(x[i]).trim();
    if (s) { out.push(s); }
  }
  return out;
}
function asStr(x: any): string { return (x == null) ? "" : String(x).trim(); }

export function stripToJson(raw: string): string {
  var s = String(raw == null ? "" : raw).trim();
  // strip ```json ... ``` or ``` ... ``` fences if a model added them anyway
  s = s.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "");
  var first = s.indexOf("{");
  var last = s.lastIndexOf("}");
  if (first >= 0 && last > first) { s = s.slice(first, last + 1); }
  return s;
}

export function emptyHypothesis(parseError: string | null, model: string): LLMHypothesis {
  return {
    asset: { value: "", confidence: 0, evidence: [] },
    domain: { value: "", confidence: 0, evidence: [] },
    authority: { value: "", confidence: 0, derivedFrom: "" },
    physicalCondition: "UNKNOWN",
    assuranceState: "UNKNOWN_STATE",
    operationalChange: "STABLE",
    suspectedMechanism: { value: null, confidence: 0, evidence: [] },
    disposition: "hold_for_review",
    evidence: [],
    missingEvidence: [],
    uncertainty: parseError ? ["hypothesis unavailable: " + parseError] : [],
    meta: { ok: false, model: model || HYPOTHESIS_MODEL, cached: false, parseError: parseError }
  };
}

export function parseAndValidateHypothesis(raw: string, model?: string): LLMHypothesis {
  var mdl = model || HYPOTHESIS_MODEL;
  var obj: any = null;
  try { obj = JSON.parse(stripToJson(raw)); }
  catch (e) { return emptyHypothesis("invalid JSON", mdl); }
  if (!obj || typeof obj !== "object") { return emptyHypothesis("not an object", mdl); }

  var a = obj.asset || {};
  var d = obj.domain || {};
  var au = obj.authority || {};
  var sm = obj.suspectedMechanism || {};
  var smVal = (sm.value == null || asStr(sm.value) === "") ? null : asStr(sm.value);

  return {
    asset: { value: asStr(a.value), confidence: clampConfidence(a.confidence), evidence: asStringArray(a.evidence) },
    domain: { value: asStr(d.value), confidence: clampConfidence(d.confidence), evidence: asStringArray(d.evidence) },
    authority: { value: asStr(au.value), confidence: clampConfidence(au.confidence), derivedFrom: asStr(au.derivedFrom) },
    physicalCondition: toPhysicalCondition(obj.physicalCondition),
    assuranceState: toAssuranceState(obj.assuranceState),
    operationalChange: toOperationalChange(obj.operationalChange),
    suspectedMechanism: { value: smVal, confidence: clampConfidence(sm.confidence), evidence: asStringArray(sm.evidence) },
    disposition: asStr(obj.disposition) || "hold_for_review",
    evidence: asStringArray(obj.evidence),
    missingEvidence: asStringArray(obj.missingEvidence),
    uncertainty: asStringArray(obj.uncertainty),
    meta: { ok: true, model: mdl, cached: false, parseError: null }
  };
}

// ---------------------------------------------------------------------------
// TRANSPORT (injected; default posts to the llm-proxy serverless function)
// ---------------------------------------------------------------------------
export interface CallModelOpts { model: string; temperature: number; response_format?: any; }
export type CallModel = (messages: Array<{ role: string; content: string }>, opts: CallModelOpts) => Promise<string>;

export interface GenerateOpts {
  callModel?: CallModel;
  authHeaders?: { [k: string]: string };
  proxyUrl?: string;
}

function defaultCallModel(authHeaders: any, proxyUrl: string): CallModel {
  return function (messages, opts) {
    var url = proxyUrl || "/.netlify/functions/llm-proxy";
    var headers: any = { "Content-Type": "application/json" };
    if (authHeaders) { for (var k in authHeaders) { if (authHeaders.hasOwnProperty(k)) { headers[k] = authHeaders[k]; } } }
    return fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ messages: messages, model: opts.model, temperature: opts.temperature, response_format: opts.response_format })
    }).then(function (r) {
      return r.json().then(function (j: any) {
        if (!r.ok) { throw new Error("llm-proxy " + r.status + ": " + (j && j.error ? j.error : "")); }
        return (j && typeof j.content === "string") ? j.content : "";
      });
    });
  };
}

export async function generateHypothesis(transcript: string, opts?: GenerateOpts): Promise<LLMHypothesis> {
  var o = opts || {};
  var call = o.callModel || defaultCallModel(o.authHeaders, o.proxyUrl || "");
  var messages = buildHypothesisPrompt(transcript);
  try {
    var raw = await call(messages, { model: HYPOTHESIS_MODEL, temperature: HYPOTHESIS_TEMPERATURE, response_format: { type: "json_object" } });
    return parseAndValidateHypothesis(raw, HYPOTHESIS_MODEL);
  } catch (e: any) {
    return emptyHypothesis("transport error: " + (e && e.message ? e.message : String(e)), HYPOTHESIS_MODEL);
  }
}
