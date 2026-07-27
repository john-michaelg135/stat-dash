# stat-dash

Flood control statistics dashboard — a Node.js data pipeline powered by DuckDB and a Vite + React/TypeScript frontend.

## Structure

```
stat-dash/
├── pipeline/    # Node.js + DuckDB data ingestion & transformation
└── dashboard/   # Vite + React + TypeScript visualization app
```

## Getting Started

### Pipeline

```bash
cd pipeline
npm install
npm start

npm run start -w pipeline

```

### Dashboard

```bash
cd dashboard
npm install
npm run dev

npm run dev -w dashboard

```