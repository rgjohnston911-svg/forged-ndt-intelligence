-- ============================================================
-- DEPLOY356 — Sprint 4A memory retrieval RPC
--
-- Adds a single SECURITY INVOKER SQL function for top-K cosine
-- similarity search over cd_tenant_memory_index. supabase-js cannot
-- emit raw SQL for the `embedding <=> :vec` ordering clause, so the
-- canonical pgvector pattern is to expose a SECURITY INVOKER function.
--
-- SECURITY INVOKER (the default) preserves RLS — the function runs
-- under the caller's role, so the cd_tenant_memory_index_tenant_isolation
-- policy still gates rows by JWT org_id. We add a defensive WHERE
-- org_id = match_org_id anyway so the planner can use the org index
-- before the cosine ordering.
-- ============================================================

CREATE OR REPLACE FUNCTION match_tenant_memory(
  query_embedding vector(1536),
  match_org_id uuid,
  match_count integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  memory_type text,
  asset_id uuid,
  anomaly_id uuid,
  summary text,
  context_jsonb jsonb,
  similarity double precision,
  created_at timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT
    m.id,
    m.org_id,
    m.memory_type,
    m.asset_id,
    m.anomaly_id,
    m.summary,
    m.context_jsonb,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.created_at
  FROM cd_tenant_memory_index m
  WHERE m.org_id = match_org_id
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_tenant_memory(vector, uuid, integer)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
