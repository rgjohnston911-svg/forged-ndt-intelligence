# DEPLOY381: SA Tier 1 — surface Stakeholder Matrix + Conflict Detection on every report

## Why
A GPT eval of a live test report scored the platform 6.5/10 on situational awareness, noting that stakeholder perspectives, conflict detection, and scenarios were absent from the output. Investigation confirmed the report contained **zero SA content** — even though the SA engines (L9.1 stakeholder, L9.2 conflict, L9.3 consequence, L9.4 brief) are built and deployed. Root cause: the SA chain only fired **after the user answered SA questions**, and the test report was a HOLD generated without completing that loop, so `saPackage` was null and nothing rendered.

## What This Does
Removes the answer-gate so the SA chain runs on **every** decision-core result. The stakeholder and conflict engines operate on the frozen DecisionPackage alone (validated evidence is optional and handled as null), so the **Stakeholder Matrix + Conflict Detection now surface in every report and PDF** — directly addressing the eval's "Level 2 (Stakeholder Awareness)" and "Level 3 (Conflict Detection)" gaps with engines we already shipped.

This is **Tier 1 of 3** from the SA-gap roadmap:
- **Tier 1 (this):** surface what we built (stakeholder + conflict on every report).
- **Tier 2 (next):** wire the L4 failure-timeline into `probabilityBasis` so the Consequence Simulator emits real probability-weighted scenarios (eval Level 5) instead of `confidence: 0`.
- **Tier 3:** new engines — Organizational Failure Detection, Escalation Momentum, Converging Failure Pathway (eval Levels 1 & 4).

## The change (1 block in `src/pages/VoiceInspectionPage.tsx`)
The SA-orchestrate fire condition changes from:
```
if (saResponsesRef.current && saResponsesRef.current.length > 0 && coreRes && coreRes.decisionPackage) {
```
to:
```
if (coreRes && coreRes.decisionPackage) {
```
Everything else (best-effort try/catch, the on-screen SA card, the PDF SA section) is unchanged — they already render whenever `saPackage` is set.

## Notes / trade-offs
- **SA now appears on all reports** (the previous "byte-identical when SA absent" behavior is intentionally relaxed — surfacing SA everywhere is the goal here).
- Adds one `situational-awareness-orchestrate` call per decision-core run (best-effort; a failure is logged to `errs` and never blocks the report).
- On a HOLD/answer-less run, validated evidence is null, so stakeholder views/conflicts derive from the DecisionPackage; the Consequence scenarios remain `confidence: 0` until Tier 2.
- `tsc -b` passes. Diff is ~12 lines (comment + the one condition).

## Deploy Steps (git bash)
```
git pull
git add src/pages/VoiceInspectionPage.tsx DEPLOY381-INSTRUCTIONS.md
git status
git diff --cached --stat src/pages/VoiceInspectionPage.tsx
```
Confirm a small (~12-line) `.tsx` diff, then:
```
git commit -m "DEPLOY381 - SA Tier 1: run the SA chain on every decision-core result (drop the sa_responses gate). Stakeholder Matrix + Conflict Detection now surface in every report/PDF; engines handle null validated evidence. Best-effort, never blocks the report. tsc -b clean."
git push
```
(If OneDrive blocks a local `npm run build`, `tsc -b` already passed; Netlify runs the full build.)

## After Deploy — verify live
Run any inspection through to a decision-core result (even a HOLD). Confirm:
1. The on-screen **Situational Awareness Brief** card now appears (recommendation, risk, conflicts, stakeholder positions).
2. The exported **PDF** now includes the Situational Awareness section.
3. A normal run still completes if the SA call fails (best-effort).
