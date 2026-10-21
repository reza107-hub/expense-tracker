import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { periodContaining, periodForMonth, todayInDhaka } from "@/lib/period";
import { getOverview } from "@/lib/reports/overview";
import { getMonthReport } from "@/lib/reports/queries";
import { getMonthStartDay } from "@/lib/settings/queries";

/** The home page numbers for the signed-in user. */
export async function getDashboard() {
  const { userId } = await requireUser();
  return getOverview(getDb(), userId, todayInDhaka());
}

/**
 * The monthly report for the signed-in user. With no month given it is the period that
 * contains today.
 */
export async function getReport(month: { year: number; month: number } | null) {
  const { userId } = await requireUser();
  const db = getDb();
  const today = todayInDhaka();
  const startDay = await getMonthStartDay(db, userId);
  const period = month
    ? periodForMonth(month.year, month.month, startDay)
    : periodContaining(today, startDay);
  return { startDay, today, report: await getMonthReport(db, userId, period, startDay) };
}
