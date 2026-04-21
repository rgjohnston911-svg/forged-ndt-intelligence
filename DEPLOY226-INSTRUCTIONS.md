# DEPLOY226 — Inspector Adjudication Engine

Allows human inspectors to agree, disagree, or escalate system decisions — with mandatory rationale and full audit trail. The system decision is never modified; the inspector's decision lives alongside it.

## What it does

Three adjudication types:

1. **CONCUR** — Inspector agrees with the system. Recorded for audit proof that a human reviewed and approved the decision.

2. **OVERRIDE** — Inspector disagrees. They provide an alternative decision, an optional disposition change, and a mandatory rationale explaining why. The system's original decision is preserved; the inspector's becomes the effective decision.

3. **ESCALATE** — Inspector flags for senior review. Includes who to escalate to and a priority level (routine/elevated/urgent/emergency).

Every adjudication records:
- Who (inspector ID, email, name, cert level)
- When (timestamp)
- What the system said at that moment (state, confidence, disposition — snapshot)
- What the inspector decided and why
- Agreement rate tracking (concurs vs overrides across all cases)

## Deploy order

### 1. Run migration
File: `DEPLOY226-migration.sql` in Supabase SQL Editor.
Creates: `inspector_adjudications` table with RLS.
Adds: `adjudication_count`, `last_adjudication_type`, `last_adjudication_at`, `inspector_final_decision`, `inspector_override_active` to `inspection_cases`.

### 2. Paste function
File: `netlify/functions/inspector-adjudication.ts`
Endpoint: `POST /api/inspector-adjudication { action, case_id, ... }`

### 3. Paste component
File: `src/components/InspectorAdjudicationCard.tsx`

### 4. Mount on Decision tab in `src/pages/CaseDetail.tsx`

**Import** (with the others):
```
import InspectorAdjudicationCard from "../components/InspectorAdjudicationCard";
```

**JSX** — immediately after the EnterpriseAuditCard line:
```
{id && <InspectorAdjudicationCard caseId={id} />}
```

---

## Smoke test

1. Open any case on the Decision tab.
2. Inspector Adjudication → **Record Adjudication**.
3. Click **CONCUR** → Type rationale (min 10 chars) → Submit.
4. Stats row should show: 1 CONCUR, 0 OVERRIDE, 0 ESCALATE, 100% AGREEMENT.
5. Record another: **OVERRIDE** → Enter override decision → Submit.
6. Stats update: 1 CONCUR, 1 OVERRIDE, 50% AGREEMENT.
7. Banner appears: "INSPECTOR OVERRIDE ACTIVE" in red.
8. Expand history → Both adjudications show with system state snapshots.
9. **ESCALATE** → Enter escalate_to and priority → Submit.

---

## Architecture

- **Non-destructive**: The system decision is NEVER modified. Inspector decisions are parallel records.
- **Effective decision**: When an override is active, `inspector_override_active = true` and the case shows the inspector's decision as effective.
- **Snapshot**: Every adjudication captures the system state at that moment, so you can see what the system was saying when the inspector made their call.
- **Audit integration**: Every adjudication is logged to the `audit_events` table (DEPLOY223) automatically.
- **Stats endpoint**: `{ action: "get_stats" }` aggregates override patterns across all cases — which system states get overridden most, which inspectors disagree most.
- **Agreement rate**: Calculated as concurs / total adjudications. Tracks whether inspectors trust the system over time.
