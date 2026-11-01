import type { Translate } from "@/i18n";
import type { ListedEntry } from "./types";

type Shape = Pick<ListedEntry, "type" | "loanId" | "loanDirection">;

/** The short name of the kind of entry this is. */
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
      return t(loanDirection === "borrowed" ? "entryKind.loanRepayment" : "entryKind.loanRepaidToYou");
  }
}

/** The effect on the wallet: positive adds money, negative removes it, null for a transfer. */
export function signedAmount({ type, amount, loanDirection }: Pick<ListedEntry, "type" | "amount" | "loanDirection">): number | null {
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

/** Entries the Entries tab may edit or delete. Loan rows are managed with their loan. */
export const isPlainEntry = (entry: Pick<ListedEntry, "type" | "loanId">) =>
  entry.loanId === null && ["expense", "income", "transfer", "adjustment"].includes(entry.type);
