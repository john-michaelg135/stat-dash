/**
 * Automatic data analysis engine.
 * Detects column types, determines appropriate charts, generates meaningful insights.
 * Handles pivoted/wide datasets by unpivoting year-columns into rows.
 * Assumes data is already cleaned.
 */

export type ColumnType = "numeric" | "categorical" | "temporal" | "id" | "text";

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  uniqueCount: number;
  nullCount: number;
  sampleValues: unknown[];
  min?: number;
  max?: number;
  mean?: number;
  sum?: number;
  median?: number;
  topValues?: { value: string; count: number }[];
}

export interface ChartRecommendation {
  id: string;
  type: "bar" | "line" | "pie" | "area" | "scatter" | "horizontal-bar";
  title: string;
  description: string;
  xKey: string;
  yKey: string | string[];
  data: Record<string, unknown>[];
}

export interface KPI {
  label: string;
  value: string;
  rawValue: number;
  trend?: "up" | "down" | "neutral";
  accent: "blue" | "purple" | "green" | "red" | "cyan";
  tooltip?: string;
}

export interface Insight {
  text: string;
  type: "info" | "positive" | "negative" | "warning";
  confidence?: "high" | "medium" | "low";
  evidence?: string;
}

export interface FilterOption {
  column: string;
  label: string;
  values: string[];
}

export interface AnalysisResult {
  totalRows: number;
  totalColumns: number;
  columns: ColumnProfile[];
  numericColumns: ColumnProfile[];
  categoricalColumns: ColumnProfile[];
  temporalColumns: ColumnProfile[];
  kpis: KPI[];
  charts: ChartRecommendation[];
  insights: Insight[];
  executiveSummary: string;
  datasetName: string;
  datasetContext: string;
  filters: FilterOption[];
  rawData: Record<string, unknown>[];
  isPivoted: boolean;
}

// Detect if columns look like years/periods (pivoted wide-format data)
// Matches: "2024", "1990", "2018 31" (year + week/period number)
const YEAR_COL_RE = /^\d{4}(\s+\d+)?$/;

function detectYearColumns(columns: string[]): string[] {
  const candidates = columns.filter((c) => YEAR_COL_RE.test(c.trim()));
  // Only treat as year-columns if the pure-year part (first 4 digits) covers a reasonable range
  // and they all start with valid years (1900-2099)
  return candidates.filter((c) => {
    const year = parseInt(c.trim().slice(0, 4), 10);
    return year >= 1900 && year <= 2099;
  });
}

function detectCategoryColumns(columns: string[], yearCols: Set<string>, rows: Record<string, unknown>[]): string[] {
  return columns.filter((c) => {
    if (yearCols.has(c)) return false;
    // Must have non-numeric, non-empty, meaningful values
    const sample = rows.slice(0, Math.min(rows.length, 30)).map((r) => r[c]);
    const nonEmpty = sample.filter((v) => v !== null && v !== undefined && v !== "");
    if (nonEmpty.length === 0) return false;
    const numericCount = nonEmpty.filter((v) => !isNaN(Number(v))).length;
    if (numericCount > nonEmpty.length * 0.5) return false;
    // Filter out columns where all values are very short garbage (like "s/", "6/")
    const avgLen = nonEmpty.reduce((s: number, v) => s + String(v).length, 0) / nonEmpty.length;
    if (avgLen < 3) return false;
    return true;
  });
}

/**
 * Unpivot wide-format data where columns are years/periods.
 * Converts from: {Category: "A", 2020: 100, 2021: 200}
 * To: [{category: "A", period: "2020", value: 100}, {category: "A", period: "2021", value: 200}]
 */
function unpivotData(
  rows: Record<string, unknown>[],
  yearCols: string[],
  catCols: string[]
): Record<string, unknown>[] {
  const unpivoted: Record<string, unknown>[] = [];
  for (const row of rows) {
    for (const yearCol of yearCols) {
      const val = Number(row[yearCol]);
      if (isNaN(val) || val === 0) continue; // Skip empty/zero entries
      const entry: Record<string, unknown> = {
        period: yearCol.trim(),
        value: val,
      };
      for (const cat of catCols) {
        entry[cat] = row[cat];
      }
      unpivoted.push(entry);
    }
  }
  return unpivoted;
}

export function analyzeData(
  rows: Record<string, unknown>[],
  columns: string[],
  fileName: string
): AnalysisResult {
  if (rows.length === 0) {
    return emptyResult(fileName, columns);
  }

  const yearCols = detectYearColumns(columns);
  const yearColSet = new Set(yearCols);
  const isPivoted = yearCols.length >= 3 && yearCols.length > columns.length * 0.4;

  let analysisRows: Record<string, unknown>[];
  let analysisColumns: string[];

  if (isPivoted) {
    // Wide-format: unpivot into long-format for proper analysis
    const catCols = detectCategoryColumns(columns, yearColSet, rows);
    analysisRows = unpivotData(rows, yearCols, catCols);
    analysisColumns = ["period", "value", ...catCols];
  } else {
    analysisRows = rows;
    analysisColumns = columns;
  }

  const profiles = analysisColumns.map((col) => profileColumn(col, analysisRows));
  const numericColumns = profiles.filter((p) => p.type === "numeric");
  const categoricalColumns = profiles.filter((p) => p.type === "categorical");
  const temporalColumns = profiles.filter((p) => p.type === "temporal");

  const kpis = isPivoted
    ? generatePivotedKPIs(rows, yearCols, analysisRows, categoricalColumns)
    : generateKPIs(numericColumns, categoricalColumns, analysisRows);
  const charts = isPivoted
    ? generatePivotedCharts(rows, yearCols, detectCategoryColumns(columns, yearColSet, rows))
    : generateCharts(numericColumns, categoricalColumns, temporalColumns, analysisRows);
  const insights = isPivoted
    ? generatePivotedInsights(rows, yearCols, detectCategoryColumns(columns, yearColSet, rows))
    : generateInsights(numericColumns, categoricalColumns, temporalColumns, analysisRows);
  const executiveSummary = isPivoted
    ? generatePivotedSummary(rows, yearCols, detectCategoryColumns(columns, yearColSet, rows), fileName)
    : generateExecutiveSummary(analysisRows, numericColumns, categoricalColumns, temporalColumns, fileName);

  // Filters: for pivoted data, generate filters from the original raw data's category columns
  // For standard data, generate from the analyzed categorical columns
  let filters: FilterOption[];
  if (isPivoted) {
    const catCols = detectCategoryColumns(columns, yearColSet, rows);
    // Profile category columns directly from raw data for filter generation
    const rawCatProfiles = catCols.map((col) => profileColumn(col, rows)).filter((p) => p.type === "categorical");
    filters = generateFilters(rawCatProfiles);
  } else {
    filters = generateFilters(categoricalColumns);
  }

  const datasetName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const datasetContext = inferDatasetContext(datasetName, columns, profiles, rows);

  return {
    totalRows: rows.length,
    totalColumns: columns.length,
    columns: profiles,
    numericColumns,
    categoricalColumns,
    temporalColumns,
    kpis,
    charts,
    insights,
    executiveSummary,
    datasetName,
    datasetContext,
    filters,
    rawData: rows,
    isPivoted,
  };
}

function emptyResult(fileName: string, columns: string[]): AnalysisResult {
  const datasetName = fileName.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    totalRows: 0, totalColumns: columns.length, columns: [], numericColumns: [],
    categoricalColumns: [], temporalColumns: [], kpis: [], charts: [], insights: [],
    executiveSummary: "No data to analyze.", datasetName, datasetContext: "", filters: [], rawData: [], isPivoted: false,
  };
}

function profileColumn(name: string, rows: Record<string, unknown>[]): ColumnProfile {
  const values = rows.map((r) => r[name]);
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  const uniqueValues = new Set(nonNull.map(String));
  const nullCount = values.length - nonNull.length;
  const type = detectColumnType(name, nonNull, uniqueValues.size, rows.length);

  const profile: ColumnProfile = {
    name, type, uniqueCount: uniqueValues.size, nullCount,
    sampleValues: nonNull.slice(0, 5),
  };

  if (type === "numeric") {
    const nums = nonNull.map(Number).filter((n) => !isNaN(n));
    if (nums.length > 0) {
      profile.min = Math.min(...nums);
      profile.max = Math.max(...nums);
      profile.sum = nums.reduce((a, b) => a + b, 0);
      profile.mean = profile.sum / nums.length;
      const sorted = [...nums].sort((a, b) => a - b);
      profile.median = sorted[Math.floor(sorted.length / 2)];
    }
  }

  if (type === "categorical") {
    const counts = new Map<string, number>();
    for (const v of nonNull) {
      const key = String(v);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    profile.topValues = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([value, count]) => ({ value, count }));
  }

  return profile;
}

function detectColumnType(name: string, values: unknown[], uniqueCount: number, totalRows: number): ColumnType {
  const nameLower = name.toLowerCase();

  // "period" from unpivoted data is temporal
  if (nameLower === "period") return "temporal";

  // ID detection
  if (/\bid\b/.test(nameLower) && uniqueCount > totalRows * 0.8) return "id";

  // Temporal keywords — but only if the column actually has enough non-null values
  const temporalKeywords = ["date", "time", "month", "day", "quarter", "week", "created", "updated"];
  const isTemporalByName = temporalKeywords.some((k) => nameLower.includes(k)) ||
    nameLower === "year" || nameLower === "fiscal_year" || nameLower === "infra_year";

  if (isTemporalByName && values.length > 0) {
    // Only classify as temporal if majority of values are non-null
    // Otherwise it's useless for time-series analysis
    if (values.length >= totalRows * 0.3) return "temporal";
    // If mostly null, treat as categorical or numeric depending on content
  }

  // Date pattern detection
  const sampleStr = values.slice(0, 20).map(String);
  const datePattern = /^\d{4}[-/]\d{2}[-/]\d{2}/;
  if (sampleStr.filter((v) => datePattern.test(v)).length > sampleStr.length * 0.5) return "temporal";

  // Numeric detection
  const sampleSize = Math.min(values.length, 50);
  const numericCount = values.slice(0, 50).filter((v) => !isNaN(Number(v)) && v !== "" && v !== null).length;

  if (numericCount > sampleSize * 0.7) {
    if (uniqueCount > totalRows * 0.9 && totalRows > 20) return "id";
    // If it's named "year" but has numeric values, treat as temporal if reasonable year range
    if (isTemporalByName) {
      const nums = values.slice(0, 20).map(Number).filter((n) => !isNaN(n));
      if (nums.every((n) => n >= 1900 && n <= 2100)) return "temporal";
    }
    return "numeric";
  }

  // Long text
  const avgLen = values.slice(0, 50).reduce((s: number, v) => s + String(v).length, 0) / Math.max(sampleSize, 1);
  if (avgLen > 100 || (uniqueCount > totalRows * 0.8 && totalRows > 50)) return "text";

  return "categorical";
}

function generateFilters(categoricalColumns: ColumnProfile[]): FilterOption[] {
  return categoricalColumns
    .filter((c) => {
      if (c.uniqueCount < 2 || c.uniqueCount > 50) return false;
      if (!c.topValues || c.topValues.length < 2) return false;
      // Filter out columns where values look like garbage (too short, numeric-like, etc.)
      const validValues = c.topValues.filter((tv) => tv.value.length >= 2 && !/^\d+[\/.\\]?$/.test(tv.value));
      return validValues.length >= 2;
    })
    .slice(0, 5)
    .map((c) => ({
      column: c.name,
      label: formatColumnName(c.name),
      values: (c.topValues || [])
        .filter((tv) => tv.value.length >= 2 && !/^\d+[\/.\\]?$/.test(tv.value))
        .map((tv) => tv.value),
    }));
}

// ============================
// PIVOTED DATA ANALYSIS
// ============================

function generatePivotedKPIs(
  rows: Record<string, unknown>[],
  yearCols: string[],
  _unpivoted: Record<string, unknown>[],
  categoricalColumns: ColumnProfile[]
): KPI[] {
  const sorted = [...yearCols].sort();
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const latestLabel = formatPeriodLabel(latest);
  const prevLabel = previous ? formatPeriodLabel(previous) : "";

  const latestTotal = rows.reduce((s, r) => s + (Number(r[latest]) || 0), 0);
  const prevTotal = previous ? rows.reduce((s, r) => s + (Number(r[previous]) || 0), 0) : 0;
  const grandTotal = rows.reduce((s, r) => {
    return s + yearCols.reduce((rs, yc) => rs + (Number(r[yc]) || 0), 0);
  }, 0);

  const growthPct = previous && prevTotal > 0 ? ((latestTotal - prevTotal) / prevTotal) * 100 : 0;

  const kpis: KPI[] = [
    {
      label: `Latest Period (${latestLabel})`,
      value: formatLargeNumber(latestTotal),
      rawValue: latestTotal,
      accent: "blue",
      tooltip: `Sum of all values in the most recent period column "${latestLabel}".`,
    },
    {
      label: "Grand Total",
      value: formatLargeNumber(grandTotal),
      rawValue: grandTotal,
      accent: "purple",
      tooltip: `Sum of all values across all ${yearCols.length} period columns and ${rows.length} records.`,
    },
    {
      label: "Period Average",
      value: formatLargeNumber(grandTotal / Math.max(yearCols.length, 1)),
      rawValue: grandTotal / Math.max(yearCols.length, 1),
      accent: "green",
      tooltip: `Grand total divided by ${yearCols.length} periods — the average total per period.`,
    },
  ];

  if (previous && prevTotal > 0) {
    kpis.push({
      label: `Growth (${prevLabel} → ${latestLabel})`,
      value: `${growthPct >= 0 ? "+" : ""}${growthPct.toFixed(1)}%`,
      rawValue: growthPct,
      trend: growthPct >= 0 ? "up" : "down",
      accent: growthPct >= 0 ? "cyan" : "red",
      tooltip: `Percentage change from ${prevLabel} (${formatLargeNumber(prevTotal)}) to ${latestLabel} (${formatLargeNumber(latestTotal)}).`,
    });
  }

  if (categoricalColumns.length > 0) {
    const cat = categoricalColumns[0];
    kpis.push({
      label: `Distinct ${formatColumnName(cat.name)}`,
      value: cat.uniqueCount.toLocaleString(),
      rawValue: cat.uniqueCount,
      accent: "cyan",
      tooltip: `Number of unique values in the "${cat.name}" column.`,
    });
  }

  return kpis.slice(0, 5);
}

/** Format a period column name for display */
function formatPeriodLabel(col: string): string {
  const trimmed = col.trim();
  if (/^\d{4}\s+\d+$/.test(trimmed)) {
    const [year, period] = trimmed.split(/\s+/);
    return `${year} P${period}`;
  }
  return trimmed;
}

function generatePivotedCharts(
  rows: Record<string, unknown>[],
  yearCols: string[],
  catCols: string[]
): ChartRecommendation[] {
  const charts: ChartRecommendation[] = [];
  let id = 0;
  const sorted = [...yearCols].sort();

  // 1. Line chart: aggregate totals per period
  const periodTotals = sorted.map((yc) => ({
    period: formatPeriodLabel(yc),
    total: rows.reduce((s, r) => s + (Number(r[yc]) || 0), 0),
  }));

  charts.push({
    id: `chart-${id++}`,
    type: "line",
    title: "Total Over Time",
    description: `Aggregate totals across ${sorted.length} periods from ${sorted[0].trim()} to ${sorted[sorted.length - 1].trim()}.`,
    xKey: "period",
    yKey: "total",
    data: periodTotals,
  });

  // 2. Area chart: same data
  charts.push({
    id: `chart-${id++}`,
    type: "area",
    title: "Volume Trend",
    description: `Cumulative volume pattern showing growth and seasonal variation across periods.`,
    xKey: "period",
    yKey: "total",
    data: periodTotals,
  });

  // 3. Bar chart by category for the latest period
  if (catCols.length > 0) {
    const latestCol = sorted[sorted.length - 1];
    const catCol = catCols[0];
    const catAgg = new Map<string, number>();
    for (const r of rows) {
      const cat = String(r[catCol] ?? "").trim();
      if (!cat) continue;
      catAgg.set(cat, (catAgg.get(cat) || 0) + (Number(r[latestCol]) || 0));
    }
    const catData = [...catAgg.entries()]
      .filter(([, v]) => v !== 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, value]) => ({ [catCol]: name, value }));

    if (catData.length >= 2) {
      charts.push({
        id: `chart-${id++}`,
        type: catData.length > 8 ? "horizontal-bar" : "bar",
        title: `${latestCol.trim()} by ${formatColumnName(catCol)}`,
        description: `Latest period values broken down by ${formatColumnName(catCol).toLowerCase()}.`,
        xKey: catCol,
        yKey: "value",
        data: catData,
      });

      // 4. Pie chart for latest period share
      if (catData.length <= 12) {
        charts.push({
          id: `chart-${id++}`,
          type: "pie",
          title: `${latestCol.trim()} Share`,
          description: `Proportional share of ${latestCol.trim()} values by ${formatColumnName(catCol).toLowerCase()}.`,
          xKey: catCol,
          yKey: "value",
          data: catData,
        });
      }
    }

    // 5. Multi-line: top N categories over all periods
    const topCats = [...catAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
    if (topCats.length >= 2) {
      const multiLineData = sorted.map((yc) => {
        const entry: Record<string, unknown> = { period: yc.trim() };
        for (const cat of topCats) {
          const row = rows.find((r) => String(r[catCol]).trim() === cat);
          entry[cat] = row ? Number(row[yc]) || 0 : 0;
        }
        return entry;
      });

      charts.push({
        id: `chart-${id++}`,
        type: "line",
        title: `Top ${formatColumnName(catCol)} Over Time`,
        description: `Comparing the top ${topCats.length} ${formatColumnName(catCol).toLowerCase()} groups across all periods.`,
        xKey: "period",
        yKey: topCats,
        data: multiLineData,
      });
    }
  }

  // 6. Second category bar chart
  if (catCols.length > 1) {
    const latestCol = sorted[sorted.length - 1];
    const catCol = catCols[1];
    const catAgg = new Map<string, number>();
    for (const r of rows) {
      const cat = String(r[catCol] ?? "").trim();
      if (!cat) continue;
      catAgg.set(cat, (catAgg.get(cat) || 0) + (Number(r[latestCol]) || 0));
    }
    const catData = [...catAgg.entries()]
      .filter(([, v]) => v !== 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, value]) => ({ [catCol]: name, value }));

    if (catData.length >= 2) {
      charts.push({
        id: `chart-${id++}`,
        type: catData.length > 8 ? "horizontal-bar" : "bar",
        title: `${latestCol.trim()} by ${formatColumnName(catCol)}`,
        description: `Breakdown by ${formatColumnName(catCol).toLowerCase()} for the latest period.`,
        xKey: catCol,
        yKey: "value",
        data: catData,
      });
    }
  }

  return charts;
}

function generatePivotedInsights(
  rows: Record<string, unknown>[],
  yearCols: string[],
  catCols: string[]
): Insight[] {
  const insights: Insight[] = [];
  const sorted = [...yearCols].sort();
  const n = rows.length;
  const conf = n >= 20 ? "high" : n >= 5 ? "medium" : "low";

  // YoY growth
  if (sorted.length >= 2) {
    const latest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const latestTotal = rows.reduce((s, r) => s + (Number(r[latest]) || 0), 0);
    const prevTotal = rows.reduce((s, r) => s + (Number(r[prev]) || 0), 0);
    if (prevTotal > 0) {
      const pct = ((latestTotal - prevTotal) / prevTotal) * 100;
      insights.push({
        text: `${formatPeriodLabel(latest)} vs ${formatPeriodLabel(prev)}: ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% change (${formatLargeNumber(prevTotal)} → ${formatLargeNumber(latestTotal)}).`,
        type: pct >= 0 ? "positive" : "negative",
        confidence: conf,
        evidence: `Sum of ${n} records across both periods.`,
      });
    }
  }

  // Peak period
  const periodTotals = sorted.map((yc) => ({
    period: formatPeriodLabel(yc),
    total: rows.reduce((s, r) => s + (Number(r[yc]) || 0), 0),
  }));
  const peak = periodTotals.reduce((best, p) => p.total > best.total ? p : best, periodTotals[0]);
  const low = periodTotals.reduce((best, p) => p.total < best.total ? p : best, periodTotals[0]);
  if (peak && low && peak.period !== low.period) {
    insights.push({
      text: `Peak period is ${peak.period} with ${formatLargeNumber(peak.total)}. Lowest is ${low.period} at ${formatLargeNumber(low.total)}.`,
      type: "info",
      confidence: conf,
      evidence: `Compared aggregates across ${sorted.length} periods.`,
    });
  }

  // CAGR if enough years
  if (sorted.length >= 3) {
    const first = periodTotals[0];
    const last = periodTotals[periodTotals.length - 1];
    if (first.total > 0 && last.total > 0) {
      const years = sorted.length - 1;
      const cagr = (Math.pow(last.total / first.total, 1 / years) - 1) * 100;
      insights.push({
        text: `Compound annual growth rate (CAGR) across ${years} periods: ${cagr >= 0 ? "+" : ""}${cagr.toFixed(1)}%.`,
        type: cagr >= 0 ? "positive" : "negative",
        confidence: sorted.length >= 5 ? "high" : "medium",
        evidence: `Calculated from first period (${formatLargeNumber(first.total)}) to last (${formatLargeNumber(last.total)}) over ${years} periods.`,
      });
    }
  }

  // Category insights
  if (catCols.length > 0) {
    const catCol = catCols[0];
    const latest = sorted[sorted.length - 1];
    const catAgg = new Map<string, number>();
    for (const r of rows) {
      const cat = String(r[catCol] ?? "").trim();
      if (!cat) continue;
      catAgg.set(cat, (catAgg.get(cat) || 0) + (Number(r[latest]) || 0));
    }
    const catSorted = [...catAgg.entries()].sort((a, b) => b[1] - a[1]);

    if (catSorted.length >= 2) {
      const [topName, topVal] = catSorted[0];
      const totalVal = catSorted.reduce((s, [, v]) => s + v, 0);
      if (totalVal > 0) {
        const pct = (topVal / totalVal) * 100;
        insights.push({
          text: `"${topName}" leads in ${formatPeriodLabel(latest)} with ${formatLargeNumber(topVal)} (${pct.toFixed(0)}% share).`,
          type: "positive",
          confidence: catSorted.length >= 5 ? "high" : "medium",
          evidence: `Ranked ${catSorted.length} ${formatColumnName(catCol).toLowerCase()} groups by ${formatPeriodLabel(latest)} values.`,
        });
      }

      const [botName, botVal] = catSorted[catSorted.length - 1];
      insights.push({
        text: `"${botName}" has the lowest ${formatPeriodLabel(latest)} value at ${formatLargeNumber(botVal)}.`,
        type: "info",
        confidence: catSorted.length >= 5 ? "high" : "medium",
      });

      // Concentration
      if (catSorted.length >= 5) {
        const top3 = catSorted.slice(0, 3).reduce((s, [, v]) => s + v, 0);
        const conc = totalVal > 0 ? (top3 / totalVal) * 100 : 0;
        if (conc > 50) {
          insights.push({
            text: `Top 3 ${formatColumnName(catCol).toLowerCase()} account for ${conc.toFixed(0)}% of ${formatPeriodLabel(latest)} total — high concentration.`,
            type: "warning",
            confidence: "high",
            evidence: `Top 3 sum ${formatLargeNumber(top3)} out of total ${formatLargeNumber(totalVal)}.`,
          });
        }
      }
    }
  }

  // Data span
  insights.push({
    text: `Dataset spans ${sorted.length} periods from ${sorted[0].trim()} to ${sorted[sorted.length - 1].trim()} across ${rows.length} records.`,
    type: "info",
  });

  return insights.slice(0, 8);
}

function generatePivotedSummary(
  rows: Record<string, unknown>[],
  yearCols: string[],
  catCols: string[],
  _fileName: string
): string {
  const sorted = [...yearCols].sort();
  const parts: string[] = [];

  const grandTotal = rows.reduce((s, r) => {
    return s + yearCols.reduce((rs, yc) => rs + (Number(r[yc]) || 0), 0);
  }, 0);
  const latest = sorted[sorted.length - 1];
  const latestTotal = rows.reduce((s, r) => s + (Number(r[latest]) || 0), 0);
  const periodAvg = grandTotal / Math.max(yearCols.length, 1);

  // Opening: scope
  parts.push(`This analysis covers ${rows.length} records over ${yearCols.length} periods (${formatPeriodLabel(sorted[0])} to ${formatPeriodLabel(sorted[sorted.length - 1])}).`);

  // Grand total and latest period
  parts.push(`The aggregate total across all periods is ${formatLargeNumber(grandTotal)}, averaging ${formatLargeNumber(periodAvg)} per period. The latest period (${formatPeriodLabel(latest)}) totals ${formatLargeNumber(latestTotal)}${periodAvg > 0 ? ` (${((latestTotal / periodAvg - 1) * 100) >= 0 ? "+" : ""}${((latestTotal / periodAvg - 1) * 100).toFixed(0)}% vs. period average)` : ""}.`);

  // Growth narrative
  if (sorted.length >= 2) {
    const first = sorted[0];
    const firstTotal = rows.reduce((s, r) => s + (Number(r[first]) || 0), 0);
    if (firstTotal > 0) {
      const overallGrowth = ((latestTotal - firstTotal) / firstTotal) * 100;
      parts.push(`From ${formatPeriodLabel(first)} to ${formatPeriodLabel(latest)}, values ${overallGrowth >= 0 ? "grew" : "declined"} by ${Math.abs(overallGrowth).toFixed(0)}% (${formatLargeNumber(firstTotal)} → ${formatLargeNumber(latestTotal)}).`);
    }

    const prev = sorted[sorted.length - 2];
    const prevTotal = rows.reduce((s, r) => s + (Number(r[prev]) || 0), 0);
    if (prevTotal > 0) {
      const recentPct = ((latestTotal - prevTotal) / prevTotal) * 100;
      parts.push(`The most recent period-over-period change is ${recentPct >= 0 ? "+" : ""}${recentPct.toFixed(1)}%.`);
    }
  }

  // Category breakdown
  if (catCols.length > 0) {
    const catCol = catCols[0];
    const catAgg = new Map<string, number>();
    for (const r of rows) {
      const cat = String(r[catCol] ?? "").trim();
      if (!cat) continue;
      catAgg.set(cat, (catAgg.get(cat) || 0) + (Number(r[latest]) || 0));
    }
    const catSorted = [...catAgg.entries()].sort((a, b) => b[1] - a[1]);
    if (catSorted.length >= 2) {
      const [topName, topVal] = catSorted[0];
      const totalCat = catSorted.reduce((s, [, v]) => s + v, 0);
      const pct = totalCat > 0 ? (topVal / totalCat) * 100 : 0;
      parts.push(`Among ${catSorted.length} ${formatColumnName(catCol).toLowerCase()} groups, "${topName}" leads the latest period with ${formatLargeNumber(topVal)} (${pct.toFixed(0)}% share).`);
    }
  }

  return parts.join(" ");
}

// ============================
// STANDARD (non-pivoted) ANALYSIS
// ============================

function generateKPIs(
  numericColumns: ColumnProfile[],
  categoricalColumns: ColumnProfile[],
  rows: Record<string, unknown>[]
): KPI[] {
  const kpis: KPI[] = [];

  kpis.push({
    label: "Total Records",
    value: rows.length.toLocaleString(),
    rawValue: rows.length,
    accent: "blue",
    tooltip: "Total number of records/rows in the dataset.",
  });

  const importantNumerics = numericColumns
    .filter((c) => c.sum !== undefined && c.sum > 0)
    .sort((a, b) => (b.sum || 0) - (a.sum || 0))
    .slice(0, 2);

  importantNumerics.forEach((col, i) => {
    kpis.push({
      label: `Total ${formatColumnName(col.name)}`,
      value: formatLargeNumber(col.sum || 0),
      rawValue: col.sum || 0,
      accent: i === 0 ? "purple" : "green",
      tooltip: `Sum of all "${col.name}" values across ${rows.length} records.`,
    });
  });

  if (importantNumerics.length > 0) {
    const main = importantNumerics[0];
    kpis.push({
      label: `Avg ${formatColumnName(main.name)}`,
      value: formatLargeNumber(main.mean || 0),
      rawValue: main.mean || 0,
      accent: "green",
      tooltip: `Arithmetic mean of "${main.name}" — total (${formatLargeNumber(main.sum || 0)}) divided by ${rows.length} records.`,
    });
  }

  if (categoricalColumns.length > 0) {
    const cat = categoricalColumns[0];
    kpis.push({
      label: `${formatColumnName(cat.name)} Groups`,
      value: cat.uniqueCount.toLocaleString(),
      rawValue: cat.uniqueCount,
      accent: "cyan",
      tooltip: `Number of unique ${formatColumnName(cat.name).toLowerCase()} values in the dataset.`,
    });
  }

  // If we have numeric data, show max value as additional KPI
  if (importantNumerics.length > 0 && kpis.length < 5) {
    const main = importantNumerics[0];
    if (main.max && main.max !== main.sum) {
      kpis.push({
        label: `Highest ${formatColumnName(main.name)}`,
        value: formatLargeNumber(main.max),
        rawValue: main.max,
        accent: "red",
        tooltip: `Maximum single-record value in "${main.name}".`,
      });
    }
  }

  return kpis.slice(0, 5);
}

function generateCharts(
  numericColumns: ColumnProfile[],
  categoricalColumns: ColumnProfile[],
  temporalColumns: ColumnProfile[],
  rows: Record<string, unknown>[]
): ChartRecommendation[] {
  const charts: ChartRecommendation[] = [];
  let chartId = 0;
  const goodCategories = categoricalColumns.filter((c) => c.uniqueCount >= 2 && c.uniqueCount <= 30);
  // Also include categories with more values for horizontal bars
  const allCategories = categoricalColumns.filter((c) => c.uniqueCount >= 2 && c.uniqueCount <= 100);

  // Line chart — numeric over time (only if temporal column has enough valid data)
  if (temporalColumns.length > 0 && numericColumns.length > 0) {
    const timeCol = temporalColumns[0];
    // Only use temporal if it has enough non-null values
    const validTimeRows = rows.filter((r) => r[timeCol.name] != null && String(r[timeCol.name]).trim() !== "");
    if (validTimeRows.length >= rows.length * 0.3) {
      const topNumerics = numericColumns.slice(0, 3);
      const aggregated = aggregateByKey(validTimeRows, timeCol.name, topNumerics);
      if (aggregated.length > 1) {
        charts.push({
          id: `chart-${chartId++}`,
          type: "line",
          title: `${formatColumnName(topNumerics[0].name)} Over ${formatColumnName(timeCol.name)}`,
          description: `Trend of ${formatColumnName(topNumerics[0].name).toLowerCase()} across ${aggregated.length} ${formatColumnName(timeCol.name).toLowerCase()} periods.`,
          xKey: timeCol.name,
          yKey: topNumerics.map((c) => c.name),
          data: aggregated,
        });
      }
    }
  }

  // Bar chart — top numeric by first category
  if (goodCategories.length > 0 && numericColumns.length > 0) {
    const catCol = goodCategories[0];
    const numCol = numericColumns[0];
    const aggregated = aggregateByKey(rows, catCol.name, [numCol]);
    if (aggregated.length >= 2) {
      charts.push({
        id: `chart-${chartId++}`,
        type: aggregated.length > 8 ? "horizontal-bar" : "bar",
        title: `${formatColumnName(numCol.name)} by ${formatColumnName(catCol.name)}`,
        description: `How ${formatColumnName(numCol.name).toLowerCase()} distributes across ${formatColumnName(catCol.name).toLowerCase()}.`,
        xKey: catCol.name,
        yKey: numCol.name,
        data: aggregated.sort((a, b) => (Number(b[numCol.name]) || 0) - (Number(a[numCol.name]) || 0)),
      });
    }
  }

  // Pie chart for first category (only if ≤ 10 groups)
  if (goodCategories.length > 0 && numericColumns.length > 0) {
    const catCol = goodCategories[0];
    const numCol = numericColumns[0];
    const aggregated = aggregateByKey(rows, catCol.name, [numCol]);
    if (aggregated.length >= 2 && aggregated.length <= 10) {
      charts.push({
        id: `chart-${chartId++}`,
        type: "pie",
        title: `${formatColumnName(numCol.name)} Share by ${formatColumnName(catCol.name)}`,
        description: `Proportional distribution of ${formatColumnName(numCol.name).toLowerCase()} across ${formatColumnName(catCol.name).toLowerCase()}.`,
        xKey: catCol.name,
        yKey: numCol.name,
        data: aggregated.sort((a, b) => (Number(b[numCol.name]) || 0) - (Number(a[numCol.name]) || 0)).map((d) => ({
          name: String(d[catCol.name]),
          value: Number(d[numCol.name]) || 0,
        })),
      });
    } else if (aggregated.length > 10 && catCol.topValues) {
      // Use record count for pie when too many categories
      const pieData = catCol.topValues.slice(0, 8).map((tv) => ({ name: tv.value, value: tv.count }));
      if (pieData.length >= 2) {
        charts.push({
          id: `chart-${chartId++}`,
          type: "pie",
          title: `Record Distribution by ${formatColumnName(catCol.name)}`,
          description: `Share of records across top ${formatColumnName(catCol.name).toLowerCase()} categories.`,
          xKey: "name",
          yKey: "value",
          data: pieData,
        });
      }
    }
  }

  // Second category bar chart
  if (goodCategories.length > 1 && numericColumns.length > 0) {
    const catCol = goodCategories[1];
    const numCol = numericColumns.length > 1 ? numericColumns[1] : numericColumns[0];
    const aggregated = aggregateByKey(rows, catCol.name, [numCol]);
    if (aggregated.length >= 2) {
      charts.push({
        id: `chart-${chartId++}`,
        type: aggregated.length > 8 ? "horizontal-bar" : "bar",
        title: `${formatColumnName(numCol.name)} by ${formatColumnName(catCol.name)}`,
        description: `Comparison across ${formatColumnName(catCol.name).toLowerCase()}.`,
        xKey: catCol.name,
        yKey: numCol.name,
        data: aggregated.sort((a, b) => (Number(b[numCol.name]) || 0) - (Number(a[numCol.name]) || 0)),
      });
    }
  }

  // Area chart for temporal + second numeric (with validation)
  if (temporalColumns.length > 0 && numericColumns.length > 1) {
    const timeCol = temporalColumns[0];
    const validTimeRows = rows.filter((r) => r[timeCol.name] != null && String(r[timeCol.name]).trim() !== "");
    if (validTimeRows.length >= rows.length * 0.3) {
      const numCol = numericColumns[1];
      const aggregated = aggregateByKey(validTimeRows, timeCol.name, [numCol]);
      if (aggregated.length > 1) {
        charts.push({
          id: `chart-${chartId++}`,
          type: "area",
          title: `${formatColumnName(numCol.name)} Trend`,
          description: `Cumulative view of ${formatColumnName(numCol.name).toLowerCase()} over time.`,
          xKey: timeCol.name,
          yKey: numCol.name,
          data: aggregated,
        });
      }
    }
  }

  // Scatter plot for correlation
  if (numericColumns.length >= 2) {
    const xCol = numericColumns[0];
    const yCol = numericColumns[1];
    const scatterData = rows
      .filter((r) => r[xCol.name] != null && r[yCol.name] != null && !isNaN(Number(r[xCol.name])) && !isNaN(Number(r[yCol.name])))
      .slice(0, 200)
      .map((r) => ({ [xCol.name]: Number(r[xCol.name]), [yCol.name]: Number(r[yCol.name]) }));
    if (scatterData.length > 10) {
      // Compute basic correlation direction
      const xVals = scatterData.map((d) => Number(d[xCol.name]));
      const yVals = scatterData.map((d) => Number(d[yCol.name]));
      const xMean = xVals.reduce((a, b) => a + b, 0) / xVals.length;
      const yMean = yVals.reduce((a, b) => a + b, 0) / yVals.length;
      let cov = 0, xVar = 0, yVar = 0;
      for (let i = 0; i < xVals.length; i++) {
        cov += (xVals[i] - xMean) * (yVals[i] - yMean);
        xVar += (xVals[i] - xMean) ** 2;
        yVar += (yVals[i] - yMean) ** 2;
      }
      const corr = xVar > 0 && yVar > 0 ? cov / Math.sqrt(xVar * yVar) : 0;
      const corrDesc = Math.abs(corr) > 0.7 ? "strong" : Math.abs(corr) > 0.4 ? "moderate" : "weak";
      const corrDir = corr > 0 ? "positive" : corr < 0 ? "negative" : "no";

      charts.push({
        id: `chart-${chartId++}`,
        type: "scatter",
        title: `${formatColumnName(xCol.name)} vs ${formatColumnName(yCol.name)}`,
        description: `Shows a ${corrDesc} ${corrDir} relationship (r=${corr.toFixed(2)}) between these two measures. Each dot represents one record. Higher "${formatColumnName(xCol.name)}" values tend to ${corr > 0 ? "coincide with" : "be paired with lower"} "${formatColumnName(yCol.name)}" values.`,
        xKey: xCol.name,
        yKey: yCol.name,
        data: scatterData,
      });
    }
  }

  // Additional: category × numeric for wider categories (if first category already used)
  if (allCategories.length > 0 && numericColumns.length > 1 && charts.length < 4) {
    const catCol = allCategories[0];
    const numCol = numericColumns[1];
    const aggregated = aggregateByKey(rows, catCol.name, [numCol]);
    if (aggregated.length >= 2) {
      charts.push({
        id: `chart-${chartId++}`,
        type: "horizontal-bar",
        title: `${formatColumnName(numCol.name)} by ${formatColumnName(catCol.name)}`,
        description: `${formatColumnName(numCol.name)} breakdown across ${formatColumnName(catCol.name).toLowerCase()} groups.`,
        xKey: catCol.name,
        yKey: numCol.name,
        data: aggregated.sort((a, b) => (Number(b[numCol.name]) || 0) - (Number(a[numCol.name]) || 0)),
      });
    }
  }

  // Fallback: if NO charts generated and we have any category, at least show record distribution
  if (charts.length === 0 && categoricalColumns.length > 0) {
    const catCol = categoricalColumns[0];
    if (catCol.topValues && catCol.topValues.length >= 2) {
      charts.push({
        id: `chart-${chartId++}`,
        type: catCol.topValues.length > 8 ? "horizontal-bar" : "bar",
        title: `Records by ${formatColumnName(catCol.name)}`,
        description: `Number of records in each ${formatColumnName(catCol.name).toLowerCase()} category.`,
        xKey: "name",
        yKey: "value",
        data: catCol.topValues.slice(0, 15).map((tv) => ({ name: tv.value, value: tv.count })),
      });

      if (catCol.topValues.length <= 10) {
        charts.push({
          id: `chart-${chartId++}`,
          type: "pie",
          title: `Distribution by ${formatColumnName(catCol.name)}`,
          description: `Proportional share of records.`,
          xKey: "name",
          yKey: "value",
          data: catCol.topValues.map((tv) => ({ name: tv.value, value: tv.count })),
        });
      }
    }
  }

  return charts;
}

function generateInsights(
  numericColumns: ColumnProfile[],
  categoricalColumns: ColumnProfile[],
  temporalColumns: ColumnProfile[],
  rows: Record<string, unknown>[]
): Insight[] {
  const insights: Insight[] = [];
  const n = rows.length;
  const conf = n >= 30 ? "high" : n >= 10 ? "medium" : "low";

  // === Category × Numeric cross-analysis ===
  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    const catCol = categoricalColumns[0];
    const numCol = numericColumns[0];
    const agg = new Map<string, { sum: number; count: number }>();
    for (const r of rows) {
      const key = String(r[catCol.name] ?? "").trim();
      if (!key) continue;
      const val = Number(r[numCol.name]) || 0;
      const cur = agg.get(key) || { sum: 0, count: 0 };
      cur.sum += val;
      cur.count++;
      agg.set(key, cur);
    }
    const sorted = [...agg.entries()].sort((a, b) => b[1].sum - a[1].sum);

    if (sorted.length >= 2) {
      const [topName, topData] = sorted[0];
      const totalVal = sorted.reduce((s, [, v]) => s + v.sum, 0);
      const topPct = totalVal > 0 ? (topData.sum / totalVal) * 100 : 0;
      const topAvg = topData.count > 0 ? topData.sum / topData.count : 0;

      insights.push({
        text: `"${topName}" dominates ${formatColumnName(numCol.name).toLowerCase()} — accounting for ${formatLargeNumber(topData.sum)} (${topPct.toFixed(0)}% of total ${formatLargeNumber(totalVal)}), averaging ${formatLargeNumber(topAvg)} per record across ${topData.count} entries.`,
        type: "positive",
        confidence: conf,
        evidence: `Aggregated "${numCol.name}" grouped by "${catCol.name}" across ${n} records.`,
      });

      // Bottom performer with comparison
      const [botName, botData] = sorted[sorted.length - 1];
      const ratio = botData.sum > 0 ? topData.sum / botData.sum : 0;
      insights.push({
        text: `"${botName}" has the lowest ${formatColumnName(numCol.name).toLowerCase()} at ${formatLargeNumber(botData.sum)} (${botData.count} records)${ratio > 2 ? ` — ${ratio.toFixed(0)}x less than the top performer` : ""}.`,
        type: "info",
        confidence: conf,
      });

      // Concentration risk
      if (sorted.length >= 5) {
        const top3Sum = sorted.slice(0, 3).reduce((s, [, v]) => s + v.sum, 0);
        const conc = totalVal > 0 ? (top3Sum / totalVal) * 100 : 0;
        if (conc > 50) {
          const top3Names = sorted.slice(0, 3).map(([name]) => `"${name}"`).join(", ");
          insights.push({
            text: `High concentration: ${top3Names} together hold ${conc.toFixed(0)}% of total ${formatColumnName(numCol.name).toLowerCase()} (${formatLargeNumber(top3Sum)} of ${formatLargeNumber(totalVal)}). Remaining ${sorted.length - 3} groups share the other ${(100 - conc).toFixed(0)}%.`,
            type: "warning",
            confidence: conf,
            evidence: `Top 3 of ${sorted.length} ${formatColumnName(catCol.name).toLowerCase()} groups by sum.`,
          });
        }
      }

      // Variance insight — are values evenly distributed or highly skewed?
      if (sorted.length >= 4) {
        const median = sorted[Math.floor(sorted.length / 2)][1].sum;
        const mean = totalVal / sorted.length;
        if (topData.sum > mean * 3 && median < mean) {
          insights.push({
            text: `Distribution is heavily skewed — the median ${formatColumnName(catCol.name).toLowerCase()} contributes ${formatLargeNumber(median)} vs. a mean of ${formatLargeNumber(mean)}, indicating a few large players pull the average up significantly.`,
            type: "warning",
            confidence: conf,
            evidence: `Median vs mean comparison across ${sorted.length} groups.`,
          });
        }
      }
    }
  }

  // === Temporal trend analysis ===
  if (temporalColumns.length > 0 && numericColumns.length > 0) {
    const timeCol = temporalColumns[0];
    const numCol = numericColumns[0];
    const timeAgg = new Map<string, { sum: number; count: number }>();
    for (const r of rows) {
      const key = String(r[timeCol.name] ?? "").trim();
      if (!key) continue;
      const cur = timeAgg.get(key) || { sum: 0, count: 0 };
      cur.sum += Number(r[numCol.name]) || 0;
      cur.count++;
      timeAgg.set(key, cur);
    }
    const timeSorted = [...timeAgg.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    if (timeSorted.length >= 2) {
      const first = timeSorted[0];
      const last = timeSorted[timeSorted.length - 1];
      const prev = timeSorted.length >= 2 ? timeSorted[timeSorted.length - 2] : null;

      // Overall growth
      if (first[1].sum > 0) {
        const overallGrowth = ((last[1].sum - first[1].sum) / first[1].sum) * 100;
        insights.push({
          text: `Overall, ${formatColumnName(numCol.name).toLowerCase()} ${overallGrowth >= 0 ? "grew" : "declined"} by ${Math.abs(overallGrowth).toFixed(0)}% from ${first[0]} (${formatLargeNumber(first[1].sum)}) to ${last[0]} (${formatLargeNumber(last[1].sum)}) over ${timeSorted.length} periods.`,
          type: overallGrowth >= 0 ? "positive" : "negative",
          confidence: timeSorted.length >= 5 ? "high" : "medium",
          evidence: `First vs last period comparison across ${timeSorted.length} distinct ${formatColumnName(timeCol.name).toLowerCase()} values.`,
        });
      }

      // Recent momentum
      if (prev && prev[1].sum > 0) {
        const recentGrowth = ((last[1].sum - prev[1].sum) / prev[1].sum) * 100;
        insights.push({
          text: `Most recent period (${last[0]}): ${formatLargeNumber(last[1].sum)} — a ${recentGrowth >= 0 ? "+" : ""}${recentGrowth.toFixed(1)}% change from the prior period (${prev[0]}: ${formatLargeNumber(prev[1].sum)}).`,
          type: recentGrowth >= 0 ? "positive" : "negative",
          confidence: conf,
        });
      }

      // Peak detection
      const peak = timeSorted.reduce((best, t) => t[1].sum > best[1].sum ? t : best, timeSorted[0]);
      if (peak[0] !== last[0] && peak[0] !== first[0]) {
        insights.push({
          text: `Peak ${formatColumnName(numCol.name).toLowerCase()} occurred in ${peak[0]} at ${formatLargeNumber(peak[1].sum)} — ${last[1].sum < peak[1].sum ? `current level is ${((1 - last[1].sum / peak[1].sum) * 100).toFixed(0)}% below peak` : "currently at or above peak"}.`,
          type: last[1].sum < peak[1].sum ? "warning" : "positive",
          confidence: conf,
        });
      }
    }
  }

  // === Outlier detection for numeric columns ===
  for (const col of numericColumns.slice(0, 2)) {
    if (col.max && col.mean && col.mean > 0 && col.max > col.mean * 5) {
      insights.push({
        text: `${formatColumnName(col.name)} shows extreme range — max value (${formatLargeNumber(col.max)}) is ${Math.round(col.max / col.mean)}x the average (${formatLargeNumber(col.mean)}). Median is ${formatLargeNumber(col.median || 0)}, suggesting right-skewed distribution.`,
        type: "warning",
        confidence: n >= 10 ? "high" : "medium",
        evidence: `Descriptive stats from ${n} values: min=${formatLargeNumber(col.min || 0)}, max=${formatLargeNumber(col.max)}, mean=${formatLargeNumber(col.mean)}, median=${formatLargeNumber(col.median || 0)}.`,
      });
    }
  }

  return insights.slice(0, 10);
}

function generateExecutiveSummary(
  rows: Record<string, unknown>[],
  numericColumns: ColumnProfile[],
  categoricalColumns: ColumnProfile[],
  temporalColumns: ColumnProfile[],
  _fileName: string
): string {
  const parts: string[] = [];

  // Opening with dataset scope
  const segments: string[] = [];
  if (categoricalColumns.length > 0) segments.push(`${categoricalColumns[0].uniqueCount} ${formatColumnName(categoricalColumns[0].name).toLowerCase()} groups`);
  if (temporalColumns.length > 0) {
    const vals = [...new Set(rows.map((r) => String(r[temporalColumns[0].name] ?? "")).filter(Boolean))].sort();
    if (vals.length >= 2) segments.push(`${vals.length} ${formatColumnName(temporalColumns[0].name).toLowerCase()} periods (${vals[0]}–${vals[vals.length - 1]})`);
  }

  parts.push(`This analysis covers ${rows.length.toLocaleString()} records${segments.length > 0 ? ` spanning ${segments.join(" and ")}` : ""}.`);

  // Primary numeric measure — rich interpretation
  if (numericColumns.length > 0) {
    const main = numericColumns.filter((c) => (c.sum || 0) > 0).sort((a, b) => (b.sum || 0) - (a.sum || 0))[0];
    if (main) {
      parts.push(`The total ${formatColumnName(main.name).toLowerCase()} across all records is ${formatLargeNumber(main.sum || 0)}, with individual values ranging from ${formatLargeNumber(main.min || 0)} to ${formatLargeNumber(main.max || 0)} (average: ${formatLargeNumber(main.mean || 0)}, median: ${formatLargeNumber(main.median || 0)}).`);

      // Interpret skew
      if (main.mean && main.median && main.mean > main.median * 1.5) {
        parts.push(`The average is significantly higher than the median, indicating a right-skewed distribution where a small number of high-value entries pull the overall figures upward.`);
      }
    }
  }

  // Category leader — with context
  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    const catCol = categoricalColumns[0];
    const numCol = numericColumns.filter((c) => (c.sum || 0) > 0).sort((a, b) => (b.sum || 0) - (a.sum || 0))[0];
    if (numCol && catCol.topValues && catCol.topValues.length >= 2) {
      // Aggregate numeric by category
      const agg = new Map<string, number>();
      for (const r of rows) {
        const key = String(r[catCol.name] ?? "").trim();
        if (!key) continue;
        agg.set(key, (agg.get(key) || 0) + (Number(r[numCol.name]) || 0));
      }
      const sorted = [...agg.entries()].sort((a, b) => b[1] - a[1]);
      if (sorted.length >= 2) {
        const [topName, topVal] = sorted[0];
        const total = sorted.reduce((s, [, v]) => s + v, 0);
        const topPct = total > 0 ? (topVal / total) * 100 : 0;
        parts.push(`Among ${catCol.uniqueCount} ${formatColumnName(catCol.name).toLowerCase()} groups, "${topName}" leads with ${formatLargeNumber(topVal)} in total ${formatColumnName(numCol.name).toLowerCase()} (${topPct.toFixed(0)}% market share).`);
      }
    }
  }

  // Temporal trend — growth/decline narrative
  if (temporalColumns.length > 0 && numericColumns.length > 0) {
    const timeCol = temporalColumns[0];
    const numCol = numericColumns.filter((c) => (c.sum || 0) > 0).sort((a, b) => (b.sum || 0) - (a.sum || 0))[0];
    if (numCol) {
      const timeAgg = new Map<string, number>();
      for (const r of rows) {
        const key = String(r[timeCol.name] ?? "").trim();
        if (!key) continue;
        timeAgg.set(key, (timeAgg.get(key) || 0) + (Number(r[numCol.name]) || 0));
      }
      const timeSorted = [...timeAgg.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      if (timeSorted.length >= 2) {
        const first = timeSorted[0];
        const last = timeSorted[timeSorted.length - 1];
        if (first[1] > 0) {
          const growth = ((last[1] - first[1]) / first[1]) * 100;
          parts.push(`From ${first[0]} to ${last[0]}, total ${formatColumnName(numCol.name).toLowerCase()} ${growth >= 0 ? "grew" : "declined"} by ${Math.abs(growth).toFixed(0)}% (${formatLargeNumber(first[1])} → ${formatLargeNumber(last[1])}).`);
        }
      }
    }
  }

  return parts.join(" ");
}

// --- Context Inference ---
/**
 * Infer what the dataset is about from the filename, column names, and data patterns.
 * Returns a human-readable context sentence explaining what the columns likely represent.
 */
function inferDatasetContext(
  datasetName: string,
  columns: string[],
  profiles: ColumnProfile[],
  _rows: Record<string, unknown>[]
): string {
  const colNames = columns.map((c) => c.toLowerCase());
  const allColStr = colNames.join(" ");
  const parts: string[] = [];

  // Detect domain from filename and columns
  if (/loan|lend|borrow|credit|debt/i.test(datasetName + " " + allColStr)) {
    parts.push("This appears to be a lending/credit dataset.");
  } else if (/revenue|sales|income|profit|expense/i.test(datasetName + " " + allColStr)) {
    parts.push("This appears to be a financial performance dataset.");
  } else if (/rate|interest|yield|coupon/i.test(datasetName + " " + allColStr)) {
    parts.push("This appears to be an interest rate or financial instrument dataset.");
  } else if (/population|census|demographic/i.test(datasetName + " " + allColStr)) {
    parts.push("This appears to be a demographic/population dataset.");
  } else if (/project|infra|construction|flood/i.test(datasetName + " " + allColStr)) {
    parts.push("This appears to be an infrastructure/project dataset.");
  }

  // Explain ambiguous column names
  const numericProfiles = profiles.filter((p) => p.type === "numeric");
  const ambiguousCols = numericProfiles.filter((p) => {
    const name = p.name.toLowerCase();
    return name.includes("amount") || /^(value|amount|category|label)\s*\d*$/i.test(p.name) ||
           name.length <= 3 || /^[a-z]\d?$/i.test(p.name);
  });

  if (ambiguousCols.length > 0) {
    const descriptions = ambiguousCols.slice(0, 3).map((col) => {
      const range = `${formatLargeNumber(col.min || 0)} – ${formatLargeNumber(col.max || 0)}`;
      return `"${col.name}" (numeric, range: ${range})`;
    });
    parts.push(`Note: columns ${descriptions.join(", ")} may have abbreviated names from the source file.`);
  }

  return parts.join(" ");
}

// --- Helpers ---
function aggregateByKey(rows: Record<string, unknown>[], keyCol: string, numCols: ColumnProfile[]): Record<string, unknown>[] {
  const map = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const key = String(row[keyCol] ?? "").trim();
    if (!key || key === "null" || key === "undefined") continue;
    if (!map.has(key)) {
      const entry: Record<string, number> = {};
      numCols.forEach((c) => (entry[c.name] = 0));
      map.set(key, entry);
    }
    const entry = map.get(key)!;
    numCols.forEach((c) => {
      const v = Number(row[c.name]);
      if (!isNaN(v)) entry[c.name] += v;
    });
  }
  return [...map.entries()]
    .map(([key, vals]) => ({ [keyCol]: key, ...vals }))
    .slice(0, 30);
}

function formatColumnName(name: string): string {
  const trimmed = name.trim();
  // Year-period columns like "2018 31" → "2018 W31" or just keep as-is
  if (/^\d{4}\s+\d+$/.test(trimmed)) {
    const [year, period] = trimmed.split(/\s+/);
    return `${year} P${period}`;
  }
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  return name.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

function formatLargeNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toFixed(2);
}
