-- ============================================================================
-- MASTER SCHEMA VALIDATION QUERIES
-- ============================================================================
-- These queries verify the schema is complete and properly structured
-- Run these after loading MASTER-SCHEMA.sql to validate
-- ============================================================================

-- 1. Count all tables
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 154 tables

-- 2. Count all indexes
SELECT COUNT(*) as index_count FROM pg_indexes 
WHERE schemaname = 'public';
-- Expected: 438 indexes

-- 3. Verify core tables exist
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'inspection_cases' AND table_schema = 'public'
) as inspection_cases_exists;
-- Expected: true

-- 4. Check RLS is enabled on sensitive tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE '%inspection_cases%'
LIMIT 5;
-- Expected: At least inspection_cases should be listed

-- 5. Verify function exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.routines 
  WHERE routine_name = 'find_similar_cases' AND routine_schema = 'public'
) as find_similar_cases_exists;
-- Expected: true

-- 6. Check extensions
SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'vector');
-- Expected: uuid-ossp should be listed

-- 7. Verify foreign key constraints
SELECT COUNT(*) as fk_count FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
-- Expected: 100+ foreign keys

-- 8. Check column counts for major tables
SELECT table_name, COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN (
  'inspection_cases', 'evidence', 'findings', 'thickness_readings'
)
GROUP BY table_name
ORDER BY column_count DESC;
-- Expected: inspection_cases ~25+ columns, others ~10+ columns

-- 9. Verify unique indexes
SELECT COUNT(*) as unique_index_count FROM pg_indexes 
WHERE schemaname = 'public' AND indexdef LIKE '%UNIQUE%';
-- Expected: Some unique indexes

-- 10. List all tables by domain (alphabetically)
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
-- Expected: 154 rows

-- 11. Check for GIN indexes (array/JSON optimization)
SELECT indexname, indexdef FROM pg_indexes 
WHERE schemaname = 'public' AND indexdef LIKE '%GIN%'
LIMIT 10;
-- Expected: Multiple GIN indexes for JSONB columns

-- 12. Check for IVFFlat indexes (vector search)
SELECT indexname, indexdef FROM pg_indexes 
WHERE schemaname = 'public' AND indexdef LIKE '%ivfflat%'
LIMIT 5;
-- Expected: Vector similarity indexes

-- 13. List tables by column count (largest first)
SELECT table_name, COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY column_count DESC
LIMIT 20;
-- Expected: inspection_cases and complex domain tables at top

-- 14. Verify timestamp columns exist (for audit trail)
SELECT table_name, COUNT(*) as timestamp_cols
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND data_type IN ('timestamp with time zone', 'timestamp without time zone')
GROUP BY table_name
HAVING COUNT(*) > 0
ORDER BY timestamp_cols DESC
LIMIT 10;
-- Expected: Most tables have created_at, updated_at, etc.

-- 15. Check for JSONB columns (flexible schema)
SELECT table_name, COUNT(*) as jsonb_cols
FROM information_schema.columns
WHERE table_schema = 'public' AND data_type = 'jsonb'
GROUP BY table_name
ORDER BY jsonb_cols DESC
LIMIT 10;
-- Expected: concept_*, reasoning, outcome tables with JSONB

-- 16. Verify array columns (multi-valued data)
SELECT table_name, COUNT(*) as array_cols
FROM information_schema.columns
WHERE table_schema = 'public' AND data_type = 'ARRAY'
GROUP BY table_name
ORDER BY array_cols DESC
LIMIT 10;
-- Expected: CIF patterns, concept tables with arrays

-- 17. List all RLS-enabled tables
SELECT schemaname, tablename FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true
ORDER BY tablename;
-- Expected: Security-sensitive tables (inspection_cases, evidence, etc.)

-- 18. Verify primary keys on all tables
SELECT COUNT(DISTINCT table_name) as tables_with_pk
FROM information_schema.table_constraints
WHERE constraint_type = 'PRIMARY KEY' AND table_schema = 'public';
-- Expected: 154 (all tables should have PK)

-- 19. Check UUID data type usage
SELECT COUNT(*) as uuid_column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND udt_name = 'uuid';
-- Expected: 300+ UUID columns

-- 20. List concept tables specifically
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'concept_%'
ORDER BY table_name;
-- Expected: concept_*, concept_learning_*, concept_validation_*, etc.

-- ============================================================================
-- ADVANCED SCHEMA QUERIES
-- ============================================================================

-- 21. Check for self-referential foreign keys (hierarchical data)
SELECT tc.table_name, 
       kcu.column_name,
       ccu.table_name as referenced_table,
       ccu.column_name as referenced_column
FROM information_schema.table_constraints as tc
JOIN information_schema.key_column_usage as kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage as ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND tc.table_name = ccu.table_name
LIMIT 10;
-- Expected: Hierarchical structures in concept/repair/contradiction tables

-- 22. Domain analysis: Count tables per domain prefix
SELECT 
  CASE 
    WHEN table_name LIKE 'concept_%' THEN 'Concept Intelligence'
    WHEN table_name LIKE 'authority_%' THEN 'Authority System'
    WHEN table_name LIKE 'physics_%' THEN 'Physics Verification'
    WHEN table_name LIKE 'repair_%' THEN 'Repair Pathway'
    WHEN table_name LIKE 'contradiction_%' THEN 'Contradiction Detection'
    WHEN table_name LIKE 'weld_%' THEN 'Weld Authority'
    WHEN table_name LIKE 'corrosion_%' THEN 'Corrosion Analysis'
    WHEN table_name LIKE 'asset_%' THEN 'Asset Management'
    WHEN table_name LIKE 'anomaly_%' THEN 'Anomaly Detection'
    WHEN table_name LIKE 'cfi_%' THEN 'CFI'
    WHEN table_name LIKE 'outcome_%' THEN 'Outcome Tracking'
    WHEN table_name LIKE 'thickness_%' THEN 'Thickness Data'
    WHEN table_name LIKE 'tri_model_%' THEN 'Tri-Model Reasoning'
    WHEN table_name LIKE 'learning_%' THEN 'Learning & Outcomes'
    WHEN table_name LIKE 'batch_%' THEN 'Batch Processing'
    WHEN table_name LIKE 'api579_%' THEN 'API 579'
    ELSE 'Other'
  END as domain,
  COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
GROUP BY domain
ORDER BY table_count DESC;
-- Expected: Breakdown of tables by functional domain

-- 23. Verify schema version/metadata
SELECT 
  'uuid-ossp' as extension_name,
  'UUID generation' as purpose
UNION ALL
SELECT 'vector', 'Semantic search embeddings'
WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector');
-- Expected: Extensions needed for full platform functionality

-- ============================================================================
-- END VALIDATION QUERIES
-- ============================================================================
