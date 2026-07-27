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

  // Detect if the first row has mostly empty headers (merged cells pattern)
  const result = parseSheetIntelligently(rawRows, fileName);
  if (result) return result;

  // Standard parse fallback
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  if (rows.length === 0) throw new Error("Excel file is empty or has no data rows.");
  const columns = Object.keys(rows[0]);
  return cleanParsedData({ rows, columns, fileName });
}

/**
 * Intelligently parse a sheet that may have merged header cells or multi-row headers.
 * Detects patterns where XLSX generates "EMPTY", "__EMPTY", "__EMPTY_1" etc. column names.
 */
function parseSheetIntelligently(rawRows: unknown[][], fileName: string): ParsedData | null {
  if (rawRows.length < 3) return null;

  // Find the best header row — the one with the most non-empty cells
  let bestHeaderIdx = 0;
  let bestCount = 0;

  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const row = rawRows[i] as unknown[];
    if (!row) continue;
    const nonEmpty = row.filter((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "").length;
    if (nonEmpty > bestCount) {
      bestCount = nonEmpty;
      bestHeaderIdx = i;
    }
  }

  // Check if there's a secondary header row (common in government reports)
  const headerRow = rawRows[bestHeaderIdx] as unknown[];
  if (!headerRow || bestCount < 2) return null;

  // Build column names: combine header row cells, handling nulls
  const headers: string[] = [];
  let lastNonEmpty = "";

  for (let i = 0; i < headerRow.length; i++) {
    const cell = headerRow[i];
    if (cell !== null && cell !== undefined && String(cell).trim() !== "") {
      lastNonEmpty = String(cell).trim();
      headers.push(lastNonEmpty);
    } else {
      // For blank cells (merged regions), try the secondary header row
      const secondaryRow = rawRows[bestHeaderIdx + 1] as unknown[] | undefined;
      const secondaryCell = secondaryRow?.[i];
      if (secondaryCell !== null && secondaryCell !== undefined && String(secondaryCell).trim() !== "") {
        headers.push(String(secondaryCell).trim());
      } else {
        // Use parent + index pattern
        headers.push(lastNonEmpty ? `${lastNonEmpty}_${i}` : `Column_${i + 1}`);
      }
    }
  }

  // Parse data rows (skip header rows)
  const dataStartIdx = bestHeaderIdx + 1;
  // Check if the row after header is also a sub-header (non-numeric in columns that should be numeric)
  const secondRow = rawRows[dataStartIdx] as unknown[] | undefined;
  let skipSubHeader = false;
  if (secondRow) {
    const numericCells = secondRow.filter((c) => c !== null && !isNaN(Number(c))).length;
    if (numericCells < secondRow.filter((c) => c !== null).length * 0.3) {
      skipSubHeader = true;
    }
  }

  const actualDataStart = skipSubHeader ? dataStartIdx + 1 : dataStartIdx;
  const rows: Record<string, unknown>[] = [];

  for (let i = actualDataStart; i < rawRows.length; i++) {
    const raw = rawRows[i] as unknown[];
    if (!raw) continue;
    // Skip completely empty rows
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

  // Deduplicate column names
  const uniqueHeaders = deduplicateHeaders(headers);

  // Remap rows to use deduplicated headers
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
 * 1. Renaming "EMPTY", "__EMPTY", "__EMPTY_N" columns to meaningful names
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
        // Keep with a cleaner name: "Value_1", "Value_2" etc.
        const idx = cleanedColumns.filter((c) => c.startsWith("Value_")).length + 1;
        const newName = `Value_${idx}`;
        columnMapping.set(col, newName);
        cleanedColumns.push(newName);
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
  // PDF table extraction: attempt to detect table structures
  // Uses a simple text-line approach for tabular PDFs
  const text = await extractPDFText(file);
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("Could not extract tabular data from PDF. The file may not contain structured tables.");
  }

  // Try to detect delimiter (tab, multiple spaces, or comma)
  const headerLine = lines[0];
  let delimiter = "\t";
  if (!headerLine.includes("\t")) {
    delimiter = headerLine.includes(",") ? "," : "  ";
  }

  const headers = headerLine.split(delimiter).map((h) => h.trim()).filter(Boolean);
  if (headers.length < 2) {
    throw new Error("Could not detect table columns in PDF. Try converting to CSV or Excel first.");
  }

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map((c) => c.trim());
    if (cells.length < 2) continue;
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      const val = cells[idx] || null;
      // Try to parse numbers
      if (val !== null && !isNaN(Number(val)) && val !== "") {
        row[h] = Number(val);
      } else {
        row[h] = val;
      }
    });
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error("PDF contained headers but no data rows could be parsed.");
  }

  return { rows, columns: headers, fileName };
}

async function extractPDFText(file: File): Promise<string> {
  // Basic PDF text extraction using binary analysis
  // For production, consider pdf.js — this handles simple text PDFs
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder("latin1").decode(bytes);

  // Extract text between BT (Begin Text) and ET (End Text) operators
  const textBlocks: string[] = [];
  const btPattern = /BT\s([\s\S]*?)ET/g;
  let match: RegExpExecArray | null;

  while ((match = btPattern.exec(text)) !== null) {
    const block = match[1];
    // Extract string literals in parentheses
    const strPattern = /\(([^)]*)\)/g;
    let strMatch: RegExpExecArray | null;
    while ((strMatch = strPattern.exec(block)) !== null) {
      textBlocks.push(strMatch[1]);
    }
  }

  if (textBlocks.length === 0) {
    // Fallback: try to find readable text
    const readable = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, "\n").trim();
    if (readable.length > 50) return readable;
    throw new Error("Could not extract text from PDF. The file may be image-based or encrypted.");
  }

  return textBlocks.join("\n");
}
