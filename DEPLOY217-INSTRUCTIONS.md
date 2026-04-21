# DEPLOY217 — Planner-Agent Layer

The Decision Spine (DEPLOY216) tells you **what the machine believes and proves the record is untampered**.
The Planner-Agent (DEPLOY217) tells you **what to do next, who owns it, why, and how long it will take**.

Together they convert a finding into an auditable next-step queue.

---

## Deploy order (do these in order)

### 1. Run the migration in Supabase SQL Editor
File: `DEPLOY217-migration.sql`

Adds three columns to `inspection_cases`:
- `action_plan` JSONB
- `action_plan_generated_at` TIMESTAMPTZ
- `action_plan_status` TEXT (CHECK ready_to_lock | actions_required | escalate | unknown)

Plus a partial index on `actions_required` and `escalate` for review-queue surfacing.

### 2. Paste the new Netlify function to GitHub
File: `netlify/functions/planner-agent.ts`

Six rules:
1. **OOD escalation** — out_of_distribution → critical escalate to supervisor; marginal → high review of neighbors
2. **Physics-coverage gaps** — one action per missing input on each required check, owner tuned by what's missing (inspector / level_ii_inspector / materials_engineer / integrity_engineer / ops_liaison)
3. **Thickness verdict** — `reject` → critical initiate_repair; `ffs_review` → high run API 579 Level 1
4. **Critical findings** — crack / lack-of-fusion / incomplete-penetration without sizing → critical re-scan with TOFD/PAUT
5. **Neighbor precedent conflict** — authority disposition disagrees with majority of K nearest neighbors → high reconcile
6. **Ready-to-lock detection** — all coverage closed and no other actions → medium lock_authority

Endpoint: `POST /api/planner-agent` with `{ case_id }`. Persists the plan to the case row.

### 3. Paste the new component to GitHub
File: `src/components/PlannerAgentCard.tsx`

Renders status badge, summary, and a prioritized action list with priority/owner chips, rationale, expected information gain, effort estimate, source check ID, and code references.

### 4. Mount it on the Decision tab in `src/pages/CaseDetail.tsx`
At the top, add the import next to the DecisionSpineCard import:

```
import PlannerAgentCard from "../components/PlannerAgentCard";
```

Then on the Decision tab, immediately AFTER the line where `<DecisionSpineCard caseId={...} />` is rendered, add:

```
<PlannerAgentCard caseId={caseId} />
```

That's the only edit to CaseDetail.tsx — one import, one JSX line.

---

## Smoke test

1. Open any case that has a signed Decision Spine bundle (DEPLOY216).
2. Decision tab → "Run planner".
3. Expect to see:
   - Status badge (READY TO LOCK / ACTIONS REQUIRED / ESCALATE)
   - One-line summary
   - List of prioritized actions, each with rationale + owner + effort
4. If a thickness CSV reading is in the 50–80% band: action `run_ffs_assessment` (high) should appear.
5. If OOD flag is `out_of_distribution`: action `escalate_to_human` (critical, owner=supervisor) should appear at the top.

---

## Why this is the right Path B

You now have:

- **Spine** (DEPLOY216) — proves what the machine concluded and that the record is integrity-sealed
- **Planner** (DEPLOY217) — converts the conclusion into a queue of owner-assigned, code-justified actions

Competitors can ship LLM black boxes that produce confident narratives. They cannot ship:
- a deterministic, auditable, owner-assigned action plan
- linked to physics-coverage gaps (API 510/570/579/BS 7910)
- linked to OOD calibration
- linked to neighbor precedent conflict
- with a SHA-256-sealed bundle hash on the underlying decision

That stack is the moat.
