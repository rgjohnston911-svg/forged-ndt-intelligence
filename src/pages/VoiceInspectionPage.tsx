// DEPLOY88 — VoiceInspectionPage.tsx v9
// Decision Dominance Layer (Engine 8) integrated into pipeline
// New cards: DDL Disposition, Structural Authority, Hard Locks, Mechanism Filter,
//            DDL Confidence with grouped penalties, Evidence Sufficiency
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

import React, { useState, useRef, useEffect } from "react";

// ============================================================================
// TYPES (unchanged from DEPLOY86 — abbreviated for brevity)
// ============================================================================

interface NumericValues { [key: string]: number | undefined; }
interface ParsedResult { events: string[]; environment: string[]; numeric_values: NumericValues; raw_text: string; }
interface AssetResult { asset_class: string; asset_type: string; confidence: number; alternatives?: Array<{ asset_class: string; score: number }>; }
interface DamageMechanism { id: string; name: string; api_571_ref: string; description: string; source_trigger: string; severity: string; requires_immediate_action: boolean; susceptible_materials: string[]; temperature_range_f: { min: number; max: number } | null; contributing_factors: string[]; }
interface AffectedZone { zone_id: string; zone_name: string; priority: number; damage_mechanisms: string[]; rationale: string; asset_specific: boolean; }
interface InspectionMethod { method_id: string; method_name: string; technique_variant: string; target_mechanism: string; target_zone: string; detection_capability: string; sizing_capability: string; code_reference: string; rationale: string; priority: number; personnel_qualification: string; limitations: string; }
interface CodeActionPath { finding_type: string; primary_code: string; code_section: string; required_action: string; ffs_assessment: string; repair_standard: string; documentation_required: string[]; engineering_review_required: boolean; }
interface EscalationTier { tier_name: string; time_window: string; hours_min: number; hours_max: number; actions: string[]; personnel_required: string[]; notifications: string[]; documentation: string[]; }
interface ExecutionPackage { role: string; summary: string; action_items: string[]; timeline: string; key_decisions: string[]; resources_needed: string[]; }
interface ChainResult { engine_version: string; timestamp: string; input_summary: { asset_class: string; asset_type: string; events: string[]; environment: string[]; numeric_values: NumericValues; }; engine_1_damage_mechanisms: DamageMechanism[]; engine_2_affected_zones: AffectedZone[]; engine_3_inspection_methods: InspectionMethod[]; engine_4_code_action_paths: CodeActionPath[]; engine_5_escalation_timeline: EscalationTier[]; engine_6_execution_packages: ExecutionPackage[]; confidence_scores: { mechanism_confidence: number; zone_confidence: number; method_confidence: number; overall_confidence: number; }; warnings: string[]; }
interface GovernanceResult { [key: string]: any; }
interface CodeAuthorityResult { [key: string]: any; }
interface TimeProgressionResult { [key: string]: any; }
interface CodeTraceResult { [key: string]: any; }
interface EventEnrichResult { [key: string]: any; }

// ============================================================================
// API HELPER
// ============================================================================

var API_BASE = "/api";

async function callAPI(endpoint: string, body: any): Promise<any> {
  var res = await fetch(API_BASE + "/" + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    var text = await res.text();
    throw new Error(endpoint + " failed (" + res.status + "): " + text);
  }
  return res.json();
}

// ============================================================================
// SEVERITY / BADGE / CONFIDENCE HELPERS
// ============================================================================

function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "#dc2626";
    case "high": return "#ea580c";
    case "medium": return "#ca8a04";
    case "low": return "#16a34a";
    default: return "#6b7280";
  }
}

function severityBadge(severity: string): React.ReactNode {
  return (<span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, color: "#fff", backgroundColor: severityColor(severity), textTransform: "uppercase", letterSpacing: "0.5px" }}>{severity}</span>);
}

function priorityBadge(priority: number): React.ReactNode {
  var colors: { [key: number]: string } = { 1: "#dc2626", 2: "#ea580c", 3: "#ca8a04" };
  return (<span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, color: "#fff", backgroundColor: colors[priority] || "#6b7280" }}>P{priority}</span>);
}

function confidenceBar(value: number, label: string): React.ReactNode {
  var pct = Math.round(value * 100);
  var color = pct >= 90 ? "#16a34a" : pct >= 75 ? "#ca8a04" : pct >= 50 ? "#ea580c" : "#dc2626";
  return (
    <div style={{ marginBottom: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "2px" }}>
        <span>{label}</span><span style={{ fontWeight: 700, color: color }}>{pct}%</span>
      </div>
      <div style={{ height: "6px", backgroundColor: "#e5e7eb", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: pct + "%", backgroundColor: color, borderRadius: "3px", transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function dispositionColor(d: string): string {
  if (d === "no_go") return "#dc2626";
  if (d === "repair_before_restart") return "#ea580c";
  if (d === "engineering_review_required") return "#ca8a04";
  if (d === "restricted_operation") return "#2563eb";
  return "#16a34a";
}

// ============================================================================
// CARD WRAPPER
// ============================================================================

function Card({ title, icon, children, status, collapsible = true }: { title: string; icon: string; children: React.ReactNode; status?: string; collapsible?: boolean; }) {
  var [collapsed, setCollapsed] = useState(false);
  return (
    <div className="voice-card" style={{ marginBottom: "16px", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", backgroundColor: "#fff" }}>
      <div onClick={() => collapsible && setCollapsed(!collapsed)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", backgroundColor: "#f9fafb", borderBottom: collapsed ? "none" : "1px solid #e5e7eb", cursor: collapsible ? "pointer" : "default", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>{icon}</span>
          <span style={{ fontWeight: 700, fontSize: "14px" }}>{title}</span>
          {status && <span style={{ fontSize: "11px", color: "#6b7280", marginLeft: "8px" }}>{status}</span>}
        </div>
        {collapsible && <span style={{ fontSize: "12px", color: "#9ca3af" }}>{collapsed ? "+" : "-"}</span>}
      </div>
      {!collapsed && <div style={{ padding: "16px" }}>{children}</div>}
    </div>
  );
}

// ============================================================================
// STEP TRACKER
// ============================================================================

interface StepState { label: string; status: "pending" | "running" | "done" | "error" | "waiting"; detail?: string; }

function StepTracker({ steps }: { steps: StepState[] }) {
  return (
    <div style={{ margin: "16px 0", padding: "12px 16px", backgroundColor: "#f0f4ff", borderRadius: "8px", border: "1px solid #dbeafe" }}>
      {steps.map((step, i) => {
        var icon = step.status === "done" ? "\u2705" : step.status === "running" ? "\u23f3" : step.status === "error" ? "\u274c" : step.status === "waiting" ? "\u23f8\ufe0f" : "\u25cb";
        var color = step.status === "done" ? "#16a34a" : step.status === "running" ? "#2563eb" : step.status === "error" ? "#dc2626" : step.status === "waiting" ? "#ca8a04" : "#9ca3af";
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", fontSize: "13px" }}>
            <span>{icon}</span>
            <span style={{ color: color, fontWeight: step.status === "running" ? 700 : step.status === "waiting" ? 600 : 400 }}>{step.label}</span>
            {step.detail && <span style={{ color: step.status === "waiting" ? "#ca8a04" : "#6b7280", fontSize: "11px" }}>{"\u2014"} {step.detail}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function VoiceInspectionPage() {
  var [transcript, setTranscript] = useState("");
  var [isGenerating, setIsGenerating] = useState(false);
  var [steps, setSteps] = useState<StepState[]>([]);
  var [pipelinePaused, setPipelinePaused] = useState(false);

  // API results
  var [parsed, setParsed] = useState<ParsedResult | null>(null);
  var [asset, setAsset] = useState<AssetResult | null>(null);
  var [governance, setGovernance] = useState<GovernanceResult | null>(null);
  var [codeAuthority, setCodeAuthority] = useState<CodeAuthorityResult | null>(null);
  var [masterRoute, setMasterRoute] = useState<any>(null);
  var [chain, setChain] = useState<ChainResult | null>(null);
  var [dominance, setDominance] = useState<any>(null);
  var [aiNarrative, setAiNarrative] = useState<string | null>(null);
  var [eventEnrich, setEventEnrich] = useState<EventEnrichResult | null>(null);
  var [timeProgression, setTimeProgression] = useState<TimeProgressionResult | null>(null);
  var [codeTrace, setCodeTrace] = useState<CodeTraceResult | null>(null);
  var [chainPerformance, setChainPerformance] = useState<any>(null);
  var [errors, setErrors] = useState<string[]>([]);
  var [activePackageTab, setActivePackageTab] = useState(0);
  var [activeTimelineTier, setActiveTimelineTier] = useState(0);
  var resultsRef = useRef<HTMLDivElement>(null);
  var [isListening, setIsListening] = useState(false);
  var recognitionRef = useRef<any>(null);
  var [aiQuestions, setAiQuestions] = useState<any[] | null>(null);
  var [aiUnderstood, setAiUnderstood] = useState<string | null>(null);
  var [aiInterpretation, setAiInterpretation] = useState<any>(null);
  var [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    var SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      var recognition = new SR();
      recognition.continuous = true; recognition.interimResults = true; recognition.lang = "en-US";
      recognition.onresult = (event: any) => { var ft = ""; for (var i = event.resultIndex; i < event.results.length; i++) { if (event.results[i].isFinal) ft += event.results[i][0].transcript + " "; } if (ft) setTranscript((prev) => prev + ft); };
      recognition.onerror = () => setIsListening(false); recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  function toggleMic() {
    if (!recognitionRef.current) { alert("Speech recognition not supported. Use Chrome."); return; }
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); } else { recognitionRef.current.start(); setIsListening(true); }
  }

  function updateStep(idx: number, updates: Partial<StepState>, current: StepState[]): StepState[] {
    var next = [...current]; next[idx] = { ...next[idx], ...updates }; return next;
  }

  // ============================================================================
  // MAIN GENERATE — now includes Decision Dominance (Engine 8) as step 6
  // Steps: 0=Parser, 1=Asset, 2=Gov, 3=CodeAuth, 4=Router, 5=Chain,
  //        6=DDL, 7=Narrative, 8=Enrich, 9=TimeProg, 10=CodeTrace
  // ============================================================================
  async function handleGenerate(transcriptOverride?: string) {
    var inputText = transcriptOverride || transcript;
    if (!inputText.trim()) return;

    setIsGenerating(true); setPipelinePaused(false); setErrors([]);
    setParsed(null); setAsset(null); setGovernance(null); setCodeAuthority(null);
    setMasterRoute(null); setChain(null); setDominance(null); setAiNarrative(null);
    setEventEnrich(null); setTimeProgression(null); setCodeTrace(null);
    setChainPerformance(null); setAiQuestions(null); setAiUnderstood(null);
    setAiInterpretation(null); setSelectedAnswers({});

    var initialSteps: StepState[] = [
      { label: "AI Incident Parser (GPT-4o)", status: "pending" },
      { label: "Resolve Asset", status: "pending" },
      { label: "Governance Matrix", status: "pending" },
      { label: "Code Authority Resolution", status: "pending" },
      { label: "Master Router", status: "pending" },
      { label: "Incident-to-Inspection Chain (7 engines)", status: "pending" },
      { label: "Decision Dominance (Engine 8)", status: "pending" },
      { label: "AI Narrative Polish (GPT-4o)", status: "pending" },
      { label: "Event Enrichment", status: "pending" },
      { label: "Time Progression", status: "pending" },
      { label: "Code Trace", status: "pending" },
    ];
    var s = [...initialSteps];
    setSteps(s);

    var errs: string[] = [];
    var parsedResult: ParsedResult | null = null;
    var assetResult: AssetResult | null = null;
    var chainResult: ChainResult | null = null;
    var dominanceResult: any = null;
    var needsMoreInfo = false;

    try {
      // ====== PHASE 1: PARALLEL — parse-incident + resolve-asset ======
      s = updateStep(0, { status: "running" }, s); s = updateStep(1, { status: "running" }, s); setSteps([...s]);

      var [parseRes, assetRes] = await Promise.allSettled([
        callAPI("parse-incident", { transcript: inputText }),
        callAPI("resolve-asset", { raw_text: inputText }),
      ]);

      if (parseRes.status === "fulfilled") {
        parsedResult = parseRes.value.parsed || parseRes.value; setParsed(parsedResult);
        if (parseRes.value.ai_interpretation) {
          setAiInterpretation(parseRes.value.ai_interpretation);
          if (parseRes.value.needs_input && parseRes.value.questions) { setAiQuestions(parseRes.value.questions); setAiUnderstood(parseRes.value.understood || ""); needsMoreInfo = true; }
          if (parseRes.value.resolved && !assetResult) { assetResult = parseRes.value.resolved; setAsset(assetResult); }
        }
        s = updateStep(0, { status: "done", detail: (parsedResult?.events?.length || 0) + " events (" + (parseRes.value.ai_interpretation?.status || "no_ai") + ")" }, s);
      } else { s = updateStep(0, { status: "error", detail: parseRes.reason?.message }, s); errs.push("parse-incident: " + parseRes.reason?.message); parsedResult = { events: [], environment: [], numeric_values: {}, raw_text: inputText }; setParsed(parsedResult); }

      if (assetRes.status === "fulfilled") {
        var resolveResult = assetRes.value.resolved || assetRes.value;
        var aiResolved = parseRes.status === "fulfilled" ? parseRes.value.resolved : null;
        assetResult = (aiResolved && resolveResult.confidence < 0.5 && aiResolved.confidence > 0.5) ? aiResolved : resolveResult;
        setAsset(assetResult);
        s = updateStep(1, { status: "done", detail: (assetResult?.asset_class || "") + " (" + Math.round((assetResult?.confidence || 0) * 100) + "%)" }, s);
      } else { s = updateStep(1, { status: "error" }, s); errs.push("resolve-asset: " + assetRes.reason?.message); assetResult = { asset_class: "pressure_vessel", asset_type: "pressure_vessel", confidence: 0.3 }; setAsset(assetResult); }
      setSteps([...s]);

      // ====== FLOW CONTROL ======
      if (needsMoreInfo) {
        for (var wi = 2; wi < s.length; wi++) s = updateStep(wi, { status: "waiting", detail: "waiting for your answers" }, s);
        setSteps([...s]); setErrors(errs); setIsGenerating(false); setPipelinePaused(true);
        setTimeout(() => { resultsRef.current?.scrollIntoView({ behavior: "smooth" }); }, 200);
        return;
      }

      // ====== PHASE 2: PARALLEL — governance + code-authority ======
      s = updateStep(2, { status: "running" }, s); s = updateStep(3, { status: "running" }, s); setSteps([...s]);
      var assetClass = assetResult?.asset_class || "pressure_vessel";
      var [govRes, codeAuthRes] = await Promise.allSettled([
        callAPI("governance-matrix", { raw_text: inputText, asset_class: assetClass }),
        callAPI("code-authority-resolution", { raw_text: inputText, asset_class: assetClass }),
      ]);
      if (govRes.status === "fulfilled") { setGovernance(govRes.value); s = updateStep(2, { status: "done" }, s); }
      else { s = updateStep(2, { status: "error" }, s); errs.push("governance: " + govRes.reason?.message); }
      if (codeAuthRes.status === "fulfilled") { setCodeAuthority(codeAuthRes.value); s = updateStep(3, { status: "done" }, s); }
      else { s = updateStep(3, { status: "error" }, s); errs.push("code-authority: " + codeAuthRes.reason?.message); }
      setSteps([...s]);

      // ====== PHASE 3: SEQUENTIAL — master-router ======
      s = updateStep(4, { status: "running" }, s); setSteps([...s]);
      try { var routerRes = await callAPI("master-router", { transcript: inputText }); setMasterRoute(routerRes); s = updateStep(4, { status: "done", detail: routerRes?.intake_path || "" }, s); }
      catch (e: any) { s = updateStep(4, { status: "error", detail: e.message }, s); errs.push("master-router: " + e.message); }
      setSteps([...s]);

      // ====== PHASE 4: INCIDENT-TO-INSPECTION CHAIN ======
      s = updateStep(5, { status: "running" }, s); setSteps([...s]);
      try {
        var chainRes = await callAPI("incident-inspection-chain", { parsed: parsedResult, asset: assetResult });
        chainResult = chainRes.chain || chainRes; setChain(chainResult); setChainPerformance(chainRes.performance || null);
        var mc = chainResult?.engine_1_damage_mechanisms?.length || 0;
        var zc = chainResult?.engine_2_affected_zones?.length || 0;
        var mtc = chainResult?.engine_3_inspection_methods?.length || 0;
        s = updateStep(5, { status: "done", detail: mc + " mechanisms, " + zc + " zones, " + mtc + " methods in " + (chainRes.performance?.total_ms || "?") + "ms" }, s);
      } catch (e: any) { s = updateStep(5, { status: "error", detail: e.message }, s); errs.push("chain: " + e.message); }
      setSteps([...s]);

      // ====== PHASE 4.5: DECISION DOMINANCE LAYER (Engine 8) ======
      s = updateStep(6, { status: "running" }, s); setSteps([...s]);
      try {
        var ddlRes = await callAPI("decision-dominance", { parsed: parsedResult, chain: chainResult, asset: assetResult });
        dominanceResult = ddlRes.dominance || ddlRes;
        setDominance(dominanceResult);
        var surv = dominanceResult.surviving_count || dominanceResult.mechanism_summary?.surviving_count || 0;
        var supp = dominanceResult.suppressed_count || dominanceResult.mechanism_summary?.suppressed_count || 0;
        s = updateStep(6, { status: "done", detail: surv + " survived, " + supp + " suppressed, " + (dominanceResult.disposition_label || "") + " in " + (dominanceResult.elapsed_ms || "?") + "ms" }, s);
      } catch (e: any) { s = updateStep(6, { status: "error", detail: e.message }, s); errs.push("decision-dominance: " + e.message); }
      setSteps([...s]);

      // ====== PHASE 5: AI NARRATIVE POLISH ======
      s = updateStep(7, { status: "running" }, s); setSteps([...s]);
      try {
        var lockedContext = "DETERMINISTIC CHAIN RESULTS (DO NOT OVERRIDE):\n";
        if (chainResult) {
          lockedContext += "Asset: " + (chainResult.input_summary?.asset_class || "unknown") + "\n";
          lockedContext += "Events: " + (chainResult.input_summary?.events?.join(", ") || "none") + "\n";
          var activeMechs = (chainResult.engine_1_damage_mechanisms || []).filter(function(m: DamageMechanism) { return !m.id.startsWith("TEMP_FILTERED"); });
          lockedContext += "Damage Mechanisms: " + activeMechs.map(function(m: DamageMechanism) { return m.name + " [" + m.severity + "]"; }).join("; ") + "\n";
          lockedContext += "Affected Zones: " + (chainResult.engine_2_affected_zones || []).map(function(z: AffectedZone) { return "P" + z.priority + " " + z.zone_name; }).join("; ") + "\n";
        }
        if (dominanceResult) {
          lockedContext += "DDL Disposition: " + (dominanceResult.disposition_label || "") + "\n";
          lockedContext += "Structural Authority: " + (dominanceResult.structural_authority?.status_label || "") + "\n";
          lockedContext += "DDL Surviving Mechanisms: " + (dominanceResult.surviving_mechanisms || []).map(function(m: any) { return m.family_name; }).join("; ") + "\n";
          lockedContext += "DDL Confidence: " + (dominanceResult.final_confidence || "") + "%\n";
        }
        var constrainedTranscript = "=== LOCKED DETERMINISTIC CONTEXT ===\n" + lockedContext + "\n=== ORIGINAL TRANSCRIPT ===\n" + inputText;
        var planRes = await callAPI("voice-incident-plan", { transcript: constrainedTranscript });
        var narrative = planRes?.plan || planRes?.text || planRes?.result || JSON.stringify(planRes);
        setAiNarrative(typeof narrative === "string" ? narrative : JSON.stringify(narrative));
        s = updateStep(7, { status: "done", detail: "prose generated" }, s);
      } catch (e: any) { s = updateStep(7, { status: "error", detail: e.message }, s); errs.push("narrative: " + e.message); }
      setSteps([...s]);

      // ====== PHASE 6: EVENT ENRICHMENT ======
      s = updateStep(8, { status: "running" }, s); setSteps([...s]);
      try { var enrichRes = await callAPI("event-enrich", { transcript: inputText, plan: aiNarrative || "", parsed: parsedResult }); setEventEnrich(enrichRes); s = updateStep(8, { status: "done" }, s); }
      catch (e: any) { s = updateStep(8, { status: "error", detail: e.message }, s); errs.push("event-enrich: " + e.message); }
      setSteps([...s]);

      // ====== PHASE 7: PARALLEL — time-progression + code-trace ======
      s = updateStep(9, { status: "running" }, s); s = updateStep(10, { status: "running" }, s); setSteps([...s]);
      var sevForTime = chainResult?.engine_1_damage_mechanisms?.find(function(m: DamageMechanism) { return m.severity === "critical"; }) ? "critical" : "medium";
      var findingsForTrace = chainResult?.engine_4_code_action_paths?.map(function(p: CodeActionPath) { return p.finding_type; }) || [];
      var methForTrace: string[] = []; (chainResult?.engine_3_inspection_methods || []).forEach(function(m: InspectionMethod) { if (methForTrace.indexOf(m.method_name) === -1) methForTrace.push(m.method_name); });
      var [timeRes, traceRes] = await Promise.allSettled([
        callAPI("time-progression", { asset_type: assetResult?.asset_type || "pressure_vessel", severity: sevForTime, service_env: parsedResult?.environment || [] }),
        callAPI("code-trace", { findings: findingsForTrace, methods: methForTrace, disposition: chainResult?.engine_4_code_action_paths?.[0]?.required_action || "", asset_class: assetClass }),
      ]);
      if (timeRes.status === "fulfilled") { setTimeProgression(timeRes.value); s = updateStep(9, { status: "done" }, s); }
      else { s = updateStep(9, { status: "error" }, s); errs.push("time: " + timeRes.reason?.message); }
      if (traceRes.status === "fulfilled") { setCodeTrace(traceRes.value); s = updateStep(10, { status: "done" }, s); }
      else { s = updateStep(10, { status: "error" }, s); errs.push("trace: " + traceRes.reason?.message); }
      setSteps([...s]);

    } catch (e: any) { errs.push("Pipeline error: " + e.message); }

    setErrors(errs); setIsGenerating(false);
    setTimeout(() => { resultsRef.current?.scrollIntoView({ behavior: "smooth" }); }, 200);
  }

  function handleGenerateWithAnswers() {
    var answers = Object.values(selectedAnswers).join(". ") + ".";
    var enrichedTranscript = transcript + " " + answers;
    setTranscript(enrichedTranscript); setAiQuestions(null); setSelectedAnswers({}); setPipelinePaused(false);
    handleGenerate(enrichedTranscript);
  }

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="voice-inspection-page" style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 4px 0", color: "#111" }}>NDT Superbrain — Voice Inspection Intelligence</h1>
        <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>Just have a conversation with the really smart AI. Speak or type — it understands any industry, any asset, any scenario.</p>
      </div>

      {/* ---- INPUT AREA ---- */}
      <div style={{ marginBottom: "20px", border: "1px solid #d1d5db", borderRadius: "8px", overflow: "hidden", backgroundColor: "#fff" }}>
        <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Describe what happened — speak or type the incident, inspection scenario, or assessment request..." style={{ width: "100%", minHeight: "120px", padding: "14px 16px", fontSize: "14px", lineHeight: "1.6", border: "none", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", backgroundColor: "#f9fafb", borderTop: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: "12px", color: "#9ca3af" }}>{transcript.length > 0 ? transcript.split(/\s+/).filter(Boolean).length + " words" : "Speak or type"}</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={toggleMic} style={{ padding: "8px 16px", fontSize: "14px", fontWeight: 700, color: isListening ? "#fff" : "#dc2626", backgroundColor: isListening ? "#dc2626" : "#fff", border: "2px solid #dc2626", borderRadius: "6px", cursor: "pointer" }}>{isListening ? "\uD83D\uDD34 Listening..." : "\uD83C\uDF99\uFE0F Mic"}</button>
            <button onClick={() => handleGenerate()} disabled={isGenerating || !transcript.trim()} style={{ padding: "8px 24px", fontSize: "14px", fontWeight: 700, color: "#fff", backgroundColor: isGenerating ? "#9ca3af" : "#2563eb", border: "none", borderRadius: "6px", cursor: isGenerating ? "not-allowed" : "pointer" }}>{isGenerating ? "Generating..." : "Generate Inspection Plan"}</button>
          </div>
        </div>
      </div>

      {steps.length > 0 && <StepTracker steps={steps} />}

      {pipelinePaused && (
        <div style={{ margin: "0 0 16px 0", padding: "12px 16px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>{"\u23F8\uFE0F"}</span>
          <div><div style={{ fontWeight: 700, fontSize: "13px", color: "#92400e" }}>Pipeline paused — AI needs more information</div><div style={{ fontSize: "12px", color: "#a16207" }}>Answer the questions below, then tap "Generate with Answers".</div></div>
        </div>
      )}

      {errors.length > 0 && (<div style={{ margin: "12px 0", padding: "12px 16px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px" }}>{errors.map((e, i) => (<div key={i} style={{ fontSize: "12px", color: "#dc2626", padding: "2px 0" }}>{e}</div>))}</div>)}

      <div ref={resultsRef}>

        {/* ---- AI FOLLOW-UP QUESTIONS ---- */}
        {aiQuestions && aiQuestions.length > 0 && (
          <Card title="AI Needs More Information" icon={"\uD83E\uDD14"} collapsible={false}>
            {aiUnderstood && (<div style={{ fontSize: "13px", color: "#374151", marginBottom: "12px", padding: "8px 12px", backgroundColor: "#f0fdf4", borderRadius: "6px", borderLeft: "3px solid #16a34a" }}><strong>Understood so far:</strong> {aiUnderstood}</div>)}
            <div style={{ fontSize: "13px", color: "#374151", marginBottom: "12px" }}>Tap your answers below, then hit <strong>Generate with Answers</strong>:</div>
            {aiQuestions.map((q: any, i: number) => {
              var qKey = "q" + i; var selected = selectedAnswers[qKey] || "";
              return (
                <div key={i} style={{ marginBottom: "14px", padding: "10px 12px", backgroundColor: selected ? "#f0fdf4" : "#fafafa", borderRadius: "6px", borderLeft: selected ? "3px solid #16a34a" : "3px solid #2563eb" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>{i + 1}. {q.question}{selected && <span style={{ marginLeft: "8px", color: "#16a34a", fontSize: "12px" }}>{"\u2705"} {selected}</span>}</div>
                  {q.why && <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "6px" }}>Why: {q.why}</div>}
                  {q.options && q.options.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                      {q.options.map((opt: string, oi: number) => {
                        var isSel = selected === opt;
                        return (<button key={oi} onClick={() => { setSelectedAnswers((prev) => { var n = { ...prev }; if (isSel) delete n[qKey]; else n[qKey] = opt; return n; }); }} style={{ padding: "6px 14px", fontSize: "13px", fontWeight: isSel ? 700 : 400, backgroundColor: isSel ? "#16a34a" : "#fff", color: isSel ? "#fff" : "#1e40af", border: isSel ? "2px solid #16a34a" : "2px solid #bfdbfe", borderRadius: "6px", cursor: "pointer" }}>{opt}</button>);
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {Object.keys(selectedAnswers).length > 0 && (
              <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}><strong>Your answers:</strong> {Object.values(selectedAnswers).join(" | ")}</div>
                <button onClick={handleGenerateWithAnswers} disabled={isGenerating} style={{ padding: "10px 28px", fontSize: "15px", fontWeight: 700, color: "#fff", backgroundColor: isGenerating ? "#9ca3af" : "#16a34a", border: "none", borderRadius: "6px", cursor: isGenerating ? "not-allowed" : "pointer", width: "100%" }}>{isGenerating ? "Generating..." : "\u2705 Generate with Answers"}</button>
              </div>
            )}
          </Card>
        )}

        {/* ==== DDL DISPOSITION CARD (Engine 8 — replaces old AI Disposition) ==== */}
        {dominance && (
          <Card title={dominance.disposition_label || "DISPOSITION"} icon={dominance.disposition === "no_go" ? "\uD83D\uDED1" : dominance.disposition === "repair_before_restart" ? "\u26D4" : "\u26A0\uFE0F"} collapsible={false}>
            <div style={{ padding: "12px 16px", borderRadius: "6px", marginBottom: "12px", fontWeight: 800, fontSize: "18px", color: "#fff", backgroundColor: dispositionColor(dominance.disposition), textAlign: "center" }}>
              {dominance.disposition_label}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div style={{ textAlign: "center", padding: "8px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
                <div style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>Risk Band</div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: severityColor(dominance.risk_band) }}>{(dominance.risk_band || "").toUpperCase()}</div>
              </div>
              <div style={{ textAlign: "center", padding: "8px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
                <div style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>Confidence</div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: dominance.final_confidence < 50 ? "#dc2626" : "#ca8a04" }}>{dominance.final_confidence}%</div>
              </div>
              <div style={{ textAlign: "center", padding: "8px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
                <div style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>Evidence</div>
                <div style={{ fontSize: "15px", fontWeight: 700 }}>{dominance.evidence_sufficiency?.label || "—"}</div>
              </div>
            </div>
            {dominance.management_summary && <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#374151" }}>{dominance.management_summary}</div>}
          </Card>
        )}

        {/* ==== STRUCTURAL AUTHORITY CARD ==== */}
        {dominance?.structural_authority && (
          <Card title={"Structural Authority: " + (dominance.structural_authority.status_label || "")} icon={dominance.structural_authority.status === "unstable" ? "\uD83D\uDEA8" : dominance.structural_authority.status === "stable" ? "\u2705" : "\u26A0\uFE0F"}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              {[
                { label: "Primary Member Damage", value: dominance.structural_authority.primary_member_damage },
                { label: "Load Path Concern", value: dominance.structural_authority.load_path_concern },
                { label: "Shoring/Isolation Recommended", value: dominance.structural_authority.immediate_shoring_or_isolation_recommended },
              ].map(function(item, i) {
                return (<div key={i} style={{ padding: "8px 12px", backgroundColor: item.value ? "#fef2f2" : "#f0fdf4", borderRadius: "6px", borderLeft: "3px solid " + (item.value ? "#dc2626" : "#16a34a") }}>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>{item.label}</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: item.value ? "#dc2626" : "#16a34a" }}>{item.value ? "YES" : "NO"}</div>
                </div>);
              })}
            </div>
            {dominance.structural_authority.rationale && dominance.structural_authority.rationale.map(function(r: string, i: number) { return <div key={i} style={{ fontSize: "12px", color: "#374151", padding: "2px 0" }}>{i + 1}. {r}</div>; })}
          </Card>
        )}

        {/* ==== HARD LOCKS CARD ==== */}
        {dominance?.hard_lock_triggers && dominance.hard_lock_triggers.filter(function(t: any) { return t.fired; }).length > 0 && (
          <Card title="Hard Lock Triggers" icon={"\uD83D\uDD12"} status={dominance.fired_lock_count + " of " + dominance.hard_lock_triggers.length + " fired"}>
            {dominance.hard_lock_triggers.filter(function(t: any) { return t.fired; }).map(function(t: any, i: number) {
              return (<div key={i} style={{ marginBottom: "10px", padding: "10px 12px", backgroundColor: "#fef2f2", borderRadius: "6px", borderLeft: "4px solid #dc2626" }}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#dc2626" }}>{t.name}</div>
                <div style={{ fontSize: "12px", color: "#374151", marginTop: "2px" }}>{t.rationale}</div>
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>Code basis: {t.code_basis}</div>
              </div>);
            })}
          </Card>
        )}

        {/* ==== DDL CONFIDENCE CARD (grouped penalties) ==== */}
        {dominance?.confidence_adjustments && dominance.confidence_adjustments.length > 0 && (
          <Card title="Decision Confidence" icon={"\uD83C\uDFAF"} status={dominance.initial_confidence + "% \u2192 " + dominance.final_confidence + "%"}>
            <div style={{ marginBottom: "12px" }}>
              {confidenceBar(dominance.final_confidence / 100, "Final Confidence")}
            </div>
            {dominance.confidence_adjustments.map(function(g: any, i: number) {
              return (<div key={i} style={{ marginBottom: "8px", padding: "8px 12px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 700, fontSize: "12px" }}>{g.group}</span>
                  <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 700 }}>{g.capped_delta}%{g.capped_delta !== g.raw_delta ? " (capped from " + g.raw_delta + "%)" : ""}</span>
                </div>
                {g.reasons.map(function(r: string, ri: number) { return <div key={ri} style={{ fontSize: "11px", color: "#6b7280", paddingLeft: "8px" }}>{"\u2022"} {r}</div>; })}
              </div>);
            })}
          </Card>
        )}

        {/* ==== MECHANISM FILTER CARD (surviving vs suppressed) ==== */}
        {dominance && (dominance.surviving_mechanisms || dominance.mechanism_summary) && (
          <Card title="Mechanism Filter (Engine 8)" icon={"\uD83E\uDDEA"} status={(dominance.mechanism_summary?.surviving_count || dominance.surviving_mechanisms?.length || 0) + " survived, " + (dominance.mechanism_summary?.suppressed_count || dominance.suppressed_mechanisms?.length || 0) + " suppressed"}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: "8px" }}>Surviving Mechanisms</div>
            {(dominance.surviving_mechanisms || []).map(function(m: any, i: number) {
              return (<div key={i} style={{ marginBottom: "6px", padding: "6px 10px", backgroundColor: "#f0fdf4", borderRadius: "4px", borderLeft: "3px solid " + severityColor(m.severity || m.adjusted_severity) }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {severityBadge(m.severity || m.adjusted_severity)}
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>{m.family_name || m.name}</span>
                  <span style={{ fontSize: "11px", color: "#6b7280" }}>({m.relevance_score || m.score})</span>
                </div>
                {m.merged_codes && m.merged_codes.length > 1 && <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}>Merged: {m.merged_codes.join(", ")}</div>}
                <div style={{ fontSize: "10px", color: "#16a34a" }}>{(m.reasons || []).join(", ")}</div>
              </div>);
            })}
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", marginTop: "16px", marginBottom: "8px" }}>Suppressed Mechanisms</div>
            {(dominance.suppressed_mechanisms || []).map(function(m: any, i: number) {
              return (<div key={i} style={{ marginBottom: "4px", padding: "4px 10px", backgroundColor: "#fef2f2", borderRadius: "4px", fontSize: "12px", color: "#991b1b", opacity: 0.8 }}>
                <span style={{ fontWeight: 600 }}>{m.family_name || m.name}</span>
                <span style={{ marginLeft: "8px", fontSize: "10px", color: "#6b7280" }}>({(m.reasons || []).join(", ")})</span>
              </div>);
            })}
          </Card>
        )}

        {/* ==== AI REASONING (from parser, if interpreted) ==== */}
        {aiInterpretation && aiInterpretation.status === "interpreted" && aiInterpretation.reasoning && (
          <Card title="AI Reasoning Chain" icon={"\uD83E\uDDE0"} status={"confidence: " + Math.round((aiInterpretation.confidence || 0) * 100) + "%"}>
            <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#374151" }}>{aiInterpretation.reasoning}</div>
          </Card>
        )}

        {/* ==== VERIFIED EXTRACTION ==== */}
        {parsed && asset && !pipelinePaused && (
          <Card title="Verified Extraction" icon={"\uD83D\uDD12"} status={(parsed.events?.length || 0) + " events, " + (parsed.environment?.length || 0) + " environments"}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Asset Resolution</div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "#111" }}>{asset.asset_class?.replace(/_/g, " ")}</div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>Confidence: {Math.round((asset.confidence || 0) * 100)}%</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Detected Events</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {(parsed.events || []).map((e, i) => (<span key={i} style={{ padding: "2px 8px", backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>{e}</span>))}
                  {(parsed.events || []).length === 0 && <span style={{ fontSize: "12px", color: "#9ca3af" }}>None</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Environment</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {(parsed.environment || []).map((e, i) => (<span key={i} style={{ padding: "2px 8px", backgroundColor: "#dbeafe", color: "#1e40af", borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>{e.replace(/_/g, " ")}</span>))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Numerics</div>
                {parsed.numeric_values && Object.entries(parsed.numeric_values).filter(function([, v]) { return v !== undefined; }).length > 0 ? Object.entries(parsed.numeric_values).filter(function([, v]) { return v !== undefined; }).map(function([k, v], i) { return <div key={i} style={{ fontSize: "13px" }}><span style={{ fontWeight: 600 }}>{k.replace(/_/g, " ")}:</span> {v}</div>; }) : <span style={{ fontSize: "12px", color: "#9ca3af" }}>None</span>}
              </div>
            </div>
          </Card>
        )}

        {/* ==== ENGINE 2: AFFECTED ZONES (prioritized by DDL if available) ==== */}
        {(dominance?.prioritized_inspection_sequence || chain?.engine_2_affected_zones) && (dominance?.prioritized_inspection_sequence?.length > 0 || (chain?.engine_2_affected_zones && chain.engine_2_affected_zones.length > 0)) && (
          <Card title="Prioritized Inspection Zones" icon={"\uD83D\uDCCD"} status={dominance ? "DDL-prioritized" : "chain output"}>
            {(dominance?.prioritized_inspection_sequence || chain?.engine_2_affected_zones || []).map(function(z: any, i: number) {
              var zName = z.zone_name || z.zone || "";
              var zPri = z.priority || 2;
              return (<div key={i} style={{ marginBottom: "8px", padding: "8px 12px", backgroundColor: zPri === 1 ? "#fef2f2" : "#f9fafb", borderRadius: "6px", borderLeft: "3px solid " + (zPri === 1 ? "#dc2626" : zPri === 2 ? "#ea580c" : "#6b7280") }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700 }}>{i + 1}.</span>
                  {priorityBadge(zPri)}
                  <span style={{ fontWeight: 700, fontSize: "13px" }}>{zName}</span>
                </div>
                {z.rationale && <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>{z.rationale}</div>}
              </div>);
            })}
          </Card>
        )}

        {/* ==== TOP METHODS (from DDL or chain) ==== */}
        {dominance?.top_methods && dominance.top_methods.length > 0 && (
          <Card title="Priority Methods" icon={"\uD83D\uDD2C"} status={dominance.method_filter ? (dominance.method_filter.surviving_count + " survived, " + dominance.method_filter.suppressed_count + " suppressed") : "DDL-ranked"}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: "6px" }}>Top Methods Now</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              {dominance.top_methods.map(function(m: string, i: number) {
                return <span key={i} style={{ padding: "6px 14px", backgroundColor: "#eff6ff", color: "#1e40af", borderRadius: "6px", fontSize: "13px", fontWeight: 700, border: "1px solid #bfdbfe" }}>{i + 1}. {m}</span>;
              })}
            </div>
            {dominance.method_filter?.suppressed_methods && dominance.method_filter.suppressed_methods.length > 0 && (
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", marginBottom: "6px" }}>Suppressed Methods (material/asset mismatch)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {dominance.method_filter.suppressed_methods.map(function(m: any, i: number) {
                    return <span key={i} style={{ padding: "4px 10px", backgroundColor: "#fef2f2", color: "#991b1b", borderRadius: "4px", fontSize: "12px", opacity: 0.8 }}>{m.method_name} <span style={{ fontSize: "10px", color: "#6b7280" }}>({m.reason.replace(/_/g, " ")})</span></span>;
                  })}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ==== ENGINE 4: CODE ACTION PATHS ==== */}
        {chain?.engine_4_code_action_paths && chain.engine_4_code_action_paths.length > 0 && (
          <Card title={"Engine 4 \u2014 Code Action Paths"} icon={"\uD83D\uDCDC"} status={chain.engine_4_code_action_paths.length + " finding types"}>
            {chain.engine_4_code_action_paths.map(function(p, i) {
              return (<div key={i} style={{ marginBottom: "12px", padding: "10px 12px", backgroundColor: "#fafafa", borderRadius: "6px", borderLeft: "3px solid " + (p.engineering_review_required ? "#dc2626" : "#2563eb") }}>
                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>{p.finding_type.replace(/_/g, " ")}{p.engineering_review_required && <span style={{ fontSize: "11px", color: "#dc2626", marginLeft: "8px" }}>ENGINEERING REVIEW REQUIRED</span>}</div>
                <div style={{ fontSize: "12px", color: "#374151" }}><strong>Code:</strong> {p.code_section} | <strong>FFS:</strong> {p.ffs_assessment}</div>
                <div style={{ fontSize: "12px", color: "#374151" }}><strong>Repair:</strong> {p.repair_standard} | <strong>Action:</strong> {p.required_action}</div>
              </div>);
            })}
          </Card>
        )}

        {/* ==== ENGINE 5: ESCALATION TIMELINE ==== */}
        {chain?.engine_5_escalation_timeline && chain.engine_5_escalation_timeline.length > 0 && (
          <Card title={"Engine 5 \u2014 Escalation Timeline"} icon={"\u23F1\uFE0F"} status={chain.engine_5_escalation_timeline.length + " tiers"}>
            <div style={{ display: "flex", gap: "4px", marginBottom: "12px", flexWrap: "wrap" }}>
              {chain.engine_5_escalation_timeline.map(function(tier, i) { return (<button key={i} onClick={() => setActiveTimelineTier(i)} style={{ padding: "6px 12px", fontSize: "12px", fontWeight: activeTimelineTier === i ? 700 : 400, color: activeTimelineTier === i ? "#fff" : "#374151", backgroundColor: activeTimelineTier === i ? (i === 0 ? "#dc2626" : i === 1 ? "#ea580c" : i === 2 ? "#ca8a04" : "#2563eb") : "#f3f4f6", border: "none", borderRadius: "4px", cursor: "pointer" }}>{tier.tier_name} ({tier.time_window})</button>); })}
            </div>
            {(() => { var tier = chain.engine_5_escalation_timeline[activeTimelineTier]; if (!tier) return null; return (<div><div style={{ marginBottom: "10px" }}><div style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "4px" }}>Actions</div>{tier.actions.map(function(a, i) { return <div key={i} style={{ fontSize: "12px", padding: "3px 0", color: "#374151" }}>{i+1}. {a}</div>; })}</div><div><div style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "4px" }}>Personnel</div>{tier.personnel_required.map(function(p, i) { return <div key={i} style={{ fontSize: "12px", color: "#374151" }}>{p}</div>; })}</div></div>); })()}
          </Card>
        )}

        {/* ==== ENGINE 6: EXECUTION PACKAGES ==== */}
        {chain?.engine_6_execution_packages && chain.engine_6_execution_packages.length > 0 && (
          <Card title={"Engine 6 \u2014 Execution Packages"} icon={"\uD83D\uDCCA"} status="Supervisor | Engineer | Executive">
            <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
              {chain.engine_6_execution_packages.map(function(pkg, i) { return (<button key={i} onClick={() => setActivePackageTab(i)} style={{ padding: "6px 12px", fontSize: "12px", fontWeight: activePackageTab === i ? 700 : 400, color: activePackageTab === i ? "#fff" : "#374151", backgroundColor: activePackageTab === i ? "#2563eb" : "#f3f4f6", border: "none", borderRadius: "4px", cursor: "pointer" }}>{pkg.role.split(" / ")[0]}</button>); })}
            </div>
            {(() => { var pkg = chain.engine_6_execution_packages[activePackageTab]; if (!pkg) return null; return (<div><div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>{pkg.role}</div><div style={{ fontSize: "12px", color: "#374151", marginBottom: "10px" }}>{pkg.summary}</div><div style={{ marginBottom: "10px" }}><div style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "4px" }}>Action Items</div>{pkg.action_items.map(function(a, i) { return <div key={i} style={{ fontSize: "12px", padding: "3px 0", color: "#374151" }}>{i+1}. {a}</div>; })}</div></div>); })()}
          </Card>
        )}

        {/* ==== AI NARRATIVE ==== */}
        {aiNarrative && (
          <Card title="AI Narrative Summary" icon={"\uD83E\uDD16"} status="GPT-4o prose — constrained by chain + DDL">
            <div style={{ fontSize: "13px", lineHeight: "1.7", color: "#374151", whiteSpace: "pre-wrap" }}>{aiNarrative}</div>
          </Card>
        )}

        {/* ==== DECISION TRACE (audit trail) ==== */}
        {dominance?.decision_trace && dominance.decision_trace.length > 0 && (
          <Card title="Decision Trace (Audit)" icon={"\uD83D\uDCCB"}>
            {dominance.decision_trace.map(function(t: string, i: number) {
              var isLock = t.indexOf("HARD LOCK") !== -1;
              return <div key={i} style={{ fontSize: "12px", padding: "3px 0", color: isLock ? "#dc2626" : "#374151", fontWeight: isLock ? 700 : 400 }}>{i + 1}. {t}</div>;
            })}
          </Card>
        )}

        {/* ==== REMAINING CARDS (governance, code authority, time, event, code trace) ==== */}
        {governance && (<Card title="Governance Matrix" icon={"\uD83C\uDFDB\uFE0F"}><pre style={{ fontSize: "12px", overflow: "auto", maxHeight: "200px", backgroundColor: "#f9fafb", padding: "10px", borderRadius: "4px" }}>{JSON.stringify(governance, null, 2)}</pre></Card>)}
        {codeAuthority && (<Card title="Code Authority Resolution" icon={"\uD83D\uDCD6"}><pre style={{ fontSize: "12px", overflow: "auto", maxHeight: "200px", backgroundColor: "#f9fafb", padding: "10px", borderRadius: "4px" }}>{JSON.stringify(codeAuthority, null, 2)}</pre></Card>)}
        {timeProgression && (<Card title="Time Progression" icon={"\uD83D\uDCC8"}><pre style={{ fontSize: "12px", overflow: "auto", maxHeight: "200px", backgroundColor: "#f9fafb", padding: "10px", borderRadius: "4px" }}>{JSON.stringify(timeProgression, null, 2)}</pre></Card>)}
        {eventEnrich && (<Card title="Event Classification" icon={"\uD83C\uDF10"}><pre style={{ fontSize: "12px", overflow: "auto", maxHeight: "200px", backgroundColor: "#f9fafb", padding: "10px", borderRadius: "4px" }}>{JSON.stringify(eventEnrich, null, 2)}</pre></Card>)}
        {codeTrace && (<Card title="Code Trace" icon={"\uD83D\uDD0D"}><pre style={{ fontSize: "12px", overflow: "auto", maxHeight: "200px", backgroundColor: "#f9fafb", padding: "10px", borderRadius: "4px" }}>{JSON.stringify(codeTrace, null, 2)}</pre></Card>)}

        {chain?.warnings && chain.warnings.length > 0 && (
          <Card title="Chain Warnings" icon={"\u26A0\uFE0F"} collapsible={false}>
            {chain.warnings.map(function(w, i) { return <div key={i} style={{ fontSize: "12px", color: "#92400e", padding: "3px 0" }}>{w}</div>; })}
          </Card>
        )}

      </div>
    </div>
  );
}
