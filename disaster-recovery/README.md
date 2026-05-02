# 4D NDT Intelligence Platform - Master Schema

## Overview
This directory contains the **consolidated master SQL schema** for the 4D NDT Intelligence Platform Supabase database.

**File:** `MASTER-SCHEMA.sql` (163 KB, 4,277 lines)

## Purpose
The master schema is a **disaster recovery** artifact that enables:
- **Complete database restoration** from a clean Supabase instance
- **Idempotent re-runs** without errors (all statements use `IF NOT EXISTS`)
- **Logical organization** by functional domain
- **Single-file baseline** for version control and backup

## Content Summary
Generated from 56 SQL migration files (DEPLOY208 through DEPLOY351+):

- **1 Extension:** `uuid-ossp`
- **154 Tables** organized by domain
- **438 Indexes** for performance optimization
- **195 RLS Policies** for row-level security
- **2 Functions** (find_similar_cases, update_cfi_patterns_updated_at)

## Domain Organization
Tables are logically grouped by functional area:

1. **Core Case Management** (3 tables)
   - Inspection cases, evidence, findings foundation

2. **Thickness & Corrosion Data** (1 table)
   - Thickness readings from UT/CML grids

3. **Concept Intelligence Engine** (Multiple tables)
   - Semantic concept linking and retrieval

4. **Learning & Outcome Tracking** (4 tables)
   - Case outcomes, pattern learning, feedback

5. **Physics Verification** (6 tables)
   - Physics sufficiency tracking and verification

6. **Authority System** (8 tables)
   - Weld acceptance, authority locks, audit trails

7. **Contradiction Detection** (4 tables)
   - System contradiction detection and resolution

8. **Repair Pathway Engine** (6 tables)
   - Repair path recommendation engine

9. **Corrosion Analysis** (2 tables)
   - Corrosion-specific analysis tables

10. **Fatigue Analysis** (1 table)
    - Fatigue and vibration analysis

11. **Asset Management** (4 tables)
    - Asset registry, twins, interactions

12. **Contextual Failure Intelligence** (2 tables)
    - CIF patterns, findings, feedback

13. **Anomaly Detection** (2 tables)
    - Anomaly fingerprints and matches

14. **Other Strategic Domains**
    - Batch processing, API 579, pipeline status, user profiles, org management

## Usage Instructions

### Disaster Recovery Scenario
```bash
# 1. Connect to a clean Supabase instance
psql postgresql://user:password@db.supabase.co:5432/postgres

# 2. Import the master schema
\i MASTER-SCHEMA.sql

# 3. Verify table count
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';
# Expected: ~154 tables

# 4. Verify indexes
SELECT COUNT(*) FROM pg_indexes 
WHERE schemaname = 'public';
# Expected: ~438 indexes
```

### Development/Testing
- Use as a **baseline** for new environments
- Compare against running database: `pg_dump production | diff MASTER-SCHEMA.sql -`
- Use for **schema validation** in CI/CD pipelines

## Safety Guarantees

✓ **All CREATE TABLE statements use `IF NOT EXISTS`**
  - Safe to run multiple times without errors
  - Existing tables are preserved

✓ **All CREATE INDEX statements use `IF NOT EXISTS`**
  - Indexes are safely created or skipped

✓ **RLS Policies use DROP/CREATE pattern**
  - Old policies are removed before creation
  - Ensures fresh, correct policies

✓ **No INSERT statements**
  - Schema only, no seed data
  - Use data migration scripts for seed data separately

## Schema Statistics

| Element | Count |
|---------|-------|
| Tables | 154 |
| Indexes | 438 |
| RLS Policies | 195 |
| Functions | 2 |
| Extensions | 1 |
| **Total Lines** | **4,277** |
| **File Size** | **163 KB** |

## Migration Source Files
Generated from all deployments in order:
- `CFI-SCHEMA-SEED.sql` (Contextual Failure Intelligence base)
- `DEPLOY208-migration.sql` through `DEPLOY351-352-MIGRATION.sql` (root directory)
- `supabase/migrations/DEPLOY252_*` through `DEPLOY271b_*` (44 migrations)

**Total migrations consolidated:** 56 files

## Key Tables by Domain

### Core NDT Inspection
- `inspection_cases` - Central case entity
- `evidence` - Evidence items per case
- `findings` - Inspection findings
- `thickness_readings` - UT/CML thickness grids

### Concept Intelligence (16 tables)
- `concept_nodes` - Semantic nodes
- `concept_links` - Semantic relationships
- `concept_retrieval_cache` - Retrieval optimization

### Authority System (8 tables)
- `authority_locks` - Case authority locks
- `authority_lock_audit` - Audit trail
- `weld_acceptance_authority` - Weld-specific authority
- `weld_audit_events` - Weld authority events

### Physics Verification (6 tables)
- `physics_coverage` - Coverage tracking
- `physics_check_registry` - Check definitions
- `tri_model_reasoning` - Tri-model verification

### Asset Management (4 tables)
- `asset_registry` - Asset master data
- `asset_twin_memory` - Asset digital twins
- `asset_interactions` - Cross-asset relationships

## Extension Requirements
- **uuid-ossp:** For UUID generation (standard Supabase)
- **pgvector:** For semantic similarity search (enabled in DEPLOY215)

## Performance Considerations

### Indexes Created
- B-tree indexes for common filters (438 total)
- IVFFlat indexes for vector similarity search
- GIN indexes for array/JSON columns

### Query Optimization
Tables are indexed on:
- Foreign key columns (case_id, org_id, asset_id, etc.)
- Status/state columns (disposition, locked, etc.)
- Search fields (name, component, method, etc.)
- Vector embeddings (case_embedding via ivfflat)

## Related Documentation
- **Migration History:** See `/sessions/keen-eager-volta/mnt/NDT Platform/supabase/migrations/`
- **Change Log:** Review individual DEPLOY files for specific changes
- **Schema Evolution:** Each DEPLOY file documents its modifications

## Validation Checklist
After running MASTER-SCHEMA.sql, verify:

- [ ] No error messages during import
- [ ] 154 tables created
- [ ] 438 indexes created
- [ ] All foreign key constraints present
- [ ] RLS enabled on sensitive tables
- [ ] Policies applied correctly
- [ ] Functions registered (find_similar_cases, etc.)

## Notes
- This file is **read-only** - do not edit directly
- For schema changes, create new migration files
- Keep this file updated after each major deployment
- Use as baseline for comparing production schema

---
**Generated:** 2026-05-01
**Platform:** 4D NDT Intelligence Platform
**Database:** Supabase (PostgreSQL 15+)
