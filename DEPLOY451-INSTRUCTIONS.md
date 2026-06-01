# DEPLOY451 — Role Authority Engine (RAE). CHECKPOINT 1 of 3: core library.

Implements FORGED_RAE_Build_Directive_v2. Built as three independently revertible
checkpoints (directive §0). **This commit is checkpoint 1: the net-new core library + gate.
It changes nothing live — its value is the rollback point before the render cutover.**

## What this checkpoint contains
`src/lib/roleAuthority.ts` (pure, no imports, facts/codes only):
- **Six authority-domain roles** — CWI, NDT, COATINGS, ENGINEER, SAFETY, OPERATIONS.
  **Financial deleted** (no code book → fails the §2 admission test). Each role emits only
  `{ role, conclusion, code_cited, evidence_ref, within_authority, escalation }` or
  `OUTSIDE_AUTHORITY`. No wants, no fears, no bias, no score — by construction.
- **Operations provenance rule (§3.6):** only a *stated* operating constraint/envelope is
  usable; inferred "production pressure" → `OUTSIDE_AUTHORITY`.
- **Cross-discipline conflict engine (§4):** maps each in-authority conclusion to a direction
  (STOP / RESTRICT / CONTINUE / REPAIR), counts incompatible pairs, emits `conflict_count` +
  `conflict_list` (each conflict carries **two real code citations**) + `escalation_required`.
  **No score, no severity number.** Resolution by authority kind — a hard-authority STOP gates.

`tests/role-authority.test.cjs` — 14 assertions: six roles, Financial gone, no
wants/fears/bias/score keys, Ops provenance rule, Engineer/Safety conclusions, conflict
COUNT with dual citations, hard-STOP resolution.

## Verified
- `node tests/role-authority.test.cjs` → 14/14.
- `node scripts/run-gates.cjs` → **42/42** (new gate auto-discovered; nothing else moved —
  the library is not yet wired).
- `npx tsc -b` → clean. `npm run eval` → 20/20.

## NOT in this checkpoint (the next two, per §0)
- **Checkpoint 2 (render cutover):** wire `roleAuthority` into `generateInspectionReport`;
  remove the live human-factor render (`what_they_want`, `Contamination:` bias lines,
  Organizational Risk score) and show the Role Authority panel. *This is the visible win.*
- **Checkpoint 3 (legacy strip + gates):** delete `what_they_want`/`what_they_fear`/
  `contamination` + the Financial role from `situational-awareness-stakeholder.cjs`; update
  the ~8 dependent gates; grep engine + report clean (§9.3).

## Commit (Git Bash, from /c/dev/forged-ndt-intelligence — NOT OneDrive)
```bash
rm -f .git/index.lock
git add src/lib/roleAuthority.ts tests/role-authority.test.cjs DEPLOY451-INSTRUCTIONS.md
git commit -m "DEPLOY451 checkpoint 1/3 - Role Authority Engine core: six code-anchored roles (Financial deleted), each emits conclusion+code+within-authority or OUTSIDE_AUTHORITY (no wants/fears/bias/score); Ops provenance rule; cross-discipline conflict engine (count + dual citations, no score; hard-STOP gates). Net-new + gated (14 assertions); not yet wired to render. gates 42/42; tsc clean; eval 20/20."
git push
git log --oneline -1
```
