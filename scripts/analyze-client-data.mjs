import * as XLSX from "xlsx";
import fs from "fs";

const buf = fs.readFileSync("client-data.xlsx");
const wb = XLSX.read(buf, { type: "buffer" });
const ws = wb.Sheets["Booking Report"];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const headerRowIndex = 9;
const headers = rows[headerRowIndex];
console.log("Headers:", headers);

const bookings = [];
const properties = new Set();
const sources = new Set();

function parseExcelDate(val) {
  if (typeof val === "number") {
    // Excel base date (Dec 30 1899)
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString().slice(0, 10);
  }
  if (typeof val === "string") {
    val = val.trim();
    if (val.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [d, m, y] = val.split("/").map(Number);
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return val;
    }
  }
  return String(val);
}

for (let i = headerRowIndex + 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || !r[0] || String(r[0]).startsWith("Total")) break;

  const propName = String(r[0]).trim();
  properties.add(propName);

  const guestRaw = String(r[1] || "").trim();
  const sourceRaw = String(r[2] || "").trim();
  sources.add(sourceRaw);

  const resCode = String(r[3] || "").trim();
  const checkIn = parseExcelDate(r[4]);
  const checkOut = parseExcelDate(r[5]);
  const externalId = String(r[6] || "").trim();
  const nights = Number(r[7] || 0);
  const rent = Number(r[8] || 0);
  const fees = Number(r[9] || 0);
  const tax = Number(r[10] || 0);
  const total = Number(r[11] || 0);
  const guestPaid = Number(r[12] || 0);
  const guestDue = Number(r[13] || 0);
  const agencyDue = Number(r[14] || 0);
  const ownerBalance = Number(r[15] || 0);

  bookings.push({
    row: i,
    propName,
    guestRaw,
    sourceRaw,
    resCode,
    checkIn,
    checkOut,
    externalId,
    nights,
    rent,
    fees,
    tax,
    total,
    guestPaid,
    guestDue,
    agencyDue,
    ownerBalance,
  });
}

console.log("Parsed bookings count:", bookings.length);
console.log("\nProperties found (" + properties.size + "):");
for (const p of properties) console.log(" -", p);

console.log("\nSources found (" + sources.size + "):");
for (const s of sources) console.log(" -", s);

console.log("\nSample booking records (first 3):");
console.log(bookings.slice(0, 3));

console.log("\nSample booking records (last 3):");
console.log(bookings.slice(-3));

// Check currency distinction:
// How do we know if a booking is EUR or GBP?
// Row 183 says "Total (EUR):" has 5 nights, rent 865.81, total 1212.80.
// Let's find which bookings sum to 1212.80 or have 5 nights!
const eurCandidates = bookings.filter(b => b.total === 1212.8 || b.rent === 865.81);
console.log("\nEUR candidates matching exact sum:", eurCandidates);

// Let's check all bookings that might be EUR
console.log("\nLet's check if there are any specific properties or channels for EUR:");
let sumNights = 0, sumTotal = 0;
for (const b of bookings) {
  sumNights += b.nights;
  sumTotal += b.total;
}
console.log("Total nights across all parsed:", sumNights, "Expected:", 585 + 5, "= 590");
console.log("Total revenue across all parsed:", sumTotal.toFixed(2), "Expected:", (282997.98 + 1212.80).toFixed(2), "= 284210.78");
