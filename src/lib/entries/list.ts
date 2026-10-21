import { and, between, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { categories, entries, loans, wallets } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import type { Period } from "@/lib/period";

export type ListedEntry = {
  id: number;
  type: (typeof entries.$inferSelect)["type"];
  /** Whole poisha. Positive except for an adjustment that lowered the balance. */
  amount: number;
  entryDate: string;
  note: string | null;
  walletId: number;
  walletName: string;
  /** Set for transfers. */
  toWalletId: number | null;
  toWalletName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  loanId: number | null;
  loanDirection: "borrowed" | "lent" | null;
  loanCounterparty: string | null;
};

export type EntryFilters = {
  walletId?: number;
  categoryId?: number;
};

/**
 * The user's entries for one reporting period, newest first, with the names to show.
 * A wallet filter keeps every entry that touches the wallet, so a transfer appears for
 * both its source and its destination. Only this user's rows are ever read.
 */
export async function listEntries(
  db: AnyDb,
  userId: string,
  period: Pick<Period, "start" | "end">,
  { walletId, categoryId }: EntryFilters = {},
): Promise<ListedEntry[]> {
  const toWallet = alias(wallets, "to_wallet");

  return db
    .select({
      id: entries.id,
      type: entries.type,
      amount: entries.amount,
      entryDate: entries.entryDate,
      note: entries.note,
      walletId: entries.walletId,
      walletName: wallets.name,
      toWalletId: entries.toWalletId,
      toWalletName: toWallet.name,
      categoryId: entries.categoryId,
      categoryName: categories.name,
      loanId: entries.loanId,
      loanDirection: loans.direction,
      loanCounterparty: loans.counterparty,
    })
    .from(entries)
    .innerJoin(wallets, and(eq(wallets.userId, entries.userId), eq(wallets.id, entries.walletId)))
    .leftJoin(
      toWallet,
      and(eq(toWallet.userId, entries.userId), eq(toWallet.id, entries.toWalletId)),
    )
    .leftJoin(
      categories,
      and(eq(categories.userId, entries.userId), eq(categories.id, entries.categoryId)),
    )
    .leftJoin(loans, and(eq(loans.userId, entries.userId), eq(loans.id, entries.loanId)))
    .where(
      and(
        eq(entries.userId, userId),
        between(entries.entryDate, period.start, period.end),
        walletId === undefined
          ? undefined
          : or(eq(entries.walletId, walletId), eq(entries.toWalletId, walletId)),
        categoryId === undefined ? undefined : eq(entries.categoryId, categoryId),
      ),
    )
    .orderBy(desc(entries.entryDate), desc(entries.createdAt), desc(entries.id));
}
