# DEPLOY417 - Demo-hardening: report-provenance gate + run-on safe-degradation

Two targets for the Columbus demo, chosen by where it actually persuades or collapses:
single-asset end-to-end on stage (the report is what a CWI interrogates) and /fleet shown
LIVE with voice (a packed utterance must not throw a phantom finding in front of the room).

## A. Report-provenance gate (the single-asset demo-killer)
### The gap found
"Constrained by decision-core JSON" was prompt INTENT plus a non-blocking, prefix-only check
on the evidence_trace side-array (superbrain-synthesis.ts line ~1028 validates only that a
cited source_field STARTS WITH a known namespace - not that the path exists, not that it
resolves, and it only warns). The narrative PROSE the reviewer reads was never cross-checked.
So a number that appears only in the prose - invented or mis-stated by the synthesis LLM -
passed through untouched. That is the exact moment a demo dies: "where did that 42% come from?"
answered by "the language model wrote it."

### The gate (the single-asset analog of the panel's no-band-colour check)
netlify/functions/report-provenance.cjs - a PURE validator: every QUANTITATIVE claim (a number
carrying a unit/% or a decimal - an engineering measurement, not a bare count) and the stated
DISPOSITION in the rendered prose must trace to a value the deterministic engines produced.
- fraction<->percent and rounding are normalized, so a legit "42%" from a 0.42 source field is
  NOT false-flagged (a naive check without this false-flags it - that is the gate's foil).
- bare unit-less integers ("3 mechanisms") are intentionally not claims (low attack value, high
  false-positive).
- disposition prose ("fit for service") is checked against decision_reality.disposition; a flip
  is a FAIL.
- on a miss it returns verdict FAIL + names the unsourced claim - it never silently passes an
  unsourced number.
Wired into superbrain-synthesis.ts (non-blocking): after synthesis, it validates the prose
against a GENEROUS source (decision-core + transcript + every engine, so only a number present
in NONE of them flags), attaches result.report_provenance {verdict, unsourced_claims,
disposition_match}, and pushes a trace_warning on FAIL. Policy is FLAG (surface the verdict);
the UI/demo can escalate to withhold/strip - "the system won't show a number it can't source."

### KNOWN-OPEN (honest edge): a number the engines COMPUTE but never store as a field/string
(a derived sum) could false-flag; the generous source keeps this rare. Measured, not hidden.

## B. Run-on safe-degradation (/fleet live voice)
/fleet is demoed live, so the keyword peripheral extractor can receive a packed, punctuation-
free utterance. Clause-scoping needs clause boundaries that voice speech lacks - and its
FAILURE is detectable: when no delimiter splits the clause, a run-on leaves a degradation cue
AND a "this one is fine" cue (SOUNDNESS_RE) in the same clause. On that contradiction the
extractor refuses to confidently refer: the referral degrades to action NEEDS_CONFIRMATION
instead of REFER. Because flagsFromReferrals counts REFER only, a packed live utterance can no
longer feed a phantom systemic CLUSTER. The "correct refusal" beat, in code.
- Clean single findings and the "but"-split case (clause-scoping puts the soundness cue in a
  different clause) still REFER untouched - no over-degradation.

## Verification
- report-provenance gate (tests/report-provenance.test.cjs): 8/8 - sourced->PASS, invented
  number->FAIL+named, %<->fraction normalized, disposition flip->FAIL, bare integers ignored,
  naive foil false-flags the legit 42%.
- voice-stress gate (tests/peripheral-extractor-voice-stress.test.cjs): 8/8 - Tier-1 (5) +
  Tier-2 safe-degradation now LOCKED (3): every run-on emits ZERO confident REFER.
- extractor acceptance 18/18, negation-adversarial 12/12, independent corpus 8/8 - no regression.
- Full local regression: 31/31. tsc -b clean. peripheral-referral.cjs + the new files: 0 NULs.

## Files
- netlify/functions/report-provenance.cjs            (new - pure provenance validator + handler)
- netlify/functions/superbrain-synthesis.ts          (wired: post-synthesis provenance check -> result.report_provenance)
- netlify/functions/peripheral-referral.cjs          (run-on safe-degradation: SOUNDNESS_RE -> NEEDS_CONFIRMATION)
- tests/report-provenance.test.cjs                   (new gate; git-ignored, runs locally)
- tests/peripheral-extractor-voice-stress.test.cjs   (Tier-2 re-locked to safe-degradation)
- DEPLOY417-INSTRUCTIONS.md

## Commit
```bash
git pull
node tests/report-provenance.test.cjs                 # 8/8
node tests/peripheral-extractor-voice-stress.test.cjs  # 8/8
node tests/peripheral-extractor.test.cjs               # 18/18
npx tsc -b
git add netlify/functions/report-provenance.cjs netlify/functions/superbrain-synthesis.ts netlify/functions/peripheral-referral.cjs DEPLOY417-INSTRUCTIONS.md
git status
git diff --cached --stat
```
Then:
```bash
git commit -m "DEPLOY417 - Demo-hardening. (A) Report-provenance gate: a pure validator (report-provenance.cjs) asserting every quantitative claim + the disposition in the synthesized PROSE traces to an engine value (fraction<->percent + rounding normalized; bare integers ignored; naive foil false-flags the legit case). Wired non-blocking into superbrain-synthesis -> result.report_provenance{verdict,unsourced_claims}. Closes the 'where did that number come from' gap: prose was never cross-checked, only a prefix-only non-blocking evidence_trace warning existed. (B) Run-on safe-degradation: a packed voice utterance (degradation cue + soundness cue in one unsplit clause) degrades to NEEDS_CONFIRMATION, never a confident REFER, so /fleet live cannot surface a phantom systemic CLUSTER. report-provenance 8/8; voice-stress 8/8 (Tier-2 safe-degradation locked); acceptance 18/18, adversarial 12/12, independent 8/8; regression 31/31; tsc clean."
git push
```

## Still open (tracked, narrowed) - #54
Safe-FAIL is now gated. What still needs REAL field audio is the narrower question: correct
ATTRIBUTION within a packed run-on (which actor is the true finding) and how often real
voice-to-text trips the detector. Data-collection on rj's side; not blocking demo SAFETY, only
recall. The provenance gate's derived-number edge is the other measured-open item.
