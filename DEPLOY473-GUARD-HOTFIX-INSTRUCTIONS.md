> **Also in this commit (472 build-fix):** the DEPLOY472 deploy FAILED at `tsc -b` — `src/lib/cross-domain/__tests__/caseStudyEndpoint.test.ts` imported `cross-domain-deliberation-case-study`, which 472 archived. (`test:gates` passed 49/49; the build gate correctly blocked the bad deploy, so 471 kept serving.) That test tested a quarantined engine, so it's **moved to `archive/`** (not repointed). Root-caused from ground truth: a full `src/` scan found this was the *only* broken import (the other 3 src→functions imports target live files), and `tsc -b` is now clean. The CI check (`scripts/check-live-engines.cjs`) was **extended** to fail on any `src/` import of a non-deployed function — the class the gate-suite scan missed.

# DEPLOY473 — auth-guard placement hotfix (comprehensive-assessment + differential-diagnosis)

**Severity: security.** Two of the DEPLOY471 guards were inserted INSIDE the `if (httpMethod === "OPTIONS")`
block (the multi-line `{ ... }` form), so for a real POST the OPTIONS branch was skipped and **the guard
never ran** — both endpoints returned 200 to an anonymous POST. Caught by the live curl
(`differential-diagnosis` → 200 anonymous, expected 401).

## Root cause
The 471 "after-OPTIONS" insertion matched a multi-line `if (OPTIONS) {` and dropped the guard after the
`{` instead of after the block's `}`. Only the two endpoints with that handler shape were affected
(scan of all 28 confirmed: exactly these two; the "after-POST" and "first-statement" placements are correct).

## Fix
Moved the guard to AFTER the OPTIONS block in both files, so it runs for POST:
```
if (event.httpMethod === "OPTIONS") { return { statusCode: 204, ... }; }
var __a = await authGuard.verifyAuth(event); if (!__a.ok) { return authGuard.denyResponse(__a, ...); }
```

## Verified offline
- Both transpile clean.
- **Functional: anonymous POST → 401 on both** (was 200). Guard now executes on the POST path.
- Internal callers (ai-chat → comprehensive-assessment/differential-diagnosis; comprehensive-assessment →
  differential-diagnosis) forward `X-API-Key`, so the live chains still pass; same-origin browser calls
  send no CORS preflight, so the OPTIONS branch is unaffected.
- Version v16.24 → **v16.25**.

## Git
```bash
git reset
git add netlify/functions/comprehensive-assessment.ts netlify/functions/differential-diagnosis.ts src/pages/VoiceInspectionPage.tsx scripts/check-live-engines.cjs DEPLOY473-GUARD-HOTFIX-INSTRUCTIONS.md archive/cross-domain-tests/caseStudyEndpoint.test.ts src/lib/cross-domain/__tests__/caseStudyEndpoint.test.ts
git status   # verify: comprehensive-assessment + differential-diagnosis + VoiceInspectionPage + check-live-engines modified;
             # DEPLOY473 doc new; caseStudyEndpoint.test.ts renamed src/lib/.../__tests__/ -> archive/cross-domain-tests/;
             # NO deleted top-level tests/*.test.cjs or tsconfig.
git commit -m "DEPLOY473: hotfix guard trapped in OPTIONS block (comprehensive-assessment + differential-diagnosis, never ran for POST) -> moved after block, both 401 anon; fix 472 build (quarantine caseStudyEndpoint.test.ts whose subject was archived); CI check now fails on src import of non-deployed function; tsc -b clean; v16.25"
git push
```

## Live check (after Published)
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://4dndt.netlify.app/api/differential-diagnosis -d '{}'      # 401 (was 200)
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://4dndt.netlify.app/api/comprehensive-assessment -d '{}'    # 401 (was 200)
```
