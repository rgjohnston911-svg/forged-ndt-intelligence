/**
 * DEPLOY43 — NewCase.tsx
 * src/pages/NewCase.tsx
 *
 * Updated Step 2 to include:
 *   - Lifecycle Stage
 *   - Industry Sector
 *   - Asset Type
 * alongside existing Material Class, Family, Surface, Environment.
 *
 * CONSTRAINT: No backtick template literals
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  NDE_METHODS,
  WELDING_PROCESSES,
  WELD_POSITIONS,
  HEAT_INPUT_LEVELS,
  TRAVEL_SPEED_LEVELS,
  INSPECTION_CONTEXT_OPTIONS,
  MATERIAL_CLASS_OPTIONS,
  MATERIAL_FAMILY_OPTIONS,
  SURFACE_TYPE_OPTIONS,
  SERVICE_ENVIRONMENT_OPTIONS,
  LIFECYCLE_STAGE_OPTIONS,
  INDUSTRY_SECTOR_OPTIONS,
  ASSET_TYPE_OPTIONS
} from "../lib/constants";

var API_BASE = "/.netlify/functions";

export default function NewCase() {
  var navigate = useNavigate();

  /* ---- step tracking ---- */
  var [step, setStep] = useState(1);
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState("");

  /* ---- Step 1: Inspection Context ---- */
  var [inspectionContext, setInspectionContext] = useState("");

  /* ---- Step 2: Material + Surface + Environment + Lifecycle + Industry + Asset ---- */
  var [materialClass, setMaterialClass] = useState("");
  var [materialFamily, setMaterialFamily] = useState("");
  var [surfaceType, setSurfaceType] = useState("");
  var [serviceEnvironment, setServiceEnvironment] = useState("");
  var [lifecycleStage, setLifecycleStage] = useState("");
  var [industrySector, setIndustrySector] = useState("");
  var [assetType, setAssetType] = useState("");

  /* ---- Step 3: NDT Method ---- */
  var [method, setMethod] = useState("");

  /* ---- Step 4: Component ---- */
  var [component, setComponent] = useState("");

  /* ---- Step 5: Welding Process (only if context = WELD) ---- */
  var [weldProcess, setWeldProcess] = useState("");
  var [weldPosition, setWeldPosition] = useState("");
  var [heatInput, setHeatInput] = useState("");
  var [travelSpeed, setTravelSpeed] = useState("");

  /* ---- Step 6: Code ---- */
  var [selectedCode, setSelectedCode] = useState("");

  /* ---- Determine if weld step is needed ---- */
  var isWeld = inspectionContext === "WELD";
  var totalSteps = isWeld ? 6 : 5;

  /* ---- Reset material family when class changes ---- */
  useEffect(function() {
    setMaterialFamily("");
  }, [materialClass]);

  /* ---- Families for selected class ---- */
  var familyOptions = MATERIAL_FAMILY_OPTIONS[materialClass] || [];

  /* ---- Step labels ---- */
  function getStepLabel(s: number): string {
    if (s === 1) return "Inspection Context";
    if (s === 2) return "Material, Environment & Classification";
    if (s === 3) return "NDT Method";
    if (s === 4) return "Component";
    if (isWeld && s === 5) return "Welding Process";
    return "Code / Standard";
  }

  /* ---- Navigation ---- */
  function canNext(): boolean {
    if (step === 1) return inspectionContext !== "";
    if (step === 2) return materialClass !== "";
    if (step === 3) return method !== "";
    if (step === 4) return component.trim() !== "";
    if (isWeld && step === 5) return true;
    return true;
  }

  function handleNext() {
    if (step < totalSteps) setStep(step + 1);
  }

  function handleBack() {
    if (step > 1) setStep(step - 1);
  }

  /* ---- Code options ---- */
  var CODE_OPTIONS = [
    { value: "AWS_D1.1", label: "AWS D1.1 — Structural Welding Code" },
    { value: "AWS_D1.5", label: "AWS D1.5 — Bridge Welding Code" },
    { value: "ASME_SEC_VIII", label: "ASME Section VIII — Pressure Vessels" },
    { value: "ASME_SEC_V", label: "ASME Section V — NDE" },
    { value: "ASME_B31.3", label: "ASME B31.3 — Process Piping" },
    { value: "ASME_B31.1", label: "ASME B31.1 — Power Piping" },
    { value: "API_1104", label: "API 1104 — Pipeline Welding" },
    { value: "API_510", label: "API 510 — Pressure Vessel Inspection" },
    { value: "API_570", label: "API 570 — Piping Inspection" },
    { value: "API_653", label: "API 653 — Tank Inspection" },
    { value: "API_579", label: "API 579 — Fitness-for-Service" },
    { value: "AMPP_COATING", label: "AMPP — Coating / Lining" },
    { value: "ACI_CIVIL", label: "ACI — Concrete / Civil" },
    { value: "ISO_GENERAL", label: "ISO — General Welding / NDT" },
    { value: "TRAINING", label: "Training / Educational Only" },
    { value: "OWNER_SPEC", label: "Owner / OEM Specification" },
    { value: "OTHER", label: "Other" }
  ];

  /* ---- Submit ---- */
  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      var sessionRes = await supabase.auth.getSession();
      var token = sessionRes.data.session?.access_token || "";

      var processContext = null;
      if (isWeld && weldProcess) {
        processContext = {
          process: weldProcess,
          position: weldPosition || null,
          heat_input: heatInput || null,
          travel_speed: travelSpeed || null
        };
      }

      var payload = {
        method: method,
        component: component,
        code: selectedCode || null,
        inspectionContext: inspectionContext,
        materialClass: materialClass || null,
        materialFamily: materialFamily || null,
        surfaceType: surfaceType || null,
        serviceEnvironment: serviceEnvironment || null,
        lifecycleStage: lifecycleStage || null,
        industrySector: industrySector || null,
        assetType: assetType || null,
        processContext: processContext
      };

      var res = await fetch(API_BASE + "/create-case", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify(payload)
      });

      var data = await res.json();

      if (!res.ok || !data.caseId) {
        setError(data.detail || data.error || "Failed to create case");
        setLoading(false);
        return;
      }

      navigate("/cases/" + data.caseId);

    } catch (err: any) {
      setError(String(err));
      setLoading(false);
    }
  }

  /* ---- Render helpers ---- */
  function renderOptionGrid(
    options: Array<{ value: string; label: string }>,
    selected: string,
    onSelect: (v: string) => void
  ) {
    return (
      <div className="option-grid">
        {options.map(function(opt) {
          return (
            <button
              key={opt.value}
              type="button"
              className={"option-btn" + (selected === opt.value ? " selected" : "")}
              onClick={function() { onSelect(opt.value); }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  function renderSelect(
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: Array<{ value: string; label: string }>,
    placeholder?: string
  ) {
    return (
      <div className="form-field">
        <label className="form-label">{label}</label>
        <select
          className="form-select"
          value={value}
          onChange={function(e) { onChange(e.target.value); }}
        >
          <option value="">{placeholder || "Select..."}</option>
          {options.map(function(opt) {
            return <option key={opt.value} value={opt.value}>{opt.label}</option>;
          })}
        </select>
      </div>
    );
  }

  /* ---- Step content ---- */
  function renderStep() {
    /* Step 1: Inspection Context */
    if (step === 1) {
      return (
        <div className="step-content">
          <h3 className="step-title">What are you inspecting?</h3>
          <p className="step-desc">
            Select the inspection context. This determines which analysis engine will evaluate your findings.
          </p>
          {renderOptionGrid(INSPECTION_CONTEXT_OPTIONS, inspectionContext, setInspectionContext)}
          {inspectionContext === "WELD" && (
            <div className="step-note info">
              Weld context selected — welding process step will be included.
            </div>
          )}
          {inspectionContext && inspectionContext !== "WELD" && inspectionContext !== "UNKNOWN" && (
            <div className="step-note info">
              Non-weld context — the system will use the {inspectionContext.replace(/_/g, " ").toLowerCase()} damage engine.
            </div>
          )}
        </div>
      );
    }

    /* Step 2: Material + Environment + Lifecycle + Industry + Asset */
    if (step === 2) {
      return (
        <div className="step-content">
          <h3 className="step-title">Material, Environment & Classification</h3>
          <p className="step-desc">
            Identify the material, environment, lifecycle stage, industry sector, and asset type.
            These drive both the damage engine and code applicability routing.
          </p>

          <div className="form-field">
            <label className="form-label">Material Class</label>
            {renderOptionGrid(MATERIAL_CLASS_OPTIONS, materialClass, setMaterialClass)}
          </div>

          {materialClass && familyOptions.length > 0 && (
            renderSelect("Material Family", materialFamily, setMaterialFamily, familyOptions, "Select family...")
          )}

          {renderSelect("Surface / Component Type", surfaceType, setSurfaceType, SURFACE_TYPE_OPTIONS, "Select surface type...")}

          {renderSelect("Service Environment", serviceEnvironment, setServiceEnvironment, SERVICE_ENVIRONMENT_OPTIONS, "Select environment...")}

          <div className="form-divider"></div>

          {renderSelect("Lifecycle Stage", lifecycleStage, setLifecycleStage, LIFECYCLE_STAGE_OPTIONS, "Select lifecycle stage...")}

          {renderSelect("Industry Sector", industrySector, setIndustrySector, INDUSTRY_SECTOR_OPTIONS, "Select industry sector...")}

          {renderSelect("Asset Type", assetType, setAssetType, ASSET_TYPE_OPTIONS, "Select asset type...")}
        </div>
      );
    }

    /* Step 3: NDT Method */
    if (step === 3) {
      return (
        <div className="step-content">
          <h3 className="step-title">NDT Method</h3>
          <p className="step-desc">Select the primary inspection method.</p>
          {renderOptionGrid(NDE_METHODS, method, setMethod)}
        </div>
      );
    }

    /* Step 4: Component */
    if (step === 4) {
      return (
        <div className="step-content">
          <h3 className="step-title">Component Description</h3>
          <p className="step-desc">Describe the component or area being inspected.</p>
          <div className="form-field">
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 12-inch carbon steel pipe, butt weld joint #47"
              value={component}
              onChange={function(e) { setComponent(e.target.value); }}
            />
          </div>
        </div>
      );
    }

    /* Step 5: Welding Process (only if isWeld) */
    if (isWeld && step === 5) {
      return (
        <div className="step-content">
          <h3 className="step-title">Welding Process</h3>
          <p className="step-desc">
            Providing welding process details dramatically improves convergence accuracy.
          </p>
          {renderOptionGrid(WELDING_PROCESSES, weldProcess, setWeldProcess)}

          {weldProcess && (
            <div className="weld-details-grid">
              {renderSelect("Weld Position", weldPosition, setWeldPosition, WELD_POSITIONS, "Select position...")}
              {renderSelect("Heat Input", heatInput, setHeatInput, HEAT_INPUT_LEVELS, "Select heat input...")}
              {renderSelect("Travel Speed", travelSpeed, setTravelSpeed, TRAVEL_SPEED_LEVELS, "Select travel speed...")}
            </div>
          )}
        </div>
      );
    }

    /* Final step: Code / Standard */
    return (
      <div className="step-content">
        <h3 className="step-title">Governing Code / Standard</h3>
        <p className="step-desc">
          Select the code or standard governing this inspection. This controls acceptance criteria and disposition authority.
        </p>
        {renderOptionGrid(CODE_OPTIONS, selectedCode, setSelectedCode)}
      </div>
    );
  }

  /* ---- Progress indicator ---- */
  function renderProgress() {
    var dots = [];
    for (var i = 1; i <= totalSteps; i++) {
      dots.push(
        <div
          key={i}
          className={"progress-dot" + (i === step ? " active" : "") + (i < step ? " done" : "")}
        >
          {i}
        </div>
      );
    }
    return <div className="progress-dots">{dots}</div>;
  }

  /* ---- Main render ---- */
  return (
    <div className="new-case-page">
      <div className="new-case-header">
        <h2>New Inspection Case</h2>
        <p className="step-indicator">
          Step {step} of {totalSteps}: {getStepLabel(step)}
        </p>
      </div>

      {renderProgress()}

      {error && <div className="error-banner">{error}</div>}

      {renderStep()}

      <div className="step-nav">
        {step > 1 && (
          <button type="button" className="btn-secondary" onClick={handleBack} disabled={loading}>
            Back
          </button>
        )}

        {step < totalSteps && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleNext}
            disabled={!canNext()}
          >
            Next
          </button>
        )}

        {step === totalSteps && (
          <button
            type="button"
            className="btn-primary submit-btn"
            onClick={handleSubmit}
            disabled={loading || !method || !component.trim()}
          >
            {loading ? "Creating..." : "Create Case"}
          </button>
        )}
      </div>
    </div>
  );
}
