/**
 * DuckDB-WASM initialization and query helper.
 */
import * as duckdb from "@duckdb/duckdb-wasm";

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

export async function initDuckDB(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conn) return conn;
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  conn = await db.connect();
  const response = await fetch("/data/projects.parquet");
  const buffer = new Uint8Array(await response.arrayBuffer());
  await db.registerFileBuffer("projects.parquet", buffer);
  await conn.query(
    "CREATE VIEW projects AS SELECT * FROM read_parquet('projects.parquet')"
  );
  return conn;
}

export async function queryDuckDB<T = Record<string, unknown>>(
  sql: string
): Promise<T[]> {
  const connection = await initDuckDB();
  const start = performance.now();
  const result = await connection.query(sql);
  const elapsed = performance.now() - start;
  if (elapsed > 100) {
    console.warn(`[DuckDB] Slow query (${elapsed.toFixed(1)}ms)`);
  }
  const rows: T[] = [];
  for (let i = 0; i < result.numRows; i++) {
    const row: Record<string, unknown> = {};
    for (const field of result.schema.fields) {
      const col = result.getChild(field.name);
      row[field.name] = col?.get(i);
    }
    rows.push(row as T);
  }
  return rows;
}

export function formatPHP(value: number): string {
  if (value >= 1_000_000_000) return `₱${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₱${(value / 1_000).toFixed(0)}K`;
  return `₱${value.toFixed(0)}`;
}
