-- ============================================================================
-- DEPLOY422 - RLS hardening (gap analysis P0-3)
--
-- Revokes public/anon access to 6 BACKEND-ONLY tables. Verified safe:
--   * written ONLY by functions using SUPABASE_SERVICE_ROLE_KEY (which BYPASSES
--     RLS) - confirmed for reasoning_sessions + superbrain_reports;
--   * ZERO direct SPA references (no supabase.from('<table>') anywhere in src/).
-- Their current policies are FOR ALL USING(true) with no role clause, so the
-- shipped ANON key can read/write them. Dropping those policies while keeping
-- RLS ON denies anon/authenticated direct access; the service-role backend is
-- unaffected (it bypasses RLS).
--
-- *** DO NOT auto-apply. REVIEW, then apply to a SUPABASE BRANCH first. ***
-- Verify after applying to the branch: (1) generate a Superbrain report and
-- (2) run a tri-model reasoning pass - both must still WRITE (they use the
-- service-role key). Confirm no function READS these tables with the ANON key.
-- A wrong RLS policy locks the app out of its own data - test before production.
-- ============================================================================

DO $$
DECLARE pol record; t text;
  tbls text[] := ARRAY[
    'reasoning_sessions','learning_records','hypothesis_tracking',
    'calibration_scores','adversarial_challenges','superbrain_reports'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    -- drop EVERY existing policy on the table (name-agnostic; covers the USING(true) ones)
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    -- RLS stays ON: with no policy, anon/authenticated get nothing; service_role bypasses.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Deliberately NOT changed here (handle separately, each needs its own verification):
--   * global_authority_audit  - INSERT WITH CHECK(true); confirm its writer uses the
--                                service-role key, then drop the public insert policy.
--   * schools / classes        - WeldScan education schema (USING(true)); parked with WeldScan.
--   * global_jurisdiction_registry / global_crosswalk_registry - SELECT USING(true) on
--                                read-only, non-sensitive code/standards reference data: ACCEPTABLE.
