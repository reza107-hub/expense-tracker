import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { listCategories } from "@/lib/categories/queries";
import { listEntries } from "@/lib/entries/list";
import type { EntriesQuery } from "@/lib/entries/query-params";
import { periodContaining, periodForMonth, todayInDhaka } from "@/lib/period";
import { getMonthStartDay } from "@/lib/settings/queries";
import { listWalletsWithBalance } from "@/lib/wallets/queries";

/**
 * Everything the entries list needs for the signed-in user: the chosen period (the one
 * containing today unless a month is given), its entries, and every wallet and category
 * they own, including archived ones, so old entries can still be filtered.
 */
export async function getEntryList(query: EntriesQuery) {
  const { userId } = await requireUser();
  const db = getDb();
  const today = todayInDhaka();

  const startDay = await getMonthStartDay(db, userId);
  const period = query.month
    ? periodForMonth(query.month.year, query.month.month, startDay)
    : periodContaining(today, startDay);

  const [rows, activeWallets, archivedWallets, activeCategories, archivedCategories] =
    await Promise.all([
      listEntries(db, userId, period, query),
      listWalletsWithBalance(db, userId),
      listWalletsWithBalance(db, userId, { archived: true }),
      listCategories(db, userId),
      listCategories(db, userId, { archived: true }),
    ]);

  return {
    period,
    today,
    startDay,
    entries: rows,
    wallets: [
      ...activeWallets.map(({ id, name }) => ({ id, name, archived: false })),
      ...archivedWallets.map(({ id, name }) => ({ id, name, archived: true })),
    ],
    categories: [
      ...activeCategories.map(({ id, name, isReserved }) => ({ id, name, archived: false, reserved: isReserved })),
      ...archivedCategories.map(({ id, name, isReserved }) => ({ id, name, archived: true, reserved: isReserved })),
    ],
  };
}
