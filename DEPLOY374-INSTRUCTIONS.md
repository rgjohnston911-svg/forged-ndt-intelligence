# DEPLOY374: SA Build Stage 9 (Part 2b backend) — SA Orchestration Endpoint

## What This Does
Adds the single **SA caller**: `situational-awareness-orchestrate`. Given a frozen `decisionPackage` and the L9.0 `validatedEvidenceSet`, it runs the full deterministic SA chain and returns the assembled `SituationalAwarenessPackage`:

```
L9.1 stakeholder -> L9.2 conflict -> L9.3 consequence -> L9.4 brief -> Stage 11 assembler
```

This is the backend half of Stage 9 Part 2. The **frontend wiring + Executive Brief report section** (which calls this endpoint and renders the result) is the next change, DEPLOY375.

## Why It Is Safe
- **Nothing calls it yet.** It deploys as a real endpoint (`/api/situational-awareness-orchestrate`) but no part of the live app invokes it until DEPLOY375. Platform behavior is unchanged.
- **Verified against a REAL captured response.** The local test feeds the actual `decisionPackage` from `_probe-response.json` through the whole chain — 9 stakeholder views, conflict matrix, consequence scenarios, executive brief, and an independent `saPackageHash`, all deterministic.
- **DecisionPackage is referenced, never modified (Directive 4).** The assembler uses the package's existing `packageHash`. The only transform is normalizing `fmd.dominant` (the runtime core emits it as an object) into its name string — done on a **shallow copy** fed to the projection engines; the original package object is left untouched (verified by test).
- **No clock, no LLM, no core imports.** It imports only the five SA modules. Any timestamp (`referenceIso`) is supplied by the caller.

## Files in This Deploy

### 1. NEW — `netlify/functions/situational-awareness-orchestrate.cjs`
Pure JS (`var` only, string concatenation only, no template literals, no arrow functions). Exports `orchestrateSa(parts)` (pure, testable) and an `exports.handler` HTTP endpoint with CORS. Requires only the five SA `.cjs` modules.

### 2. LOCAL-ONLY — `tests/situational-awareness-orchestrate.test.cjs`
Backend acceptance gate, run against the real `_probe-response.json`. Lives in `tests/` (git-ignored, `tests/*.cjs`) — **not committed**.

**Only file 1 is committed/deployed.** (`_probe-response.json` is a local artifact and stays untracked.)

## Endpoint contract
```
POST /api/situational-awareness-orchestrate
Body: {
  decisionPackage:        <frozen DecisionPackage>,   // required
  validatedEvidenceSet?:  <L9.0 output>,
  probabilityBasis?:      <L4/precedent basis for L9.3>,
  referenceIso?:          <caller timestamp for the coherence event>,
  decisionPackageHash?:   <override; else pkg.packageHash>,
  signingKey?:            <optional HMAC key>
}
Returns: { situationalAwarenessPackage, coherenceEvent, signature }
```

## Deploy Steps (git bash)

### Step 0 (MANDATORY) — pull first
```
git pull
```

### Step 1 — run the acceptance gate locally
```
node tests/situational-awareness-orchestrate.test.cjs
```
Expected: `All Stage 9 Part 2b orchestrator checks passed (real decisionPackage, full SA chain).`

### Step 2 — stage ONLY the endpoint + this doc (by name; never `git add -A`)
```
git add netlify/functions/situational-awareness-orchestrate.cjs DEPLOY374-INSTRUCTIONS.md
```
The `tests/` file is git-ignored and will not appear — correct; do not force-add it.

### Step 3 — confirm exactly those two files are staged
```
git status
```

### Step 4 — commit + push
```
git commit -m "DEPLOY374 - Stage 9 Part 2b (backend): situational-awareness-orchestrate endpoint. Runs L9.1->L9.2->L9.3->L9.4->assembler over a frozen decisionPackage; references DP by existing hash (Directive 4); normalizes fmd.dominant to a name string on a shallow copy only (original untouched); no clock/LLM/core imports; verified against real _probe-response.json. No frontend caller yet."
git push
```
If an `index.lock` error appears, `rm -f ".git/index.lock"` and retry. Confirm `git status` shows the file staged before committing.

## After Deploy
No production behavior change (no caller yet). Optional: once Netlify publishes you can sanity-check the endpoint exists by POSTing a `{ "decisionPackage": {...} }` to `/api/situational-awareness-orchestrate`, but it is not wired into any user flow until DEPLOY375.

## SA Build Status — one piece left
Stages 1–8, 9 Part 1, 10, 11, 9 Part 2a (UX echo), and 9 Part 2b (this endpoint) are done. **Final remaining:** DEPLOY375 — `VoiceInspectionPage.tsx` wiring: after the decision-core run, when `sa_responses` were submitted, POST `decisionPackage` + `validated_evidence_set` to this endpoint, then render the Executive Brief + unresolved-questions list in the UI and PDF report **only when SA is present** (report bit-identical when SA absent). That is the last live-file change; treat it with the same care (Python-based edit on the large file, `tsc -b` + local `npm run build` before push).
