# DEPLOY252: Concept Intelligence Core v2.0.0

## The "Thinking AI" Engine

This is the most important engine in the system. It encodes experienced inspector instinct as deterministic mechanism chains — "If I see X, always check Y."

## What It Does

12 Concept Engines across 5 Reality Families:

| Engine | Family | What It Does |
|--------|--------|-------------|
| Constraint Dominance | governing_reality | What is actually governing this case? |
| Physics Sufficiency | governing_reality | Are the inspection methods adequate for the findings? |
| Mechanism Propagation | propagation_reality | 20+ mechanism chains — coating disbond triggers CUC check, FIV triggers small-bore fatigue, scour triggers undermining |
| Mechanism Interaction | propagation_reality | Detects coupled mechanisms (creep+fatigue, HIC+SCC, erosion+corrosion) |
| Contradiction Detection | uncertainty_reality | Flags when VT says "fine" but UT shows wall loss |
| Blind Spot Detector | uncertainty_reality | HAZ not checked? Supports not assessed? No baseline? |
| Information Gain | action_reality | Ranks which next action reduces uncertainty the most |
| Failure Pathway | propagation_reality | What happens if this finding is ignored? |
| Parallel Reality | action_reality | Monitor vs repair vs replace — what's the outcome? |
| Confidence Collapse | uncertainty_reality | When should we trust the confidence score less? |
| Decision Boundary | governing_reality | Is the measurement sitting right on the accept/reject line? |
| Causal Root | origin_reality | What likely caused this? Process, design, fabrication, environment? |

## Mechanism Chain Database

20+ real mechanism chains across 9 categories:

1. **Mechanism Cascade** — CUI, coating disbond→CUC, FIV→fatigue, sulfidation→creep, HIC→SOHIC, scour→undermining, MIC, SCC, erosion-corrosion, creep, boiler tubes, tank bottoms, cladding, nuclear, aerospace, maritime, medical, power gen
2. **Cross-Method NDT Triggering** — VT crack→PAUT/TOFD, manual UT→PAUT, RT→UT verification
3. **Code Enforcement Chains** — Below tmin→API 579, pressure boundary crack→engineering review, hardness→NACE
4. **Mechanism Interaction** — Creep+fatigue, HIC+SCC, erosion+corrosion, vibration+corrosion, coating+CP failure
5. **Environmental Events** — Hurricane, freeze-thaw, earthquake cascades
6. **Asset Propagation** — One nozzle cracks→check all nozzles, one unit fails→check fleet
7. **Human/Process** — Bad weld→check welder's other welds, wrong material→check supply chain
8. **Consequence Chains** — Sour service leak→H2S exposure, high-energy line failure
9. **Adaptive Planning** — Accelerating rate→increase frequency, repeat finding→root cause

## Deployment Steps

### Step 1: Run SQL Migration
Go to Supabase SQL Editor and run the contents of:
`supabase/migrations/DEPLOY252_concept_intelligence_core.sql`

This creates 7 tables and seeds the concept registry.

### Step 2: Deploy the engine file
Go to GitHub > `netlify/functions/` and create:
- **concept-intelligence-core.ts** — Copy from `netlify/functions/concept-intelligence-core.ts`

### Step 3: Update health.ts
Replace `netlify/functions/health.ts` with the updated version (now has 45 engines in registry).

### Step 4: Update system-check.html
Replace `public/system-check.html` with the updated version (now tests all 45 engines).

### Step 5: Verify
1. Wait for Netlify deploy
2. Go to https://4dndt.netlify.app/system-check.html
3. Click "Run Full System Check"
4. Expected: **45 PASS**

## Testing the Engine

After deploy, you can test the chain database directly:

```json
POST /api/concept-intelligence-core
{ "action": "get_chain_for", "keyword": "coating_disbond" }
```

This returns all chains triggered by coating disbond — including the CUC chain you asked about.

```json
POST /api/concept-intelligence-core
{ "action": "get_chain_for", "keyword": "fiv" }
```

Returns the full FIV cascade — small-bore fatigue, support loosening, weld toe cracking, socket weld fatigue, threaded connection failure.

```json
POST /api/concept-intelligence-core
{ "action": "get_chain_for", "keyword": "scour" }
```

Returns scour cascade — undermining, settlement, pile exposure, riprap displacement, structural misalignment.

```json
POST /api/concept-intelligence-core
{ "action": "analyze_case", "case_id": "your-case-uuid" }
```

Runs all 12 concept engines against a real case and returns the full Concept Intelligence Pack.

## System Totals After Deploy
- **45 engines** (42 deterministic, 3 AI-assisted)
- **12 concept engines** within this single function
- **20+ mechanism chains** with 60+ secondary risks
- **10 NDT method capability profiles**
- **9 mechanism interaction pairs**
