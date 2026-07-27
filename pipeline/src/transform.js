/**
 * Transform cleaned DuckDB data into JSON + Parquet for the dashboard.
 * JSON is the primary data source (instant load, no WASM needed).
 * Parquet is exported for optional DuckDB-WASM advanced queries.
 */

import duckdb from "duckdb";
import { mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function writeJSON(dir, filename, data) {
  const serialized = JSON.stringify(data, (_, v) =>
    typeof v === "bigint" ? Number(v) : v
  , 2);
  writeFileSync(resolve(dir, filename), serialized);
  console.log(`    wrote ${filename}`);
}

export async function transform() {
  const dbPath = resolve(__dirname, "../data/flood_control.duckdb");
  const outDir = resolve(__dirname, "../../dashboard/public/data");
  mkdirSync(outDir, { recursive: true });

  const out = outDir.replace(/\\/g, "/");
  const db = new duckdb.Database(dbPath);
  const conn = db.connect();

  function run(sql) {
    return new Promise((res, rej) => {
      conn.exec(sql, (err) => (err ? rej(err) : res()));
    });
  }

  function query(sql) {
    return new Promise((res, rej) => {
      conn.all(sql, (err, rows) => (err ? rej(err) : res(rows)));
    });
  }

  // Parquet export
  await run(`COPY projects TO '${out}/projects.parquet' (FORMAT PARQUET, COMPRESSION SNAPPY)`);
  console.log("    wrote projects.parquet");

  // Compact JSON for client-side filtering (only columns needed by dashboard)
  const compact = await query(`
    SELECT region, province, municipality, type_of_work, funding_year,
      contract_cost, abc, cost_savings, is_delayed, duration_days,
      contractor, project_description
    FROM projects WHERE contract_cost > 0
  `);
  writeJSON(outDir, "projects_compact.json", compact);

  // Summary
  const [summary] = await query(`
    SELECT COUNT(*) as total_projects,
      COUNT(DISTINCT region) as total_regions,
      COUNT(DISTINCT province) as total_provinces,
      COUNT(DISTINCT municipality) as total_municipalities,
      SUM(contract_cost) as total_contract_cost,
      SUM(abc) as total_abc, AVG(contract_cost) as avg_cost,
      SUM(cost_savings) as total_savings,
      SUM(CASE WHEN is_delayed THEN 1 ELSE 0 END) as delayed_projects,
      AVG(duration_days) as avg_duration_days
    FROM projects WHERE contract_cost > 0
  `);
  writeJSON(outDir, "summary.json", summary);

  // By region
  const byRegion = await query(`
    SELECT region, COUNT(*) as project_count,
      SUM(contract_cost) as total_cost, AVG(contract_cost) as avg_cost,
      SUM(CASE WHEN is_delayed THEN 1 ELSE 0 END) as delayed_count
    FROM projects WHERE contract_cost > 0
    GROUP BY region ORDER BY total_cost DESC
  `);
  writeJSON(outDir, "by_region.json", byRegion);

  // By type of work
  const byType = await query(`
    SELECT type_of_work, COUNT(*) as project_count,
      SUM(contract_cost) as total_cost, AVG(contract_cost) as avg_cost
    FROM projects WHERE contract_cost > 0
    GROUP BY type_of_work ORDER BY total_cost DESC
  `);
  writeJSON(outDir, "by_type_of_work.json", byType);

  // By funding year
  const byYear = await query(`
    SELECT funding_year, COUNT(*) as project_count,
      SUM(contract_cost) as total_cost, SUM(cost_savings) as savings
    FROM projects WHERE contract_cost > 0 AND funding_year != ''
    GROUP BY funding_year ORDER BY funding_year
  `);
  writeJSON(outDir, "by_funding_year.json", byYear);

  // By province (top 20)
  const byProv = await query(`
    SELECT province, region, COUNT(*) as project_count,
      SUM(contract_cost) as total_cost
    FROM projects WHERE contract_cost > 0
    GROUP BY province, region ORDER BY total_cost DESC LIMIT 20
  `);
  writeJSON(outDir, "by_province.json", byProv);

  // Top contractors
  const topContr = await query(`
    SELECT contractor, COUNT(*) as project_count,
      SUM(contract_cost) as total_cost
    FROM projects WHERE contractor != 'Unknown Contractor' AND contract_cost > 0
    GROUP BY contractor ORDER BY total_cost DESC LIMIT 15
  `);
  writeJSON(outDir, "top_contractors.json", topContr);

  // Filter options
  const regionList = await query(
    "SELECT DISTINCT region FROM projects WHERE contract_cost > 0 ORDER BY region"
  );
  writeJSON(outDir, "regions.json", regionList.map(r => r.region));

  const yearList = await query(
    "SELECT DISTINCT funding_year FROM projects WHERE funding_year != '' ORDER BY funding_year"
  );
  writeJSON(outDir, "years.json", yearList.map(y => y.funding_year));

  // Per-region drill-down
  for (const r of regionList) {
    const slug = r.region.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const data = await query(`
      SELECT province, COUNT(*) as project_count, SUM(contract_cost) as total_cost
      FROM projects WHERE contract_cost > 0 AND region = '${r.region.replace(/'/g, "''")}'
      GROUP BY province ORDER BY total_cost DESC
    `);
    writeJSON(outDir, `region_${slug}.json`, data);
  }

  // Per-year drill-down
  for (const y of yearList) {
    const data = await query(`
      SELECT region, COUNT(*) as project_count, SUM(contract_cost) as total_cost,
        SUM(CASE WHEN is_delayed THEN 1 ELSE 0 END) as delayed_count
      FROM projects WHERE contract_cost > 0 AND funding_year = '${y.funding_year}'
      GROUP BY region ORDER BY total_cost DESC
    `);
    writeJSON(outDir, `year_${y.funding_year}.json`, data);
  }

  // Compact projects for client-side filtering (key fields only)
  const allProjects = await query(`
    SELECT region, province, municipality, type_of_work, funding_year,
      contract_cost, abc, cost_savings, is_delayed, duration_days,
      contractor, project_description
    FROM projects WHERE contract_cost > 0
  `);
  writeJSON(outDir, "projects_compact.json", allProjects);

  const [check] = await query("SELECT COUNT(*) as cnt FROM projects WHERE contract_cost > 0");
  console.log(`    Total exported: ${check.cnt} projects`);

  return new Promise((resolveP) => {
    conn.close();
    db.close(() => {
      console.log(`  All files written to ${outDir}`);
      resolveP();
    });
  });
}
