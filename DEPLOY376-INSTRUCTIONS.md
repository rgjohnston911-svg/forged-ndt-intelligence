# DEPLOY376: Fix "Unknown" leaking into SA question options (parse-incident)

## The bug (observed)
On the live "AI Needs More Information" card, questions offered **"Unknown"** as a selectable answer (your screenshot, Q1–Q3). The brief's Stage 2 requires Non-Evidence tokens (Unknown, N/A, TBD, …) to be filtered out of question options. They were leaking through.

## Root cause
`parse-incident.ts` filters options via `filterNonEvidenceOptions()`, which called `sa_gate.isNonEvidenceToken()` — where `sa_gate` is loaded with `require("./situational-awareness-gate.cjs")`. That `require` has a `try/catch` fallback to a **no-op filter** (returns `false` for everything). If esbuild fails to bundle the sibling `.cjs` into the deployed function, the filter silently becomes a no-op and every token — including "Unknown" — passes through.

## The fix
Inline the Non-Evidence Token Registry + normalizer directly in `parse-incident.ts` (`isNonEvidenceTokenLocal`), and make `filterNonEvidenceOptions` reject an option if **either** the gate **or** the local check flags it. Now a failed `require` can never let a Non-Evidence token through. Normalization matches the gate exactly (lowercase, strip non-alphanumerics, collapse spaces), so behavior is identical when the gate is present.

Verified locally: `Unknown`, `N/A`, `n/a`, `TBD`, `Not Applicable` → filtered; `Steel`, `Composite`, `Recently calibrated`, `Overdue`, `No changes`, `Normal operation` → kept.

## Why it's safe
- **Additive + deterministic.** Adds a pure local check; only strengthens the existing filter. No other behavior changes.
- **Belt-and-suspenders.** Keeps the gate call; the local check is the guarantee.
- **Backend only.** A `netlify/functions` change; Netlify bundles it with its own esbuild at deploy (the app's `npm run build` does not compile functions, so there's nothing to run locally for this one). If the bundle ever failed, the deploy simply wouldn't publish and we revert one file.

## Files in This Deploy
### 1. MODIFIED — `netlify/functions/parse-incident.ts`
Adds `LOCAL_NON_EVIDENCE_TOKENS` + `isNonEvidenceTokenLocal()`; `filterNonEvidenceOptions()` now rejects on gate-hit OR local-hit. ~25 added lines; content diff vs prior commit is just this block.

## Deploy Steps (git bash)

### Step 0 — pull
```
git pull
```

### Step 1 — stage ONLY this file + the doc (by name)
```
git add netlify/functions/parse-incident.ts DEPLOY376-INSTRUCTIONS.md
git status
git diff --cached --stat netlify/functions/parse-incident.ts
```
Expect `modified: netlify/functions/parse-incident.ts` + `new file: DEPLOY376-INSTRUCTIONS.md`, and a small (~30-line) diff — NOT thousands. If it shows thousands, stop and tell me.

### Step 2 — commit + push
```
git commit -m "DEPLOY376 - Fix Non-Evidence tokens (Unknown/N/A/TBD) leaking into SA question options. parse-incident option filter no longer depends solely on the runtime require of situational-awareness-gate.cjs (which falls back to a no-op if unbundled); inlines a local Non-Evidence registry so filtering always applies. Additive, deterministic, backend-only."
git push
```
If an `index.lock` error appears, `rm -f ".git/index.lock"` and retry. Confirm `git status` shows the file staged before committing.

## After Deploy — verify live
Once Netlify publishes, run an inspection that triggers SA questions and confirm the option chips no longer include **"Unknown"** (or N/A / TBD). The real answer options (Steel, Overdue, etc.) should remain.

## Note
This addresses the one known defect spotted to date. The SA build's 11 stages are all committed; this is a hardening fix on the Stage 2 option filter.
