import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { buildAdvicePayload, hashPayload } from "@/lib/advice/payload";
import { getSavedAdvice } from "@/lib/advice/service";
import { DAILY_LIMIT, remainingRequests } from "@/lib/advice/usage";
import { periodContaining, periodForMonth, todayInDhaka } from "@/lib/period";
import { getMonthStartDay } from "@/lib/settings/queries";

/**
 * What the advice section shows for one month of the signed-in user: the saved advice
 * (never a new request), whether the figures have changed since it was made, and how
 * many fresh requests are left today.
 */
export async function getAdviceView(month: { year: number; month: number } | null) {
  const { userId } = await requireUser();
  const db = getDb();
  const today = todayInDhaka();
  const startDay = await getMonthStartDay(db, userId);
  const period = month
    ? periodForMonth(month.year, month.month, startDay)
    : periodContaining(today, startDay);

  const [saved, payload, remaining] = await Promise.all([
    getSavedAdvice(db, userId, period),
    buildAdvicePayload(db, userId, period, startDay),
    remainingRequests(db, userId, today),
  ]);

  return {
    period,
    saved: saved
      ? { advice: saved.advice, createdAt: saved.createdAt.toISOString() }
      : null,
    // True when spending has changed since the saved advice was made.
    stale: saved ? saved.inputHash !== hashPayload(payload) : false,
    hasExpenses: payload.totalSpending > 0,
    remaining,
    dailyLimit: DAILY_LIMIT,
  };
}
