#!/bin/bash
# FORGED-NDT - Test New Engines (3 functions)
# Run: bash test-new-engines.sh
# Or copy/paste individual curl commands into terminal or Postman

BASE="https://4dndt.netlify.app/.netlify/functions"

echo "================================================"
echo "TEST 1: Inspection Effectiveness v2.0.0"
echo "Scenario: CL_SCC on pressure vessel, WFMT + PT"
echo "================================================"
curl -s -X POST "$BASE/inspection-effectiveness" \
  -H "Content-Type: application/json" \
  -d '{
    "damage_mechanism": "CL_SCC",
    "techniques_performed": ["WFMT", "PT"],
    "coverage": "extensive",
    "domain": "fixed",
    "equipment_type": "pressure_vessel",
    "inspection_access_quality": "unrestricted",
    "surface_condition": "clean_blasted",
    "temperature_at_inspection": 75,
    "coating_removed": true,
    "insulation_removed": "not_applicable",
    "calibration_quality": "traceable",
    "technician_cert_level": "Level_III",
    "scan_plan_adequacy": "comprehensive"
  }' | python3 -m json.tool 2>/dev/null || echo "(raw output above)"

echo ""
echo "================================================"
echo "TEST 2: Inspection Effectiveness - Poor Conditions"
echo "Scenario: CUI on piping, restricted access, Level I"
echo "================================================"
curl -s -X POST "$BASE/inspection-effectiveness" \
  -H "Content-Type: application/json" \
  -d '{
    "damage_mechanism": "CUI",
    "techniques_performed": ["UT_T"],
    "coverage": "partial",
    "domain": "fixed",
    "equipment_type": "piping",
    "inspection_access_quality": "restricted",
    "surface_condition": "corroded",
    "temperature_at_inspection": 350,
    "coating_removed": false,
    "insulation_removed": false,
    "calibration_quality": "expired",
    "technician_cert_level": "Level_I",
    "scan_plan_adequacy": "ad_hoc"
  }' | python3 -m json.tool 2>/dev/null || echo "(raw output above)"

echo ""
echo "================================================"
echo "TEST 3: MIC Intelligence"
echo "Scenario: Tank bottom, produced water, SRB suspected"
echo "================================================"
curl -s -X POST "$BASE/mic-intelligence" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "fixed",
    "equipment_type": "storage_tank",
    "material": "carbon_steel",
    "environment": {
      "water_type": "produced_water",
      "temperature": 95,
      "pH": 6.8,
      "oxygen_level": "low",
      "flow_condition": "stagnant",
      "chloride": 500,
      "sulfide": 50,
      "CO2": true,
      "nutrient_sources": ["hydrocarbons", "sulfate"]
    },
    "observed_features": ["pitting", "black_deposit", "rotten_egg_odor"],
    "deposits": "black_sludge",
    "location_context": "tank_bottom",
    "service_history": {
      "years_in_service": 12,
      "biocide_program": false,
      "previous_mic_findings": true,
      "stagnant_periods": true
    }
  }' | python3 -m json.tool 2>/dev/null || echo "(raw output above)"

echo ""
echo "================================================"
echo "TEST 4: API Standards Authority"
echo "Scenario: Pipeline SSC in sour service"
echo "================================================"
curl -s -X POST "$BASE/api-standards-authority" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "pipeline",
    "equipment_type": "pipeline",
    "damage_mechanism": "SSC",
    "service_conditions": {
      "h2s_service": true,
      "temperature": 150
    }
  }' | python3 -m json.tool 2>/dev/null || echo "(raw output above)"

echo ""
echo "================================================"
echo "TEST 5: API Standards Authority"
echo "Scenario: Subsea wellhead with fatigue"
echo "================================================"
curl -s -X POST "$BASE/api-standards-authority" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "subsea",
    "equipment_type": "wellhead",
    "damage_mechanism": "FATIGUE_CRACKING",
    "service_conditions": {
      "cyclic_service": true
    }
  }' | python3 -m json.tool 2>/dev/null || echo "(raw output above)"

echo ""
echo "================================================"
echo "ALL TESTS COMPLETE"
echo "================================================"
