# StatDash

**Instant analytics from any dataset** — a full-stack data intelligence platform combining a Node.js/DuckDB pipeline for DPWH flood control project data with a universal, browser-based dataset analyzer built on React + TypeScript.

![Beta](https://img.shields.io/badge/status-beta-orange)

---

## Overview

StatDash has two modes of operation:

1. **Pipeline Mode** — Ingests raw DPWH flood control project data (ESRI FeatureLayer JSON), cleans and transforms it via DuckDB, and exports aggregated Parquet + JSON files for the dashboard.

2. **Universal Analyzer Mode** — Upload any dataset (JSON, Excel, CSV, or PDF) directly in the browser. StatDash automatically detects schema, cleans the data, determines appropriate visualizations, and generates a complete dashboard with KPIs, executive summaries, and intelligent chart recommendations.

---

## Architecture

```
stat-dash/
├── pipeline/                   # Node.js + DuckDB data pipeline
│   ├── data/                   # Raw input (flood_control.json) + ephemeral .duckdb
│   └── src/
│       ├── index.js            # Orchestrator: ingest → clean → transform
│       ├── ingest.js           # ESRI JSON → DuckDB bulk load via NDJSON
│       ├── clean.js            # Dedup, null handling, type casting, derived columns
│       └── transform.js        # Aggregations → Parquet + JSON export
│
├── dashboard/                  # Vite + React + TypeScript frontend
│   ├── public/data/            # Pipeline output (Parquet + JSON aggregates)
│   └── src/
│       ├── App.tsx             # Root: file upload → processing → dashboard
│       ├── HeroPage.tsx        # Landing page with drag-and-drop upload
│       ├── DynamicDashboard.tsx # Interactive dashboard with filters + charts
│       └── lib/
│           ├── parseFile.ts    # Multi-format parser (JSON, Excel, CSV, PDF)
│           ├── cleanData.ts    # Client-side data cleaning pipeline
│           ├── analyzeData.ts  # Auto-analysis engine (KPIs, charts, insights)
│           └── duckdb.ts       # DuckDB-WASM integration for in-browser SQL
│
├── package.json                # Workspace root (npm workspaces)
├── vercel.json                 # Vercel deployment configuration
└── PRD.md                      # Full product requirements document
```

---

## Key Features

### Data Pipeline (Server-Side)

- **ESRI FeatureLayer ingestion** — Parses DPWH flood control project JSON with `features[].attributes` structure
- **DuckDB-powered processing** — Fast bulk load via temp NDJSON, SQL-based transforms
- **Automated data cleaning** — Deduplication (project_id + contract_id), null handling with sensible defaults, text normalization
- **Derived columns** — Cost savings (ABC − contract cost), delay detection, project duration calculation
- **Multi-format export** — Parquet (canonical) + pre-aggregated JSON files for instant dashboard loading
- **Drill-down exports** — Per-region and per-year breakdowns for client-side filtering

### Dashboard (Client-Side)

- **Universal file support** — JSON, Excel (.xlsx/.xls), CSV, and PDF table extraction
- **Intelligent Excel parsing** — Handles government/financial layouts with merged headers, multi-row headers, and title rows
- **Automatic data cleaning pipeline**:
  - Duplicate row removal
  - Column name normalization
  - Missing value detection and reporting
  - Outlier detection (IQR method)
  - Text normalization (trim, collapse whitespace)
  - Categorical merging (case variants consolidated)
  - Numeric string cleaning (currency symbols, commas, percentages)
- **Auto-analysis engine**:
  - Column type detection (numeric, categorical, temporal, ID, text)
  - Pivoted/wide-format detection and automatic unpivoting
  - Smart chart selection (bar, line, pie, area, scatter, horizontal-bar)
  - KPI generation with contextual tooltips
  - Executive summary generation
  - Insight generation with confidence scoring and evidence
  - CAGR calculation, growth trends, concentration analysis
- **Interactive filtering** — Dynamic filters generated from categorical columns, with live re-analysis
- **Responsive design** — Card-based layout following modern SaaS aesthetics
- **Beta disclaimer** — User acknowledgment before processing uploaded data

---

## Tech Stack

| Layer       | Technology               | Purpose                              |
|-------------|--------------------------|--------------------------------------|
| Pipeline    | Node.js + ES Modules     | Runtime                              |
| Pipeline    | DuckDB (native)          | Data ingestion, SQL transforms       |
| Dashboard   | Vite                     | Dev server + production build        |
| Dashboard   | React 18 + TypeScript    | UI framework                         |
| Dashboard   | Recharts                 | Chart rendering (Line, Bar, Pie, Area, Scatter) |
| Dashboard   | @duckdb/duckdb-wasm      | In-browser SQL on Parquet files      |
| Dashboard   | SheetJS (xlsx)           | Excel/CSV parsing                    |
| Dashboard   | pdfjs-dist               | PDF text extraction                  |
| Dashboard   | Lucide React             | Icon system                          |
| Deployment  | Vercel                   | Hosting + CDN                        |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install Dependencies

```bash
npm install
```

This installs both workspace packages (`pipeline` and `dashboard`) via npm workspaces.

### Run the Data Pipeline

Processes `flood_control.json` and outputs aggregated data to `dashboard/public/data/`:

```bash
npm run start -w pipeline
```

Or directly:

```bash
cd pipeline
npm start
```

The pipeline runs three stages:
1. **Ingest** — Loads ESRI FeatureLayer JSON into DuckDB
2. **Clean** — Audits, deduplicates, normalizes, and adds derived columns
3. **Transform** — Exports aggregated Parquet + JSON to `dashboard/public/data/`

### Run the Dashboard (Dev)

```bash
npm run dev -w dashboard
```

Or directly:

```bash
cd dashboard
npm run dev
```

### Production Build

```bash
npm run build -w dashboard
```

Output goes to `dashboard/dist/`.

---

## Data Flow

```
flood_control.json (ESRI FeatureLayer)
        │
        ▼
  ┌─────────────┐
  │   Ingest    │  Parse features[].attributes → DuckDB table
  └─────────────┘
        │
        ▼
  ┌─────────────┐
  │    Clean    │  Dedup, null handling, derived columns (cost_savings, is_delayed, duration_days)
  └─────────────┘
        │
        ▼
  ┌─────────────┐
  │  Transform  │  SQL aggregations → Parquet + JSON exports
  └─────────────┘
        │
        ▼
  dashboard/public/data/
  ├── projects.parquet          # Full dataset
  ├── projects_compact.json     # Key fields for client filtering
  ├── summary.json              # Global KPIs
  ├── by_region.json            # Regional aggregates
  ├── by_province.json          # Top 20 provinces
  ├── by_type_of_work.json      # Work type breakdown
  ├── by_funding_year.json      # Year-over-year
  ├── top_contractors.json      # Top 15 contractors
  ├── regions.json              # Filter options
  ├── years.json                # Filter options
  ├── region_*.json             # Per-region drill-downs
  └── year_*.json               # Per-year drill-downs
```

---

## Deployment

The project is configured for **Vercel** deployment via `vercel.json`:

- **Build command**: `npm run build` (runs TypeScript check + Vite build)
- **Output directory**: `dashboard/dist`
- **Install command**: `npm install --prefix dashboard`
- **Caching**: Static assets get immutable 1-year cache; data files get 1-hour cache with stale-while-revalidate
- **SPA rewrites**: All non-asset routes fall through to `index.html`

---

## Design System

The dashboard follows a modern finance SaaS aesthetic:

- **Layout**: Card-based, 24px gap grid
- **Typography**: Geometric sans-serif (Inter/Manrope), tabular numbers for data
- **Colors**: Calm palette — `#F6F8FB` background, `#4F7CFF` primary accent, semantic colors for status
- **Shadows**: Soft elevation (`0 12px 30px rgba(15,23,42,0.08)`)
- **Border radius**: 12–24px
- **Charts**: 2.5px strokes, rounded ends, gradient fills, soft grid lines
- **Animations**: 200–300ms transitions, hover lift effects

See `PRD.md` for the full design specification.

---

## Data Source

Source data is from the **Department of Public Works and Highways (DPWH)** Philippines flood control project monitoring system, provided in ESRI FeatureLayer JSON format.

Fields include:
- Project identification (ProjectID, ContractID)
- Location (Region, Province, Municipality, lat/long)
- Financial (ABC — Approved Budget for the Contract, Contract Cost)
- Timeline (FundingYear, StartDate, CompletionDateOriginal, CompletionDateActual)
- Classification (TypeOfWork, InfraType, Program)
- Contractor information

All monetary values are in **PHP (Philippine Peso)**.

---

## Project Status

**Current: Beta**

### Completed

- [x] Data pipeline (ingest → clean → transform → export)
- [x] DuckDB integration (native for pipeline, WASM for browser)
- [x] Multi-format file parsing (JSON, Excel, CSV, PDF)
- [x] Automatic data cleaning (7-step pipeline)
- [x] Auto-analysis engine with smart chart selection
- [x] Pivoted/wide-format dataset detection and unpivoting
- [x] KPI cards with contextual tooltips
- [x] Executive summary generation
- [x] Insight engine with confidence scoring
- [x] Interactive categorical filters with live re-analysis
- [x] Responsive card-based dashboard layout
- [x] Vercel deployment configuration
- [x] Parquet + JSON dual export from pipeline
- [x] Per-region and per-year drill-down data
- [x] Beta disclaimer modal
- [x] Code splitting (lazy-loaded dashboard)

### In Progress / Planned

- [ ] Pre-built DPWH dashboard (static mode using pipeline output)
- [ ] Map visualization (geographic project distribution)
- [ ] Time-series forecasting
- [ ] Export dashboard as PDF report
- [ ] Data comparison mode (upload multiple files)
- [ ] Saved dashboard sessions
- [ ] Advanced statistical tests (normality, chi-square)
- [ ] Accessibility audit (WCAG 2.1 AA compliance)

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npm run start -w pipeline` | Run full data pipeline |
| `npm run dev -w dashboard` | Start Vite dev server |
| `npm run build -w dashboard` | Production build |
| `npm run preview -w dashboard` | Preview production build locally |

---

## License

MIT
