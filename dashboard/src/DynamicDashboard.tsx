import { useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
  AreaChart, Area, ScatterChart, Scatter, ZAxis,
} from "recharts";
import {
  ArrowLeft, BarChart3, FileText, TrendingUp,
  AlertTriangle, Info, CheckCircle2, XCircle,
  Lightbulb, Database, Columns3, Filter, RotateCcw,
} from "lucide-react";
import { analyzeData, type AnalysisResult, type ChartRecommendation, type KPI, type Insight } from "./lib/analyzeData";

const CHART_COLORS = [
  "#4F7CFF", "#8B5CF6", "#06B6D4", "#22C55E", "#F59E0B",
  "#EF4444", "#EC4899", "#14B8A6", "#F97316", "#6366F1",
  "#84CC16", "#0EA5E9", "#D946EF", "#10B981", "#F43F5E",
];

interface DynamicDashboardProps {
  analysis: AnalysisResult;
  onReset: () => void;
}

export default function DynamicDashboard({ analysis, onReset }: DynamicDashboardProps) {
  const { datasetName, totalRows, totalColumns, filters, rawData, columns: allColumns } = analysis;

  // Interactive filters state
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const hasFilters = Object.values(activeFilters).some(Boolean);

  const handleFilterChange = useCallback((column: string, value: string) => {
    setActiveFilters((prev) => ({ ...prev, [column]: value }));
  }, []);

  const resetFilters = useCallback(() => setActiveFilters({}), []);

  // Re-analyze data based on active filters
  const currentAnalysis = useMemo(() => {
    if (!hasFilters) return analysis;

    let filtered = rawData;
    for (const [col, val] of Object.entries(activeFilters)) {
      if (val) filtered = filtered.filter((r) => String(r[col]) === val);
    }

    if (filtered.length === 0) return analysis;

    const colNames = allColumns.map((c) => c.name);
    return analyzeData(filtered, colNames, analysis.datasetName);
  }, [analysis, rawData, activeFilters, hasFilters, allColumns]);

  const { kpis, charts, insights, executiveSummary } = currentAnalysis;
  const filteredRows = hasFilters
    ? currentAnalysis.totalRows
    : totalRows;

  return (
    <div className="app-layout">
      {/* Top Navigation */}
      <header className="top-nav">
        <div className="top-nav-left">
          <button className="btn-back" onClick={onReset} aria-label="Back to upload">
            <ArrowLeft size={18} />
          </button>
          <h1 className="logo">
            <BarChart3 size={24} />
            {datasetName}
          </h1>
        </div>
        <div className="top-nav-right">
          <div className="dataset-badge">
            <Database size={14} />
            <span>{filteredRows.toLocaleString()} records</span>
          </div>
          <div className="dataset-badge">
            <Columns3 size={14} />
            <span>{totalColumns} fields</span>
          </div>
        </div>
      </header>

      <main className="main-content">

        {/* Filters */}
        {filters.length > 0 && (
          <div className="page-header">
            <div>
              <h2 className="page-title">Dashboard Overview</h2>
              <p className="page-subtitle">
                {hasFilters
                  ? `Filtered: ${Object.entries(activeFilters).filter(([, v]) => v).map(([, v]) => v).join(" · ")} (${filteredRows} records)`
                  : `All data — ${totalRows.toLocaleString()} records`
                }
              </p>
            </div>
            <div className="filter-controls">
              {filters.map((f) => (
                <div className="select-wrapper" key={f.column}>
                  <Filter size={14} />
                  <select
                    value={activeFilters[f.column] || ""}
                    onChange={(e) => handleFilterChange(f.column, e.target.value)}
                  >
                    <option value="">All {f.label}</option>
                    {f.values.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              ))}
              {hasFilters && (
                <button className="btn-secondary" onClick={resetFilters}>
                  <RotateCcw size={14} /> Reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <section className="summary-grid">
          {kpis.map((kpi, i) => (
            <KPICard key={i} kpi={kpi} />
          ))}
        </section>

        {/* Executive Summary */}
        <section className="card exec-summary">
          <div className="exec-summary-header">
            <FileText size={20} />
            <h3>Executive Summary</h3>
          </div>
          <p className="exec-summary-narrative">{executiveSummary}</p>
        </section>

        {/* Insights */}
        {insights.length > 0 && (
          <section className="insights-section">
            <div className="insights-header">
              <Lightbulb size={18} />
              <h3>Key Insights</h3>
            </div>
            <div className="insights-grid">
              {insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
            </div>
          </section>
        )}

        {/* Charts */}
        {charts.length > 0 && (
          <section className="dynamic-charts">
            {renderChartPairs(charts)}
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>Generated by StatDash — Automatic dataset analysis</p>
      </footer>
    </div>
  );
}

// --- Sub-components ---

function KPICard({ kpi }: { kpi: KPI }) {
  const iconMap = {
    blue: <Database size={20} />,
    purple: <TrendingUp size={20} />,
    green: <CheckCircle2 size={20} />,
    red: <AlertTriangle size={20} />,
    cyan: <BarChart3 size={20} />,
  };

  return (
    <div className={`card summary-card summary-card--${kpi.accent}`}>
      <div className="summary-card-icon">{iconMap[kpi.accent]}</div>
      <div className="summary-card-body">
        <span className="summary-card-value">{kpi.value}</span>
        <span className="summary-card-label">{kpi.label}</span>
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const iconMap = {
    info: <Info size={16} />,
    positive: <CheckCircle2 size={16} />,
    negative: <XCircle size={16} />,
    warning: <AlertTriangle size={16} />,
  };

  return (
    <div className={`insight-card insight-${insight.type}`}>
      <div className="insight-icon">{iconMap[insight.type]}</div>
      <p>{insight.text}</p>
    </div>
  );
}

function renderChartPairs(charts: ChartRecommendation[]) {
  const elements: JSX.Element[] = [];

  for (let i = 0; i < charts.length; i += 2) {
    const left = charts[i];
    const right = charts[i + 1];
    const isFirstRow = i === 0;

    elements.push(
      <div key={i} className={`chart-grid ${isFirstRow && right ? "chart-grid-main" : right ? "chart-grid-half" : "chart-grid-full"}`}>
        <ChartCard chart={left} wide={isFirstRow && !!right} />
        {right && <ChartCard chart={right} />}
      </div>
    );
  }

  return elements;
}

function ChartCard({ chart, wide }: { chart: ChartRecommendation; wide?: boolean }) {
  return (
    <div className={`card chart-card ${wide ? "chart-card-wide" : ""}`}>
      <div className="card-header">
        <div>
          <h3>{chart.title}</h3>
          <p className="chart-desc">{chart.description}</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={wide ? 360 : 320}>
        {renderChart(chart)}
      </ResponsiveContainer>
    </div>
  );
}

function renderChart(chart: ChartRecommendation): JSX.Element {
  const { type, data, xKey, yKey } = chart;

  switch (type) {
    case "line":
      return (
        <LineChart data={data} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAECF0" />
          <XAxis dataKey={xKey} fontSize={11} stroke="#667085" tickLine={false} axisLine={false} />
          <YAxis tickFormatter={shortNum} fontSize={11} stroke="#667085" tickLine={false} axisLine={false} />
          <Tooltip formatter={(v: number) => shortNum(v)} contentStyle={tooltipStyle} />
          {Array.isArray(yKey) ? (
            yKey.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i]} strokeWidth={2.5} dot={{ r: 3 }} name={formatLabel(k)} />
            ))
          ) : (
            <Line type="monotone" dataKey={yKey} stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={{ r: 3 }} name={formatLabel(yKey)} />
          )}
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
        </LineChart>
      );

    case "bar":
      return (
        <BarChart data={data} margin={{ left: 10, right: 10, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAECF0" vertical={false} />
          <XAxis dataKey={xKey} angle={-35} textAnchor="end" height={70} fontSize={10} stroke="#667085" tickLine={false} axisLine={false}
            tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 16) + "…" : v} />
          <YAxis tickFormatter={shortNum} fontSize={11} stroke="#667085" tickLine={false} axisLine={false} />
          <Tooltip formatter={(v: number) => shortNum(v)} contentStyle={tooltipStyle} />
          <Bar dataKey={Array.isArray(yKey) ? yKey[0] : yKey} fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} name={formatLabel(Array.isArray(yKey) ? yKey[0] : yKey)} />
        </BarChart>
      );

    case "horizontal-bar":
      return (
        <BarChart data={data.slice(0, 15)} layout="vertical" margin={{ left: 140, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAECF0" horizontal={false} />
          <XAxis type="number" tickFormatter={shortNum} fontSize={10} stroke="#667085" tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey={xKey} width={130} fontSize={10} stroke="#667085" tickLine={false} axisLine={false}
            tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + "…" : v} />
          <Tooltip formatter={(v: number) => shortNum(v)} contentStyle={tooltipStyle} />
          <Bar dataKey={Array.isArray(yKey) ? yKey[0] : yKey} fill={CHART_COLORS[1]} radius={[0, 6, 6, 0]} name={formatLabel(Array.isArray(yKey) ? yKey[0] : yKey)} />
        </BarChart>
      );

    case "pie":
      return (
        <PieChart>
          <Pie
            data={data}
            dataKey={Array.isArray(yKey) ? yKey[0] : yKey}
            nameKey={xKey}
            cx="50%" cy="45%"
            outerRadius={90} innerRadius={50}
            paddingAngle={2} strokeWidth={0}
          >
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => shortNum(v)} />
          <Legend layout="horizontal" verticalAlign="bottom" align="center"
            wrapperStyle={{ fontSize: 11, paddingTop: 16 }}
            formatter={(value: string) => value.length > 20 ? value.slice(0, 18) + "…" : value} />
        </PieChart>
      );

    case "area":
      return (
        <AreaChart data={data} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAECF0" />
          <XAxis dataKey={xKey} fontSize={11} stroke="#667085" tickLine={false} axisLine={false} />
          <YAxis tickFormatter={shortNum} fontSize={11} stroke="#667085" tickLine={false} axisLine={false} />
          <Tooltip formatter={(v: number) => shortNum(v)} contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey={Array.isArray(yKey) ? yKey[0] : yKey}
            stroke={CHART_COLORS[2]} fill={CHART_COLORS[2]} fillOpacity={0.15}
            strokeWidth={2.5} name={formatLabel(Array.isArray(yKey) ? yKey[0] : yKey)} />
        </AreaChart>
      );

    case "scatter":
      return (
        <ScatterChart margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAECF0" />
          <XAxis dataKey={xKey} fontSize={11} stroke="#667085" tickLine={false} axisLine={false} name={formatLabel(xKey)} tickFormatter={shortNum} type="number" />
          <YAxis dataKey={Array.isArray(yKey) ? yKey[0] : yKey} fontSize={11} stroke="#667085" tickLine={false} axisLine={false} name={formatLabel(Array.isArray(yKey) ? yKey[0] : yKey)} tickFormatter={shortNum} type="number" />
          <ZAxis range={[40, 40]} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => shortNum(v)} />
          <Scatter data={data} fill={CHART_COLORS[0]} fillOpacity={0.6} />
        </ScatterChart>
      );

    default:
      return (
        <BarChart data={data}>
          <Bar dataKey={Array.isArray(yKey) ? yKey[0] : yKey} fill={CHART_COLORS[0]} />
        </BarChart>
      );
  }
}

// --- Helpers ---
const tooltipStyle = { borderRadius: 12, border: "1px solid #EAECF0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" };

function shortNum(v: number): string {
  if (typeof v !== "number" || isNaN(v)) return String(v);
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toFixed(1);
}

function formatLabel(key: string): string {
  if (/^\d{4}\s*\d*$/.test(key.trim())) return key.trim();
  return key.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase());
}
