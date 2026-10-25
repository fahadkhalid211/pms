import { describe, it, expect } from "vitest";
import { formatMoney, formatDate, addDays, toISODate, fromISODate } from "@/lib/utils";

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
});
