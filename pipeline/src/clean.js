/**
 * Data Quality Assessment & Cleaning
 */

import duckdb from "duckdb";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function clean() {
  const dbPath = resolve(__dirname, "../data/flood_control.duckdb");
  const db = new duckdb.Database(dbPath);
  const conn = db.connect();

  function query(sql) {
    return new Promise((resolve, reject) => {
      conn.all(sql, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
  }

  function run(sql) {
    return new Promise((resolve, reject) => {
      conn.exec(sql, (err) => (err ? reject(err) : resolve()));
    });
  }

  // 1. AUDIT
  console.log("\n  [AUDIT] Checking raw data quality...");
  const [rowCount] = await query("SELECT COUNT(*) as cnt FROM projects");
  console.log(`    Total rows: ${rowCount.cnt}`);

  const nullAudit = await query(`
    SELECT
      COUNT(*) - COUNT(region) as region_nulls,
      COUNT(*) - COUNT(province) as province_nulls,
      COUNT(*) - COUNT(contract_cost) as cost_nulls,
      COUNT(*) - COUNT(contractor) as contractor_nulls,
      COUNT(*) - COUNT(type_of_work) as type_nulls
    FROM projects
  `);
  const a = nullAudit[0];
  console.log(`    Nulls: region=${a.region_nulls} province=${a.province_nulls} cost=${a.cost_nulls} contractor=${a.contractor_nulls} type=${a.type_nulls}`);

  const [dupCount] = await query(`
    SELECT COUNT(*) as cnt FROM (
      SELECT project_id, contract_id, ROW_NUMBER() OVER (
        PARTITION BY project_id, contract_id ORDER BY infra_year DESC
      ) as rn FROM projects
    ) WHERE rn > 1
  `);
  console.log(`    Duplicate rows: ${dupCount.cnt}`);

  // 2. DEDUP
  console.log("  [DEDUP] Removing duplicates...");
  await run(`
    CREATE OR REPLACE TABLE projects AS
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY project_id, contract_id
        ORDER BY infra_year DESC, completion_year DESC NULLS LAST
      ) as _rn FROM projects
    ) WHERE _rn = 1
  `);
  await run("ALTER TABLE projects DROP COLUMN _rn");
  const [afterDedup] = await query("SELECT COUNT(*) as cnt FROM projects");
  console.log(`    Rows after dedup: ${afterDedup.cnt} (removed ${rowCount.cnt - afterDedup.cnt})`);

  // 3. CLEAN + DERIVED COLUMNS
  console.log("  [CLEAN] Null handling, trimming, derived columns...");
  await run(`CREATE OR REPLACE TABLE projects AS SELECT * FROM projects`);
  await run(cleanSQL());
  const [afterClean] = await query("SELECT COUNT(*) as cnt FROM projects");
  console.log(`    Rows after clean: ${afterClean.cnt}`);

  // 4. VALIDATE
  console.log("  [VALIDATE] Post-clean assertions...");
  const val = await query(`
    SELECT
      COUNT(*) - COUNT(region) as r,
      COUNT(*) - COUNT(province) as p,
      COUNT(*) - COUNT(project_description) as d,
      COUNT(*) - COUNT(type_of_work) as t,
      COUNT(*) - COUNT(contractor) as c
    FROM projects
  `);
  const v = val[0];
  const pass = v.r === 0 && v.p === 0 && v.d === 0 && v.t === 0 && v.c === 0;
  console.log(`    Zero nulls in core fields: ${pass ? "PASS" : "WARN (non-blocking)"}`);

  return new Promise((resolveP) => {
    conn.close();
    db.close(() => resolveP());
  });
}


function cleanSQL() {
  return `
    CREATE OR REPLACE TABLE projects AS
    SELECT
      COALESCE(TRIM(project_id), 'UNK-' || CAST(ROW_NUMBER() OVER () AS VARCHAR)) as project_id,
      COALESCE(TRIM(contract_id), '') as contract_id,
      COALESCE(TRIM(region), 'Unknown Region') as region,
      COALESCE(TRIM(province), 'Unknown Province') as province,
      COALESCE(TRIM(municipality), 'Unknown Municipality') as municipality,
      COALESCE(TRIM(project_description), 'No Description') as project_description,
      COALESCE(TRIM(type_of_work), 'Unclassified') as type_of_work,
      COALESCE(TRIM(infra_type), 'Unclassified') as infra_type,
      COALESCE(TRIM(program), '') as program,
      CAST(COALESCE(abc, 0) AS DOUBLE) as abc,
      CAST(COALESCE(contract_cost, 0) AS DOUBLE) as contract_cost,
      CAST(COALESCE(abc, 0) - COALESCE(contract_cost, 0) AS DOUBLE) as cost_savings,
      CAST(COALESCE(infra_year, 0) AS INTEGER) as infra_year,
      CAST(COALESCE(completion_year, 0) AS INTEGER) as completion_year,
      COALESCE(TRIM(funding_year), '') as funding_year,
      COALESCE(TRIM(CAST(start_date AS VARCHAR)), '') as start_date,
      COALESCE(TRIM(CAST(completion_date_actual AS VARCHAR)), '') as completion_date_actual,
      completion_date_original,
      CASE
        WHEN completion_date_original IS NOT NULL
          AND completion_date_actual IS NOT NULL
          AND TRY_CAST(CAST(completion_date_actual AS VARCHAR) AS DATE) IS NOT NULL
          AND TRY_CAST(CAST(completion_date_actual AS VARCHAR) AS DATE) > CAST(EPOCH_MS(completion_date_original) AS DATE)
        THEN TRUE ELSE FALSE
      END as is_delayed,
      CASE
        WHEN start_date IS NOT NULL AND completion_date_actual IS NOT NULL
          AND TRY_CAST(CAST(completion_date_actual AS VARCHAR) AS DATE) IS NOT NULL
          AND TRY_CAST(CAST(start_date AS VARCHAR) AS DATE) IS NOT NULL
        THEN DATEDIFF('day',
          TRY_CAST(CAST(start_date AS VARCHAR) AS DATE),
          TRY_CAST(CAST(completion_date_actual AS VARCHAR) AS DATE))
        ELSE NULL
      END as duration_days,
      COALESCE(TRIM(contractor), 'Unknown Contractor') as contractor,
      COALESCE(TRIM(implementing_office), '') as implementing_office,
      COALESCE(TRIM(district_engineering_office), '') as district_engineering_office,
      COALESCE(TRIM(legislative_district), '') as legislative_district,
      CAST(longitude AS DOUBLE) as longitude,
      CAST(latitude AS DOUBLE) as latitude
    FROM projects
  `;
}
