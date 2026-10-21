import { describe, expect, it } from "vitest";
import { MAX_POISHA, formatTaka, parseTaka } from "./money";

describe("parseTaka", () => {
  it("parses whole and decimal amounts without float error", () => {
    expect(parseTaka("450")).toBe(45000);
    expect(parseTaka("19.99")).toBe(1999);
    // 1.15 * 100 is 114.99999999999999 in floating point
    expect(parseTaka("1.15")).toBe(115);
    expect(parseTaka("0.29")).toBe(29);
  });

  it("pads a single decimal digit", () => {
    expect(parseTaka("5.5")).toBe(550);
    expect(parseTaka("0.1")).toBe(10);
  });

  it("accepts standard and lakh comma grouping and trims spaces", () => {
    expect(parseTaka("1,250.50")).toBe(125050);
    expect(parseTaka("  48,200 ")).toBe(4820000);
    expect(parseTaka("1,234,567")).toBe(123456700);
    expect(parseTaka("1,00,000")).toBe(10000000);
    expect(parseTaka("12,34,567.8")).toBe(123456780);
  });

  it("returns zero for zero", () => {
    expect(parseTaka("0")).toBe(0);
    expect(parseTaka("0.00")).toBe(0);
  });

  it("rejects negatives unless allowed", () => {
    expect(parseTaka("-5")).toBeNull();
    expect(parseTaka("-5", { allowNegative: true })).toBe(-500);
    expect(parseTaka("-0", { allowNegative: true })).toBe(0);
  });

  it("rejects three or more decimals instead of rounding", () => {
    expect(parseTaka("10.005")).toBeNull();
    expect(parseTaka("10.999")).toBeNull();
  });

  it("rejects text, empty input and malformed numbers", () => {
    for (const bad of ["", " ", "abc", "12abc", "1.", ".5", "1..2", "1e5", "1,2", "1,2345", "1,00,00", "--5", "৳500"]) {
      expect(parseTaka(bad), bad).toBeNull();
    }
  });

  it("handles large values up to the limit and rejects above it", () => {
    expect(parseTaka("10000000000")).toBe(MAX_POISHA);
    expect(parseTaka("10000000000.01")).toBeNull();
    expect(parseTaka("99999999999999999999")).toBeNull();
  });
});

describe("formatTaka", () => {
  it("formats with Bangladeshi lakh grouping", () => {
    expect(formatTaka(0)).toBe("0");
    expect(formatTaka(99900)).toBe("999");
    expect(formatTaka(100000)).toBe("1,000");
    expect(formatTaka(4820000)).toBe("48,200");
    expect(formatTaka(10000000)).toBe("1,00,000");
    expect(formatTaka(1234567800)).toBe("1,23,45,678");
  });

  it("shows decimals only when needed", () => {
    expect(formatTaka(125050)).toBe("1,250.50");
    expect(formatTaka(5)).toBe("0.05");
    expect(formatTaka(100)).toBe("1");
  });

  it("formats negatives", () => {
    expect(formatTaka(-200000)).toBe("-2,000");
    expect(formatTaka(-5)).toBe("-0.05");
  });

  it("formats the largest amount", () => {
    expect(formatTaka(MAX_POISHA)).toBe("10,00,00,00,000");
  });

  it("round-trips with parseTaka", () => {
    for (const poisha of [0, 1, 5, 99, 100, 125050, 4820000, 10000000, 1234567800, MAX_POISHA]) {
      expect(parseTaka(formatTaka(poisha)), String(poisha)).toBe(poisha);
    }
    expect(parseTaka(formatTaka(-200000), { allowNegative: true })).toBe(-200000);
  });

  it("rejects non-integer poisha", () => {
    expect(() => formatTaka(10.5)).toThrow(RangeError);
  });
});
