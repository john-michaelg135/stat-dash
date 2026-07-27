/**
 * Ingest flood_control.json (ESRI FeatureLayer format) into DuckDB.
 * Uses a temp NDJSON file for fast bulk loading.
 */

import duckdb from "duckdb";
import { readFileSync, writeFileSync, existsSync, copyFileSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function ingest() {
  const dbPath = resolve(__dirname, "../data/flood_control.duckdb");
  const tempNdjson = resolve(__dirname, "../data/_temp_projects.json");

  // Look for flood_control.json in pipeline/data/ first, then project root
  let jsonPath = resolve(__dirname, "../data/flood_control.json");
  if (!existsSync(jsonPath)) {
    const rootPath = resolve(__dirname, "../../flood_control.json");
    if (existsSync(rootPath)) {
      copyFileSync(rootPath, jsonPath);
      console.log("  Copied flood_control.json from project root to pipeline/data/");
    } else {
      throw new Error(
        "Data file not found. Place flood_control.json in pipeline/data/ or project root."
      );
    }
  }

  // Parse ESRI FeatureLayer JSON and write flat NDJSON for bulk load
  const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
  const features = raw.features || [];

  if (features.length === 0) {
    throw new Error("No features found in flood_control.json");
  }

  console.log(`  Found ${features.length} project records.`);
  console.log("  Writing temp NDJSON for bulk load...");

  const lines = features.map((f) => {
    const a = f.attributes || {};
    return JSON.stringify({
      infra_year: a.InfraYear ?? null,
      region: a.Region ?? null,
      province: a.Province ?? null,
      municipality: a.Municipality ?? null,
      implementing_office: a.ImplementingOffice ?? null,
      project_id: a.ProjectID ?? null,
      project_description: a.ProjectDescription ?? null,
      program: a.Program ?? null,
      type_of_work: a.TypeofWork ?? null,
      infra_type: a.infra_type ?? null,
      longitude: a.Longitude ?? null,
      latitude: a.Latitude ?? null,
      contract_id: a.ContractID ?? null,
      abc: a.ABC ?? null,
      contract_cost: a.ContractCost ?? null,
      completion_date_original: a.CompletionDateOriginal ?? null,
      completion_year: a.CompletionYear ?? null,
      contractor: a.Contractor ?? null,
      funding_year: a.FundingYear ?? null,
      legislative_district: a.LegislativeDistrict ?? null,
      district_engineering_office: a.DistrictEngineeringOffice ?? null,
      completion_date_actual: a.CompletionDateActual ?? null,
      start_date: a.StartDate ?? null,
    });
  });

  writeFileSync(tempNdjson, lines.join("\n"), "utf-8");

  return new Promise((resolveP, reject) => {
    const db = new duckdb.Database(dbPath);
    const conn = db.connect();

    const sql = `
      DROP TABLE IF EXISTS projects;
      CREATE TABLE projects AS
      SELECT * FROM read_json_auto('${tempNdjson.replace(/\\/g, "/")}');
    `;

    conn.exec(sql, (err) => {
      if (err) {
        conn.close();
        db.close(() => {});
        return reject(err);
      }

      conn.all("SELECT COUNT(*) as cnt FROM projects", (err, rows) => {
        const count = rows?.[0]?.cnt ?? "?";
        console.log(`  Ingested ${count} records into DuckDB at ${dbPath}`);

        conn.close();
        db.close(() => {
          // Clean up temp file
          try { unlinkSync(tempNdjson); } catch {}
          resolveP();
        });
      });
    });
  });
}
