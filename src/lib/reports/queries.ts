import { and, eq, gte, lte, sql } from "drizzle-orm";
import { categories, entries, wallets } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import { shiftPeriod, type Period } from "@/lib/period";

export type CategorySpend = {
  categoryId: number;
  name: string;
  /** Spending this period, in poisha. */
  total: number;
  /** Share of the period's total spending, 0 to 100. Zero when nothing was spent. */
  share: number;
  /** Spending in the previous period, in poisha. */
  previous: number;
  /** This period minus the previous one, in poisha. */
  change: number;
  /** Change as a percentage of the previous period, or null when it spent nothing. */
  changePercent: number | null;
};

export type WalletSpend = { walletId: number; name: string; total: number };

export type MonthReport = {
  period: Period;
  previousPeriod: Period;
  /** Sum of the user's expense entries in the period, in poisha. */
  total: number;
  previousTotal: number;
  change: number;
  changePercent: number | null;
  byCategory: CategorySpend[];
  byWallet: WalletSpend[];
  /** The last six periods, oldest first, ending with this one. */
  trend: { period: Period; total: number }[];
  /** False when the user recorded nothing at all of any kind in the period. */
  hasEntries: boolean;
};

/** A whole-number percentage, or null when there is nothing to compare with. */
export function percentOf(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part * 100) / whole);
}

const inPeriod = (userId: string, period: Period) =>
  and(
    eq(entries.userId, userId),
    gte(entries.entryDate, period.start),
    lte(entries.entryDate, period.end),
  );

/**
 * Spending per category for one period. Only expense entries count, so income,
 * transfers, adjustments and loan principal never appear. Interest and fees on a
 * borrowed loan are expenses and are included.
 */
async function categoryTotals(db: AnyDb, userId: string, period: Period) {
  return db
    .select({
      categoryId: categories.id,
      name: categories.name,
      total: sql<number>`sum(${entries.amount})`.mapWith(Number),
    })
    .from(entries)
    .innerJoin(
      categories,
      and(eq(categories.userId, entries.userId), eq(categories.id, entries.categoryId)),
    )
    .where(and(inPeriod(userId, period), eq(entries.type, "expense")))
    .groupBy(categories.id, categories.name);
}

async function walletTotals(db: AnyDb, userId: string, period: Period): Promise<WalletSpend[]> {
  const rows = await db
    .select({
      walletId: wallets.id,
      name: wallets.name,
      total: sql<number>`sum(${entries.amount})`.mapWith(Number),
    })
    .from(entries)
    .innerJoin(wallets, and(eq(wallets.userId, entries.userId), eq(wallets.id, entries.walletId)))
    .where(and(inPeriod(userId, period), eq(entries.type, "expense")))
    .groupBy(wallets.id, wallets.name);
  return rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/** Total spending for each of the given periods (oldest first), from one query. */
async function totalsByPeriod(db: AnyDb, userId: string, periods: Period[]): Promise<number[]> {
  const rows = await db
    .select({ entryDate: entries.entryDate, amount: entries.amount })
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        eq(entries.type, "expense"),
        gte(entries.entryDate, periods[0].start),
        lte(entries.entryDate, periods[periods.length - 1].end),
      ),
    );
  return periods.map((period) =>
    rows
      .filter((row) => row.entryDate >= period.start && row.entryDate <= period.end)
      .reduce((sum, row) => sum + row.amount, 0),
  );
}

/** Spending for one period, in poisha. */
export async function totalSpending(db: AnyDb, userId: string, period: Period): Promise<number> {
  return (await totalsByPeriod(db, userId, [period]))[0];
}

/**
 * The monthly report for one user: total spending, breakdowns by category and wallet,
 * the comparison with the previous period and a six-period trend. Every figure uses
 * only this user's entries, and the periods come from the user's month start day.
 */
export async function getMonthReport(
  db: AnyDb,
  userId: string,
  period: Period,
  startDay: number,
): Promise<MonthReport> {
  const previousPeriod = shiftPeriod(period, -1, startDay);
  const trendPeriods = [-5, -4, -3, -2, -1, 0].map((delta) => shiftPeriod(period, delta, startDay));

  const [current, previous, byWallet, trendTotals, [count]] = await Promise.all([
    categoryTotals(db, userId, period),
    categoryTotals(db, userId, previousPeriod),
    walletTotals(db, userId, period),
    totalsByPeriod(db, userId, trendPeriods),
    db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(entries).where(inPeriod(userId, period)),
  ]);

  const total = trendTotals[5];
  const previousTotal = trendTotals[4];
  const previousById = new Map(previous.map((row) => [row.categoryId, row]));
  const currentById = new Map(current.map((row) => [row.categoryId, row]));

  // Categories that were spent in either period, so a category that dropped to zero shows.
  const ids = new Set([...currentById.keys(), ...previousById.keys()]);
  const byCategory: CategorySpend[] = [...ids].map((categoryId) => {
    const now = currentById.get(categoryId);
    const before = previousById.get(categoryId);
    const amount = now?.total ?? 0;
    const prior = before?.total ?? 0;
    return {
      categoryId,
      name: (now ?? before)!.name,
      total: amount,
      share: percentOf(amount, total) ?? 0,
      previous: prior,
      change: amount - prior,
      changePercent: percentOf(amount - prior, prior),
    };
  });
  byCategory.sort((a, b) => b.total - a.total || b.previous - a.previous || a.name.localeCompare(b.name));

  return {
    period,
    previousPeriod,
    total,
    previousTotal,
    change: total - previousTotal,
    changePercent: percentOf(total - previousTotal, previousTotal),
    byCategory,
    byWallet,
    trend: trendPeriods.map((p, i) => ({ period: p, total: trendTotals[i] })),
    hasEntries: count.n > 0,
  };
}
