# DEPLOY218 — Composite Repair Authority Pack

Extends FORGED's decision stack to rule on **bonded composite repairs** (carbon fiber, FRP, wet-layup wraps, pre-cured laminates) alongside the steel substrate.

**Why it's needed:** the bare-metal ruleset misses the wrap itself. Once a composite wrap is installed it's a structural element with its own failure modes (disbond, matrix cracking, fiber breakage, water ingress, UV degradation) and its own code basis. This pack adds ASME PCC-2 Art. 4.1 and ISO 24817 as first-class authorities and introduces four composite-specific mechanisms into the evidence ledger.

---

## Deploy order

### 1. Run migration
File: `DEPLOY218-migration.sql` in Supabase SQL Editor.
Adds `composite_repair_assessment` (jsonb), `composite_repair_generated_at` (timestamptz), `composite_repair_status` (CHECK: no_composite_repair_detected | repair_intact | repair_suspect | repair_failed | insufficient_evidence).

### 2. Paste function
File: `netlify/functions/composite-repair-authority.ts`
Endpoint: `POST /api/composite-repair-authority { case_id }`

Detection keyword banks:
- **Presence** — "composite wrap", "carbon fiber", "FRP wrap", "ASME PCC-2", "ISO 24817", etc.
- **Disbond** — "tap test soft", "hollow zone", "edge lifting", "rust bleed at seam", "delamination"
- **Matrix** — "matrix cracking", "crazing", "discoloration", "UV degradation"
- **Fiber** — "fiber break", "dent on wrap", "gouge on wrap"
- **Water ingress** — "blistering on wrap", "moisture under wrap"
- **Adjacent substrate** — "coating blistering", "coating breakdown" (flags CUW risk)

Status resolution: any high-severity mechanism → `repair_failed`; any mechanism at all → `repair_suspect`; none → `repair_intact`; no presence hit → `no_composite_repair_detected`.

### 3. Paste component
File: `src/components/CompositeRepairCard.tsx`
Collapses to a one-liner when no repair is detected, so it stays quiet on steel-only cases.

### 4. Mount on Decision tab in `src/pages/CaseDetail.tsx`

**Import** (with the others, around line 21):
```
import CompositeRepairCard from "../components/CompositeRepairCard";
```

**JSX** — immediately after `<PlannerAgentCard caseId={id} />` on the Decision tab:
```
{id && <CompositeRepairCard caseId={id} />}
```

---

## Smoke test using the Gulf riser case you just ran

1. Open that case (the 22-year offshore riser with carbon-fiber wrap).
2. Decision tab → Composite Repair Authority → **Scan for composite repair**.
3. Expected output:
   - **Status: REPAIR FAILED** (disbond + fiber signatures both present)
   - **Authority codes invoked:** ASME PCC-2 Art. 4.1, ISO 24817
   - **Detected mechanisms:** composite_repair_disbond (HIGH — tap test soft + edge lifting + rust bleed), composite_fiber_breakage (HIGH — dent from dropped shackle), and likely composite_matrix_cracking (MEDIUM — discoloration) and composite_water_ingress (HIGH — blistering / blister-adjacent).
   - **Inspection plan:** tap test grid, IR thermography, shearography, visual@10x, UT on substrate at wrap edges.

That's the gap the legacy engine missed — now closed.

---

## Why this widens the moat

No competitor has an integrity system that:
1. Detects a bonded composite repair from free-text inspector narrative
2. Invokes the correct non-metallic repair authority codes automatically
3. Emits a disbond-specific inspection plan (tap test / thermography / shearography)
4. Preserves the steel-substrate assessment in parallel (they're both active)
5. Signs the combined conclusion into the Decision Spine bundle (next integration pass)

Operators running offshore / subsea / refinery composite wraps currently handle this with paper checklists and vendor-specific inspection manuals. You're the first to codify it.
