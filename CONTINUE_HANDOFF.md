# FORGED NDT Intelligence OS — Continue Handoff

Paste the contents of this file as your first message in a new Cowork conversation to resume building without losing context.

---

## Project

**FORGED NDT Intelligence OS** — live at https://4dndt.netlify.app
- Sole founder/dev: Richard (rj)
- Workspace folder: `C:\Users\rjohn\OneDrive\Desktop\NDT Platform`
- Stack: React + Vite + TypeScript frontend, Netlify Functions backend, Supabase (Postgres + Auth + Storage)

## Deploy workflow

Claude edits files locally → Richard pastes them to GitHub via the web editor → Netlify auto-deploys on commit.

## Hard code constraints (non-negotiable)

- `var` only — no `let` or `const`
- String concatenation only — no backtick template literals (Git Bash paste corruption breaks them)
- `@ts-nocheck` at top of every `.ts` file
- Standing directive: **"prioritize and fix issues which fix the system not scenario fixes"**

## Standing rules for Claude

1. Read existing files before writing new ones — match house style (see `netlify/functions/create-case.ts` and `netlify/functions/run-authority.ts` as canonical patterns).
2. Hand Richard paste-ready files with `computer://` links to the workspace folder. Don't dump code in chat unless asked — he prefers clicking links.
3. When changes need a Supabase migration, output a `DEPLOYxxx-migration.sql` at repo root and tell Richard to run it in the Supabase SQL Editor BEFORE deploying code.
4. Two-table awareness: `inspection_cases` is canonical, legacy `cases` table is orphaned. Never write to `cases`.
5. React Router static path precedence matters: `/cases/new` MUST resolve to NewCase, not the `:id` route. CaseDetail has a UUID guard that renders `<NewCase />` directly if a non-UUID lands on `:id` (avoids the redirect loop that nuked an earlier deploy).

## Recent deploys (chronological, all live unless flagged)

- **DEPLOY209** — Unified New Case flow on `inspection_cases` via `/api/create-case`; NDT Method dropdown required; UUID guard in CaseDetail renders NewCase directly to avoid infinite redirect.
- **DEPLOY210** — CSV thickness grid parser. New `thickness_readings` table (migration ran in Supabase). New netlify function `parse-thickness-csv.ts`. New React component `src/components/ThicknessGridUpload.tsx` mounted on Evidence tab. Auto-detects 2D grids vs flat lists. Supports `# units: in|mm` and `# nominal: 0.375` header directives.
- **DEPLOY211** — Wired `thickness_readings` into `run-authority.ts`. Added `evaluateThicknessGrid()` + 3 API 510/570 rules: <50% nominal → hard reject, 50–80% → FFS review, ≥80% → pass.
- **DEPLOY212** — Embedded `thickness_summary` into `authority_evidence` payload; added color-coded "Wall Thickness Summary" card to Decision tab in CaseDetail.tsx.
- **DEPLOY213** — Auto-generates synthetic `wall_loss` finding row (source=`"authority"`) after Run Authority Lock so the Findings tab reflects what drove the disposition. Idempotent — deletes prior authority-sourced wall_loss rows before inserting. **Status when this handoff was written: handed to Richard, deployment confirmation pending.**

## Key file locations

- Frontend pages: `src/pages/CaseDetail.tsx`, `src/pages/NewCase.tsx`, `src/pages/Cases.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Login.tsx`, `src/pages/VoiceInspectionPage.tsx`
- Components: `src/components/AppShell.tsx`, `src/components/MethodBadge.tsx`, `src/components/ThicknessGridUpload.tsx`
- Constants: `src/lib/constants.ts` (EVIDENCE_METHODS, EVIDENCE_METHOD_GROUPS, DISPOSITION_COLORS)
- Supabase client: `src/lib/supabase.ts`
- Backend functions: `netlify/functions/*.ts`
- Routing: `/api/*` rewrites to `/.netlify/functions/:splat` (set in `netlify.toml`)

## Open question

Earlier in the previous session Richard sent a screenshot of an intake form with fields (Description/Situation, Events/History, Measurements/Data, "Create Case + Run Analysis" button) that don't exist in the DEPLOY209 NewCase.tsx. Unresolved whether that was the Inspect page (`VoiceInspectionPage.tsx`), genuine drift on `/cases/new`, or a different page entirely. Ask for the URL bar contents if it comes up again.

## Next queued work

1. **DEPLOY214 — Progressive re-evaluation.** Auto-trigger `run-authority` after a thickness CSV upload so the inspector doesn't have to click Run Authority Lock manually. Closes the loop on the grid workflow.
2. **DEPLOY215 — Engine 3 frontend wiring.** Backend functions exist (`reasoning-layer.ts`, `truth-engine.ts`, etc.) but the UI surfaces are partial.
3. **Additional file parsers** for instrument exports beyond thickness grids (Krautkramer/GE DMS, Olympus 38DL, etc.).
4. **Investigate the NewCase screenshot drift** if it resurfaces.

## Resume prompt to start the new conversation

Paste this verbatim:

> Resuming work on FORGED NDT Intelligence OS per `C:\Users\rjohn\OneDrive\Desktop\NDT Platform\CONTINUE_HANDOFF.md`. Read that file first, then ask me whether DEPLOY213 is confirmed deployed — if yes, build DEPLOY214 (auto-trigger run-authority after thickness CSV upload). If no, wait for me to confirm before stacking 214 on top.
