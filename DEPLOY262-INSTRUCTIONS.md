# DEPLOY262: Contradiction Engine v1.0.0

## What This Does
"Student says no cracks — photo shows linear indication at crater." The highest-impact teaching engine in the platform. Catches gaps between what the person CLAIMS and what the EVIDENCE shows. Forces honest observation before allowing disposition.

20 contradiction rules across 10 categories. Every claim is checked against available evidence. Contradictions block disposition until resolved. Each contradiction includes a detailed teaching response explaining what went wrong and how to fix it.

## 10 Capabilities
1. **Get Registry** — engine overview
2. **Check Contradictions** — run all 20 rules against an assessment, calculate integrity score, block disposition if critical contradictions found
3. **Get Rules** — list all contradiction rules with category/severity filtering
4. **Get Detected** — retrieve contradictions found for an assessment
5. **Resolve Contradiction** — mark as resolved with corrective action (claim_corrected, evidence_reexamined, both_updated, false_positive_confirmed)
6. **Get Integrity Score** — 0-100 score where 100 = all claims consistent with evidence
7. **Get Assessment Summary** — full summary with all contradictions and resolution status
8. **Override Contradiction** — instructor/CWI override with mandatory justification (audit-trailed)
9. **Get Teaching Response** — detailed teaching content for any contradiction rule
10. **Get Contradiction Stats** — aggregate stats showing most common contradictions across all assessments

## 20 Contradiction Rules in 10 Categories

### Claim vs Image (4 rules)
- **CVE-001** [CRITICAL] Claims no cracks but linear indication detected in image
- **CVE-002** [MAJOR] Claims no porosity but rounded indications visible
- **CVE-003** [MAJOR] Claims no undercut but groove visible at weld toe
- **CVE-004** [CRITICAL] Claims no incomplete fusion but cold lap visible

### Claim vs Measurement (3 rules)
- **CVM-001** [MAJOR] Claimed throat does not match WPS requirement
- **CVM-002** [MAJOR] Claimed weld size conflicts with leg measurement
- **CVM-003** [MINOR] Reinforcement exceeds code maximum but claimed acceptable

### Measurement vs Measurement (2 rules)
- **MVM-001** [MAJOR] UT thickness exceeds nominal (physically impossible in corrosion service)
- **MVM-002** [MAJOR] Hardness reading conflicts with material specification

### Claim vs Code (2 rules)
- **CVC-001** [CRITICAL] Accepts weld but findings exceed code limits
- **CVC-002** [MINOR] Rejects weld but all findings within code limits

### Measurement vs WPS (2 rules)
- **MVW-001** [MAJOR] Amperage outside WPS qualified range
- **MVW-002** [MAJOR] Voltage outside WPS qualified range

### Process vs Evidence (1 rule)
- **PVE-001** [MAJOR] Claimed process does not match visual characteristics

### Position vs Evidence (1 rule)
- **POS-001** [MAJOR] Claimed position does not match gravity effects on bead

### Material vs Evidence (1 rule)
- **MAT-001** [CRITICAL] Claimed material does not match visual/PMI evidence

### History vs Current (1 rule)
- **HVC-001** [MINOR] Current disposition conflicts with prior assessment without documented repair

### Logic Conflict (3 rules)
- **LOG-001** [CRITICAL] Accepts weld while reporting a crack (prohibited under all codes)
- **LOG-002** [MINOR] Rejects weld with no discontinuities reported
- **LOG-003** [MAJOR] Definitive disposition with insufficient evidence (<50% sufficiency)

## Deploy Steps

### Step 1: SQL Migration
Run in Supabase SQL Editor:
- File: `supabase/migrations/DEPLOY262_contradiction_engine.sql`
- Creates 4 tables: contradiction_rule_registry, detected_contradictions, contradiction_assessments, contradiction_audit_events
- Seeds 20 contradiction rules with teaching responses
- Click "Run and enable RLS"

### Step 2: Netlify Function
Paste into GitHub:
- File: `netlify/functions/contradiction-engine.ts`
- 10 actions (see above)

### Step 3: Health Registry
Paste updated file:
- File: `netlify/functions/health.ts`
- Now has 55 engines

### Step 4: System Check
Paste updated file:
- File: `public/system-check.html`
- Now tests 55 endpoints

## Test After Deploy
Visit: https://4dndt.netlify.app/system-check.html
Expected: 55 PASS (Ctrl+Shift+R to hard refresh)

## Integrity Scoring

Starts at 100, deducted per contradiction by severity:
- Critical: -30 points
- Major: -15 points
- Minor: -5 points
- Informational: 0 points

Ratings:
- 90-100: HIGH — claims consistent with evidence
- 70-89: MODERATE — minor inconsistencies detected
- 40-69: LOW — significant contradictions require resolution
- 0-39: CRITICAL — disposition blocked until contradictions resolved

## Disposition Blocking

Disposition is automatically blocked when:
- Any CRITICAL contradiction is detected (crack accepted, claim contradicts clear evidence, material mismatch)
- Integrity score drops below 40

Blocked dispositions require the student/inspector to resolve contradictions before the system will accept their disposition. This forces honest observation and accurate reporting.

## Teaching Integration

Every contradiction rule includes:
- **Description** — what the contradiction is
- **Detection Logic** — how the system finds it
- **Example Scenario** — real-world case that triggers this rule
- **Teaching Response** — detailed explanation of what went wrong, why it matters, and how to fix it

The teaching responses are written at the CWI level — they explain the physics, the code requirements, and the practical correction. This is where the system teaches by catching mistakes, not by lecturing.
