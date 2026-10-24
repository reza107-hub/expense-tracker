import { describe, expect, it } from "vitest";
import { createTranslator } from "@/i18n";
import { bn } from "@/i18n/bn";
import { en } from "@/i18n/en";
import type { LoanAlert } from "./compute";
import { loanAlertText } from "./text";

const tEn = createTranslator(en);
const tBn = createTranslator(bn);

const alert = (over: Partial<LoanAlert>): LoanAlert => ({
  loanId: 1,
  direction: "borrowed",
  counterparty: "Rahim bhai",
  outstanding: 4_000_000,
  dueDate: "2026-10-25",
  daysUntil: 5,
  ...over,
});

describe("loanAlertText", () => {
  it("borrowed loan due in 5 days names who is owed, the amount and the date", () => {
    expect(loanAlertText(alert({}), tEn)).toBe(
      "You owe ৳ 40,000 to Rahim bhai. It is due in 5 days (25 Oct 2026).",
    );
  });

  it("lent loan reads the other way round", () => {
    expect(loanAlertText(alert({ direction: "lent", counterparty: "Karim" }), tEn)).toBe(
      "Karim owes you ৳ 40,000. It is due in 5 days (25 Oct 2026).",
    );
  });

  it("says day and days correctly for today, tomorrow and overdue", () => {
    expect(loanAlertText(alert({ daysUntil: 0 }), tEn)).toContain("due today");
    expect(loanAlertText(alert({ daysUntil: 1 }), tEn)).toContain("due in 1 day (");
    expect(loanAlertText(alert({ daysUntil: -1 }), tEn)).toContain("due 1 day ago");
    expect(loanAlertText(alert({ daysUntil: -7 }), tEn)).toContain("due 7 days ago");
  });

  it("every case reads in Bangla with the name, the amount and no left-over markers", () => {
    for (const direction of ["borrowed", "lent"] as const) {
      for (const daysUntil of [-7, -1, 0, 1, 7]) {
        const text = loanAlertText(alert({ direction, daysUntil }), tBn);
        expect(text).toMatch(/[ঀ-৿]/);
        expect(text).toContain("Rahim bhai");
        expect(text).toContain("40,000");
        expect(text).not.toMatch(/[{}]/);
      }
    }
  });
});
