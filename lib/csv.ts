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
