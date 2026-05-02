# 4D NDT Intelligence Platform — 3-Tier Access Model

**Owner:** Richard Johnston  
**Last Updated:** 2026-05-01

---

## Tier Overview

| | AI Assistant | AI Pro Assistant | Platform |
|---|---|---|---|
| **Target User** | Students, trainees, entry-level inspectors | CWI, Level II/III, engineers, integrity specialists | Companies, inspection firms, asset owners |
| **Pricing Model** | Free / low monthly | Professional monthly subscription | Enterprise annual license |
| **Suggested Price** | Free or $29/mo | $149-299/mo per seat | $2,000-10,000/mo (usage-based) |

---

## AI Assistant (Basic Tier)

**Who it's for:** NDT students studying for Level I/II exams, field inspectors who need quick reference, trainees learning damage mechanisms.

### Access Includes:

**Knowledge & Reference**
- Universal Formula Engine (all 20+ engineering formulas with explanations)
- Method Capability Matrix (which NDT method detects which mechanism)
- Code reference lookups (ASME, API, AWS edition info — read-only, no routing)
- Damage mechanism definitions and typical indicators
- Educational feedback engine (explains WHY a method works or doesn't)

**Basic Assessment**
- Single-method physics sufficiency check (is my selected method adequate?)
- Basic POD calculation (single method, single mechanism)
- Simple corrosion rate and remaining life calculations
- Basic risk ranking (PoF × CoF)

**Limitations (NOT included)**
- No tri-model AI reasoning (Superbrain)
- No comprehensive assessment orchestrator
- No differential diagnosis engine
- No multi-mechanism analysis
- No authority lock / disposition decisions
- No case storage or history
- No report generation
- No image analysis
- No learning engine access
- Max 20 queries/day

### Engine Access (15 of 144):
1. health (system status only)
2. physics-sufficiency-engine (single-method mode)
3. universal-code-authority (lookup mode only)
4. live-code-authority (lookup mode only)
5. inspection-effectiveness-engine (single-method POD)
6. api-standards-authority (reference only)
7. nde-image-analysis (educational tier — explains what they see, no disposition)
8. formula calculations (stress, strain, corrosion rate, remaining life, etc.)
9. method capability matrix queries
10. basic risk calculator

---

## AI Pro Assistant (Professional Tier)

**Who it's for:** Certified Welding Inspectors (CWI), ASNT Level II/III technicians, corrosion engineers, mechanical integrity engineers, fitness-for-service analysts.

### Access Includes:

**Everything in AI Assistant, plus:**

**Full Assessment Pipeline**
- Comprehensive assessment orchestrator (full multi-stage pipeline)
- Differential Diagnosis Engine (all 5 domain KBs, 143+ mechanisms)
- Multi-method physics sufficiency (combined method evaluation)
- Contextual Factors Intelligence (environmental, operational, historical)
- Inspection effectiveness with full field quality modifiers

**AI-Powered Analysis**
- Tri-model adversarial reasoning (Superbrain) — limited to 10 cases/month
- Classification engine with authority lock
- Contradiction detection
- Evidence contract validation
- Decision confidence scoring

**Code Authority**
- Full code authority routing (ASME, API, AWS, DNVGL, NORSOK, etc.)
- Acceptance criteria evaluation
- Weld acceptance authority with full welding code KB
- Coatings inspection authority

**Specialized Engines**
- Corrosion loop engine
- Fatigue & vibration analysis
- Mechanism causality engine
- Uncertainty boundary engine
- Sour service & corrosion prediction
- MIC intelligence engine

**Image Analysis**
- NDE image analysis (Pro tier — full discontinuity classification + code evaluation)
- Multi-modality support (UT, RT, PAUT, TOFD, MT, PT, VT, ET, PEC)

**Case Management**
- Save and retrieve cases (up to 100 active cases)
- Basic report generation (PDF summary)
- Case search

**Limitations (NOT included)**
- No fleet-level analytics
- No multi-asset cascade analysis
- No batch processing
- No custom API access
- No white-label reports
- No learning engine write access (reads only)
- No subsea/marine vessel orchestrators
- No floating platform engine
- Limited Superbrain usage (10/month)
- No executive decision engine

### Engine Access (85 of 144):
All domain-specific engines for fixed equipment, refinery, and power generation. Single-asset analysis only.

---

## Platform (Enterprise Tier)

**Who it's for:** Inspection companies, asset owners (refineries, offshore operators, power plants), engineering firms managing fleets of assets.

### Access Includes:

**Everything in AI Pro, plus:**

**Unlimited AI Analysis**
- Unlimited Superbrain tri-model reasoning
- Background processing for large assessments
- Batch processing gateway (submit multiple cases)
- Priority queue processing

**Fleet & Multi-Asset**
- Multi-asset cascade engine
- Interaction mesh (cross-asset failure propagation)
- Fleet exposure analysis
- Root cause prevention authority
- Convergence reporter (cross-case pattern detection)
- Cross-case pattern recognition
- Outcome tracking with fleet-wide learning

**All Domain Orchestrators**
- Subsea structures orchestrator
- Marine vessel orchestrator
- Floating platform assessment engine
- Subsea production equipment engine
- Mooring system assessment engine
- Riser dynamics & VIV engine
- Subsea flow assurance engine

**Advanced AI Engines**
- Executive decision engine
- Neurosymbolic reasoning
- Conformal prediction (calibrated uncertainty)
- Active inspection optimizer
- Physics-constrained inference
- Uncertainty propagation
- Causal discovery engine
- Multi-agent debate engine
- Anomaly fingerprint engine
- Diffusion embedding retrieval
- Physics learning engine
- Self-calibrating digital twin

**Validation & Compliance**
- Regression test authority (run validation suites against your data)
- Decision proof recorder (audit trail for regulatory compliance)
- Convergence proof engine
- Validation suite engine

**Enterprise Features**
- Custom API access (programmatic engine calls)
- White-label report generation
- Branded PDF reports with company logo
- Multi-user accounts with role-based access
- SSO integration
- Usage analytics dashboard
- Dedicated support
- Custom engine configuration
- Data export (all cases, all outcomes)
- Learning engine write access (contributes to platform improvement)

### Engine Access: All 144 engines, unlimited usage.

---

## Implementation Plan

### Database Changes
```sql
-- Add tier column to user profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier text DEFAULT 'assistant'
  CHECK (tier IN ('assistant', 'pro', 'platform'));

-- Add usage tracking
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  tier text NOT NULL,
  endpoint text NOT NULL,
  called_at timestamptz DEFAULT now(),
  response_ms integer,
  tokens_used integer
);

-- Add daily usage limits
CREATE TABLE IF NOT EXISTS tier_limits (
  tier text PRIMARY KEY,
  daily_query_limit integer,
  monthly_superbrain_limit integer,
  max_active_cases integer,
  batch_enabled boolean DEFAULT false,
  api_access boolean DEFAULT false
);

INSERT INTO tier_limits VALUES
  ('assistant', 20, 0, 0, false, false),
  ('pro', 500, 10, 100, false, false),
  ('platform', -1, -1, -1, true, true);  -- -1 = unlimited
```

### Middleware Gate (add to each function)
```typescript
function checkTierAccess(userTier: string, requiredTier: string): boolean {
  const hierarchy = { assistant: 1, pro: 2, platform: 3 };
  return (hierarchy[userTier] || 0) >= (hierarchy[requiredTier] || 999);
}
```

### Engine-to-Tier Mapping
Every engine endpoint gets a `requiredTier` tag in the ENGINE_REGISTRY in health.ts. The function middleware checks the user's tier before executing.

---

## Marketing Positioning

### AI Assistant — "Learn Smarter"
> Your AI study partner for NDT certification. Get instant answers on methods, codes, formulas, and damage mechanisms. Built by inspectors, for inspectors.

### AI Pro Assistant — "Inspect with Confidence"
> Full AI-powered inspection intelligence. Differential diagnosis, physics validation, code authority, and defensible disposition decisions — all in your pocket.

### Platform — "Enterprise Inspection Intelligence"
> Fleet-wide inspection optimization powered by 144 AI engines. Multi-asset analysis, regulatory compliance automation, and self-improving decision intelligence that gets smarter with every case your team runs.

---

## Revenue Model Notes

- **AI Assistant** as free tier drives adoption and brand awareness among students/trainees who become tomorrow's buyers
- **AI Pro** is the volume tier — individual practitioners paying monthly
- **Platform** is the revenue driver — enterprise contracts with annual commitments
- Upgrade path is natural: students graduate to Pro, then bring the Platform to their employer
