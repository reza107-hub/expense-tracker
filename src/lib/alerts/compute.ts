import type { AnyDb } from "@/db/types";
import { listLoans, type LoanSummary } from "@/lib/loans/queries";
import { periodContaining } from "@/lib/period";
import { totalSpending } from "@/lib/reports/queries";
import { getAlertSettings, getMonthStartDay } from "@/lib/settings/queries";

/** A loan alert shows for an open loan due within this many days, or already overdue. */
export const LOAN_DUE_DAYS = 7;

export type SpendingAlert = {
  level: "warning" | "exceeded";
  /** Spending this month across all wallets, in poisha. */
  spent: number;
  limit: number;
  /** Whole percent of the limit used. */
  percent: number;
  /** How far over the limit, in poisha. Zero unless exceeded. */
  over: number;
};

export type LoanAlert = {
  loanId: number;
  direction: "borrowed" | "lent";
  counterparty: string;
  outstanding: number;
  dueDate: string;
  /** Days from today to the due date. Negative when overdue, zero when due today. */
  daysUntil: number;
};

export type Alerts = { spending: SpendingAlert | null; loans: LoanAlert[] };

/**
 * The spending alert for a month: a warning once spending reaches 80% of the limit, and
 * exceeded once it is above 100%. Exactly at the limit is still a warning.
 */
export function spendingAlert(spent: number, limit: number): SpendingAlert | null {
  if (limit <= 0 || spent * 100 < limit * 80) return null;
  const exceeded = spent > limit;
  return {
    level: exceeded ? "exceeded" : "warning",
    spent,
    limit,
    percent: Math.floor((spent * 100) / limit),
    over: exceeded ? spent - limit : 0,
  };
}

/** Whole days from `from` to `to`, both "YYYY-MM-DD". Plain UTC maths, no time zone. */
export function daysBetween(from: string, to: string): number {
  const day = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return day(to) - day(from);
}

/** Open loans that are overdue or due within a week, soonest first. Closed loans never alert. */
export function loanAlerts(loans: LoanSummary[], today: string): LoanAlert[] {
  return loans
    .flatMap((loan) => {
      if (loan.status !== "open" || loan.dueDate === null) return [];
      const daysUntil = daysBetween(today, loan.dueDate);
      if (daysUntil > LOAN_DUE_DAYS) return [];
      return [
        {
          loanId: loan.id,
          direction: loan.direction,
          counterparty: loan.counterparty,
          outstanding: loan.outstanding,
          dueDate: loan.dueDate,
          daysUntil,
        },
      ];
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * The alerts to show this user right now. With alerts off there are none at all. They
 * are worked out from the current data each time, so saving an entry raises one and
 * deleting it clears it, and a new reporting month starts from zero spending.
 */
export async function getAlerts(db: AnyDb, userId: string, today: string): Promise<Alerts> {
  const { alertsEnabled, monthlyLimit } = await getAlertSettings(db, userId);
  if (!alertsEnabled) return { spending: null, loans: [] };

  const startDay = await getMonthStartDay(db, userId);
  const [spent, loans] = await Promise.all([
    monthlyLimit === null
      ? Promise.resolve(0)
      : totalSpending(db, userId, periodContaining(today, startDay)),
    listLoans(db, userId),
  ]);

  return {
    spending: monthlyLimit === null ? null : spendingAlert(spent, monthlyLimit),
    loans: loanAlerts(loans, today),
  };
}
