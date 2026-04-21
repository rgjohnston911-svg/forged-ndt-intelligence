# DEPLOY228 — Escalation Workflow Engine

When an inspector escalates a case (DEPLOY226), this engine makes it actionable — creates a tracked escalation with auto-deadline, allows assignment to a reviewer, and records the resolution with rationale.

## What it does

Six actions:

1. **create** — Opens a new escalation with auto-calculated deadline based on priority:
   - Routine: 7 days
   - Elevated: 3 days
   - Urgent: 24 hours
   - Emergency: 4 hours

2. **assign** — Assigns an escalation to a specific reviewer.

3. **resolve** — Closes an escalation with one of four resolution types:
   - **Upheld** — The escalation concern was valid, original decision stands
   - **Overturned** — The escalation led to a changed decision
   - **Modified** — The decision was partially adjusted
   - **Deferred** — Pushed to a later review cycle

4. **get_queue** — Returns the escalation queue, filterable by status, priority, assignee.

5. **get_case_escalations** — Returns all escalations for a specific case.

6. **get_stats** — Aggregate stats: open count, overdue count, by priority, average resolution time, resolution breakdown.

## Deploy order

### 1. Run migration
File: `DEPLOY228-migration.sql` in Supabase SQL Editor.
Creates: `escalation_queue` table with RLS.
Adds: `escalation_count`, `active_escalation_id`, `escalation_status` to `inspection_cases`.

### 2. Paste function
File: `netlify/functions/escalation-workflow.ts`
Endpoint: `POST /api/escalation-workflow { action, ... }`

### 3. Paste component
File: `src/components/EscalationQueueCard.tsx`

### 4. Mount on Decision tab in `src/pages/CaseDetail.tsx`

**Import** (with the others):
```
import EscalationQueueCard from "../components/EscalationQueueCard";
```

**JSX** — after InspectorAdjudicationCard:
```
{id && <EscalationQueueCard caseId={id} />}
```

### 5. Update health.ts ENGINE_REGISTRY
Add to the array:
```
{ name: "escalation-workflow", deploy: "DEPLOY228", mode: "deterministic", path: "/api/escalation-workflow" }
```

### 6. Update system-check.html
Add test:
```
await testEndpoint("DEPLOY228: Escalation Workflow", "/api/escalation-workflow", { action: "get_stats" });
```

---

## Smoke test

1. Open any case → Inspector Adjudication → ESCALATE → Submit.
2. Escalation Workflow card should show "1 ACTIVE" with the escalation.
3. Click **Assign** → Enter reviewer → Confirm.
4. Status changes from OPEN to ASSIGNED.
5. Click **Resolve** → Select resolution type → Enter rationale → Submit.
6. Status changes to RESOLVED with resolution details shown.
7. Badge changes to "ALL RESOLVED".

---

## Architecture

- **Auto-deadlines**: Priority determines deadline (routine=7d, elevated=3d, urgent=24h, emergency=4h).
- **Overdue tracking**: Active escalations past deadline are flagged OVERDUE in the UI.
- **Resolution types**: upheld, overturned, modified, deferred — each tells a different story about the system's decision quality.
- **Audit integration**: Every create, assign, and resolve action is logged to audit_events (DEPLOY223).
- **Case tracking**: inspection_cases gets escalation_count, active_escalation_id, and escalation_status updated automatically.
- **Stats endpoint**: Aggregates queue health — how many open, overdue, average resolution time, resolution breakdown.
