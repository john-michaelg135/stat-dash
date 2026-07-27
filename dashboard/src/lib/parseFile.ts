/**
 * File parser — handles JSON, Excel/CSV, and PDF ingestion.
 * Returns a flat array of row objects and column names.
 */

import * as XLSX from "xlsx";

export interface ParsedData {
  rows: Record<string, unknown>[];
  columns: string[];
  fileName: string;
}

export async function parseFile(file: File): Promise<ParsedData> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const fileName = file.name;

  switch (ext) {
    case "json":
      return parseJSON(file, fileName);
    case "csv":
      return parseCSV(file, fileName);
    case "xlsx":
    case "xls":
      return parseExcel(file, fileName);
    case "pdf":
      return parsePDF(file, fileName);
    default:
      throw new Error(`Unsupported file format: .${ext}. Please upload JSON, Excel, CSV, or PDF.`);
  }
}

async function parseJSON(file: File, fileName: string): Promise<ParsedData> {
  const text = await file.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON file. Please check the format.");
  }

  // Handle ESRI FeatureLayer format
  if (isESRIFormat(data)) {
    const features = (data as { features: { attributes: Record<string, unknown> }[] }).features;
    const rows = features.map((f) => f.attributes);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, columns, fileName };
  }

  // Handle array of objects
  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error("JSON file contains an empty array.");
    if (typeof data[0] !== "object" || data[0] === null) {
      throw new Error("JSON array must contain objects with key-value pairs.");
    }
    const rows = data as Record<string, unknown>[];
    const columns = Object.keys(rows[0]);
    return { rows, columns, fileName };
  }

  // Handle object with a data/results/records array property
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const arrayKey = Object.keys(obj).find((k) => Array.isArray(obj[k]) && (obj[k] as unknown[]).length > 0);
    if (arrayKey) {
      const rows = obj[arrayKey] as Record<string, unknown>[];
      if (typeof rows[0] === "object" && rows[0] !== null) {
        const columns = Object.keys(rows[0]);
        return { rows, columns, fileName };
      }
    }
    // Single-object: wrap it
    const columns = Object.keys(obj);
    return { rows: [obj], columns, fileName };
  }

  throw new Error("Unrecognized JSON structure. Expected an array of objects or ESRI FeatureLayer format.");
}

function isESRIFormat(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.features) && obj.features.length > 0 && typeof (obj.features as Record<string, unknown>[])[0]?.attributes === "object";
}

async function parseCSV(file: File, fileName: string): Promise<ParsedData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  if (rows.length === 0) throw new Error("CSV file is empty or has no data rows.");
  const columns = Object.keys(rows[0]);
  return cleanParsedData({ rows, columns, fileName });
}

async function parseExcel(file: File, fileName: string): Promise<ParsedData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // First, try reading with raw headers to detect merged-cell layouts
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

  // Try intelligent parsing for complex government/financial layouts
  const smartResult = parseSheetIntelligently(rawRows, fileName);
  if (smartResult && !hasGarbageColumns(smartResult.columns)) {
    return smartResult;
  }

  // Standard parse fallback
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  if (rows.length === 0) throw new Error("Excel file is empty or has no data rows.");
  const columns = Object.keys(rows[0]);
  return cleanParsedData({ rows, columns, fileName });
}

/**
 * Check if column names look like garbage (mostly numbers, or very short nonsense).
 * If >40% of columns are pure numbers or ≤2 chars, the parsing probably went wrong.
 */
function hasGarbageColumns(columns: string[]): boolean {
  if (columns.length < 3) return false;
  const garbage = columns.filter((c) => {
    const trimmed = c.trim();
    // Pure numbers that aren't years
    if (!isNaN(Number(trimmed))) {
      const n = Number(trimmed);
      if (!(Number.isInteger(n) && n >= 1900 && n <= 2099)) return true;
    }
    // Very short with slashes (like "4/", "6/")
    if (trimmed.length <= 2 && /[\/\\]/.test(trimmed)) return true;
    // Decimal numbers as column names (like "25270.58")
    if (/^\d+\.\d+$/.test(trimmed)) return true;
    return false;
  });
  return garbage.length > columns.length * 0.4;
}

/**
 * Intelligently parse a sheet that may have merged header cells or multi-row headers.
 * Handles government/finance Excel layouts with:
 * - Title rows at the top
 * - Multi-row merged headers
 * - Year columns as numeric headers
 * - Entity names in first column with numeric data in subsequent columns
 */
function parseSheetIntelligently(rawRows: unknown[][], fileName: string): ParsedData | null {
  if (rawRows.length < 3) return null;

  // Strategy: find the real header row by looking for the row that:
  // 1. Has multiple non-empty cells
  // 2. Is followed by rows with a DIFFERENT pattern (data rows)
  // 3. Isn't itself a data row (a data row has a mix of text + many numbers)

  let bestHeaderIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const row = rawRows[i] as unknown[];
    if (!row) continue;

    const nonEmpty = row.filter((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "");
    if (nonEmpty.length < 2) continue;

    const textCells = nonEmpty.filter((cell) => isNaN(Number(cell)));
    const numCells = nonEmpty.filter((cell) => !isNaN(Number(cell)));

    // A good header row has mostly text OR is all years (4-digit numbers 1900-2099)
    const yearCells = numCells.filter((c) => {
      const n = Number(c);
      return Number.isInteger(n) && n >= 1900 && n <= 2099;
    });

    // Score: penalize rows that mix text with non-year numbers (those are data rows)
    // A real header: "Particulars | 1990 | 1991 | 1992 ..." → text + years = GOOD
    // A data row: "APT | 782 | 671 | 25270 ..." → text + random numbers = BAD
    const nonYearNums = numCells.length - yearCells.length;
    const isLikelyDataRow = nonYearNums > 2 && textCells.length > 0 && nonYearNums >= textCells.length;

    if (isLikelyDataRow) continue; // Skip — this is a data row, not a header

    // Score: text cells + year cells (both are valid header content)
    const score = (textCells.length + yearCells.length) * 2 + nonEmpty.length;

    // Bonus: first row after title rows (row 0 often is the title)
    const titleBonus = (i >= 1 && i <= 3) ? 3 : 0;

    if (score + titleBonus > bestScore) {
      bestScore = score + titleBonus;
      bestHeaderIdx = i;
    }
  }

  if (bestHeaderIdx < 0) return null;

  const headerRow = rawRows[bestHeaderIdx] as unknown[];
  if (!headerRow) return null;

  // Build headers from the identified header row
  const headers: string[] = [];
  let lastNonEmpty = "";

  const subHeaderRow = rawRows[bestHeaderIdx + 1] as unknown[] | undefined;
  let isSubHeader = false;
  if (subHeaderRow) {
    const nextRow = rawRows[bestHeaderIdx + 2] as unknown[] | undefined;
    const headerNonNull = headerRow.filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;
    const subNonNull = subHeaderRow.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
    const subNumeric = subNonNull.filter((c) => !isNaN(Number(c)));
    
    // If subHeaderRow has mostly text
    if (subNonNull.length > 0 && subNumeric.length < subNonNull.length * 0.5) {
       // Check if there are merged cells in the header
       const hasGaps = headerRow.includes(null) || headerRow.includes(undefined) || headerRow.includes("");
       
       if (headerNonNull < subNonNull.length || hasGaps) {
           // It might be a sub-header. But let's verify it doesn't look exactly like the data row below it.
           if (nextRow) {
               const nextNonNull = nextRow.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
               const nextNumeric = nextNonNull.filter((c) => !isNaN(Number(c)));
               // If the next row has significantly more numbers, then subHeaderRow is definitely a header.
               if (nextNumeric.length > subNumeric.length) {
                   isSubHeader = true;
               } else if (nextNonNull.length === 0) {
                   // Only 2 rows in file?
                   isSubHeader = true;
               }
           } else {
               isSubHeader = true; // No more rows, assume sub-header
           }
       }
    }
  }

  for (let i = 0; i < headerRow.length; i++) {
    const cell = headerRow[i];
    const cellStr = cell !== null && cell !== undefined ? String(cell).trim() : "";

    if (cellStr !== "") {
      lastNonEmpty = cellStr;
      // Check if sub-header row adds specificity (text, not numbers)
      const subCell = isSubHeader ? subHeaderRow?.[i] : null;
      const subStr = subCell !== null && subCell !== undefined ? String(subCell).trim() : "";
      if (subStr && subStr !== cellStr && isNaN(Number(subStr))) {
        headers.push(`${cellStr} ${subStr}`);
      } else {
        headers.push(cellStr);
      }
    } else {
      // Empty cell — try sub-header row or use context
      const subCell = isSubHeader ? subHeaderRow?.[i] : null;
      const subStr = subCell !== null && subCell !== undefined ? String(subCell).trim() : "";

      if (subStr && isNaN(Number(subStr))) {
        headers.push(lastNonEmpty ? `${lastNonEmpty} ${subStr}` : subStr);
      } else if (lastNonEmpty) {
        headers.push(`${lastNonEmpty} ${headers.filter((h) => h.startsWith(lastNonEmpty)).length + 1}`);
      } else {
        headers.push(`Column ${i + 1}`);
      }
    }
  }

  // Determine data start
  let dataStartIdx = bestHeaderIdx + 1;
  if (isSubHeader) {
    dataStartIdx = bestHeaderIdx + 2;
  }

  const rows: Record<string, unknown>[] = [];
  for (let i = dataStartIdx; i < rawRows.length; i++) {
    const raw = rawRows[i] as unknown[];
    if (!raw) continue;
    const nonEmpty = raw.filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;
    if (nonEmpty < 2) continue;

    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      const val = raw[idx] ?? null;
      if (val !== null && !isNaN(Number(val)) && String(val).trim() !== "") {
        row[h] = Number(val);
      } else {
        row[h] = val;
      }
    });
    rows.push(row);
  }

  if (rows.length === 0) return null;

  const uniqueHeaders = deduplicateHeaders(headers);
  const cleanedRows = rows.map((row) => {
    const newRow: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      newRow[uniqueHeaders[i]] = row[h];
    });
    return newRow;
  });

  return cleanParsedData({ rows: cleanedRows, columns: uniqueHeaders, fileName });
}

/**
 * Clean parsed data by:
 * 1. Renaming "EMPTY", "__EMPTY", "__EMPTY_N" columns to meaningful names based on content
 * 2. Removing columns that are entirely null
 * 3. Stripping leading/trailing whitespace from string values
 */
function cleanParsedData(data: ParsedData): ParsedData {
  const { rows, columns, fileName } = data;

  // Detect and rename EMPTY-pattern columns
  const emptyPattern = /^_*EMPTY_?\s*\d*$/i;
  const cleanedColumns: string[] = [];
  const columnMapping = new Map<string, string>();

  for (const col of columns) {
    const normalized = col.trim().replace(/\s+/g, "_");
    if (emptyPattern.test(normalized)) {
      // Try to infer meaning from the first few non-null values
      const sampleValues = rows
        .map((r) => r[col])
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
        .slice(0, 10);

      if (sampleValues.length === 0) {
        // Column is entirely empty — skip it
        continue;
      }

      // Check if values look like years
      const areYears = sampleValues.every((v) => {
        const n = Number(v);
        return !isNaN(n) && n >= 1900 && n <= 2100;
      });

      if (areYears) {
        const yearVal = sampleValues[0];
        const newName = `Year_${yearVal}`;
        columnMapping.set(col, newName);
        cleanedColumns.push(newName);
      } else {
        // Infer a better name based on content type
        const numCount = sampleValues.filter((v) => !isNaN(Number(v))).length;
        const isNumeric = numCount > sampleValues.length * 0.7;
        const isText = !isNumeric;

        if (isText) {
          // Use the most common non-null string value pattern to name it
          const firstVal = String(sampleValues[0]).trim();
          if (firstVal.length > 2 && firstVal.length <= 30) {
            // Try using it as a category label column
            const idx = cleanedColumns.filter((c) => c.startsWith("Category")).length + 1;
            const newName = idx === 1 ? "Category" : `Category_${idx}`;
            columnMapping.set(col, newName);
            cleanedColumns.push(newName);
          } else {
            const idx = cleanedColumns.filter((c) => c.startsWith("Label")).length + 1;
            const newName = idx === 1 ? "Label" : `Label_${idx}`;
            columnMapping.set(col, newName);
            cleanedColumns.push(newName);
          }
        } else {
          // Numeric column — try to give context from adjacent named columns
          const existingNamedCols = cleanedColumns.filter((c) => !c.startsWith("Amount") && !c.startsWith("Value"));
          const contextName = existingNamedCols.length > 0 ? existingNamedCols[existingNamedCols.length - 1] : "";
          const idx = cleanedColumns.filter((c) => c.startsWith("Amount")).length + 1;
          const newName = contextName && idx === 1 ? `${contextName} Amount` : `Amount ${idx}`;
          columnMapping.set(col, newName.trim());
          cleanedColumns.push(newName.trim());
        }
      }
    } else {
      columnMapping.set(col, col);
      cleanedColumns.push(col);
    }
  }

  // Rebuild rows with cleaned column names and trimmed values
  const cleanedRows = rows.map((row) => {
    const newRow: Record<string, unknown> = {};
    for (const [oldCol, newCol] of columnMapping.entries()) {
      let val = row[oldCol];
      // Trim strings
      if (typeof val === "string") {
        val = val.trim();
        if (val === "") val = null;
      }
      newRow[newCol] = val;
    }
    return newRow;
  });

  // Remove rows that are entirely null/empty
  const finalRows = cleanedRows.filter((row) => {
    const nonNull = Object.values(row).filter((v) => v !== null && v !== undefined && String(v).trim() !== "").length;
    return nonNull >= 2;
  });

  if (finalRows.length === 0) {
    throw new Error("No valid data rows found after cleaning. The file may have an unsupported layout.");
  }

  return { rows: finalRows, columns: cleanedColumns, fileName };
}

/**
 * Deduplicate column headers by appending _N suffix to duplicates.
 */
function deduplicateHeaders(headers: string[]): string[] {
  const counts = new Map<string, number>();
  return headers.map((h) => {
    const count = counts.get(h) || 0;
    counts.set(h, count + 1);
    return count > 0 ? `${h}_${count}` : h;
  });
}

async function parsePDF(file: File, fileName: string): Promise<ParsedData> {
  const text = await extractPDFText(file);
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error(
      "Could not extract tabular data from PDF. The file may be image-based or contain no readable tables. Try converting to Excel or CSV first."
    );
  }

  // Strategy: find the most likely header row and parse the table
  const parsed = parseTableFromLines(lines);
  if (parsed) return { ...parsed, fileName };

  throw new Error(
    "Could not detect a table structure in the PDF. The file may not contain a standard table layout. Try converting to CSV or Excel first."
  );
}

/**
 * Attempt to detect a table structure from lines of text extracted from a PDF.
 * Tries multiple strategies: tab-delimited, consistent spacing, comma-separated.
 */
function parseTableFromLines(lines: string[]): { rows: Record<string, unknown>[]; columns: string[] } | null {
  // Strategy 1: Tab-delimited
  const tabResult = tryDelimiter(lines, "\t");
  if (tabResult) return tabResult;

  // Strategy 2: Comma-delimited (but not inside parentheses)
  const commaResult = tryDelimiter(lines, ",");
  if (commaResult) return commaResult;

  // Strategy 3: Pipe-delimited (common in some reports)
  const pipeResult = tryDelimiter(lines, "|");
  if (pipeResult) return pipeResult;

  // Strategy 4: Multi-space delimited — detect consistent column positions
  const spaceResult = trySpaceDelimited(lines);
  if (spaceResult) return spaceResult;

  // Strategy 5: Treat each line as a single-column entry (last resort)
  if (lines.length >= 3) {
    // Find a line that looks like a header (text content)
    const headerIdx = lines.findIndex((l) => /[a-zA-Z]/.test(l) && l.split(/\s{2,}/).length >= 2);
    if (headerIdx >= 0) {
      const headers = lines[headerIdx].split(/\s{2,}/).map((h) => h.trim()).filter(Boolean);
      if (headers.length >= 2) {
        const rows: Record<string, unknown>[] = [];
        for (let i = headerIdx + 1; i < lines.length; i++) {
          const cells = lines[i].split(/\s{2,}/).map((c) => c.trim());
          if (cells.length < 2) continue;
          const row: Record<string, unknown> = {};
          headers.forEach((h, idx) => {
            const val = cells[idx] || null;
            if (val !== null && val !== "" && !isNaN(Number(val.replace(/,/g, "")))) {
              row[h] = Number(val.replace(/,/g, ""));
            } else {
              row[h] = val;
            }
          });
          rows.push(row);
        }
        if (rows.length > 0) return { rows, columns: headers };
      }
    }
  }

  return null;
}

function tryDelimiter(lines: string[], delimiter: string): { rows: Record<string, unknown>[]; columns: string[] } | null {
  // Check if most lines contain the delimiter
  const linesWithDelimiter = lines.filter((l) => l.includes(delimiter));
  if (linesWithDelimiter.length < lines.length * 0.4) return null;

  // Find best header line (first line with the delimiter that has mostly text)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const parts = lines[i].split(delimiter).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return null;

  const headers = lines[headerIdx].split(delimiter).map((h) => h.trim()).filter(Boolean);
  if (headers.length < 2) return null;

  const rows: Record<string, unknown>[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map((c) => c.trim());
    if (cells.filter(Boolean).length < 2) continue;
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      const val = cells[idx] || null;
      if (val !== null && val !== "" && !isNaN(Number(val.replace(/,/g, "")))) {
        row[h] = Number(val.replace(/,/g, ""));
      } else {
        row[h] = val;
      }
    });
    rows.push(row);
  }

  if (rows.length < 1) return null;
  return { rows, columns: headers };
}

function trySpaceDelimited(lines: string[]): { rows: Record<string, unknown>[]; columns: string[] } | null {
  // Look for lines with consistent multi-space gaps
  const spacedLines = lines.filter((l) => /\s{3,}/.test(l));
  if (spacedLines.length < lines.length * 0.3) return null;

  // Find header: first line with at least 2 space-separated groups
  let headerIdx = -1;
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const parts = lines[i].split(/\s{3,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2 && /[a-zA-Z]/.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return null;

  const headers = lines[headerIdx].split(/\s{3,}/).map((h) => h.trim()).filter(Boolean);
  if (headers.length < 2) return null;

  const rows: Record<string, unknown>[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = lines[i].split(/\s{3,}/).map((c) => c.trim());
    if (cells.filter(Boolean).length < 2) continue;
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      const val = cells[idx] || null;
      if (val !== null && val !== "" && !isNaN(Number(val.replace(/,/g, "")))) {
        row[h] = Number(val.replace(/,/g, ""));
      } else {
        row[h] = val;
      }
    });
    rows.push(row);
  }

  if (rows.length < 1) return null;
  return { rows, columns: headers };
}

async function extractPDFText(file: File): Promise<string> {
  // Use pdf.js for proper PDF text extraction
  const pdfjsLib = await import("pdfjs-dist");

  // Set up worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;

  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group text items by Y position to reconstruct lines
    const itemsByY = new Map<number, { x: number; text: string }[]>();

    for (const item of textContent.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      // Round Y to group items on same line (within 2px tolerance)
      const y = Math.round(item.transform[5] / 2) * 2;
      if (!itemsByY.has(y)) itemsByY.set(y, []);
      itemsByY.get(y)!.push({ x: item.transform[4], text: item.str });
    }

    // Sort by Y (descending — PDF coordinates are bottom-up)
    const sortedYs = [...itemsByY.keys()].sort((a, b) => b - a);

    for (const y of sortedYs) {
      const items = itemsByY.get(y)!.sort((a, b) => a.x - b.x);
      // Join items on same line, using tab as separator when gaps are large
      let line = "";
      let lastX = -Infinity;
      for (const item of items) {
        const gap = item.x - lastX;
        if (lastX > -Infinity && gap > 20) {
          line += "\t";
        } else if (lastX > -Infinity && gap > 5) {
          line += "  ";
        }
        line += item.text;
        lastX = item.x + item.text.length * 5; // rough char width estimate
      }
      if (line.trim()) allLines.push(line);
    }
  }

  if (allLines.length === 0) {
    throw new Error(
      "Could not extract text from this PDF. It may be image-based (scanned) or encrypted. Try converting to Excel or CSV first."
    );
  }

  return allLines.join("\n");
}
