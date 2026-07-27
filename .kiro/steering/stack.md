# Project Stack & Conventions

## Architecture

This is a monorepo with two workspaces:

- **pipeline/** — Node.js data pipeline using DuckDB (native)
- **dashboard/** — Vite + React + TypeScript frontend using DuckDB-WASM

## Data Flow

1. `pipeline/` reads raw JSON (ESRI FeatureLayer format from DPWH), ingests into DuckDB, transforms/aggregates, and exports to **Parquet** files.
2. Parquet files are written to `dashboard/public/data/` as the hand-off format.
3. `dashboard/` loads Parquet via `@duckdb/duckdb-wasm` in-browser for interactive querying and renders charts with **Recharts**.

## Key Libraries

| Workspace   | Library             | Purpose                        |
|-------------|---------------------|--------------------------------|
| pipeline    | duckdb              | Native DuckDB for Node.js      |
| dashboard   | @duckdb/duckdb-wasm | In-browser SQL on Parquet      |
| dashboard   | recharts            | React charting (built on D3)   |
| dashboard   | react, react-dom    | UI framework                   |
| dashboard   | vite                | Dev server & build tool        |

## Conventions

- Pipeline scripts are ES modules (`.js`, `"type": "module"`)
- Dashboard code is TypeScript (`.tsx` / `.ts`)
- Parquet is the only format exchanged between pipeline and dashboard — no JSON data files in production
- DuckDB databases (`.duckdb`) are intermediate/ephemeral; Parquet is the canonical output
- All monetary values are in PHP (Philippine Peso)
- The source data is DPWH flood control projects in ESRI FeatureLayer JSON format with `features[].attributes` containing project fields

## Scripts

- `npm run start` (pipeline) — runs the full ingest → transform → export pipeline
- `npm run dev` (dashboard) — starts Vite dev server
- `npm run build` (dashboard) — production build

## File Layout

```
stat-dash/
├── pipeline/
│   ├── data/              # Raw input (flood_control.json)
│   ├── src/
│   │   ├── index.js       # Entry point
│   │   ├── ingest.js      # JSON → DuckDB
│   │   └── transform.js   # DuckDB → Parquet
│   └── package.json
├── dashboard/
│   ├── public/data/       # Parquet files from pipeline
│   ├── src/
│   └── package.json
└── package.json           # Workspace root
```
