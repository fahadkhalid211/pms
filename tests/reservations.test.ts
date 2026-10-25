import { describe, it, expect } from "vitest";
import { nightsBetween, roomIsAvailable, roomsAreAvailable, listReservations, getReservation, createReservation } from "@/lib/reservations";

describe("reservation domain logic", () => {
  it("computes nights between dates", () => {
    const checkIn = new Date(2026, 10, 12);
    const checkOut = new Date(2026, 10, 15);
    expect(nightsBetween(checkIn, checkOut)).toBe(3);
  });

  it("returns zero nights for reversed dates", () => {
    expect(nightsBetween(new Date(2026, 10, 15), new Date(2026, 10, 12))).toBe(0);
  });
});
