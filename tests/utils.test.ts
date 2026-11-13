import { describe, it, expect } from "vitest";
import { formatMoney, formatDate, addDays, toISODate, fromISODate, formatRoomDisplayName } from "@/lib/utils";

describe("formatting utilities", () => {
  it("formats money", () => {
    expect(formatMoney(123.45, "USD")).toContain("123");
    expect(formatMoney(null)).toBe("$0.00");
  });

  it("formats dates", () => {
    expect(formatDate(new Date(2026, 0, 5))).toContain("Jan");
  });

  it("adds days", () => {
    const d = addDays(new Date(2026, 0, 1), 10);
    expect(d.getDate()).toBe(11);
  });

  it("converts ISO dates", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(fromISODate("2026-01-05").getDate()).toBe(5);
  });

  it("formats room display names without exposing placeholder 'MAIN'", () => {
    expect(formatRoomDisplayName(null)).toBe("Unassigned");

    // Hospitable or single-unit room with placeholder number "MAIN"
    expect(formatRoomDisplayName({ number: "MAIN", name: "Sunset Beach Villa" })).toBe("Sunset Beach Villa");

    // Legacy bulk imported room with trailing " MAIN"
    expect(formatRoomDisplayName({ number: "MAIN", name: "Sunset Beach Villa MAIN" })).toBe("Sunset Beach Villa");

    // Room with placeholder "MAIN" and missing name falls back to property name
    expect(
      formatRoomDisplayName({ number: "MAIN", name: null, property: { name: "Ocean Palms Resort" } }),
    ).toBe("Ocean Palms Resort");

    // Traditional hotel room number
    expect(formatRoomDisplayName({ number: "101", name: null })).toBe("Room 101");

    // Room with both number and distinct name
    expect(formatRoomDisplayName({ number: "201", name: "Honeymoon Suite" })).toBe("201 · Honeymoon Suite");

    // Room whose name already includes the number
    expect(formatRoomDisplayName({ number: "301", name: "Penthouse 301" })).toBe("Penthouse 301");

    // Room with descriptive unit code
    expect(formatRoomDisplayName({ number: "Villa 4", name: null })).toBe("Villa 4");
  });
});

