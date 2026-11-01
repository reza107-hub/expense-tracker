/** Shapes the server sends (see src/lib/api/routes.ts in the web app). Money is whole poisha. */

export type Period = { year: number; month: number; start: string; end: string };

export type Wallet = {
  id: number;
  name: string;
  openingBalance: number;
  archivedAt: string | null;
  balance: number;
};

export type Category = { id: number; name: string; isReserved: boolean; archivedAt: string | null };

export type EntryType = "expense" | "income" | "transfer" | "adjustment" | "loan_principal" | "loan_repayment";

export type ListedEntry = {
  id: number;
  type: EntryType;
  amount: number;
  entryDate: string;
  note: string | null;
  walletId: number;
  walletName: string;
  toWalletId: number | null;
  toWalletName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  loanId: number | null;
  loanDirection: "borrowed" | "lent" | null;
  loanCounterparty: string | null;
};

export type SpendingAlert = { level: "warning" | "exceeded"; spent: number; limit: number; percent: number; over: number };
export type LoanAlert = {
  loanId: number;
  direction: "borrowed" | "lent";
  counterparty: string;
  outstanding: number;
  dueDate: string;
  daysUntil: number;
};
export type Alerts = { spending: SpendingAlert | null; loans: LoanAlert[] };

export type Overview = {
  wallets: Wallet[];
  totalBalance: number;
  owe: number;
  owed: number;
  netPosition: number;
  period: Period;
  monthSpending: number;
};

export type Loan = {
  id: number;
  direction: "borrowed" | "lent";
  counterparty: string;
  principal: number;
  dueDate: string | null;
  note: string | null;
  repaid: number;
  outstanding: number;
  status: "open" | "closed";
  startDate: string | null;
};

export type Repayment = {
  id: number;
  loanId: number;
  walletId: number;
  walletName: string;
  entryDate: string;
  principal: number;
  fee: number;
  note: string | null;
};

export type CategorySpend = {
  categoryId: number;
  name: string;
  total: number;
  share: number;
  previous: number;
  change: number;
  changePercent: number | null;
};

export type MonthReport = {
  period: Period;
  previousPeriod: Period;
  total: number;
  previousTotal: number;
  change: number;
  changePercent: number | null;
  byCategory: CategorySpend[];
  byWallet: { walletId: number; name: string; total: number }[];
  trend: { period: Period; total: number }[];
  hasEntries: boolean;
};

export type AdviceView = {
  period: Period;
  saved: { advice: { summary: string; suggestions: { category: string; tip: string; saving: number }[] }; createdAt: string } | null;
  stale: boolean;
  hasExpenses: boolean;
  remaining: number;
  dailyLimit: number;
};
