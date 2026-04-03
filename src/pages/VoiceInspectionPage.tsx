// DEPLOY85 — VoiceInspectionPage.tsx v7
// Full pipeline with mic input, AI-powered parsing, deterministic chain
// "Just have a conversation with the really smart AI"

import React, { useState, useRef, useEffect } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface NumericValues {
  wind_speed_mph?: number;
  wave_height_ft?: number;
  pressure_psi?: number;
  temperature_f?: number;
  distance_miles?: number;
  thickness_in?: number;
  diameter_in?: number;
  duration_hours?: number;
  [key: string]: number | undefined;
}

interface ParsedResult {
  events: string[];
  environment: string[];
  numeric_values: NumericValues;
  raw_text: string;
}

interface AssetResult {
  asset_class: string;
  asset_type: string;
  confidence: number;
  alternatives?: Array<{ asset_class: string; score: number }>;
}

interface DamageMechanism {
  id: string;
  name: string;
  api_571_ref: string;
  description: string;
  source_trigger: string;
  severity: string;
  requires_immediate_action: boolean;
  susceptible_materials: string[];
  temperature_range_f: { min: number; max: number } | null;
  contributing_factors: string[];
}

interface AffectedZone {
  zone_id: string;
  zone_name: string;
  priority: number;
  damage_mechanisms: string[];
  rationale: string;
  asset_specific: boolean;
}

interface InspectionMethod {
  method_id: string;
  method_name: string;
  technique_variant: string;
  target_mechanism: string;
  target_zone: string;
  detection_capability: string;
  sizing_capability: string;
  code_reference: string;
  rationale: string;
  priority: number;
  personnel_qualification: string;
  limitations: string;
}

interface CodeActionPath {
  finding_type: string;
  primary_code: string;
  code_section: string;
  required_action: string;
  ffs_assessment: string;
  repair_standard: string;
  documentation_required: string[];
  engineering_review_required: boolean;
}

interface EscalationTier {
  tier_name: string;
  time_window: string;
  hours_min: number;
  hours_max: number;
  actions: string[];
  personnel_required: string[];
  notifications: string[];
  documentation: string[];
}

interface ExecutionPackage {
  role: string;
  summary: string;
  action_items: string[];
  timeline: string;
  key_decisions: string[];
  resources_needed: string[];
}

interface ChainResult {
  engine_version: string;
  timestamp: string;
  input_summary: {
    asset_class: string;
    asset_type: string;
    events: string[];
    environment: string[];
    numeric_values: NumericValues;
  };
  engine_1_damage_mechanisms: DamageMechanism[];
  engine_2_affected_zones: AffectedZone[];
  engine_3_inspection_methods: InspectionMethod[];
  engine_4_code_action_paths: CodeActionPath[];
  engine_5_escalation_timeline: EscalationTier[];
  engine_6_execution_packages: ExecutionPackage[];
  confidence_scores: {
    mechanism_confidence: number;
    zone_confidence: number;
    method_confidence: number;
    overall_confidence: number;
  };
  warnings: string[];
}

interface GovernanceResult {
  layers?: Array<{ layer: string; authority: string; status: string }>;
  [key: string]: any;
}

interface CodeAuthorityResult {
  primary_code?: string;
  execution_order?: string[];
  conflicts?: string[];
  [key: string]: any;
}

interface TimeProgressionResult {
  mechanisms?: Array<{ name: string; probability_curve?: number[] }>;
  [key: string]: any;
}

interface CodeTraceResult {
  citations?: Array<{ code: string; clause: string; requirement: string }>;
  [key: string]: any;
}

interface EventEnrichResult {
  classification?: string;
  rule_packs?: string[];
  [key: string]: any;
}

// ============================================================================
// API HELPER
// ============================================================================

const API_BASE = "/api";

async function callAPI(endpoint: string, body: any): Promise<any> {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${endpoint} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ============================================================================
// SEVERITY HELPERS
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
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 700,
        color: "#fff",
        backgroundColor: severityColor(severity),
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {severity}
    </span>
  );
}

function priorityBadge(priority: number): React.ReactNode {
  const colors: { [key: number]: string } = { 1: "#dc2626", 2: "#ea580c", 3: "#ca8a04" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 700,
        color: "#fff",
        backgroundColor: colors[priority] || "#6b7280",
      }}
    >
      P{priority}
    </span>
  );
}

function confidenceBar(value: number, label: string): React.ReactNode {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "#16a34a" : pct >= 75 ? "#ca8a04" : pct >= 50 ? "#ea580c" : "#dc2626";
  return (
    <div style={{ marginBottom: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "2px" }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: "6px", backgroundColor: "#e5e7eb", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, backgroundColor: color, borderRadius: "3px", transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ============================================================================
// CARD WRAPPER
// ============================================================================

function Card({ title, icon, children, status, collapsible = true }: {
  title: string;
  icon: string;
  children: React.ReactNode;
  status?: string;
  collapsible?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="voice-card" style={{ marginBottom: "16px", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", backgroundColor: "#fff" }}>
      <div
        onClick={() => collapsible && setCollapsed(!collapsed)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          backgroundColor: "#f9fafb",
          borderBottom: collapsed ? "none" : "1px solid #e5e7eb",
          cursor: collapsible ? "pointer" : "default",
          userSelect: "none",
        }}
      >
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

interface StepState {
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

function StepTracker({ steps }: { steps: StepState[] }) {
  return (
    <div style={{ margin: "16px 0", padding: "12px 16px", backgroundColor: "#f0f4ff", borderRadius: "8px", border: "1px solid #dbeafe" }}>
      {steps.map((step, i) => {
        const icon = step.status === "done" ? "\u2705" : step.status === "running" ? "\u23f3" : step.status === "error" ? "\u274c" : "\u25cb";
        const color = step.status === "done" ? "#16a34a" : step.status === "running" ? "#2563eb" : step.status === "error" ? "#dc2626" : "#9ca3af";
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", fontSize: "13px" }}>
            <span>{icon}</span>
            <span style={{ color, fontWeight: step.status === "running" ? 700 : 400 }}>{step.label}</span>
            {step.detail && <span style={{ color: "#6b7280", fontSize: "11px" }}>— {step.detail}</span>}
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
  // Input state
  const [transcript, setTranscript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Pipeline step tracking
  const [steps, setSteps] = useState<StepState[]>([]);

  // API results
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [asset, setAsset] = useState<AssetResult | null>(null);
  const [governance, setGovernance] = useState<GovernanceResult | null>(null);
  const [codeAuthority, setCodeAuthority] = useState<CodeAuthorityResult | null>(null);
  const [masterRoute, setMasterRoute] = useState<any>(null);
  const [chain, setChain] = useState<ChainResult | null>(null);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [eventEnrich, setEventEnrich] = useState<EventEnrichResult | null>(null);
  const [timeProgression, setTimeProgression] = useState<TimeProgressionResult | null>(null);
  const [codeTrace, setCodeTrace] = useState<CodeTraceResult | null>(null);
  const [chainPerformance, setChainPerformance] = useState<any>(null);

  // Error state
  const [errors, setErrors] = useState<string[]>([]);

  // Active tab for execution packages
  const [activePackageTab, setActivePackageTab] = useState(0);

  // Active tab for escalation timeline
  const [activeTimelineTier, setActiveTimelineTier] = useState(0);

  // Ref for auto-scroll
  const resultsRef = useRef<HTMLDivElement>(null);

  // Mic / speech recognition
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // AI follow-up questions (from DEPLOY84 parse-incident)
  const [aiQuestions, setAiQuestions] = useState<any[] | null>(null);
  const [aiUnderstood, setAiUnderstood] = useState<string | null>(null);
  const [aiInterpretation, setAiInterpretation] = useState<any>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: string }>({});

  // Initialize speech recognition on mount
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event: any) => {
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript + " ";
          }
        }
        if (finalText) setTranscript((prev) => prev + finalText);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  function toggleMic() {
    if (!recognitionRef.current) {
      alert("Speech recognition not supported in this browser. Use Chrome for voice input.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }

  // ---- Step updater helper ----
  function updateStep(idx: number, updates: Partial<StepState>, current: StepState[]): StepState[] {
    const next = [...current];
    next[idx] = { ...next[idx], ...updates };
    return next;
  }

  // ---- MAIN GENERATE FUNCTION ----
  async function handleGenerate() {
    if (!transcript.trim()) return;

    setIsGenerating(true);
    setErrors([]);
    setParsed(null);
    setAsset(null);
    setGovernance(null);
    setCodeAuthority(null);
    setMasterRoute(null);
    setChain(null);
    setAiNarrative(null);
    setEventEnrich(null);
    setTimeProgression(null);
    setCodeTrace(null);
    setChainPerformance(null);
    setAiQuestions(null);
    setAiUnderstood(null);
    setAiInterpretation(null);
    setSelectedAnswers({});

    const initialSteps: StepState[] = [
      { label: "AI Incident Parser (GPT-4o)", status: "pending" },
      { label: "Resolve Asset", status: "pending" },
      { label: "Governance Matrix", status: "pending" },
      { label: "Code Authority Resolution", status: "pending" },
      { label: "Master Router", status: "pending" },
      { label: "Incident-to-Inspection Chain (6 engines)", status: "pending" },
      { label: "AI Narrative Polish (GPT-4o)", status: "pending" },
      { label: "Event Enrichment", status: "pending" },
      { label: "Time Progression", status: "pending" },
      { label: "Code Trace", status: "pending" },
    ];
    let s = [...initialSteps];
    setSteps(s);

    const errs: string[] = [];
    let parsedResult: ParsedResult | null = null;
    let assetResult: AssetResult | null = null;
    let chainResult: ChainResult | null = null;

    try {
      // ====== PHASE 1: PARALLEL — parse-incident + resolve-asset ======
      s = updateStep(0, { status: "running" }, s);
      s = updateStep(1, { status: "running" }, s);
      setSteps([...s]);

      const [parseRes, assetRes] = await Promise.allSettled([
        callAPI("parse-incident", { transcript }),
        callAPI("resolve-asset", { raw_text: transcript }),
      ]);

      if (parseRes.status === "fulfilled") {
        parsedResult = parseRes.value.parsed || parseRes.value;
        setParsed(parsedResult);

        // Capture AI interpretation from DEPLOY84
        if (parseRes.value.ai_interpretation) {
          setAiInterpretation(parseRes.value.ai_interpretation);

          // If AI is asking follow-up questions
          if (parseRes.value.needs_input && parseRes.value.questions) {
            setAiQuestions(parseRes.value.questions);
            setAiUnderstood(parseRes.value.understood || "");
          }

          // If AI provided asset resolution, use it as fallback
          if (parseRes.value.resolved && !assetResult) {
            assetResult = parseRes.value.resolved;
            setAsset(assetResult);
          }
        }

        const evtCount = parsedResult?.events?.length || 0;
        const envCount = parsedResult?.environment?.length || 0;
        const aiStatus = parseRes.value.ai_interpretation?.status || "no_ai";
        s = updateStep(0, { status: "done", detail: `${evtCount} events, ${envCount} environments (${aiStatus})` }, s);
      } else {
        s = updateStep(0, { status: "error", detail: parseRes.reason?.message }, s);
        errs.push("parse-incident: " + parseRes.reason?.message);
        parsedResult = { events: [], environment: [], numeric_values: {}, raw_text: transcript };
        setParsed(parsedResult);
      }

      if (assetRes.status === "fulfilled") {
        // Use resolve-asset result, but AI interpretation may override if resolve-asset gives low confidence
        const resolveResult = assetRes.value.resolved || assetRes.value;
        const aiResolved = parseRes.status === "fulfilled" ? parseRes.value.resolved : null;

        if (aiResolved && resolveResult.confidence < 0.5 && aiResolved.confidence > 0.5) {
          // AI interpretation is more confident — use it
          assetResult = aiResolved;
        } else {
          assetResult = resolveResult;
        }
        setAsset(assetResult);
        s = updateStep(1, { status: "done", detail: `${assetResult?.asset_class} (${Math.round((assetResult?.confidence || 0) * 100)}%)` }, s);
      } else {
        s = updateStep(1, { status: "error", detail: assetRes.reason?.message }, s);
        errs.push("resolve-asset: " + assetRes.reason?.message);
        // Fall back to AI resolution if available
        const aiResolved = parseRes.status === "fulfilled" ? parseRes.value.resolved : null;
        assetResult = aiResolved || { asset_class: "pressure_vessel", asset_type: "pressure_vessel", confidence: 0.3 };
        setAsset(assetResult);
      }
      setSteps([...s]);

      // ====== PHASE 2: PARALLEL — governance + code-authority (with asset_class) ======
      s = updateStep(2, { status: "running" }, s);
      s = updateStep(3, { status: "running" }, s);
      setSteps([...s]);

      const assetClass = assetResult?.asset_class || "pressure_vessel";

      const [govRes, codeAuthRes] = await Promise.allSettled([
        callAPI("governance-matrix", { raw_text: transcript, asset_class: assetClass }),
        callAPI("code-authority-resolution", { raw_text: transcript, asset_class: assetClass }),
      ]);

      if (govRes.status === "fulfilled") {
        setGovernance(govRes.value);
        s = updateStep(2, { status: "done" }, s);
      } else {
        s = updateStep(2, { status: "error", detail: govRes.reason?.message }, s);
        errs.push("governance: " + govRes.reason?.message);
      }

      if (codeAuthRes.status === "fulfilled") {
        setCodeAuthority(codeAuthRes.value);
        s = updateStep(3, { status: "done" }, s);
      } else {
        s = updateStep(3, { status: "error", detail: codeAuthRes.reason?.message }, s);
        errs.push("code-authority: " + codeAuthRes.reason?.message);
      }
      setSteps([...s]);

      // ====== PHASE 3: SEQUENTIAL — master-router ======
      s = updateStep(4, { status: "running" }, s);
      setSteps([...s]);

      try {
        const routerRes = await callAPI("master-router", { transcript });
        setMasterRoute(routerRes);
        s = updateStep(4, { status: "done", detail: routerRes?.intake_path || "" }, s);
      } catch (e: any) {
        s = updateStep(4, { status: "error", detail: e.message }, s);
        errs.push("master-router: " + e.message);
      }
      setSteps([...s]);

      // ====== PHASE 4: INCIDENT-TO-INSPECTION CHAIN (THE CORE) ======
      s = updateStep(5, { status: "running" }, s);
      setSteps([...s]);

      try {
        const chainRes = await callAPI("incident-inspection-chain", {
          parsed: parsedResult,
          asset: assetResult,
        });
        chainResult = chainRes.chain || chainRes;
        setChain(chainResult);
        setChainPerformance(chainRes.performance || null);
        const mechCount = chainResult?.engine_1_damage_mechanisms?.length || 0;
        const zoneCount = chainResult?.engine_2_affected_zones?.length || 0;
        const methodCount = chainResult?.engine_3_inspection_methods?.length || 0;
        s = updateStep(5, { status: "done", detail: `${mechCount} mechanisms, ${zoneCount} zones, ${methodCount} methods in ${chainRes.performance?.total_ms || "?"}ms` }, s);
      } catch (e: any) {
        s = updateStep(5, { status: "error", detail: e.message }, s);
        errs.push("incident-inspection-chain: " + e.message);
      }
      setSteps([...s]);

      // ====== PHASE 5: AI NARRATIVE POLISH (GPT-4o — demoted) ======
      s = updateStep(6, { status: "running" }, s);
      setSteps([...s]);

      try {
        // Build locked context from chain results
        let lockedContext = "DETERMINISTIC CHAIN RESULTS (DO NOT OVERRIDE — use ONLY these findings):\n";
        if (chainResult) {
          lockedContext += "Asset: " + (chainResult.input_summary?.asset_class || "unknown") + "\n";
          lockedContext += "Events: " + (chainResult.input_summary?.events?.join(", ") || "none") + "\n";
          lockedContext += "Environment: " + (chainResult.input_summary?.environment?.join(", ") || "none") + "\n";
          lockedContext += "Damage Mechanisms: " + (chainResult.engine_1_damage_mechanisms || []).filter((m: DamageMechanism) => !m.id.startsWith("TEMP_FILTERED")).map((m: DamageMechanism) => m.name + " [" + m.severity + "]").join("; ") + "\n";
          lockedContext += "Affected Zones: " + (chainResult.engine_2_affected_zones || []).map((z: AffectedZone) => "P" + z.priority + " " + z.zone_name).join("; ") + "\n";

          // Summarize methods by unique technique
          const uniqueTechniques: string[] = [];
          (chainResult.engine_3_inspection_methods || []).forEach((m: InspectionMethod) => {
            if (uniqueTechniques.indexOf(m.technique_variant) === -1) uniqueTechniques.push(m.technique_variant);
          });
          lockedContext += "Inspection Methods: " + uniqueTechniques.join("; ") + "\n";
          lockedContext += "Code Paths: " + (chainResult.engine_4_code_action_paths || []).map((p: CodeActionPath) => p.finding_type + " → " + p.primary_code).join("; ") + "\n";
        }
        if (parsedResult && parsedResult.numeric_values) {
          const nums = parsedResult.numeric_values;
          const numParts: string[] = [];
          if (nums.wind_speed_mph !== undefined) numParts.push("Wind: " + nums.wind_speed_mph + " mph");
          if (nums.wave_height_ft !== undefined) numParts.push("Waves: " + nums.wave_height_ft + " ft");
          if (nums.pressure_psi !== undefined) numParts.push("Pressure: " + nums.pressure_psi + " psi");
          if (nums.temperature_f !== undefined) numParts.push("Temperature: " + nums.temperature_f + " F");
          if (numParts.length > 0) lockedContext += "Verified Numerics: " + numParts.join(", ") + "\n";
        }

        const constrainedTranscript = "=== LOCKED DETERMINISTIC CONTEXT ===\n" + lockedContext + "\n=== ORIGINAL TRANSCRIPT ===\n" + transcript;

        const planRes = await callAPI("voice-incident-plan", { transcript: constrainedTranscript });
        const narrative = planRes?.plan || planRes?.text || planRes?.result || JSON.stringify(planRes);
        setAiNarrative(typeof narrative === "string" ? narrative : JSON.stringify(narrative));
        s = updateStep(6, { status: "done", detail: "prose generated from chain data" }, s);
      } catch (e: any) {
        s = updateStep(6, { status: "error", detail: e.message }, s);
        errs.push("voice-incident-plan: " + e.message);
      }
      setSteps([...s]);

      // ====== PHASE 6: EVENT ENRICHMENT ======
      s = updateStep(7, { status: "running" }, s);
      setSteps([...s]);

      try {
        const enrichRes = await callAPI("event-enrich", {
          transcript,
          plan: aiNarrative || "",
          parsed: parsedResult,
        });
        setEventEnrich(enrichRes);
        s = updateStep(7, { status: "done" }, s);
      } catch (e: any) {
        s = updateStep(7, { status: "error", detail: e.message }, s);
        errs.push("event-enrich: " + e.message);
      }
      setSteps([...s]);

      // ====== PHASE 7: PARALLEL — time-progression + code-trace ======
      s = updateStep(8, { status: "running" }, s);
      s = updateStep(9, { status: "running" }, s);
      setSteps([...s]);

      // Build inputs from chain results
      const severityForTime = chainResult?.engine_1_damage_mechanisms?.find((m: DamageMechanism) => m.severity === "critical")
        ? "critical"
        : chainResult?.engine_1_damage_mechanisms?.find((m: DamageMechanism) => m.severity === "high")
          ? "high"
          : "medium";
      const serviceEnvForTime = chainResult?.input_summary?.environment || parsedResult?.environment || [];

      const findingsForTrace = chainResult?.engine_4_code_action_paths?.map((p: CodeActionPath) => p.finding_type) || [];
      const methodsForTrace = [...new Set((chainResult?.engine_3_inspection_methods || []).map((m: InspectionMethod) => m.method_name))];
      const dispositionForTrace = chainResult?.engine_4_code_action_paths?.[0]?.required_action || "";

      const [timeRes, traceRes] = await Promise.allSettled([
        callAPI("time-progression", {
          asset_type: assetResult?.asset_type || assetResult?.asset_class || "pressure_vessel",
          severity: severityForTime,
          service_env: serviceEnvForTime,
        }),
        callAPI("code-trace", {
          findings: findingsForTrace,
          methods: methodsForTrace,
          disposition: dispositionForTrace,
          asset_class: assetClass,
        }),
      ]);

      if (timeRes.status === "fulfilled") {
        setTimeProgression(timeRes.value);
        s = updateStep(8, { status: "done" }, s);
      } else {
        s = updateStep(8, { status: "error", detail: timeRes.reason?.message }, s);
        errs.push("time-progression: " + timeRes.reason?.message);
      }

      if (traceRes.status === "fulfilled") {
        setCodeTrace(traceRes.value);
        s = updateStep(9, { status: "done" }, s);
      } else {
        s = updateStep(9, { status: "error", detail: traceRes.reason?.message }, s);
        errs.push("code-trace: " + traceRes.reason?.message);
      }
      setSteps([...s]);

    } catch (e: any) {
      errs.push("Pipeline error: " + e.message);
    }

    setErrors(errs);
    setIsGenerating(false);

    // Auto-scroll to results
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 200);
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="voice-inspection-page" style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px" }}>
      {/* ---- HEADER ---- */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 4px 0", color: "#111" }}>
          NDT Superbrain — Voice Inspection Intelligence
        </h1>
        <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>
          Just have a conversation with the really smart AI. Speak or type — it understands any industry, any asset, any scenario.
        </p>
      </div>

      {/* ---- INPUT AREA ---- */}
      <div style={{ marginBottom: "20px", border: "1px solid #d1d5db", borderRadius: "8px", overflow: "hidden", backgroundColor: "#fff" }}>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Describe what happened — speak or type the incident, inspection scenario, or assessment request. Example: 'Hurricane with 92 mph winds hit our offshore platform. Sour service pressure vessel operating at 850 psi and 650 degrees F. Wave heights reached 18 feet.'"
          style={{
            width: "100%",
            minHeight: "120px",
            padding: "14px 16px",
            fontSize: "14px",
            lineHeight: "1.6",
            border: "none",
            outline: "none",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", backgroundColor: "#f9fafb", borderTop: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: "12px", color: "#9ca3af" }}>
            {transcript.length > 0 ? `${transcript.split(/\s+/).filter(Boolean).length} words` : "Speak or type your inspection scenario"}
          </span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={toggleMic}
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: 700,
                color: isListening ? "#fff" : "#dc2626",
                backgroundColor: isListening ? "#dc2626" : "#fff",
                border: "2px solid #dc2626",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              {isListening ? "\uD83D\uDD34 Listening..." : "\uD83C\uDF99\uFE0F Mic"}
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !transcript.trim()}
              style={{
                padding: "8px 24px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#fff",
                backgroundColor: isGenerating ? "#9ca3af" : "#2563eb",
                border: "none",
                borderRadius: "6px",
                cursor: isGenerating ? "not-allowed" : "pointer",
              }}
            >
              {isGenerating ? "Generating..." : "Generate Inspection Plan"}
            </button>
          </div>
        </div>
      </div>

      {/* ---- STEP TRACKER ---- */}
      {steps.length > 0 && <StepTracker steps={steps} />}

      {/* ---- ERRORS ---- */}
      {errors.length > 0 && (
        <div style={{ margin: "12px 0", padding: "12px 16px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px" }}>
          {errors.map((e, i) => (
            <div key={i} style={{ fontSize: "12px", color: "#dc2626", padding: "2px 0" }}>{e}</div>
          ))}
        </div>
      )}

      {/* ---- RESULTS ---- */}
      <div ref={resultsRef}>

        {/* ---- AI FOLLOW-UP QUESTIONS (when parser needs more info) ---- */}
        {aiQuestions && aiQuestions.length > 0 && (
          <Card title="AI Needs More Information" icon="\uD83E\uDD14" collapsible={false}>
            {aiUnderstood && (
              <div style={{ fontSize: "13px", color: "#374151", marginBottom: "12px", padding: "8px 12px", backgroundColor: "#f0fdf4", borderRadius: "6px", borderLeft: "3px solid #16a34a" }}>
                <strong>Understood so far:</strong> {aiUnderstood}
              </div>
            )}
            <div style={{ fontSize: "13px", color: "#374151", marginBottom: "12px" }}>
              Tap your answers below, then hit <strong>Generate with Answers</strong> at the bottom:
            </div>
            {aiQuestions.map((q: any, i: number) => {
              const qKey = "q" + i;
              const selected = selectedAnswers[qKey] || "";
              return (
                <div key={i} style={{ marginBottom: "14px", padding: "10px 12px", backgroundColor: selected ? "#f0fdf4" : "#fafafa", borderRadius: "6px", borderLeft: selected ? "3px solid #16a34a" : "3px solid #2563eb", transition: "all 0.2s" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>
                    {i + 1}. {q.question}
                    {selected && <span style={{ marginLeft: "8px", color: "#16a34a", fontSize: "12px" }}>{"\u2705"} {selected}</span>}
                  </div>
                  {q.why && <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "6px" }}>Why: {q.why}</div>}
                  {q.options && q.options.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                      {q.options.map((opt: string, oi: number) => {
                        const isSelected = selected === opt;
                        return (
                          <button
                            key={oi}
                            onClick={() => {
                              setSelectedAnswers((prev) => {
                                const next = { ...prev };
                                if (isSelected) {
                                  delete next[qKey];
                                } else {
                                  next[qKey] = opt;
                                }
                                return next;
                              });
                            }}
                            style={{
                              padding: "6px 14px",
                              fontSize: "13px",
                              fontWeight: isSelected ? 700 : 400,
                              backgroundColor: isSelected ? "#16a34a" : "#fff",
                              color: isSelected ? "#fff" : "#1e40af",
                              border: isSelected ? "2px solid #16a34a" : "2px solid #bfdbfe",
                              borderRadius: "6px",
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {Object.keys(selectedAnswers).length > 0 && (
              <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>
                  <strong>Your answers:</strong> {Object.values(selectedAnswers).join(" | ")}
                </div>
                <button
                  onClick={() => {
                    const answers = Object.values(selectedAnswers).join(". ") + ".";
                    setTranscript((prev) => prev + " " + answers);
                    setAiQuestions(null);
                    setSelectedAnswers({});
                    setTimeout(() => handleGenerate(), 300);
                  }}
                  style={{
                    padding: "10px 28px",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#fff",
                    backgroundColor: "#16a34a",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  {"\u2705"} Generate with Answers
                </button>
              </div>
            )}
          </Card>
        )}

        {/* ---- AI FULL INTERPRETATION (when parser has enough info) ---- */}
        {aiInterpretation && aiInterpretation.status === "interpreted" && aiInterpretation.disposition && (
          <Card
            title={"AI Disposition: " + (aiInterpretation.disposition.decision || "").replace(/_/g, " ")}
            icon={aiInterpretation.disposition.decision === "NO_GO" ? "\uD83D\uDED1" : aiInterpretation.disposition.decision === "RESTRICTED" ? "\u26A0\uFE0F" : "\u2705"}
            status={aiInterpretation.disposition.authority_required || ""}
          >
            <div style={{
              padding: "10px 14px",
              borderRadius: "6px",
              marginBottom: "10px",
              fontWeight: 700,
              fontSize: "15px",
              color: "#fff",
              backgroundColor: aiInterpretation.disposition.decision === "NO_GO" ? "#dc2626" : aiInterpretation.disposition.decision === "RESTRICTED" ? "#ea580c" : "#16a34a"
            }}>
              {(aiInterpretation.disposition.decision || "").replace(/_/g, " ")}
            </div>
            <div style={{ fontSize: "13px", color: "#374151", marginBottom: "8px" }}>{aiInterpretation.disposition.rationale}</div>
            {aiInterpretation.disposition.conditions_for_upgrade && (
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                <strong>Required before upgrade:</strong>
                {aiInterpretation.disposition.conditions_for_upgrade.map((c: string, i: number) => (
                  <div key={i} style={{ padding: "2px 0" }}>{i + 1}. {c}</div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ---- AI REASONING (show the AI's thought process) ---- */}
        {aiInterpretation && aiInterpretation.status === "interpreted" && aiInterpretation.reasoning && (
          <Card title="AI Reasoning Chain" icon="\uD83E\uDDE0" status={`confidence: ${Math.round((aiInterpretation.confidence || 0) * 100)}%`}>
            <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#374151" }}>{aiInterpretation.reasoning}</div>
          </Card>
        )}

        {/* ---- VERIFIED DATA (Parse + Asset) ---- */}
        {parsed && asset && (
          <Card title="Verified Extraction" icon="\ud83d\udd12" status={`${parsed.events?.length || 0} events, ${parsed.environment?.length || 0} environments`}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Asset Resolution</div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "#111" }}>{asset.asset_class?.replace(/_/g, " ")}</div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>Type: {asset.asset_type?.replace(/_/g, " ")} — Confidence: {Math.round((asset.confidence || 0) * 100)}%</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Detected Events</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {(parsed.events || []).map((e, i) => (
                    <span key={i} style={{ padding: "2px 8px", backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>{e}</span>
                  ))}
                  {(parsed.events || []).length === 0 && <span style={{ fontSize: "12px", color: "#9ca3af" }}>None detected</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Service Environment</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {(parsed.environment || []).map((e, i) => (
                    <span key={i} style={{ padding: "2px 8px", backgroundColor: "#dbeafe", color: "#1e40af", borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>{e.replace(/_/g, " ")}</span>
                  ))}
                  {(parsed.environment || []).length === 0 && <span style={{ fontSize: "12px", color: "#9ca3af" }}>None detected</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Regex-Locked Numerics</div>
                {parsed.numeric_values && Object.keys(parsed.numeric_values).filter(k => parsed.numeric_values[k] !== undefined).length > 0 ? (
                  Object.entries(parsed.numeric_values).filter(([, v]) => v !== undefined).map(([k, v], i) => (
                    <div key={i} style={{ fontSize: "13px" }}>
                      <span style={{ fontWeight: 600 }}>{k.replace(/_/g, " ")}:</span> {v}
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>No numerics extracted</span>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* ---- CONFIDENCE SCORES ---- */}
        {chain?.confidence_scores && (
          <Card title="Chain Confidence" icon="\ud83c\udfaf" status={`Overall: ${Math.round(chain.confidence_scores.overall_confidence * 100)}%`}>
            {confidenceBar(chain.confidence_scores.mechanism_confidence, "Damage Mechanism")}
            {confidenceBar(chain.confidence_scores.zone_confidence, "Zone Prediction")}
            {confidenceBar(chain.confidence_scores.method_confidence, "Method Selection")}
            {confidenceBar(chain.confidence_scores.overall_confidence, "Overall Chain")}
            {chainPerformance && (
              <div style={{ marginTop: "8px", fontSize: "11px", color: "#6b7280" }}>
                Chain execution: {chainPerformance.total_ms}ms (E1:{chainPerformance.engine_1_ms}ms E2:{chainPerformance.engine_2_ms}ms E3:{chainPerformance.engine_3_ms}ms E4:{chainPerformance.engine_4_ms}ms E5:{chainPerformance.engine_5_ms}ms E6:{chainPerformance.engine_6_ms}ms)
              </div>
            )}
          </Card>
        )}

        {/* ---- ENGINE 1: DAMAGE MECHANISMS ---- */}
        {chain?.engine_1_damage_mechanisms && chain.engine_1_damage_mechanisms.length > 0 && (
          <Card title="Engine 1 — Damage Mechanisms" icon="\u26a0\ufe0f" status={`${chain.engine_1_damage_mechanisms.filter(m => !m.id.startsWith("TEMP_FILTERED")).length} active, ${chain.engine_1_damage_mechanisms.filter(m => m.id.startsWith("TEMP_FILTERED")).length} temp-excluded`}>
            {chain.engine_1_damage_mechanisms.filter(m => !m.id.startsWith("TEMP_FILTERED")).map((m, i) => (
              <div key={i} style={{ marginBottom: "12px", padding: "10px 12px", backgroundColor: "#fafafa", borderRadius: "6px", borderLeft: `4px solid ${severityColor(m.severity)}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  {severityBadge(m.severity)}
                  <span style={{ fontWeight: 700, fontSize: "14px" }}>{m.name}</span>
                  <span style={{ fontSize: "11px", color: "#6b7280" }}>({m.id})</span>
                </div>
                <div style={{ fontSize: "12px", color: "#374151", marginBottom: "4px" }}>{m.description}</div>
                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                  <strong>Ref:</strong> {m.api_571_ref} | <strong>Trigger:</strong> {m.source_trigger}
                  {m.requires_immediate_action && <span style={{ color: "#dc2626", fontWeight: 700, marginLeft: "8px" }}>IMMEDIATE ACTION REQUIRED</span>}
                </div>
              </div>
            ))}
            {/* Temperature-excluded mechanisms */}
            {chain.engine_1_damage_mechanisms.filter(m => m.id.startsWith("TEMP_FILTERED")).length > 0 && (
              <div style={{ marginTop: "12px", padding: "10px 12px", backgroundColor: "#fffbeb", borderRadius: "6px", border: "1px solid #fde68a" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", marginBottom: "6px" }}>Temperature-Excluded Mechanisms (verify multi-zone applicability)</div>
                {chain.engine_1_damage_mechanisms.filter(m => m.id.startsWith("TEMP_FILTERED")).map((m, i) => (
                  <div key={i} style={{ fontSize: "12px", color: "#78350f", padding: "2px 0" }}>
                    {m.name.replace("TEMPERATURE-EXCLUDED (verify multi-zone applicability): ", "")}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ---- ENGINE 2: AFFECTED ZONES ---- */}
        {chain?.engine_2_affected_zones && chain.engine_2_affected_zones.length > 0 && (
          <Card title="Engine 2 — Affected Zones" icon="\ud83d\udccd" status={`${chain.engine_2_affected_zones.filter(z => z.priority === 1).length} P1, ${chain.engine_2_affected_zones.filter(z => z.priority === 2).length} P2`}>
            {chain.engine_2_affected_zones.map((z, i) => (
              <div key={i} style={{ marginBottom: "8px", padding: "8px 12px", backgroundColor: z.priority === 1 ? "#fef2f2" : "#f9fafb", borderRadius: "6px", borderLeft: `3px solid ${z.priority === 1 ? "#dc2626" : z.priority === 2 ? "#ea580c" : "#6b7280"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                  {priorityBadge(z.priority)}
                  <span style={{ fontWeight: 700, fontSize: "13px" }}>{z.zone_name}</span>
                </div>
                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                  <strong>Mechanisms:</strong> {z.damage_mechanisms.join(", ")} | {z.rationale}
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* ---- ENGINE 3: INSPECTION METHODS ---- */}
        {chain?.engine_3_inspection_methods && chain.engine_3_inspection_methods.length > 0 && (
          <Card title="Engine 3 — Inspection Methods" icon="\ud83d\udd2c" status={`${chain.engine_3_inspection_methods.length} method-zone pairs`}>
            {(() => {
              // Group by method
              const groups: { [key: string]: InspectionMethod[] } = {};
              chain.engine_3_inspection_methods.forEach(m => {
                if (!groups[m.method_name]) groups[m.method_name] = [];
                // Deduplicate by technique within group
                if (!groups[m.method_name].find(x => x.technique_variant === m.technique_variant)) {
                  groups[m.method_name].push(m);
                }
              });
              return Object.entries(groups).map(([method, items], gi) => (
                <div key={gi} style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e40af", marginBottom: "6px", padding: "4px 8px", backgroundColor: "#eff6ff", borderRadius: "4px", display: "inline-block" }}>{method}</div>
                  {items.map((item, ii) => (
                    <div key={ii} style={{ marginLeft: "8px", marginBottom: "8px", padding: "6px 10px", borderLeft: "2px solid #dbeafe", fontSize: "12px" }}>
                      <div style={{ fontWeight: 600, marginBottom: "2px" }}>{item.technique_variant}</div>
                      <div style={{ color: "#374151" }}><strong>For:</strong> {item.target_mechanism} at {item.target_zone}</div>
                      <div style={{ color: "#6b7280" }}><strong>Detects:</strong> {item.detection_capability}</div>
                      <div style={{ color: "#6b7280" }}><strong>Sizing:</strong> {item.sizing_capability}</div>
                      <div style={{ color: "#6b7280" }}><strong>Code:</strong> {item.code_reference} | <strong>Qual:</strong> {item.personnel_qualification}</div>
                    </div>
                  ))}
                </div>
              ));
            })()}
          </Card>
        )}

        {/* ---- ENGINE 4: CODE ACTION PATHS ---- */}
        {chain?.engine_4_code_action_paths && chain.engine_4_code_action_paths.length > 0 && (
          <Card title="Engine 4 — Code Action Paths" icon="\ud83d\udcdc" status={`${chain.engine_4_code_action_paths.length} finding types mapped`}>
            {chain.engine_4_code_action_paths.map((p, i) => (
              <div key={i} style={{ marginBottom: "12px", padding: "10px 12px", backgroundColor: "#fafafa", borderRadius: "6px", borderLeft: `3px solid ${p.engineering_review_required ? "#dc2626" : "#2563eb"}` }}>
                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>
                  {p.finding_type.replace(/_/g, " ")}
                  {p.engineering_review_required && <span style={{ fontSize: "11px", color: "#dc2626", marginLeft: "8px" }}>ENGINEERING REVIEW REQUIRED</span>}
                </div>
                <div style={{ fontSize: "12px", color: "#374151", marginBottom: "2px" }}><strong>Code:</strong> {p.code_section}</div>
                <div style={{ fontSize: "12px", color: "#374151", marginBottom: "2px" }}><strong>FFS:</strong> {p.ffs_assessment}</div>
                <div style={{ fontSize: "12px", color: "#374151", marginBottom: "2px" }}><strong>Repair:</strong> {p.repair_standard}</div>
                <div style={{ fontSize: "12px", color: "#374151" }}><strong>Action:</strong> {p.required_action}</div>
              </div>
            ))}
          </Card>
        )}

        {/* ---- ENGINE 5: ESCALATION TIMELINE ---- */}
        {chain?.engine_5_escalation_timeline && chain.engine_5_escalation_timeline.length > 0 && (
          <Card title="Engine 5 — Escalation Timeline" icon="\u23f1\ufe0f" status={`${chain.engine_5_escalation_timeline.length} tiers`}>
            <div style={{ display: "flex", gap: "4px", marginBottom: "12px", flexWrap: "wrap" }}>
              {chain.engine_5_escalation_timeline.map((tier, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTimelineTier(i)}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: activeTimelineTier === i ? 700 : 400,
                    color: activeTimelineTier === i ? "#fff" : "#374151",
                    backgroundColor: activeTimelineTier === i ? (i === 0 ? "#dc2626" : i === 1 ? "#ea580c" : i === 2 ? "#ca8a04" : "#2563eb") : "#f3f4f6",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  {tier.tier_name} ({tier.time_window})
                </button>
              ))}
            </div>
            {(() => {
              const tier = chain.engine_5_escalation_timeline[activeTimelineTier];
              if (!tier) return null;
              return (
                <div>
                  <div style={{ marginBottom: "10px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "4px" }}>Actions</div>
                    {tier.actions.map((a, i) => (
                      <div key={i} style={{ fontSize: "12px", padding: "3px 0", color: "#374151" }}>{i + 1}. {a}</div>
                    ))}
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "4px" }}>Personnel Required</div>
                    {tier.personnel_required.map((p, i) => (
                      <div key={i} style={{ fontSize: "12px", padding: "2px 0", color: "#374151" }}>{p}</div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "4px" }}>Notifications</div>
                    {tier.notifications.map((n, i) => (
                      <div key={i} style={{ fontSize: "12px", padding: "2px 0", color: "#374151" }}>{n}</div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Card>
        )}

        {/* ---- ENGINE 6: EXECUTION PACKAGES ---- */}
        {chain?.engine_6_execution_packages && chain.engine_6_execution_packages.length > 0 && (
          <Card title="Engine 6 — Execution Packages" icon="\ud83d\udcca" status="Supervisor | Engineer | Executive">
            <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
              {chain.engine_6_execution_packages.map((pkg, i) => (
                <button
                  key={i}
                  onClick={() => setActivePackageTab(i)}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: activePackageTab === i ? 700 : 400,
                    color: activePackageTab === i ? "#fff" : "#374151",
                    backgroundColor: activePackageTab === i ? "#2563eb" : "#f3f4f6",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  {pkg.role.split(" / ")[0]}
                </button>
              ))}
            </div>
            {(() => {
              const pkg = chain.engine_6_execution_packages[activePackageTab];
              if (!pkg) return null;
              return (
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>{pkg.role}</div>
                  <div style={{ fontSize: "12px", color: "#374151", marginBottom: "10px" }}>{pkg.summary}</div>
                  <div style={{ marginBottom: "10px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "4px" }}>Action Items</div>
                    {pkg.action_items.map((a, i) => (
                      <div key={i} style={{ fontSize: "12px", padding: "3px 0", color: "#374151" }}>{i + 1}. {a}</div>
                    ))}
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "4px" }}>Key Decisions</div>
                    {pkg.key_decisions.map((d, i) => (
                      <div key={i} style={{ fontSize: "12px", padding: "2px 0", color: "#374151" }}>{d}</div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "4px" }}>Resources Needed</div>
                    {pkg.resources_needed.map((r, i) => (
                      <div key={i} style={{ fontSize: "12px", padding: "2px 0", color: "#374151" }}>{r}</div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Card>
        )}

        {/* ---- AI NARRATIVE (demoted GPT-4o) ---- */}
        {aiNarrative && (
          <Card title="AI Narrative Summary" icon="\ud83e\udd16" status="GPT-4o prose polish — constrained by chain data">
            <div style={{ fontSize: "13px", lineHeight: "1.7", color: "#374151", whiteSpace: "pre-wrap" }}>
              {aiNarrative}
            </div>
          </Card>
        )}

        {/* ---- GOVERNANCE MATRIX ---- */}
        {governance && (
          <Card title="Governance Matrix" icon="\ud83c\udfdb\ufe0f">
            <pre style={{ fontSize: "12px", overflow: "auto", maxHeight: "300px", backgroundColor: "#f9fafb", padding: "10px", borderRadius: "4px" }}>
              {JSON.stringify(governance, null, 2)}
            </pre>
          </Card>
        )}

        {/* ---- CODE AUTHORITY RESOLUTION ---- */}
        {codeAuthority && (
          <Card title="Code Authority Resolution" icon="\ud83d\udcd6">
            <pre style={{ fontSize: "12px", overflow: "auto", maxHeight: "300px", backgroundColor: "#f9fafb", padding: "10px", borderRadius: "4px" }}>
              {JSON.stringify(codeAuthority, null, 2)}
            </pre>
          </Card>
        )}

        {/* ---- TIME PROGRESSION ---- */}
        {timeProgression && (
          <Card title="Time Progression — Risk Curve" icon="\ud83d\udcc8">
            <pre style={{ fontSize: "12px", overflow: "auto", maxHeight: "300px", backgroundColor: "#f9fafb", padding: "10px", borderRadius: "4px" }}>
              {JSON.stringify(timeProgression, null, 2)}
            </pre>
          </Card>
        )}

        {/* ---- EVENT ENRICHMENT ---- */}
        {eventEnrich && (
          <Card title="Event Classification & Rule Packs" icon="\ud83c\udf10">
            <pre style={{ fontSize: "12px", overflow: "auto", maxHeight: "300px", backgroundColor: "#f9fafb", padding: "10px", borderRadius: "4px" }}>
              {JSON.stringify(eventEnrich, null, 2)}
            </pre>
          </Card>
        )}

        {/* ---- CODE TRACE ---- */}
        {codeTrace && (
          <Card title="Code Trace — Clause-Level Citations" icon="\ud83d\udd0d">
            <pre style={{ fontSize: "12px", overflow: "auto", maxHeight: "300px", backgroundColor: "#f9fafb", padding: "10px", borderRadius: "4px" }}>
              {JSON.stringify(codeTrace, null, 2)}
            </pre>
          </Card>
        )}

        {/* ---- WARNINGS ---- */}
        {chain?.warnings && chain.warnings.length > 0 && (
          <Card title="Chain Warnings" icon="\u26a0\ufe0f" collapsible={false}>
            {chain.warnings.map((w, i) => (
              <div key={i} style={{ fontSize: "12px", color: "#92400e", padding: "3px 0" }}>{w}</div>
            ))}
          </Card>
        )}

      </div>
    </div>
  );
}
