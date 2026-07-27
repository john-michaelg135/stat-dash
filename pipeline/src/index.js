/**
 * Pipeline entry point
 * Orchestrates: Ingest → Audit → Clean → Transform → Validate → Export
 */

import { ingest } from "./ingest.js";
import { clean } from "./clean.js";
import { transform } from "./transform.js";

async function main() {
  console.log("=".repeat(70));
  console.log("  DPWH Flood Control Data Pipeline");
  console.log("  Node.js + DuckDB | Output: Parquet");
  console.log("=".repeat(70));

  console.log("\n[1/3] INGEST — Loading raw ESRI FeatureLayer JSON into DuckDB...");
  await ingest();

  console.log("\n[2/3] CLEAN — Data quality assessment, dedup, null handling, type casting...");
  await clean();

  console.log("\n[3/3] TRANSFORM — Aggregations and Parquet export...");
  await transform();

  console.log("\n" + "=".repeat(70));
  console.log("  Pipeline complete. Parquet files → dashboard/public/data/");
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("\nPIPELINE FAILED:", err.message || err);
  process.exit(1);
});
