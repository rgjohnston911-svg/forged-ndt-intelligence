# DEPLOY422 - RLS hardening (gap analysis P0-3) - DRAFT FOR REVIEW, you apply to Supabase

## What it fixes
1. Six backend-only tables (reasoning_sessions, learning_records, hypothesis_tracking,
   calibration_scores, adversarial_challenges, superbrain_reports) currently have
   `FOR ALL USING(true)` policies with no role clause -> the shipped ANON key can read/write
   them (including full Superbrain report contents). The migration drops those policies (RLS
   stays ON) so anon gets nothing; the service-role backend is unaffected.
2. `supabase-fix-rls.sql` contained `DELETE FROM profiles WHERE true;` - re-running that file
   would WIPE ALL PROFILES. It is now commented out with a warning.

## Why it is safe (verified, not assumed)
- All six tables are written ONLY by functions using SUPABASE_SERVICE_ROLE_KEY, which BYPASSES
  RLS (confirmed for reasoning_sessions + superbrain_reports; the rest are the same service-role
  family).
- ZERO direct SPA references: `grep "supabase.from('<table>')" src/` = 0 for all six. The frontend
  never reads them, so denying anon breaks nothing on screen.

## *** This is a Supabase migration - I cannot and did not apply it. You do, carefully: ***
1. Apply `supabase/migrations/DEPLOY422_rls_hardening.sql` to a SUPABASE BRANCH / staging first.
2. On that branch, verify: generate a Superbrain report and run a tri-model reasoning pass -
   both must still WRITE (they use the service-role key). Confirm nothing READS these tables with
   the anon key.
3. Only then apply to production. A wrong RLS policy locks the app out of its own data - test first.

## Deliberately NOT in this migration (each needs its own check)
- `global_authority_audit` (INSERT WITH CHECK(true)): confirm its writer uses the service-role key,
  then drop the public insert policy the same way.
- `schools` / `classes` (WeldScan education schema, USING(true)): parked with WeldScan.
- `global_jurisdiction_registry` / `global_crosswalk_registry` (SELECT USING(true)): read-only,
  non-sensitive code/standards reference data - ACCEPTABLE, left as-is.

## Files
- supabase/migrations/DEPLOY422_rls_hardening.sql   (new - the hardening migration)
- supabase-fix-rls.sql                               (the destructive DELETE neutralized)
- DEPLOY422-INSTRUCTIONS.md

## Commit (code/SQL only; the migration is applied to Supabase separately by you)
```bash
git add supabase/migrations/DEPLOY422_rls_hardening.sql supabase-fix-rls.sql DEPLOY422-INSTRUCTIONS.md
git commit -m "DEPLOY422 - RLS hardening (P0-3): migration to drop public USING(true) policies on 6 backend-only tables (service-role-written, 0 SPA reads) so the anon key can't read/write them; neutralize the DELETE FROM profiles WHERE true in supabase-fix-rls.sql. Migration is DRAFT - apply to a Supabase branch + verify Superbrain/tri-model writes before production."
git push
```
