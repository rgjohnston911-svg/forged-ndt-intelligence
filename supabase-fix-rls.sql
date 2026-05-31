-- ============================================================
-- FIX: Drop broken RLS policies and replace with simple ones
-- Paste into SQL Editor and click Run
-- ============================================================

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "profiles_self_read" ON profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
DROP POLICY IF EXISTS "profiles_self_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_teacher_read" ON profiles;

-- Create simple, working policies
-- Users can do everything with their own profile
CREATE POLICY "profiles_own_all" ON profiles
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow inserting own profile during sign-up
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Fix schools table - allow inserts during sign-up
DROP POLICY IF EXISTS "schools_member_read" ON schools;
CREATE POLICY "schools_read_all" ON schools FOR SELECT USING (true);
CREATE POLICY "schools_insert" ON schools FOR INSERT WITH CHECK (true);

-- Fix classes table
DROP POLICY IF EXISTS "classes_school_read" ON classes;
CREATE POLICY "classes_read_all" ON classes FOR SELECT USING (true);

-- DEPLOY422 SAFETY: bulk DELETE DISABLED. Re-running this file would WIPE ALL PROFILES.
-- To clear specific test accounts, run a manual, explicitly-scoped DELETE instead.
-- DELETE FROM profiles WHERE true;   <-- intentionally commented out (destructive)
