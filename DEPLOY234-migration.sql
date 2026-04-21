-- DEPLOY234 — RBAC + Multi-Tenant Isolation
-- Run in Supabase SQL Editor

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User roles table (links users to orgs with roles)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  org_id UUID REFERENCES organizations(id),
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'reviewer', 'technician', 'viewer')),
  assigned_by UUID,
  is_active BOOLEAN DEFAULT true,
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add org_id to inspection_cases for tenant isolation
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_cases' AND column_name = 'org_id') THEN
    ALTER TABLE inspection_cases ADD COLUMN org_id UUID REFERENCES organizations(id);
  END IF;
END $$;

-- 4. Add org_id to findings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'findings' AND column_name = 'org_id') THEN
    ALTER TABLE findings ADD COLUMN org_id UUID REFERENCES organizations(id);
  END IF;
END $$;

-- 5. Add org_id to evidence
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evidence' AND column_name = 'org_id') THEN
    ALTER TABLE evidence ADD COLUMN org_id UUID REFERENCES organizations(id);
  END IF;
END $$;

-- 6. Add org_id to escalation_queue
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escalation_queue' AND column_name = 'org_id') THEN
    ALTER TABLE escalation_queue ADD COLUMN org_id UUID REFERENCES organizations(id);
  END IF;
END $$;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_org_id ON user_roles(org_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_org_role ON user_roles(org_id, role);
CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);
CREATE INDEX IF NOT EXISTS idx_cases_org_id ON inspection_cases(org_id);
CREATE INDEX IF NOT EXISTS idx_findings_org_id ON findings(org_id);
CREATE INDEX IF NOT EXISTS idx_evidence_org_id ON evidence(org_id);

-- 8. RLS on organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'org_auth_all') THEN
    CREATE POLICY org_auth_all ON organizations FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'org_service_all') THEN
    CREATE POLICY org_service_all ON organizations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 9. RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'roles_auth_all') THEN
    CREATE POLICY roles_auth_all ON user_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'roles_service_all') THEN
    CREATE POLICY roles_service_all ON user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
