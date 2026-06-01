# DEPLOY454 — SA-section render subordination (render-only)

## What this does

Makes the Situational Awareness section a **supporting-input layer**, not a competing
authority. Render-only — no engine change. It removes render elements that are wrong *by
policy* (it does NOT hide or reframe the fabricated mechanism tower — that contradiction stays
visible on purpose, as the true signal that the tower is fabricating, until the governance
contest gates it on evidence).

Removed from **both** render paths (the printable HTML report AND the interactive React card):

1. **SA "Recommendation"** — disposition belongs to the Governing Reality, not the SA brief.
   (This was the "Perform API 579 Level 2 FFS" line SA emitted on TEST 30.)
2. **"Financial" risk** — deleted by the RAE directive (no financial / human-factor modeling).
3. **Legacy "Active Conflicts" / "active stakeholder conflict(s)"** — a duplicate of the RAE
   Cross-Discipline Conflicts panel. RAE is the single conflict authority.
4. **"Organizational risk N/10" score** (interactive card only) — deleted by the RAE directive.
   *This card was the source of the "Organizational risk 7.5/10" you kept seeing after the RAE
   cutover — the cutover updated the report path but missed this view.*

Changed: section retitled "Situational Awareness — Supporting Inputs" with a one-line header —
"Supporting situational inputs only. The governing disposition is set by the Governing Reality,
not by this section." Kept (as inputs): life-safety/regulatory risk, SA confidence, unresolved
unknowns, convergence, future-state forecast, and the RAE Role Authority panel.

## What this deliberately does NOT do
- Does not touch the FMD card or Authority Lock rendering. Relabeling fabricated crack/sour/
  metal-loss locks as "inputs" would be cosmetic — it would make a reasoning bug look
  intentional and erase the Governing-Reality-vs-tower contradiction we need visible. The tower
  gets fixed structurally at the governance contest (single source of truth), then becomes a
  legitimate input.

## Files
- `src/pages/VoiceInspectionPage.tsx` — both SA render paths subordinated; version v16.9 -> **v16.10**.

## Verification (offline, all green)
- `npx tsc -b` -> clean (rc 0)
- `node scripts/run-gates.cjs` -> 42 / 42  (unchanged; render-only)
- `node scripts/eval-sa.cjs` -> 20 / 20    (unchanged; render-only)

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence

```bash
git add src/pages/VoiceInspectionPage.tsx DEPLOY454-INSTRUCTIONS.md
git commit -m "DEPLOY454: SA render subordination - SA brief = supporting inputs; remove Recommendation/Financial/duplicate-conflicts/org-risk-score from both render paths; v16.10"
git push
```

(If the stale lock returns: close VS Code / GitHub Desktop, then `rm -f .git/index.lock`.)

## Live check
Hard-refresh and confirm subtitle reads **v16.10**. Re-run any SA-heavy scenario (e.g. TEST 29
ESD or TEST 30 H2 piping) and confirm in the Situational Awareness section:
- title now reads "Situational Awareness — Supporting Inputs" with the disposition-defers-to-
  Governing-Reality header,
- **no** "Recommendation: …", **no** "Financial", **no** "Organizational risk N/10", and **no**
  duplicate "active stakeholder conflict(s)" line (the RAE Cross-Discipline Conflicts panel is
  the only conflict display).

Expected to still be present (and correct): the Governing-Reality-vs-FMD/Authority contradiction
on the misclassified cases — that's the fabricated tower, untouched here, and the next target.

Next after this lands: the governance contest (single source of truth for "no confirmed
mechanism"; assurance recognizer for safety-function integrity; route a stated regulatory
nonconformance to the disposition). That phase deletes the FLEET stopgap and makes the
FMD/Authority sections trustworthy enough to legitimately label as inputs.
