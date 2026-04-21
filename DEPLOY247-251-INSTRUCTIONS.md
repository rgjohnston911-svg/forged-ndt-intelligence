# DEPLOY247-251: GPT-Recommended Governance & Enterprise Features

## What's New
Five new engines recommended by GPT red-team evaluation:

| Deploy | Engine | File | Purpose |
|--------|--------|------|---------|
| DEPLOY247 | Validation Benchmark | validation-benchmark.ts | Known-answer testing, repeatability, expert comparison, confusion matrix |
| DEPLOY248 | Decision Traceability | decision-traceability.ts | 12-step decision trace, side-by-side comparison, full audit trail |
| DEPLOY249 | Rules Version Control | rules-version-control.ts | Versioned rule packs, change impact analysis, effective dates |
| DEPLOY250 | Evidence Integrity | evidence-integrity.ts | HMAC-SHA256 evidence sealing, tamper detection, chain-of-custody |
| DEPLOY251 | Enterprise Operations | enterprise-operations.ts | System health, SLA reporting, DR planning, capacity forecast, rollback |

## Deployment Steps

### Step 1: Deploy the 5 new engine files
For each file below, go to GitHub > `netlify/functions/` and create a new file:

1. **validation-benchmark.ts** - Copy from `netlify/functions/validation-benchmark.ts`
2. **decision-traceability.ts** - Copy from `netlify/functions/decision-traceability.ts`
3. **rules-version-control.ts** - Copy from `netlify/functions/rules-version-control.ts`
4. **evidence-integrity.ts** - Copy from `netlify/functions/evidence-integrity.ts`
5. **enterprise-operations.ts** - Copy from `netlify/functions/enterprise-operations.ts`

### Step 2: Update health.ts
Open `netlify/functions/health.ts` in GitHub and replace the entire file contents with the updated version from your local folder.

### Step 3: Update system-check.html
Open `public/system-check.html` in GitHub and replace the entire file contents with the updated version from your local folder.

### Step 4: Verify
1. Wait for Netlify deploy to complete
2. Go to https://4dndt.netlify.app/system-check.html
3. Click "Run Full System Check"
4. Expected result: **44 PASS**

## Engine Summary

### DEPLOY247: Validation Benchmark
- 16 known-answer benchmark cases across 7 categories
- 8 vertical validation dossiers with coverage metrics
- Repeatability testing (N runs, verify identical output)
- Expert comparison framework with disagreement classification
- Confusion matrix with safety-oriented interpretation

### DEPLOY248: Decision Traceability
- 12-step decision tree from evidence collection to audit seal
- Pulls from all DB tables to build complete decision trace
- Side-by-side case comparison
- Every step shows source, confidence, and dependencies

### DEPLOY249: Rules Version Control
- 7 rule packs containing 37 individual rules
- Full version history with effective/retired dates
- Change impact analysis with delta calculations
- Weight sum validation for scoring rules

### DEPLOY250: Evidence Integrity
- HMAC-SHA256 sealing of evidence objects
- Per-item and case-level verification
- Tamper detection with integrity status
- Chain-of-custody provenance tracking
- Integrity report with A-F grading

### DEPLOY251: Enterprise Operations
- Real-time system health dashboard
- Tenant health scoring with activity metrics
- SLA targets and compliance reporting
- 4-tier rollback strategy catalog
- M/M/c queue simulation for capacity planning
- 5-tier disaster recovery plan with RTO/RPO targets
- 12-month capacity forecasting with scaling alerts

## Post-Deploy: System Totals
- **44 engines** (41 deterministic, 3 AI-assisted)
- **8 industry verticals** (Chemical, Nuclear, Aerospace, Power Gen, Maritime, Civil Infrastructure, Space Systems, Medical/Bio)
- **2 cross-cutting layers** (Robotics/Automation, Human Intelligence)
- **4 governance engines** (Validation, Traceability, Rules, Evidence Integrity)
- **1 enterprise operations engine**
