/**
 * DEPLOY18_MeasurementInput.tsx
 * Deploy to: src/components/MeasurementInput.tsx
 *
 * Structured measurement input form for NDT findings
 * - Imperial default (US) with metric toggle
 * - Dynamic fields based on finding types
 * - Live code limit comparison
 * - Saves to Supabase case_measurements table
 */

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  UnitSystem,
  getMeasurementFields,
  getCodeLimits,
  inchesToMm,
  mmToInches,
  formatImperial,
  formatMetric,
  MeasurementField,
} from "../lib/units";

interface Finding {
  id: string;
  finding_type: string;
  severity: string;
  confidence: number;
  source: string;
}

interface MeasurementInputProps {
  caseId: string;
  findings: Finding[];
  onMeasurementsSaved: () => void;
}

interface MeasurementEntry {
  findingType: string;
  key: string;
  valueImperial: number;
  valueMetric: number;
}

export default function MeasurementInput({ caseId, findings, onMeasurementsSaved }: MeasurementInputProps) {
  var [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  var [measurements, setMeasurements] = useState<Record<string, Record<string, string>>>({});
  var [saving, setSaving] = useState(false);
  var [saved, setSaved] = useState(false);
  var [existingMeasurements, setExistingMeasurements] = useState<any[]>([]);

  // Get unique finding types from AI findings
  var findingTypes = Array.from(new Set(findings.map(function(f) { return f.finding_type; })));

  // Load existing measurements
  useEffect(function() {
    loadExistingMeasurements();
  }, [caseId]);

  async function loadExistingMeasurements() {
    var result = await supabase
      .from("case_measurements")
      .select("*")
      .eq("case_id", caseId);

    if (result.data && result.data.length > 0) {
      setExistingMeasurements(result.data);
      // Pre-populate form
      var populated: Record<string, Record<string, string>> = {};
      for (var i = 0; i < result.data.length; i++) {
        var m = result.data[i];
        if (!populated[m.finding_type]) populated[m.finding_type] = {};
        if (unitSystem === "imperial") {
          populated[m.finding_type][m.measurement_key] = String(m.value_imperial);
        } else {
          populated[m.finding_type][m.measurement_key] = String(m.value_metric);
        }
      }
      setMeasurements(populated);
    }
  }

  function handleValueChange(findingType: string, fieldKey: string, rawValue: string) {
    var updated = Object.assign({}, measurements);
    if (!updated[findingType]) updated[findingType] = {};
    updated[findingType][fieldKey] = rawValue;
    setMeasurements(updated);
    setSaved(false);
  }

  function toggleUnits() {
    var newSystem: UnitSystem = unitSystem === "imperial" ? "metric" : "imperial";
    // Convert existing values
    var converted: Record<string, Record<string, string>> = {};
    var types = Object.keys(measurements);
    for (var t = 0; t < types.length; t++) {
      var type = types[t];
      converted[type] = {};
      var keys = Object.keys(measurements[type]);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var val = parseFloat(measurements[type][key]);
        if (isNaN(val)) {
          converted[type][key] = measurements[type][key];
        } else if (newSystem === "metric") {
          converted[type][key] = String(inchesToMm(val));
        } else {
          converted[type][key] = String(mmToInches(val));
        }
      }
    }
    setMeasurements(converted);
    setUnitSystem(newSystem);
  }

  async function saveMeasurements() {
    setSaving(true);
    var entries: MeasurementEntry[] = [];
    var types = Object.keys(measurements);

    for (var t = 0; t < types.length; t++) {
      var type = types[t];
      var keys = Object.keys(measurements[type]);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var rawVal = parseFloat(measurements[type][key]);
        if (isNaN(rawVal) || rawVal <= 0) continue;

        var imperial = unitSystem === "imperial" ? rawVal : mmToInches(rawVal);
        var metric = unitSystem === "metric" ? rawVal : inchesToMm(rawVal);

        entries.push({
          findingType: type,
          key: key,
          valueImperial: imperial,
          valueMetric: metric,
        });
      }
    }

    if (entries.length === 0) {
      setSaving(false);
      return;
    }

    // Upsert measurements
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var fields = getMeasurementFields(e.findingType);
      var field = fields.find(function(f) { return f.key === e.key; });

      await supabase
        .from("case_measurements")
        .upsert({
          case_id: caseId,
          finding_type: e.findingType,
          measurement_key: e.key,
          value_imperial: e.valueImperial,
          value_metric: e.valueMetric,
          unit_imperial: field ? field.imperialUnit : "in",
          unit_metric: field ? field.metricUnit : "mm",
          measured_at: new Date().toISOString(),
        }, {
          onConflict: "case_id,finding_type,measurement_key"
        });
    }

    // Update case measurement status
    await supabase
      .from("inspection_cases")
      .update({
        measurement_status: "completed",
        unit_preference: unitSystem,
      })
      .eq("id", caseId);

    setSaving(false);
    setSaved(true);
    onMeasurementsSaved();
  }

  function getPassFail(findingType: string, fieldKey: string, value: number): { status: string; detail: string } | null {
    var limits = getCodeLimits(findingType, fieldKey);
    if (limits.length === 0) return null;

    var imperialValue = unitSystem === "imperial" ? value : mmToInches(value);

    for (var i = 0; i < limits.length; i++) {
      var limit = limits[i];
      if (imperialValue > limit.limitImperial) {
        var displayLimit = unitSystem === "imperial"
          ? formatImperial(limit.limitImperial, limit.unitImperial)
          : formatMetric(limit.limitMetric, limit.unitMetric);
        return {
          status: "FAIL",
          detail: limit.code + " " + limit.rule + ": exceeds " + displayLimit,
        };
      }
    }

    return {
      status: "PASS",
      detail: "Within all applicable code limits",
    };
  }

  return (
    <div className="measurement-input-container">
      <div className="measurement-header">
        <h3>Inspector Measurements</h3>
        <button
          className={"unit-toggle " + unitSystem}
          onClick={toggleUnits}
          type="button"
        >
          {unitSystem === "imperial" ? "IN (Imperial)" : "MM (Metric)"}
          <span className="toggle-hint">
            {unitSystem === "imperial" ? "Switch to Metric" : "Switch to Imperial"}
          </span>
        </button>
      </div>

      {findingTypes.length === 0 && (
        <div className="empty-state">
          <p>No findings to measure. Run AI Analysis first.</p>
        </div>
      )}

      {findingTypes.map(function(findingType) {
        var fields = getMeasurementFields(findingType);
        var relatedFindings = findings.filter(function(f) {
          return f.finding_type === findingType;
        });
        var maxConfidence = Math.max.apply(null, relatedFindings.map(function(f) {
          return f.confidence;
        }));

        return (
          <div key={findingType} className="measurement-finding-group">
            <div className="finding-group-header">
              <span className="finding-type-label">
                {findingType.replace(/_/g, " ").toUpperCase()}
              </span>
              <span className="finding-confidence">
                AI Confidence: {Math.round(maxConfidence * 100)}%
              </span>
            </div>

            {fields.map(function(field) {
              var currentVal = measurements[findingType]
                ? measurements[findingType][field.key] || ""
                : "";
              var numVal = parseFloat(currentVal);
              var passFail = !isNaN(numVal) && numVal > 0
                ? getPassFail(findingType, field.key, numVal)
                : null;
              var limits = getCodeLimits(findingType, field.key);

              return (
                <div key={field.key} className="measurement-field-row">
                  <label className="measurement-label">
                    {field.label}
                  </label>
                  <div className="measurement-input-group">
                    <input
                      type="number"
                      className="measurement-input"
                      value={currentVal}
                      onChange={function(e) {
                        handleValueChange(findingType, field.key, e.target.value);
                      }}
                      step={unitSystem === "imperial" ? field.imperialStep : field.metricStep}
                      min={unitSystem === "imperial" ? field.imperialMin : field.metricMin}
                      max={unitSystem === "imperial" ? field.imperialMax : field.metricMax}
                      placeholder={unitSystem === "imperial"
                        ? "0.000 " + field.imperialUnit
                        : "0.00 " + field.metricUnit
                      }
                    />
                    <span className="measurement-unit">
                      {unitSystem === "imperial" ? field.imperialUnit : field.metricUnit}
                    </span>
                  </div>

                  {/* Live code limit comparison */}
                  {passFail && (
                    <div className={"measurement-verdict verdict-" + passFail.status.toLowerCase()}>
                      <span className="verdict-badge">
                        {passFail.status === "PASS" ? "\u2713 PASS" : "\u2717 FAIL"}
                      </span>
                      <span className="verdict-detail">{passFail.detail}</span>
                    </div>
                  )}

                  {/* Show applicable code limits */}
                  {limits.length > 0 && (
                    <div className="code-limits-display">
                      {limits.map(function(limit, idx) {
                        return (
                          <span key={idx} className="code-limit-chip">
                            {limit.code}: {unitSystem === "imperial"
                              ? formatImperial(limit.limitImperial, limit.unitImperial)
                              : formatMetric(limit.limitMetric, limit.unitMetric)
                            }
                            {" "}({limit.rule})
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {findingTypes.length > 0 && (
        <div className="measurement-actions">
          <button
            className="save-measurements-btn"
            onClick={saveMeasurements}
            disabled={saving}
            type="button"
          >
            {saving ? "Saving..." : saved ? "\u2713 Saved \u2014 Re-run Analysis to Lock Decision" : "Save Measurements"}
          </button>
          {saved && (
            <p className="measurement-hint">
              Measurements saved. Click "Run AI Analysis" to re-evaluate with measurement data and lock the final decision.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
