import * as XLSX from "xlsx";

/**
 * Lightweight RFC 4180 quote-aware CSV parser for client & server bulk imports.
 * Handles quoted fields with commas, CRLF/LF newlines, and header normalization.
 */
export function parseCsvRecords(input: string): Array<Record<string, string>> {
  const text = input.trim();
  if (!text) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(cell.trim());
      if (row.some((v) => v.length > 0)) rows.push(row);
      row = [];
      cell = "";
      i += 1;
    } else if (ch === "\n" || ch === "\r") {
      row.push(cell.trim());
      if (row.some((v) => v.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some((v) => v.length > 0)) rows.push(row);

  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).map((cols) => {
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) record[h] = cols[idx] ?? "";
    });
    return record;
  });
}

/**
 * Parses an Excel (.xlsx or .xls) file buffer into an array of records
 * with normalized lowercase underscore headers.
 */
export function parseXlsxRecords(buffer: ArrayBuffer | Uint8Array): Array<Record<string, string>> {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) return [];

  const rawRows = XLSX.utils.sheet_to_json<Array<unknown>>(worksheet, { header: 1, raw: false, defval: "" });
  if (rawRows.length < 2) return [];

  const headers = (rawRows[0] as unknown[]).map((h) =>
    String(h ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_"),
  );

  return (rawRows.slice(1) as unknown[][])
    .filter((row) => row.some((cell) => cell !== undefined && cell !== null && String(cell).trim().length > 0))
    .map((cols) => {
      const record: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (h) record[h] = String(cols[idx] ?? "").trim();
      });
      return record;
    });
}

/**
 * Converts an Excel (.xlsx/.xls) workbook buffer into CSV text for instant
 * preview and editing in modal textareas.
 */
export function xlsxToCsv(buffer: ArrayBuffer | Uint8Array): string {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return "";
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) return "";
  return XLSX.utils.sheet_to_csv(worksheet);
}

/**
 * Generates an Excel (.xlsx) file buffer from headers and row data,
 * allowing users to download formatted sample templates.
 */
export function generateSampleXlsx(headers: string[], rows: (string | number)[][]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(out);
}
