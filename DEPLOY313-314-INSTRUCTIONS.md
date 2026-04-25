# DEPLOY313-314: Regression Test Authority + Decision Proof Recorder

## What This Deploy Adds

**Engine 105: Regression Test Authority (DEPLOY313)**
- Proves engines produce CORRECT outputs, not just respond
- 42 test vectors across all major engines
- Actually POSTs to endpoints with known inputs, validates outputs
- Reports pass/fail with diffs, stores run history
- Coverage report shows which engines have tests vs which don't
- Verdict system: ALL_PASS / REGRESSION_DETECTED / CRITICAL_REGRESSION

**Engine 106: Decision Proof Recorder (DEPLOY314)**
- Immutable audit trail for every authority decision
- Captures complete proof chain AT decision time
- Records: inputs, physics applied, code authority, evidence quality, confidence, alternatives, assumptions, rationale
- Proof records cannot be modified — revisions create new linked records
- Integrity hash on every proof for tamper detection
- Completeness grading (A/B/C/D) on every proof

## New Tables (2)

| Table | Purpose |
|-------|---------|
| regression_test_runs | Stores regression test suite results |
| decision_proofs | Immutable decision proof records |

## Deployment Sequence

### Step 1: Run SQL Migration
Open Supabase SQL Editor → paste contents of `DEPLOY313-314-MIGRATION.sql` → Run

### Step 2: Deploy Engine Files (2 files)

**File 1:** `regression-test-authority.ts`
- Source: `netlify/functions/regression-test-authority.ts` (already in place)
- Target: `netlify/functions/regression-test-authority.ts`

**File 2:** `decision-proof-recorder.ts`
- Source: `netlify/functions/decision-proof-recorder.ts` (already in place)
- Target: `netlify/functions/decision-proof-recorder.ts`

### Step 3: Update health.ts

Add these 2 entries to the `CRITICAL_TABLES` array:
```
{ name: "regression_test_runs", deploy: "DEPLOY313", critical: false },
{ name: "decision_proofs", deploy: "DEPLOY314", critical: false }
```

Add these 2 entries to the `ENGINE_REGISTRY` array:
```
{ name: "regression-test-authority", deploy: "DEPLOY313", mode: "deterministic", path: "/api/regression-test-authority" },
{ name: "decision-proof-recorder", deploy: "DEPLOY314", mode: "deterministic", path: "/api/decision-proof-recorder" }
```

### Step 4: Update system-check.html

Add these 2 test endpoints in the `runAllChecks()` function:
```
await testEndpoint("DEPLOY313: Regression Test Authority", "/api/regression-test-authority", { action: "get_registry" });
await testEndpoint("DEPLOY314: Decision Proof Recorder", "/api/decision-proof-recorder", { action: "get_registry" });
```

Update the subtitle to reflect new engine count.

### Step 5: Git commit and deploy
```
git add -A && git commit -m "DEPLOY313-314: Regression Test Authority + Decision Proof Recorder" && git push
```

### Step 6: Verify
1. Wait for Netlify deploy
2. Run system check — expect 106 PASS (or current count + 2)
3. Test regression authority: POST `/api/regression-test-authority` with `{ "action": "get_coverage" }`
4. Test proof recorder: POST `/api/decision-proof-recorder` with `{ "action": "get_registry" }`
5. Run full regression suite: POST `/api/regression-test-authority` with `{ "action": "run_full_suite" }`

## Test Payloads

**Regression Test — get coverage:**
```json
{ "action": "get_coverage" }
```

**Regression Test — run full suite:**
```json
{ "action": "run_full_suite" }
```

**Decision Proof — record a proof:**
```json
{
  "action": "record_proof",
  "case_id": "00000000-0000-0000-0000-000000000001",
  "source_engine": "weld-acceptance-authority",
  "decision_type": "weld_acceptance",
  "decision_value": "ACCEPT",
  "rationale": "Weld meets AWS D1.1 Table 6.1 criteria for static loading. Undercut 0.5mm < 1mm limit. No cracks detected.",
  "confidence": 0.92,
  "evidence_quality": 0.85,
  "physics_applied": { "model": "visual_acceptance", "code": "AWS D1.1", "table": "6.1" },
  "code_authority": { "governing_code": "AWS D1.1:2020", "clause": "6.9", "tier": "industry_standard" },
  "alternatives_considered": [
    { "option": "REJECT", "reason_rejected": "All measured values within code limits" },
    { "option": "HOLD_FOR_NDE", "reason_rejected": "Visual evidence sufficient for static connection per D1.1" }
  ],
  "assumptions": [
    { "assumption": "Static loading only", "valid": true },
    { "assumption": "Base metal is carbon steel", "valid": true }
  ]
}
```
