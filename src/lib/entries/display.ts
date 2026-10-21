import type { ListedEntry } from "./list";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "October 2026". */
export function monthName(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

/** "5 Oct 2026" from "2026-10-05". Plain string work, so no time zone can shift it. */
export function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1].slice(0, 3)} ${year}`;
}

type Shape = Pick<ListedEntry, "type" | "loanId" | "loanDirection">;

/** A short name for what kind of entry this is. */
export function entryLabel({ type, loanId, loanDirection }: Shape): string {
  switch (type) {
    case "expense":
      return loanId ? "Loan interest or fee" : "Expense";
    case "income":
      return loanId ? "Loan interest received" : "Income";
    case "transfer":
      return "Transfer";
    case "adjustment":
      return "Adjustment";
    case "loan_principal":
      return loanDirection === "borrowed" ? "Loan received" : "Loan given";
    case "loan_repayment":
      return loanDirection === "borrowed" ? "Loan repayment" : "Loan repaid to you";
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
