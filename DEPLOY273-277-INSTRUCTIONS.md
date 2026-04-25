# DEPLOY273-277: Phase 1 v8 Expansion — 5 New Engines (65-69)

**Date:** 2026-04-22
**Engines:** 65-69 (evidence-contract, coatings-intelligence, mechanism-causality, uncertainty-boundary, decision-liability)
**Platform Version:** FORGED-NDT/2.0.0
**Engine Count:** 64 → 69

---

## Overview

Phase 1 of the Superbrain v8 expansion. Five new deterministic intelligence engines built with full hardcoded knowledge bases — same pattern as CWI Core and Live Code Authority.

### Engine 65: Evidence Contract Engine (DEPLOY273)
- 8 evidence contracts (weld_visual, weld_volumetric, coating_condition, coating_application, corrosion_assessment, fatigue_assessment, general_case, pressure_equipment)
- Severity escalators (low through catastrophic)
- Service condition evidence escalators (sour, cryogenic, lethal, hydrogen, immersion, buried)
- Mode eligibility computation (assist/advisory/authority)
- Confidence ceiling logic
- 6 API actions

### Engine 66: Coatings Intelligence Authority (DEPLOY274) — "Smartest Coating Inspector"
- 18 coating standards (SSPC-SP 1/2/3/5/6/10/11, SSPC-PA 2, ISO 8501/8502/8503/12944, ASTM D7091/D3359/D4541/D5162, NACE SP0188/SP0178)
- 22 coating system families with full chemistry, DFT ranges, cure mechanisms, failure modes
- 65+ coating defect types with 4-tier dominance hierarchy
- 11 surface prep grades with SSPC/NACE/ISO cross-reference
- 8 environmental condition rules
- 7 service environments per ISO 12944
- 10 degradation progression models
- 6 repair method families with step-by-step procedures
- Full DFT per SSPC-PA 2, adhesion per ASTM D3359/D4541, holiday per ASTM D5162
- 12-step evaluate_coating pipeline
- 16 API actions

### Engine 67: Mechanism Causality Engine (DEPLOY275)
- 35+ damage mechanisms with physics, prerequisites, indicators
- 30+ root cause families
- Mechanism interaction matrix (synergistic, sequential, competing)
- Material susceptibility matrix (7 material families)
- Mechanism identification from indications
- Causal chain validation logic
- Differential diagnosis
- 10 API actions

### Engine 68: Uncertainty Boundary Engine (DEPLOY276)
- 15 uncertainty source categories (aleatory + epistemic)
- 12 NDT measurement uncertainty models
- 8 epistemic boundary rules (hard limits on knowability)
- 10 confidence ceiling modifiers
- 6 knowledge state classifications
- Confidence claim validation (prevents overconfidence)
- 10 API actions

### Engine 69: Decision Liability Engine (DEPLOY277)
- 5 decision modes (assist, advisory, supervisory, authority, locked)
- 12 decision categories with mode requirements
- 8 liability boundary rules
- 6 escalation triggers
- 10 regulatory framework references
- Human-in-the-loop enforcement
- Decision provenance and audit trail
- 10 API actions

---

## Step 1: Run SQL Migration

Run this in Supabase SQL Editor:

```sql
-- DEPLOY273-277: Phase 1 v8 Expansion Tables

-- Evidence contracts
CREATE TABLE IF NOT EXISTS evidence_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  domain TEXT NOT NULL,
  contract_key TEXT NOT NULL,
  evidence_items JSONB DEFAULT '[]',
  evidence_score NUMERIC(4,2),
  confidence_ceiling NUMERIC(4,2),
  mode_eligibility TEXT,
  missing_critical JSONB DEFAULT '[]',
  result_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coating assessments
CREATE TABLE IF NOT EXISTS coating_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  scan_id UUID,
  coating_system TEXT,
  service_environment TEXT,
  disposition TEXT,
  mode TEXT,
  confidence NUMERIC(4,2),
  evidence_score NUMERIC(4,2),
  flags JSONB DEFAULT '[]',
  steps JSONB DEFAULT '[]',
  result_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coating audit events
CREATE TABLE IF NOT EXISTS coating_audit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  scan_id UUID,
  action_type TEXT NOT NULL,
  event_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uncertainty records
CREATE TABLE IF NOT EXISTS uncertainty_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  final_confidence NUMERIC(4,2),
  confidence_ceiling NUMERIC(4,2),
  knowledge_state TEXT,
  sources_count INTEGER,
  result_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decision audit log
CREATE TABLE IF NOT EXISTS decision_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID,
  case_id UUID,
  decision_category TEXT,
  decision_mode TEXT,
  confidence NUMERIC(4,2),
  disposition TEXT,
  rationale TEXT,
  human_reviewer TEXT,
  human_approved BOOLEAN DEFAULT FALSE,
  engine_versions JSONB DEFAULT '{}',
  evidence_summary JSONB,
  escalation_flags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evidence_contracts_org ON evidence_contracts(org_id);
CREATE INDEX IF NOT EXISTS idx_evidence_contracts_case ON evidence_contracts(case_id);
CREATE INDEX IF NOT EXISTS idx_coating_assessments_org ON coating_assessments(org_id);
CREATE INDEX IF NOT EXISTS idx_coating_assessments_case ON coating_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_coating_audit_events_org ON coating_audit_events(org_id);
CREATE INDEX IF NOT EXISTS idx_uncertainty_records_org ON uncertainty_records(org_id);
CREATE INDEX IF NOT EXISTS idx_uncertainty_records_case ON uncertainty_records(case_id);
CREATE INDEX IF NOT EXISTS idx_decision_audit_log_org ON decision_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_decision_audit_log_case ON decision_audit_log(case_id);

-- Enable RLS
ALTER TABLE evidence_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE coating_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coating_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE uncertainty_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role bypass)
CREATE POLICY "evidence_contracts_service" ON evidence_contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "coating_assessments_service" ON coating_assessments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "coating_audit_events_service" ON coating_audit_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "uncertainty_records_service" ON uncertainty_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "decision_audit_log_service" ON decision_audit_log FOR ALL USING (true) WITH CHECK (true);
```

---

## Step 2: Push to GitHub & Deploy

```bash
cd "NDT Platform"
git add .
git commit -m "DEPLOY273-277: Phase 1 v8 Expansion — 5 new engines (65-69)"
git push origin main
```

Netlify auto-deploys on push.

### Updated/New Files

- `netlify/functions/evidence-contract-engine.ts` — NEW (engine 65)
- `netlify/functions/coatings-intelligence-authority.ts` — NEW (engine 66)
- `netlify/functions/mechanism-causality-engine.ts` — NEW (engine 67)
- `netlify/functions/uncertainty-boundary-engine.ts` — NEW (engine 68)
- `netlify/functions/decision-liability-engine.ts` — NEW (engine 69)
- `netlify/functions/health.ts` — Updated ENGINE_REGISTRY (64 → 69)
- `public/system-check.html` — Updated (64 → 69 engines)

---

## Step 3: Verify

1. Go to `https://4dndt.netlify.app/system-check.html`
2. Click **Run Full System Check**
3. Confirm **69 endpoints** respond (all PASS)

### Quick Smoke Tests

```
POST /api/evidence-contract-engine      →  { "action": "get_registry" }
POST /api/coatings-intelligence-authority  →  { "action": "get_registry" }
POST /api/mechanism-causality-engine    →  { "action": "get_registry" }
POST /api/uncertainty-boundary-engine   →  { "action": "get_registry" }
POST /api/decision-liability-engine     →  { "action": "get_registry" }
```

### Test Coating DFT Check

```json
POST /api/coatings-intelligence-authority
{
  "action": "check_dft",
  "readings": [180, 195, 210, 200, 190],
  "spec_min_um": 200,
  "spec_max_um": 300
}
```
Expected: REJECT (spot avg 195 um below 200 um minimum)

### Test Mechanism Identification

```json
POST /api/mechanism-causality-engine
{
  "action": "identify_mechanism",
  "indications": ["branching_cracks", "transgranular"],
  "material": "austenitic_stainless_steel",
  "environment": ["chloride"]
}
```
Expected: Top candidate = Chloride Stress Corrosion Cracking

### Test Decision Mode

```json
POST /api/decision-liability-engine
{
  "action": "evaluate_decision_mode",
  "decision_category": "shutdown_recommendation",
  "confidence": 0.95
}
```
Expected: LOCKED — shutdown decisions always require human authority

### Test Uncertainty Validation

```json
POST /api/uncertainty-boundary-engine
{
  "action": "validate_confidence_claim",
  "claimed_confidence": 0.95,
  "ai_only": true,
  "inspection_data": false
}
```
Expected: OVERCONFIDENT flags — AI-only ceiling is 0.65, no inspection ceiling is 0.40
