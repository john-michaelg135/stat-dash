/**
 * Automatic data analysis engine.
 * Detects column types, determines appropriate charts, generates meaningful insights.
 * Assumes data is already cleaned — no data quality metrics.
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
}

export interface Insight {
  text: string;
  type: "info" | "positive" | "negative" | "warning";
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
  filters: FilterOption[];
  rawData: Record<string, unknown>[];
}

export function analyzeData(
  rows: Record<string, unknown>[],
  columns: string[],
  fileName: string
): AnalysisResult {
  const profiles = columns.map((col) => profileColumn(col, rows));
  const numericColumns = profiles.filter((p) => p.type === "numeric");
  const categoricalColumns = profiles.filter((p) => p.type === "categorical");
  const temporalColumns = profiles.filter((p) => p.type === "temporal");

  const kpis = generateKPIs(numericColumns, categoricalColumns, rows);
  const charts = generateCharts(numericColumns, categoricalColumns, temporalColumns, rows);
  const insights = generateInsights(numericColumns, categoricalColumns, temporalColumns, rows);
  const executiveSummary = generateExecutiveSummary(rows, numericColumns, categoricalColumns, temporalColumns, fileName);
  const filters = generateFilters(categoricalColumns);

  const datasetName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

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
    filters,
    rawData: rows,
  };
}

function profileColumn(name: string, rows: Record<string, unknown>[]): ColumnProfile {
  const values = rows.map((r) => r[name]);
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  const uniqueValues = new Set(nonNull.map(String));
  const nullCount = values.length - nonNull.length;
  const type = detectColumnType(name, nonNull, uniqueValues.size, rows.length);

  const profile: ColumnProfile = {
    name,
    type,
    uniqueCount: uniqueValues.size,
    nullCount,
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
      .slice(0, 15)
      .map(([value, count]) => ({ value, count }));
  }

  return profile;
}

function detectColumnType(name: string, values: unknown[], uniqueCount: number, totalRows: number): ColumnType {
  const nameLower = name.toLowerCase();

  // ID detection
  if (nameLower.includes("id") && (nameLower.startsWith("id") || nameLower.endsWith("id") || nameLower.endsWith("_id"))) {
    if (uniqueCount > totalRows * 0.8) return "id";
  }

  // Temporal keywords
  const temporalKeywords = ["date", "time", "month", "day", "quarter", "week", "period", "created", "updated"];
  if (temporalKeywords.some((k) => nameLower.includes(k))) return "temporal";

  // Date pattern detection
  const sampleStr = values.slice(0, 20).map(String);
  const datePattern = /^\d{4}[-/]\d{2}[-/]\d{2}/;
  const dateCount = sampleStr.filter((v) => datePattern.test(v)).length;
  if (dateCount > sampleStr.length * 0.5) return "temporal";

  // Year-only column (e.g. "year", "fiscal_year") — treat as temporal
  if (nameLower === "year" || nameLower === "fiscal_year" || nameLower === "infra_year") return "temporal";

  // Numeric detection
  const numericCount = values.slice(0, 50).filter((v) => !isNaN(Number(v)) && v !== "" && v !== null).length;
  const sampleSize = Math.min(values.length, 50);

  if (numericCount > sampleSize * 0.7) {
    // Pure IDs have very high cardinality
    if (uniqueCount > totalRows * 0.9 && totalRows > 20) return "id";
    return "numeric";
  }

  // Long text
  const avgLength = values.slice(0, 50).reduce((s: number, v) => s + String(v).length, 0) / Math.max(values.slice(0, 50).length, 1);
  if (avgLength > 100 || (uniqueCount > totalRows * 0.8 && totalRows > 50)) return "text";

  return "categorical";
}

function generateFilters(categoricalColumns: ColumnProfile[]): FilterOption[] {
  return categoricalColumns
    .filter((c) => c.uniqueCount >= 2 && c.uniqueCount <= 50)
    .slice(0, 4)
    .map((c) => ({
      column: c.name,
      label: formatColumnName(c.name),
      values: (c.topValues || []).map((tv) => tv.value),
    }));
}

function generateKPIs(
  numericColumns: ColumnProfile[],
  categoricalColumns: ColumnProfile[],
  rows: Record<string, unknown>[]
): KPI[] {
  const kpis: KPI[] = [];
  const accents: KPI["accent"][] = ["blue", "purple", "green", "cyan", "red"];

  // Total records
  kpis.push({
    label: "Total Records",
    value: rows.length.toLocaleString(),
    rawValue: rows.length,
    accent: "blue",
  });

  // Top numeric sums
  const importantNumerics = numericColumns
    .filter((c) => c.sum !== undefined && c.sum > 0)
    .sort((a, b) => (b.sum || 0) - (a.sum || 0))
    .slice(0, 2);

  importantNumerics.forEach((col, i) => {
    kpis.push({
      label: `Total ${formatColumnName(col.name)}`,
      value: formatLargeNumber(col.sum || 0),
      rawValue: col.sum || 0,
      accent: accents[(i + 1) % accents.length],
    });
  });

  // Average of top numeric
  if (importantNumerics.length > 0) {
    const main = importantNumerics[0];
    kpis.push({
      label: `Avg ${formatColumnName(main.name)}`,
      value: formatLargeNumber(main.mean || 0),
      rawValue: main.mean || 0,
      accent: "green",
    });
  }

  // Distinct count for first categorical
  if (categoricalColumns.length > 0) {
    const cat = categoricalColumns[0];
    kpis.push({
      label: `Distinct ${formatColumnName(cat.name)}`,
      value: cat.uniqueCount.toLocaleString(),
      rawValue: cat.uniqueCount,
      accent: "cyan",
    });
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

  // Detect pivoted year columns (common in government/finance Excel files)
  // Patterns: "2024", "2024 01", "Year_2024", "FY2024", etc.
  const yearColPattern = /^(\d{4})\s*\d*$|^year[_\s]*(\d{4})$/i;
  const yearColumns = numericColumns.filter((c) => yearColPattern.test(c.name.trim()));
  const nonYearNumerics = numericColumns.filter((c) => !yearColPattern.test(c.name.trim()));

  const goodCategories = categoricalColumns.filter((c) => c.uniqueCount >= 2 && c.uniqueCount <= 30);
  const mainNumerics = nonYearNumerics.length > 0 ? nonYearNumerics : numericColumns;

  // === PIVOTED YEAR DATA (e.g. each column is a year or year-period) ===
  if (yearColumns.length >= 3) {
    const sorted = yearColumns.sort((a, b) => a.name.localeCompare(b.name));

    // Line chart: total per year
    const yearTotals = sorted.map((yc) => {
      const total = rows.reduce((s, r) => s + (Number(r[yc.name]) || 0), 0);
      return { year: yc.name.trim(), total };
    });

    charts.push({
      id: `chart-${chartId++}`,
      type: "line",
      title: "Total Over Time",
      description: `Yearly trend across ${yearColumns.length} periods showing aggregate totals.`,
      xKey: "year",
      yKey: "total",
      data: yearTotals,
    });

    // Area chart
    charts.push({
      id: `chart-${chartId++}`,
      type: "area",
      title: "Volume Trend",
      description: `Area chart showing volume distribution over ${yearColumns.length} periods.`,
      xKey: "year",
      yKey: "total",
      data: yearTotals,
    });

    // Bar chart by category for the latest period
    if (goodCategories.length > 0) {
      const latestYear = sorted[sorted.length - 1];
      const catCol = goodCategories[0];
      const catData = aggregateByKey(rows, catCol.name, [latestYear]);
      if (catData.length >= 2) {
        charts.push({
          id: `chart-${chartId++}`,
          type: catData.length > 8 ? "horizontal-bar" : "bar",
          title: `${latestYear.name.trim()} by ${formatColumnName(catCol.name)}`,
          description: `Latest period values broken down by ${formatColumnName(catCol.name).toLowerCase()}.`,
          xKey: catCol.name,
          yKey: latestYear.name,
          data: catData.sort((a, b) => (Number(b[latestYear.name]) || 0) - (Number(a[latestYear.name]) || 0)),
        });
      }

      // Pie chart: share by category for latest period
      if (catData.length >= 2 && catData.length <= 12) {
        charts.push({
          id: `chart-${chartId++}`,
          type: "pie",
          title: `${latestYear.name.trim()} Share by ${formatColumnName(catCol.name)}`,
          description: `Proportional distribution of ${latestYear.name.trim()} values among ${formatColumnName(catCol.name).toLowerCase()} groups.`,
          xKey: "name",
          yKey: "value",
          data: catData.map((d) => ({ name: String(d[catCol.name]), value: Number(d[latestYear.name]) || 0 })),
        });
      }
    }

    // Second category comparison
    if (goodCategories.length > 1) {
      const catCol = goodCategories[1];
      const latestYear = sorted[sorted.length - 1];
      const catData = aggregateByKey(rows, catCol.name, [latestYear]);
      if (catData.length >= 2) {
        charts.push({
          id: `chart-${chartId++}`,
          type: catData.length > 8 ? "horizontal-bar" : "bar",
          title: `${latestYear.name.trim()} by ${formatColumnName(catCol.name)}`,
          description: `Comparison across ${formatColumnName(catCol.name).toLowerCase()} for the latest period.`,
          xKey: catCol.name,
          yKey: latestYear.name,
          data: catData.sort((a, b) => (Number(b[latestYear.name]) || 0) - (Number(a[latestYear.name]) || 0)),
        });
      }
    }
  }

  // === STANDARD CHARTS (non-pivoted data) ===

  // Line chart — numeric over time
  if (temporalColumns.length > 0 && mainNumerics.length > 0) {
    const timeCol = temporalColumns[0];
    const topNumerics = mainNumerics.slice(0, 3);
    const aggregated = aggregateByKey(rows, timeCol.name, topNumerics);
    if (aggregated.length > 1) {
      charts.push({
        id: `chart-${chartId++}`,
        type: "line",
        title: `${formatColumnName(topNumerics[0].name)} Over ${formatColumnName(timeCol.name)}`,
        description: `Trend of ${formatColumnName(topNumerics[0].name).toLowerCase()} across ${formatColumnName(timeCol.name).toLowerCase()}.`,
        xKey: timeCol.name,
        yKey: topNumerics.map((c) => c.name),
        data: aggregated,
      });
    }
  }

  // Bar chart — top numeric by first category
  if (goodCategories.length > 0 && mainNumerics.length > 0) {
    const catCol = goodCategories[0];
    const numCol = mainNumerics[0];
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

  // Pie chart for first category record count
  if (goodCategories.length > 0) {
    const catCol = goodCategories[0];
    if (catCol.topValues && catCol.topValues.length >= 2) {
      charts.push({
        id: `chart-${chartId++}`,
        type: "pie",
        title: `Record Distribution by ${formatColumnName(catCol.name)}`,
        description: `Proportional share of records across ${formatColumnName(catCol.name).toLowerCase()}.`,
        xKey: "name",
        yKey: "value",
        data: catCol.topValues.slice(0, 10).map((tv) => ({ name: tv.value, value: tv.count })),
      });
    }
  }

  // Second category
  if (goodCategories.length > 1 && mainNumerics.length > 0) {
    const catCol = goodCategories[1];
    const numCol = mainNumerics.length > 1 ? mainNumerics[1] : mainNumerics[0];
    const aggregated = aggregateByKey(rows, catCol.name, [numCol]);
    if (aggregated.length >= 2) {
      charts.push({
        id: `chart-${chartId++}`,
        type: aggregated.length > 8 ? "horizontal-bar" : "bar",
        title: `${formatColumnName(numCol.name)} by ${formatColumnName(catCol.name)}`,
        description: `Comparison of ${formatColumnName(numCol.name).toLowerCase()} across ${formatColumnName(catCol.name).toLowerCase()}.`,
        xKey: catCol.name,
        yKey: numCol.name,
        data: aggregated.sort((a, b) => (Number(b[numCol.name]) || 0) - (Number(a[numCol.name]) || 0)),
      });
    }
  }

  // Area chart for temporal data
  if (temporalColumns.length > 0 && mainNumerics.length > 1) {
    const timeCol = temporalColumns[0];
    const numCol = mainNumerics[1];
    const aggregated = aggregateByKey(rows, timeCol.name, [numCol]);
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

  // Scatter plot for correlation
  if (mainNumerics.length >= 2) {
    const xCol = mainNumerics[0];
    const yCol = mainNumerics[1];
    const scatterData = rows
      .filter((r) => r[xCol.name] != null && r[yCol.name] != null && !isNaN(Number(r[xCol.name])) && !isNaN(Number(r[yCol.name])))
      .slice(0, 200)
      .map((r) => ({ [xCol.name]: Number(r[xCol.name]), [yCol.name]: Number(r[yCol.name]) }));
    if (scatterData.length > 10) {
      charts.push({
        id: `chart-${chartId++}`,
        type: "scatter",
        title: `${formatColumnName(xCol.name)} vs ${formatColumnName(yCol.name)}`,
        description: `Correlation between ${formatColumnName(xCol.name).toLowerCase()} and ${formatColumnName(yCol.name).toLowerCase()}.`,
        xKey: xCol.name,
        yKey: yCol.name,
        data: scatterData,
      });
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

  // Top performer insights from categories + numerics
  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    const catCol = categoricalColumns[0];
    const numCol = numericColumns[0];
    const aggregated = new Map<string, number>();
    for (const r of rows) {
      const key = String(r[catCol.name] ?? "");
      if (!key) continue;
      aggregated.set(key, (aggregated.get(key) || 0) + (Number(r[numCol.name]) || 0));
    }
    const sorted = [...aggregated.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length >= 2) {
      const [topName, topVal] = sorted[0];
      const totalVal = sorted.reduce((s, [, v]) => s + v, 0);
      const pct = totalVal > 0 ? ((topVal / totalVal) * 100).toFixed(1) : "0";
      insights.push({
        text: `"${topName}" leads in ${formatColumnName(numCol.name)} with ${formatLargeNumber(topVal)} (${pct}% of total).`,
        type: "positive",
      });

      // Bottom performer
      const [botName, botVal] = sorted[sorted.length - 1];
      insights.push({
        text: `"${botName}" has the lowest ${formatColumnName(numCol.name)} at ${formatLargeNumber(botVal)}.`,
        type: "info",
      });
    }

    // Concentration — top 3 vs rest
    if (sorted.length >= 5) {
      const top3Sum = sorted.slice(0, 3).reduce((s, [, v]) => s + v, 0);
      const totalVal = sorted.reduce((s, [, v]) => s + v, 0);
      const top3Pct = totalVal > 0 ? (top3Sum / totalVal) * 100 : 0;
      if (top3Pct > 50) {
        insights.push({
          text: `Top 3 ${formatColumnName(catCol.name).toLowerCase()} categories account for ${top3Pct.toFixed(0)}% of all ${formatColumnName(numCol.name).toLowerCase()}.`,
          type: "warning",
        });
      }
    }
  }

  // Year-over-year growth if pivoted year columns exist
  const yearColPattern = /^(\d{4})\s*\d*$|^year[_\s]*(\d{4})$/i;
  const yearCols = numericColumns.filter((c) => yearColPattern.test(c.name.trim()));
  if (yearCols.length >= 2) {
    const sorted = yearCols.sort((a, b) => a.name.localeCompare(b.name));
    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];
    const latestTotal = rows.reduce((s, r) => s + (Number(r[latest.name]) || 0), 0);
    const prevTotal = rows.reduce((s, r) => s + (Number(r[previous.name]) || 0), 0);
    if (prevTotal > 0) {
      const growthPct = ((latestTotal - prevTotal) / prevTotal) * 100;
      insights.push({
        text: `${latest.name.trim()} shows a ${growthPct >= 0 ? "+" : ""}${growthPct.toFixed(1)}% change compared to ${previous.name.trim()} (${formatLargeNumber(prevTotal)} → ${formatLargeNumber(latestTotal)}).`,
        type: growthPct >= 0 ? "positive" : "negative",
      });
    }
  }

  // Range and outlier insights for top numerics
  for (const col of numericColumns.slice(0, 2)) {
    if (col.max !== undefined && col.mean !== undefined && col.min !== undefined && col.mean > 0) {
      if (col.max > col.mean * 10) {
        insights.push({
          text: `${formatColumnName(col.name)} has extreme variation — max (${formatLargeNumber(col.max)}) is ${Math.round(col.max / col.mean)}x the average (${formatLargeNumber(col.mean)}).`,
          type: "warning",
        });
      }
    }
  }

  // Category dominance
  for (const col of categoricalColumns.slice(0, 3)) {
    if (col.topValues && col.topValues.length > 0) {
      const topPct = (col.topValues[0].count / rows.length) * 100;
      if (topPct > 50) {
        insights.push({
          text: `"${col.topValues[0].value}" dominates ${formatColumnName(col.name)} at ${topPct.toFixed(0)}% of all records.`,
          type: "info",
        });
      }
    }
  }

  // Temporal insight
  if (temporalColumns.length > 0) {
    const timeCol = temporalColumns[0];
    const vals = rows.map((r) => String(r[timeCol.name] ?? "")).filter(Boolean);
    const unique = [...new Set(vals)].sort();
    if (unique.length >= 2) {
      insights.push({
        text: `Data covers ${unique.length} distinct ${formatColumnName(timeCol.name).toLowerCase()} periods from "${unique[0]}" to "${unique[unique.length - 1]}".`,
        type: "info",
      });
    }
  }

  return insights.slice(0, 8);
}

function generateExecutiveSummary(
  rows: Record<string, unknown>[],
  numericColumns: ColumnProfile[],
  categoricalColumns: ColumnProfile[],
  temporalColumns: ColumnProfile[],
  fileName: string
): string {
  const datasetName = fileName.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const parts: string[] = [];

  parts.push(`This dataset "${datasetName}" contains ${rows.length.toLocaleString()} records across ${numericColumns.length + categoricalColumns.length + temporalColumns.length} analyzed fields.`);

  if (numericColumns.length > 0) {
    const main = numericColumns.filter((c) => (c.sum || 0) > 0).sort((a, b) => (b.sum || 0) - (a.sum || 0))[0];
    if (main) {
      parts.push(`The primary measure "${formatColumnName(main.name)}" totals ${formatLargeNumber(main.sum || 0)} with an average of ${formatLargeNumber(main.mean || 0)} per record (ranging from ${formatLargeNumber(main.min || 0)} to ${formatLargeNumber(main.max || 0)}).`);
    }
  }

  if (categoricalColumns.length > 0) {
    const mainCat = categoricalColumns[0];
    const topEntry = mainCat.topValues?.[0];
    parts.push(`Data spans ${mainCat.uniqueCount} distinct ${formatColumnName(mainCat.name).toLowerCase()} groups${topEntry ? `, with "${topEntry.value}" as the leading category (${topEntry.count} records)` : ""}.`);
  }

  if (temporalColumns.length > 0) {
    const timeCol = temporalColumns[0];
    const vals = rows.map((r) => String(r[timeCol.name] ?? "")).filter(Boolean);
    const unique = [...new Set(vals)].sort();
    if (unique.length >= 2) {
      parts.push(`Temporal data via "${formatColumnName(timeCol.name)}" spans from ${unique[0]} to ${unique[unique.length - 1]}.`);
    }
  }

  // Year column summary
  const yearColPattern = /^(\d{4})\s*\d*$|^year[_\s]*(\d{4})$/i;
  const yearCols = numericColumns.filter((c) => yearColPattern.test(c.name.trim()));
  if (yearCols.length >= 3) {
    const sorted = yearCols.sort((a, b) => a.name.localeCompare(b.name));
    parts.push(`The dataset includes ${yearCols.length} period columns from ${sorted[0].name.trim()} to ${sorted[sorted.length - 1].name.trim()}, enabling time-series analysis.`);
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
      const entry: Record<string, number> = { __count: 0 };
      numCols.forEach((c) => (entry[c.name] = 0));
      map.set(key, entry);
    }
    const entry = map.get(key)!;
    entry.__count++;
    numCols.forEach((c) => {
      const v = Number(row[c.name]);
      if (!isNaN(v)) entry[c.name] += v;
    });
  }
  return [...map.entries()]
    .map(([key, vals]) => ({
      [keyCol]: key,
      ...Object.fromEntries(Object.entries(vals).filter(([k]) => k !== "__count")),
      count: vals.__count,
    }))
    .slice(0, 30);
}

function formatColumnName(name: string): string {
  if (/^\d{4}\s*\d*$/.test(name.trim())) return name.trim();
  return name
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatLargeNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toFixed(2);
}
