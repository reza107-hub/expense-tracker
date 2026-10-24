import type { Language, Translate, TranslationKey } from "@/i18n";
import type { ListedEntry } from "./list";

/** The long name of a month (1 to 12) in the chosen language. */
export function monthLong(month: number, t: Translate): string {
  return t(`month.${month}` as TranslationKey);
}

/** The short name of a month (1 to 12) in the chosen language. */
export function monthShort(month: number, t: Translate): string {
  return t(`monthShort.${month}` as TranslationKey);
}

/** "October 2026". */
export function monthName(year: number, month: number, t: Translate): string {
  return `${monthLong(month, t)} ${year}`;
}

/** "5 Oct 2026" from "2026-10-05". Plain string work, so no time zone can shift it. */
export function formatDate(date: string, t: Translate): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${monthShort(month, t)} ${year}`;
}

/**
 * "20 Oct 2026, 3:42 pm" in Dhaka time. Bangla uses Bangla month names but keeps Latin
 * digits, the same as every other number in the app.
 */
export function formatDateTime(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(language === "bn" ? "bn-BD-u-nu-latn" : "en-GB", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

type Shape = Pick<ListedEntry, "type" | "loanId" | "loanDirection">;

/** A short name for what kind of entry this is. */
export function entryLabel({ type, loanId, loanDirection }: Shape, t: Translate): string {
  switch (type) {
    case "expense":
      return t(loanId ? "entryKind.loanFee" : "entryKind.expense");
    case "income":
      return t(loanId ? "entryKind.loanInterestReceived" : "entryKind.income");
    case "transfer":
      return t("entryKind.transfer");
    case "adjustment":
      return t("entryKind.adjustment");
    case "loan_principal":
      return t(loanDirection === "borrowed" ? "entryKind.loanReceived" : "entryKind.loanGiven");
    case "loan_repayment":
      return t(
        loanDirection === "borrowed" ? "entryKind.loanRepayment" : "entryKind.loanRepaidToYou",
      );
  }
}

/**
 * What the entry does to the wallet it names, in poisha: positive adds money, negative
 * takes it away. A transfer has two sides, so it has no single effect (null).
 */
export function walletEffect({
  type,
  amount,
  loanDirection,
}: Pick<ListedEntry, "type" | "amount" | "loanDirection">): number | null {
  switch (type) {
    case "income":
    case "adjustment":
      return amount;
    case "expense":
      return -amount;
    case "transfer":
      return null;
    case "loan_principal":
      return loanDirection === "borrowed" ? amount : -amount;
    case "loan_repayment":
      return loanDirection === "borrowed" ? -amount : amount;
  }
}
