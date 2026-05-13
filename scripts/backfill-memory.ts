// ============================================================
// Sprint 4A — One-shot backfill of cd_tenant_memory_index
//
// Embeds every previously-finalized successful deliberation (consensus
// not 'unresolved') into the tenant memory index so the Historian has
// context on the next run. Idempotent via the same context_jsonb
// deliberation_id key the ingest module uses — safe to re-run.
//
// Usage:
//   OPENAI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     npx tsx scripts/backfill-memory.ts
//
// NOT wired into CI. One-shot. Outputs progress and totals to stdout.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { ingestDeliberationMemory } from "../src/lib/cross-domain/memoryIngest";

interface DeliberationStub {
  id: string;
  org_id: string;
  consensus_level: string | null;
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(1);
  }
  if (!openaiKey) {
    console.error("ERROR: OPENAI_API_KEY required");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("cd_deliberation_log")
    .select("id, org_id, consensus_level")
    .not("deliberation_completed_at", "is", null)
    .neq("consensus_level", "unresolved")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(`ERROR loading deliberations: ${error.message}`);
    process.exit(1);
  }

  const deliberations = (data ?? []) as DeliberationStub[];
  console.log(
    `[backfill-memory] found ${deliberations.length} successful deliberations to consider`
  );

  let totalRowsInserted = 0;
  let totalCostUsd = 0;
  let countOk = 0;
  let countSkipped = 0;
  let countFailed = 0;

  for (const d of deliberations) {
    const t0 = Date.now();
    const result = await ingestDeliberationMemory(d.id, d.org_id, supabase);
    const elapsed = Date.now() - t0;
    totalRowsInserted += result.rows_inserted;
    totalCostUsd += result.total_cost_usd;
    if (result.ok && result.rows_inserted > 0) {
      countOk++;
      console.log(
        `  ✓ ${d.id} consensus=${d.consensus_level} rows=${result.rows_inserted} cost=$${result.total_cost_usd.toFixed(4)} elapsed=${elapsed}ms`
      );
    } else if (result.note === "already_ingested") {
      countSkipped++;
      console.log(`  ↺ ${d.id} already_ingested (no-op)`);
    } else {
      countFailed++;
      console.warn(
        `  ✗ ${d.id} note=${result.note ?? "none"} error=${result.error ?? "none"} errors=${result.errors.join("; ") || "none"}`
      );
    }
  }

  console.log("");
  console.log("[backfill-memory] DONE");
  console.log(`  considered:       ${deliberations.length}`);
  console.log(`  ingested ok:      ${countOk}`);
  console.log(`  already ingested: ${countSkipped}`);
  console.log(`  failed:           ${countFailed}`);
  console.log(`  rows inserted:    ${totalRowsInserted}`);
  console.log(`  total cost USD:   $${totalCostUsd.toFixed(4)}`);
}

main().catch((err) => {
  console.error(
    `[backfill-memory] FATAL: ${err instanceof Error ? err.stack ?? err.message : String(err)}`
  );
  process.exit(1);
});
