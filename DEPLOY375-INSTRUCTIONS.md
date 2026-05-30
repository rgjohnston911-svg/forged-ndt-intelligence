# DEPLOY375: SA Build Stage 9 (Part 2b frontend) — Executive Brief wiring + render

## What This Does
Completes the SA build. After a decision-core run, **when the user actually provided SA answers** (`sa_responses`), the frontend POSTs the frozen `decisionPackage` + `validated_evidence_set` to the `situational-awareness-orchestrate` endpoint (DEPLOY374), receives the assembled `SituationalAwarenessPackage`, and renders the **Executive Brief** both on screen (a new card) and in the exported **PDF report**.

## Why It Is Safe
- **SA-absent path is byte-identical.** The orchestrate fetch is gated on `saResponsesRef.current.length > 0`; a normal inspection never calls it. The on-screen card renders only when `saPackage` is set, and the PDF section is wrapped in `if (data.situationalAwarenessPackage)`. With no SA, `saPackage` stays `null` → no fetch, no card, and the PDF is unchanged.
- **Best-effort, non-blocking.** The SA fetch is in its own `try/catch`; any failure is pushed to `errs` and the normal report still renders.
- **Compiles clean.** `tsc -b` exits 0. The content diff vs the prior commit is ~83 lines (the 7 edits below) — not a whole-file churn.
- **Endpoint resolves.** `callAPI("situational-awareness-orchestrate", …)` → `/api/situational-awareness-orchestrate` → (netlify.toml redirect) → `/.netlify/functions/situational-awareness-orchestrate` (shipped in DEPLOY374).

## The 7 edits (all in `src/pages/VoiceInspectionPage.tsx`)
1. `generateInspectionReport` data type gains `situationalAwarenessPackage?: any`.
2. New **SA section** in the PDF HTML, injected before the signature block, guarded by `if (data.situationalAwarenessPackage && …executiveBrief)`.
3. New state: `var [saPackage, setSaPackage] = useState<any>(null)`.
4. `saPackage` reset to `null` on each new Analyze (alongside the other resets).
5. After the decision-core call, gated SA orchestrate fetch (best-effort) → `setSaPackage(...)`.
6. The Export-PDF click passes `situationalAwarenessPackage: saPackage` into the report.
7. New on-screen **"Situational Awareness Brief"** card (recommendation, risk triad, confidence, conflict count, unresolved CRITICALs), rendered only when `saPackage` is present.

## MUST DO before pushing — run the full build locally
`tsc -b` was verified here, but `vite build` could **not** run in the assistant sandbox (the Windows-installed `node_modules` lacks rollup's Linux native binary). Please run the full build on your machine first:
```
npm run build
```
It should complete `tsc -b` **and** `vite build` with no errors. If it fails, paste the error and stop — do not push.

## Files in This Deploy
### 1. MODIFIED — `src/pages/VoiceInspectionPage.tsx`
The 7 edits above. No test file (the orchestrator was already tested in DEPLOY374 against the real `_probe-response.json`).

## Deploy Steps (git bash)

### Step 0 (MANDATORY) — pull first
```
git pull
```

### Step 1 — full local build (see above)
```
npm run build
```

### Step 2 — stage ONLY this file + the doc (by name; never `git add -A`)
```
git add src/pages/VoiceInspectionPage.tsx DEPLOY375-INSTRUCTIONS.md
```

### Step 3 — confirm the staged set + that the file change is small
```
git status
git diff --cached --stat src/pages/VoiceInspectionPage.tsx
```
Expect `modified: src/pages/VoiceInspectionPage.tsx` + `new file: DEPLOY375-INSTRUCTIONS.md`, and a small diff (~80 lines, NOT thousands). If the stat shows thousands of lines, stop and tell me.

### Step 4 — commit + push
```
git commit -m "DEPLOY375 - Stage 9 Part 2b (frontend): wire SA orchestrate after decision-core when sa_responses present; render Executive Brief on screen + in PDF. Gated on saPackage so SA-absent UI and report are byte-identical; best-effort fetch never blocks the report. tsc -b clean."
git push
```
If an `index.lock` error appears, `rm -f ".git/index.lock"` and retry. Confirm `git status` shows the file staged before committing.

## After Deploy — live verification (this is a real UI/PDF change)
Once Netlify publishes:
1. **SA flow:** run an inspection that triggers SA questions → answer them → Generate. Confirm the new **Situational Awareness Brief** card appears and the exported PDF includes the SA section (recommendation, risk triad, stakeholder positions, conflicts).
2. **Non-SA flow:** run a normal inspection with no questions. Confirm **no** SA card appears and the PDF report looks exactly as before.
3. Confirm a SA-orchestrate hiccup (if any) doesn't block the normal report (it's best-effort).

## SA Build — COMPLETE
With this deploy, all 11 stages of the FORGED SA Build Brief are shipped: L9.0 gate (Stages 1–5) + regression (6), L9.1 stakeholder (7), L9.2 conflict (8), L9.4 brief engine (9 Pt1), L9.3 consequence (10), Stage 11 assembler, the duplicate-question UX-echo fix (9 Pt2a), the SA orchestration endpoint (9 Pt2b backend), and this frontend render (9 Pt2b frontend). The deterministic core stayed frozen throughout; every SA artifact references the DecisionPackage by hash and adds no field to it.
