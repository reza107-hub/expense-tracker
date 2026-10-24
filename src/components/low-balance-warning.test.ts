import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { bn } from "@/i18n/bn";
import { renderInLanguage } from "@/test/render-in-language";

vi.mock("@/lib/entries/validation", () => ({ CONFIRM_LOW_BALANCE_FIELD: "confirmLowBalance" }));
const { default: LowBalanceWarning } = await import(
  "@/app/(app)/entries/low-balance-warning"
);

const render = (language: "en" | "bn") =>
  renderInLanguage(
    language,
    createElement(LowBalanceWarning, {
      walletName: "bKash",
      balanceAfter: -150_000,
      pending: false,
      onCancel: () => {},
    }),
  );

describe("LowBalanceWarning", () => {
  it("names the wallet and shows the amount left in bold, in English", () => {
    const html = render("en");
    expect(html).toContain("bKash does not have enough money for this.");
    expect(html).toContain("<strong>৳ -1,500</strong>");
    expect(html).toContain("Save it anyway?");
    expect(html).toContain(">Save anyway<");
  });

  it("does the same in Bangla, with the amount still in bold and no stray markers", () => {
    const html = render("bn");
    expect(html).toContain("bKash");
    expect(html).toContain("<strong>৳ -1,500</strong>");
    expect(html).toContain(`>${bn["entries.saveAnyway"]}<`);
    expect(html).not.toMatch(/\u0000|\{wallet\}|\{amount\}/);
    expect(html).toMatch(/[ঀ-৿]/);
  });
});
