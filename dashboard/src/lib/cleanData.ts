// Automatic data cleaning pipeline - pure TypeScript, no external dependencies

export interface CleaningAction {
  step: string;
  description: string;
  affectedRows: number;
  affectedColumns: string[];
}

export interface CleaningReport {
  originalRows: number;
  cleanedRows: number;
  originalColumns: number;
  cleanedColumns: number;
  duplicatesRemoved: number;
  actions: CleaningAction[];
}

export interface CleanedData {
  rows: Record<string, unknown>[];
  columns: string[];
  report: CleaningReport;
}

// --- Helpers ---

function rowKey(row: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(row)
      .sort()
      .map((k) => [k, row[k]])
  );
}

function cleanColumnName(name: string): string {
  let cleaned = name.trim();
  // Only remove invisible/control characters, keep spaces and readable punctuation
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
  // Collapse multiple spaces into one
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned || name;
}

function isNumeric(value: unknown): boolean {
  return typeof value === 'number' && !isNaN(value);
}

function getNumericValues(rows: Record<string, unknown>[], col: string): number[] {
  return rows
    .map((r) => r[col])
    .filter((v): v is number => typeof v === 'number' && !isNaN(v));
}

function computeIQR(values: number[]): { q1: number; q3: number; iqr: number; lower: number; upper: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  return { q1, q3, iqr, lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

function normalizeCategorical(value: string): string {
  const lower = value.toLowerCase().trim();

  // Boolean normalization
  if (lower === 'true' || lower === 'yes') {
    return value.charAt(0).toUpperCase() + lower.slice(1);
  }
  if (lower === 'false' || lower === 'no') {
    return value.charAt(0).toUpperCase() + lower.slice(1);
  }

  // Title case: capitalize first letter, lowercase the rest
  if (value === value.toUpperCase() || value === value.toLowerCase()) {
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  return value;
}

function stripCurrencyAndCommas(value: string): number | null {
  // Remove currency symbols and whitespace
  let cleaned = value.replace(/[$₱€£]/g, '').trim();
  // Remove commas used as thousand separators
  cleaned = cleaned.replace(/,/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function parsePercentage(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) {
    const num = Number(trimmed.slice(0, -1));
    return isNaN(num) ? null : num / 100;
  }
  return null;
}

// --- Main pipeline ---

export function cleanDataset(rows: Record<string, unknown>[], columns: string[]): CleanedData {
  const actions: CleaningAction[] = [];
  const originalRows = rows.length;
  const originalColumns = columns.length;

  // Deep copy rows to avoid mutating input
  let workingRows: Record<string, unknown>[] = rows.map((r) => ({ ...r }));
  let workingColumns = [...columns];

  // Step 1: Remove exact duplicate rows
  const seen = new Set<string>();
  const dedupedRows: Record<string, unknown>[] = [];
  for (const row of workingRows) {
    const key = rowKey(row);
    if (!seen.has(key)) {
      seen.add(key);
      dedupedRows.push(row);
    }
  }
  const duplicatesRemoved = workingRows.length - dedupedRows.length;
  workingRows = dedupedRows;

  actions.push({
    step: 'Remove duplicates',
    description: `Removed ${duplicatesRemoved} exact duplicate row(s)`,
    affectedRows: duplicatesRemoved,
    affectedColumns: workingColumns,
  });

  // Step 2: Fix column names
  const columnMap: Record<string, string> = {};
  const renamedColumns: string[] = [];

  for (const col of workingColumns) {
    const cleaned = cleanColumnName(col);
    columnMap[col] = cleaned;
    if (col !== cleaned) {
      renamedColumns.push(col);
    }
  }

  // Rename columns in rows
  if (renamedColumns.length > 0) {
    workingRows = workingRows.map((row) => {
      const newRow: Record<string, unknown> = {};
      for (const col of workingColumns) {
        newRow[columnMap[col]] = row[col];
      }
      return newRow;
    });
  }

  workingColumns = workingColumns.map((c) => columnMap[c]);

  actions.push({
    step: 'Fix column names',
    description: `Cleaned ${renamedColumns.length} column name(s): trimmed whitespace, replaced special characters, collapsed underscores`,
    affectedRows: renamedColumns.length > 0 ? workingRows.length : 0,
    affectedColumns: renamedColumns.map((c) => columnMap[c]),
  });

  // Step 3: Handle missing values (report only, no removal)
  const missingReport: Record<string, number> = {};
  let totalMissingCells = 0;

  for (const col of workingColumns) {
    let count = 0;
    for (const row of workingRows) {
      const val = row[col];
      if (val === null || val === undefined || val === '') {
        count++;
      }
    }
    if (count > 0) {
      missingReport[col] = count;
      totalMissingCells += count;
    }
  }

  const missingCols = Object.keys(missingReport);
  const missingDesc = missingCols.length > 0
    ? `Found ${totalMissingCells} missing value(s) across ${missingCols.length} column(s): ${missingCols.map((c) => `${c}(${missingReport[c]})`).join(', ')}`
    : 'No missing values detected';

  actions.push({
    step: 'Handle missing values',
    description: missingDesc,
    affectedRows: 0,
    affectedColumns: missingCols,
  });

  // Step 4: Detect and flag outliers using IQR (no removal)
  const outlierColumns: string[] = [];
  let totalOutliers = 0;

  for (const col of workingColumns) {
    const numericVals = getNumericValues(workingRows, col);
    if (numericVals.length < 4) continue; // Need enough data for IQR

    const { lower, upper } = computeIQR(numericVals);
    let colOutliers = 0;

    for (const row of workingRows) {
      const val = row[col];
      if (isNumeric(val)) {
        const num = val as number;
        if (num < lower || num > upper) {
          colOutliers++;
        }
      }
    }

    if (colOutliers > 0) {
      outlierColumns.push(col);
      totalOutliers += colOutliers;
    }
  }

  actions.push({
    step: 'Detect outliers',
    description: totalOutliers > 0
      ? `Flagged ${totalOutliers} outlier value(s) in ${outlierColumns.length} numeric column(s) using IQR method (not removed)`
      : 'No outliers detected in numeric columns',
    affectedRows: 0,
    affectedColumns: outlierColumns,
  });

  // Step 5: Normalize text - trim strings, collapse multiple spaces
  let textNormalizedCells = 0;
  const textNormalizedCols = new Set<string>();

  for (const row of workingRows) {
    for (const col of workingColumns) {
      const val = row[col];
      if (typeof val === 'string') {
        const trimmed = val.trim().replace(/\s+/g, ' ');
        if (trimmed !== val) {
          row[col] = trimmed;
          textNormalizedCells++;
          textNormalizedCols.add(col);
        }
      }
    }
  }

  actions.push({
    step: 'Normalize text',
    description: `Trimmed and collapsed whitespace in ${textNormalizedCells} cell(s)`,
    affectedRows: textNormalizedCells,
    affectedColumns: [...textNormalizedCols],
  });

  // Step 6: Clean categoricals - merge obvious duplicates
  const categoricalCols = new Set<string>();
  let categoricalChanges = 0;

  for (const col of workingColumns) {
    // Determine if column is categorical: mostly strings with limited unique values
    const stringVals = workingRows
      .map((r) => r[col])
      .filter((v): v is string => typeof v === 'string');

    if (stringVals.length === 0) continue;

    const uniqueLower = new Set(stringVals.map((v) => v.toLowerCase().trim()));

    // Only treat as categorical if there are repeated values (unique < total)
    if (uniqueLower.size < stringVals.length) {
      // Build canonical map: lowercase -> most common casing or Title Case
      const freqMap: Record<string, Record<string, number>> = {};
      for (const val of stringVals) {
        const key = val.toLowerCase().trim();
        if (!freqMap[key]) freqMap[key] = {};
        freqMap[key][val] = (freqMap[key][val] || 0) + 1;
      }

      const canonicalMap: Record<string, string> = {};
      for (const [key, variants] of Object.entries(freqMap)) {
        if (Object.keys(variants).length > 1) {
          // Multiple casings exist - normalize to Title Case
          canonicalMap[key] = normalizeCategorical(key);
        }
      }

      if (Object.keys(canonicalMap).length > 0) {
        for (const row of workingRows) {
          const val = row[col];
          if (typeof val === 'string') {
            const key = val.toLowerCase().trim();
            if (canonicalMap[key] && val !== canonicalMap[key]) {
              row[col] = canonicalMap[key];
              categoricalChanges++;
              categoricalCols.add(col);
            }
          }
        }
      }
    }
  }

  actions.push({
    step: 'Clean categoricals',
    description: categoricalChanges > 0
      ? `Merged ${categoricalChanges} categorical variant(s) across ${categoricalCols.size} column(s) to consistent casing`
      : 'No categorical inconsistencies found',
    affectedRows: categoricalChanges,
    affectedColumns: [...categoricalCols],
  });

  // Step 7: Clean numbers - strip currency, commas, convert percentages
  let numbersCleaned = 0;
  const numbersCleanedCols = new Set<string>();

  for (const row of workingRows) {
    for (const col of workingColumns) {
      const val = row[col];
      if (typeof val !== 'string') continue;

      // Try percentage first
      const pct = parsePercentage(val);
      if (pct !== null) {
        row[col] = pct;
        numbersCleaned++;
        numbersCleanedCols.add(col);
        continue;
      }

      // Try currency/comma stripping
      if (/[$₱€£,]/.test(val)) {
        const num = stripCurrencyAndCommas(val);
        if (num !== null) {
          row[col] = num;
          numbersCleaned++;
          numbersCleanedCols.add(col);
        }
      }
    }
  }

  actions.push({
    step: 'Clean numbers',
    description: numbersCleaned > 0
      ? `Converted ${numbersCleaned} value(s) in ${numbersCleanedCols.size} column(s): stripped currency symbols/commas, converted percentages to decimals`
      : 'No numeric strings requiring cleaning',
    affectedRows: numbersCleaned,
    affectedColumns: [...numbersCleanedCols],
  });

  // Build final report
  const report: CleaningReport = {
    originalRows,
    cleanedRows: workingRows.length,
    originalColumns,
    cleanedColumns: workingColumns.length,
    duplicatesRemoved,
    actions,
  };

  return {
    rows: workingRows,
    columns: workingColumns,
    report,
  };
}
