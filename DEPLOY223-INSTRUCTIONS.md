# DEPLOY223 — Enterprise Audit System

Tamper-proof audit trail with cryptographic signing, hash chains, and full replay snapshots. Tracks every user and system action with timestamps, actor identity, and immutable event logging.

## What it does

1. **Event Logging** — Every action is recorded: who did it, when, what changed, what function ran, and whether it was a user or system action. Events are append-only (INSERT-only RLS — no UPDATE, no DELETE).

2. **Bundle Signing** — Creates a cryptographically signed snapshot of the entire case state at the moment of signing. Includes all decision data, findings, engine outputs, and the complete audit event trail. Each bundle is HMAC-SHA256 signed.

3. **Hash Chain** — Each bundle includes the hash of the previous bundle, forming an append-only chain. Tampering with any historical bundle breaks the chain and is immediately detectable.

4. **Replay Snapshots** — Every signed bundle captures the complete input state so the exact same output can be reproduced by re-running the deterministic pipeline.

5. **Chain Verification** — Walks the entire chain, recomputes hashes, verifies signatures, validates links, and checks version sequence. Any break is reported with the exact bundle and check that failed.

## Deploy order

### 1. Run migration
File: `DEPLOY223-migration.sql` in Supabase SQL Editor.
Creates:
- `audit_events` table (append-only event log with INSERT-only RLS)
- `audit_bundles` table (signed bundle chain with INSERT-only RLS)
- `org_signing_keys` table (per-org signing keys)
- Adds `audit_bundle_count`, `last_audit_hash`, `last_audit_signed_at`, `audit_chain_valid` to `inspection_cases`
- Seeds default HMAC-SHA256 signing key

### 2. Paste functions
- `netlify/functions/enterprise-audit.ts` — Main audit engine (log events, sign bundles, get history)
- `netlify/functions/verify-audit-chain.ts` — Chain verification endpoint

### 3. Paste component
File: `src/components/EnterpriseAuditCard.tsx`

### 4. Mount on Decision tab in `src/pages/CaseDetail.tsx`

**Import** (with the others, around line 26):
```
import EnterpriseAuditCard from "../components/EnterpriseAuditCard";
```

**JSX** — immediately after the UniversalCodeAuthorityCard line:
```
{id && <EnterpriseAuditCard caseId={id} />}
```

---

## Smoke test

1. Open any case on the Decision tab.
2. Enterprise Audit Trail card → **Sign Audit Bundle**.
3. Expected: Bundle v1 created with hash, signature, and signing key reference.
4. Click **Sign New Bundle** again → Bundle v2 with `previous_hash` pointing to v1.
5. Click **Verify Chain** → All bundles show VERIFIED with PASS on hash integrity, signature, chain link, and version sequence.
6. Expand **Event Timeline** → Shows the bundle_signed events with timestamps and actor.
7. Expand **Signed Bundles** → Shows hash chain with truncated hashes and signing metadata.

---

## Architecture

- **Append-only**: `audit_events` and `audit_bundles` tables have INSERT-only RLS. No UPDATE or DELETE policies exist. Once written, records cannot be modified through the application.
- **HMAC-SHA256**: Bundles are signed with a per-org key stored in `org_signing_keys`. The signature covers the entire bundle data with deterministic JSON key ordering.
- **Hash chain**: Each bundle stores `previous_hash` = hash of prior bundle. Verification walks the chain and validates every link.
- **Stable stringify**: JSON is serialized with sorted keys for deterministic hashing. Same data always produces same hash.
- **User extraction**: Auth header is parsed to identify the human actor. System actions are logged as actor_type = "system".
- **Replay guarantee**: The `replay_snapshot` captures all inputs (case data, findings, engine outputs) at signing time. Re-running the deterministic pipeline on the snapshot should produce identical results.
- **Event type registry**: 25+ predefined event types across 11 categories. Future DEPLOYs can log events by calling the enterprise-audit endpoint.

## Integration with other engines

All other DEPLOY functions can log audit events by POSTing to `/api/enterprise-audit`:
```
POST /api/enterprise-audit
{
  "action": "log_event",
  "case_id": "...",
  "event_type": "decision_spine_run",
  "detail": { ... },
  "function_name": "decision-spine"
}
```

This will be wired in progressively as each engine is updated.
