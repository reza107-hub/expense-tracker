import { createHash } from "node:crypto";
import type { AnyDb } from "@/db/types";
import { LOAN_FEES_CATEGORY } from "@/db/seed";
import { loanTotals } from "@/lib/loans/queries";
import type { Period } from "@/lib/period";
import { getMonthReport } from "@/lib/reports/queries";
import { getAlertSettings } from "@/lib/settings/queries";

/**
 * Everything the model is told. It holds figures only, in taka: no notes, no wallet or
 * counterparty names, no entries, no email and no id. Category names are included
 * because the advice has to point at a category.
 */
export type AdvicePayload = {
  totalSpending: number;
  previousMonthTotalSpending: number;
  /** The monthly limit in taka, or null when none is set. */
  monthlyLimit: number | null;
  /** What the user owes on open loans, in taka. */
  totalOwed: number;
  /** Interest and fees paid on borrowed loans this month, in taka. */
  loanInterestAndFees: number;
  /** Spending per category, largest first. Loan interest and fees are listed separately. */
  categories: { category: string; spent: number; previousMonthSpent: number }[];
};

const taka = (poisha: number) => poisha / 100;

/**
 * Builds the figures for one month from the signed-in user's own data. The sums come
 * from the database, never from the model.
 */
export async function buildAdvicePayload(
  db: AnyDb,
  userId: string,
  period: Period,
  startDay: number,
): Promise<AdvicePayload> {
  const [report, settings, owed] = await Promise.all([
    getMonthReport(db, userId, period, startDay),
    getAlertSettings(db, userId),
    loanTotals(db, userId),
  ]);

  const fees = report.byCategory.find((c) => c.name === LOAN_FEES_CATEGORY);
  const categories = report.byCategory
    .filter((c) => c.name !== LOAN_FEES_CATEGORY && (c.total > 0 || c.previous > 0))
    .map((c) => ({
      category: c.name,
      spent: taka(c.total),
      previousMonthSpent: taka(c.previous),
    }));

  return {
    totalSpending: taka(report.total),
    previousMonthTotalSpending: taka(report.previousTotal),
    monthlyLimit: settings.monthlyLimit === null ? null : taka(settings.monthlyLimit),
    totalOwed: taka(owed.owe),
    loanInterestAndFees: taka(fees?.total ?? 0),
    categories,
  };
}

/** A fingerprint of the figures. The same figures always give the same hash. */
export function hashPayload(payload: AdvicePayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
