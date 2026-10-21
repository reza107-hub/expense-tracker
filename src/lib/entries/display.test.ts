import { describe, expect, it } from "vitest";
import { entryLabel, formatDate, monthName, walletEffect } from "./display";
import { entriesHref, monthKey, parseEntriesQuery } from "./query-params";

describe("parseEntriesQuery", () => {
  it("reads month, wallet and category", () => {
    expect(parseEntriesQuery({ month: "2026-10", wallet: "3", category: "7" })).toEqual({
      month: { year: 2026, month: 10 },
      walletId: 3,
      categoryId: 7,
    });
  });

  it("ignores anything that is not valid instead of failing", () => {
    expect(
      parseEntriesQuery({ month: "2026-13", wallet: "abc", category: "-1" }),
    ).toEqual({ month: null, walletId: undefined, categoryId: undefined });
    expect(parseEntriesQuery({ month: "2026-1", wallet: "1; drop table" }).month).toBeNull();
    expect(parseEntriesQuery({})).toEqual({ month: null });
  });

  it("uses the first value when a parameter is repeated", () => {
    expect(parseEntriesQuery({ wallet: ["4", "9"] }).walletId).toBe(4);
  });
});

describe("links", () => {
  it("builds a month key and an address that keeps the filters", () => {
    expect(monthKey({ year: 2026, month: 3 })).toBe("2026-03");
    expect(entriesHref({ year: 2026, month: 3 }, { walletId: 2 })).toBe("/entries?month=2026-03&wallet=2");
    expect(entriesHref({ year: 2026, month: 12 }, {})).toBe("/entries?month=2026-12");
  });
});

describe("display helpers", () => {
  it("formats dates and months", () => {
    expect(formatDate("2026-10-05")).toBe("5 Oct 2026");
    expect(monthName(2026, 2)).toBe("February 2026");
  });

  it("labels loan rows by direction and loan fees by their loan link", () => {
    const base = { loanId: null, loanDirection: null } as const;
    expect(entryLabel({ type: "expense", ...base })).toBe("Expense");
    expect(entryLabel({ type: "expense", loanId: 1, loanDirection: "borrowed" })).toBe("Loan interest or fee");
    expect(entryLabel({ type: "loan_principal", loanId: 1, loanDirection: "lent" })).toBe("Loan given");
    expect(entryLabel({ type: "loan_repayment", loanId: 1, loanDirection: "lent" })).toBe("Loan repaid to you");
  });

  it("signs the effect on the named wallet", () => {
    expect(walletEffect({ type: "expense", amount: 100, loanDirection: null })).toBe(-100);
    expect(walletEffect({ type: "income", amount: 100, loanDirection: null })).toBe(100);
    expect(walletEffect({ type: "adjustment", amount: -300, loanDirection: null })).toBe(-300);
    expect(walletEffect({ type: "transfer", amount: 100, loanDirection: null })).toBeNull();
    expect(walletEffect({ type: "loan_principal", amount: 100, loanDirection: "borrowed" })).toBe(100);
    expect(walletEffect({ type: "loan_principal", amount: 100, loanDirection: "lent" })).toBe(-100);
    expect(walletEffect({ type: "loan_repayment", amount: 100, loanDirection: "borrowed" })).toBe(-100);
    expect(walletEffect({ type: "loan_repayment", amount: 100, loanDirection: "lent" })).toBe(100);
  });
});
