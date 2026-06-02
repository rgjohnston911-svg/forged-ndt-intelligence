# DEPLOY457 — Governance Contest CP3, commit 1: the evidence pre-pass (single source)

CP3 (the consumption contract) is **multi-commit** per §2.4 — this is **commit 1 of 5**. It adds
the single mechanism-evidence verdict as a shared server module. **No satellite consumes it yet**,
so this commit is invisible and changes no output. Commits 2–5 thread it into Authority Lock →
FMD paths → disposition ledger → consequence, one per commit, suite-green between each.

## What this adds
- **`netlify/functions/_mechanism-evidence.cjs`** — pure-JS, transcript-only. Exports
  `buildMechanismVerdict(transcript)` → `{ confirmed, confirmed_tier, confirmed_basis, candidates[], sour_service }`.
  This is the ONE answer to "what does the account contain direct, non-negated evidence of."
  Logic ported from `src/lib/evidenceGate.ts` (the client/reconcile source). The `_` prefix keeps
  it out of the Netlify endpoint set — it's a shared library the satellites will `require`.
  - **Hydrogen ≠ H2S:** `sour_service` is true only on *non-negated* H2S/sour evidence (clause-aware,
    so "No H2S present" does not read as sour). This is the precise distinction the NACE MR0175
    lock will gate on in commit 2.
- **`tests/mechanism-evidence-parity.test.cjs`** — the single-source guard across the TS/JS
  boundary: asserts the server JS verdict and the client TS classifier (`evidenceGate.ts`) agree on
  the golden transcripts (TEST 28 → no confirmed; real corrosion → confirmed; real crack →
  confirmed; sour → sour_service; hydrogen-without-H2S → not sour). If the two ever drift, this
  gate fails. (Auto-registered with run-gates.)

## Why a module with no consumer is the right commit-1
§2.4 sequences CP3 as "first hoist the evidence pre-pass, then thread one satellite per commit."
Landing the verdict source alone — proven equal to the existing client logic, wired to nothing —
means each subsequent satellite commit changes exactly one engine against a verified, frozen
verdict. No four-satellite swing.

## Verification (offline, all green)
- `node scripts/run-gates.cjs` → **43 / 43** (new parity gate added)
- `node scripts/eval-sa.cjs` → 20 / 20 (unchanged — no consumer)
- `npx tsc -b` → clean
- No render change, no disposition change, no version bump.

---

## Git — run in Git Bash at /c/dev/forged-ndt-intelligence

```bash
git add netlify/functions/_mechanism-evidence.cjs tests/mechanism-evidence-parity.test.cjs DEPLOY457-INSTRUCTIONS.md
git commit -m "DEPLOY457: governance contest CP3 commit 1 - single mechanism-evidence verdict (_mechanism-evidence.cjs) ported from evidenceGate.ts + cross-check parity gate; hydrogen != H2S; no consumer yet (safe)"
git push
```

## Live check
None — invisible commit (no consumer, no render/disposition change). Confidence is the parity gate
+ suite.

## Next (CP3 commit 2)
Authority Lock consumes the verdict: **asset-class locks (API 570/B31.3/general API 579) unchanged**;
**mechanism-triggered locks (API 579 Part 9 crack, NACE MR0175 sour, Part 4/5 metal loss, HTHA)
fire only when `confirmed` matches or a candidate carries direct evidence** — and NACE gates on
`sour_service`, never on hydrogen presence. That commit is where the TEST 30 / TEST 31 mechanism
tower starts to actually collapse.
