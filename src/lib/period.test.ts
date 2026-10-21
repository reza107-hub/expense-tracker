import { describe, expect, it } from "vitest";
import {
  isFutureDate,
  periodContaining,
  periodForMonth,
  shiftPeriod,
  todayInDhaka,
} from "./period";

describe("periodForMonth", () => {
  it("covers the calendar month when the start day is 1", () => {
    expect(periodForMonth(2026, 10, 1)).toEqual({
      year: 2026,
      month: 10,
      start: "2026-10-01",
      end: "2026-10-31",
    });
  });

  it("runs from the start day to the day before the next start day", () => {
    expect(periodForMonth(2026, 10, 25)).toMatchObject({
      start: "2026-10-25",
      end: "2026-11-24",
    });
  });

  it("crosses the year boundary", () => {
    expect(periodForMonth(2026, 12, 25)).toMatchObject({
      start: "2026-12-25",
      end: "2027-01-24",
    });
    expect(periodForMonth(2026, 12, 1)).toMatchObject({
      start: "2026-12-01",
      end: "2026-12-31",
    });
  });

  it("handles February in leap and non-leap years", () => {
    expect(periodForMonth(2028, 2, 1).end).toBe("2028-02-29");
    expect(periodForMonth(2027, 2, 1).end).toBe("2027-02-28");
    expect(periodForMonth(2027, 2, 28)).toMatchObject({
      start: "2027-02-28",
      end: "2027-03-27",
    });
    expect(periodForMonth(2027, 1, 28).end).toBe("2027-02-27");
  });

  it("rejects an invalid start day or month", () => {
    for (const day of [0, 29, 31, -1, 1.5, Number.NaN]) {
      expect(() => periodForMonth(2026, 10, day), String(day)).toThrow(RangeError);
    }
    expect(() => periodForMonth(2026, 0, 1)).toThrow(RangeError);
    expect(() => periodForMonth(2026, 13, 1)).toThrow(RangeError);
  });
});

describe("periodContaining", () => {
  it("finds the calendar month when the start day is 1", () => {
    expect(periodContaining("2026-10-21", 1)).toMatchObject({
      year: 2026,
      month: 10,
      start: "2026-10-01",
    });
    expect(periodContaining("2026-10-01", 1).month).toBe(10);
    expect(periodContaining("2026-10-31", 1).month).toBe(10);
  });

  it("picks the period named for the previous month before the start day", () => {
    expect(periodContaining("2026-11-10", 25)).toMatchObject({
      year: 2026,
      month: 10,
      start: "2026-10-25",
      end: "2026-11-24",
    });
    expect(periodContaining("2026-10-24", 25)).toMatchObject({
      month: 9,
      start: "2026-09-25",
      end: "2026-10-24",
    });
  });

  it("includes the start day itself and the last day", () => {
    expect(periodContaining("2026-10-25", 25).month).toBe(10);
    expect(periodContaining("2026-11-24", 25).month).toBe(10);
    expect(periodContaining("2026-11-25", 25).month).toBe(11);
  });

  it("crosses the year boundary in both directions", () => {
    expect(periodContaining("2027-01-03", 25)).toMatchObject({
      year: 2026,
      month: 12,
      start: "2026-12-25",
      end: "2027-01-24",
    });
    expect(periodContaining("2026-12-31", 25)).toMatchObject({ year: 2026, month: 12 });
  });

  it("handles February dates", () => {
    expect(periodContaining("2028-02-29", 1).end).toBe("2028-02-29");
    expect(periodContaining("2027-03-01", 28)).toMatchObject({
      month: 2,
      start: "2027-02-28",
      end: "2027-03-27",
    });
  });

  it("places every day of a year in exactly one period", () => {
    for (const startDay of [1, 15, 25, 28]) {
      let day = Date.UTC(2027, 0, 1);
      while (day < Date.UTC(2028, 0, 1)) {
        const date = new Date(day).toISOString().slice(0, 10);
        const p = periodContaining(date, startDay);
        expect(date >= p.start && date <= p.end, `${date} start ${startDay}`).toBe(true);
        day += 86_400_000;
      }
    }
  });

  it("rejects malformed and impossible dates", () => {
    expect(() => periodContaining("2026-13-01", 1)).toThrow(RangeError);
    expect(() => periodContaining("2026-02-30", 1)).toThrow(RangeError);
    expect(() => periodContaining("21-10-2026", 1)).toThrow(RangeError);
  });
});

describe("shiftPeriod", () => {
  it("moves back and forward across year boundaries", () => {
    const jan = periodForMonth(2026, 1, 25);
    expect(shiftPeriod(jan, -1, 25)).toMatchObject({ year: 2025, month: 12, start: "2025-12-25" });
    expect(shiftPeriod(periodForMonth(2026, 12, 1), 1, 1)).toMatchObject({ year: 2027, month: 1 });
    expect(shiftPeriod(jan, -6, 25)).toMatchObject({ year: 2025, month: 7 });
  });

  it("is a no-op for zero", () => {
    const p = periodForMonth(2026, 10, 25);
    expect(shiftPeriod(p, 0, 25)).toEqual(p);
  });
});

describe("Dhaka dates", () => {
  it("uses the Bangladesh calendar day, which is UTC+6", () => {
    expect(todayInDhaka(new Date("2026-10-20T17:59:59Z"))).toBe("2026-10-20");
    expect(todayInDhaka(new Date("2026-10-20T18:00:00Z"))).toBe("2026-10-21");
  });

  it("treats only dates after today as future", () => {
    const now = new Date("2026-10-20T18:30:00Z"); // 21 Oct in Dhaka
    expect(isFutureDate("2026-10-21", now)).toBe(false);
    expect(isFutureDate("2026-10-22", now)).toBe(true);
    expect(isFutureDate("2026-10-20", now)).toBe(false);
  });
});
