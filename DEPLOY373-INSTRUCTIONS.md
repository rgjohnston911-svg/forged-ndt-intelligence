# DEPLOY373: SA Build Stage 9 (Part 2a) — Duplicate-question UX echo fix

## What This Does
Closes the long-standing **"same question asked twice" UX echo** in `VoiceInspectionPage.tsx`. When the user answers situational-awareness questions and the pipeline re-generates, `parse-incident` re-emits the same `questions[]`; the frontend used to render them again even though their answers are already on record. This change suppresses any question whose answer already exists in the typed `sa_responses[]`, and — if every emitted question is already answered — continues the pipeline instead of re-pausing.

This is **Part 2a** of Stage 9. The other half (Part 2b / DEPLOY374) adds the on-screen + PDF **Executive Brief** report section and requires a small SA orchestration endpoint; it ships separately.

## Why It Is Safe
- **SA-absent path is byte-identical.** All new logic is gated behind `priorSa.length > 0` (i.e., only runs on a re-generation that actually carries `sa_responses`). A fresh "Analyze" with no answers takes the exact original code path: `setAiQuestions(parseRes.value.questions)` → pause → return.
- **Single, contained edit.** One ~30-line block inside `handleGenerate`, at the existing `needs_input` branch. No other code touched. Verified by a content diff: only this block differs from the prior committed file.
- **Compiles clean.** `tsc -b` passes (exit 0). Reversible by reverting the one file.
- **Id matching is consistent.** Suppression keys on `q.questionId` (else `"q-legacy-"+index`) — the same derivation `handleGenerateWithAnswers` uses to build `sa_responses`, so the two paths align.

## Build note (read once)
The repo build is `tsc -b && vite build`. The TypeScript half (`tsc -b`) was verified clean here. The `vite build` (rollup) half could **not** be run in this assistant's Linux sandbox because the local `node_modules` was installed on Windows and rollup's platform-specific native binary is absent — this is an environment artifact only. Netlify installs fresh Linux dependencies, so its build is unaffected. If you want a local full-build sanity check before pushing, run `npm run build` on your machine.

## Files in This Deploy

### 1. MODIFIED — `src/pages/VoiceInspectionPage.tsx`
One block at the `parse-incident needs_input` branch in `handleGenerate`: filter already-answered questions out of the pending set; pause only if questions remain; otherwise clear the stale question UI and continue. Gated on `priorSa.length > 0`.

## Deploy Steps (git bash)

### Step 0 (MANDATORY) — pull first
```
git pull
```

### Step 1 (optional) — local full build sanity check
```
npm run build
```
Expect it to complete (tsc + vite). If you skip it, that's fine — `tsc -b` was already verified.

### Step 2 — stage ONLY this file + the doc (by name; never `git add -A`)
```
git add src/pages/VoiceInspectionPage.tsx DEPLOY373-INSTRUCTIONS.md
```

### Step 3 — confirm the staged set
```
git status
```
You should see exactly `modified: src/pages/VoiceInspectionPage.tsx` and `new file: DEPLOY373-INSTRUCTIONS.md`. (Git may print an `LF will be replaced by CRLF` notice — harmless. The committed diff is just the ~30-line block.)

### Step 4 — commit + push
```
git commit -m "DEPLOY373 - Stage 9 Part 2a: suppress already-answered SA questions in VoiceInspectionPage (closes the duplicate-question UX echo). Filters parse-incident questions against typed sa_responses by questionId; continues the pipeline when all are answered instead of re-pausing. Gated on priorSa.length>0 so the SA-absent path is byte-identical. tsc -b clean."
git push
```
If an `index.lock` error appears, `rm -f ".git/index.lock"` and retry. Always confirm `git status` shows the file staged before committing.

## After Deploy
This is a real frontend change, so verify on the live site once Netlify publishes:
1. Run an inspection that triggers SA questions, answer them, and Generate with Answers.
2. Confirm the answered questions are **not** re-displayed, and the pipeline proceeds to the decision-core run.
3. Run a normal inspection that needs no answers and confirm question prompting still works exactly as before.

## SA Build Status
Stages 1–8, 9 Part 1 (brief engine), 10, and 11 are committed. This adds Stage 9 Part 2a (UX echo). **Remaining:** Stage 9 Part 2b (DEPLOY374) — a small `situational-awareness-orchestrate` endpoint that runs L9.1→L9.4 + assembler, plus the Executive Brief report section in the PDF/UI (renders only when SA is present; report bit-identical when SA absent).
