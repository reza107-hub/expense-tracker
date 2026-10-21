import { and, eq, inArray, isNull } from "drizzle-orm";
import { entries } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import { getWalletWithBalance } from "@/lib/wallets/queries";
import { findReferenceErrors } from "./create";
import type { EntryChanges, EntryFieldErrors } from "./validation";

/** The entry types the entries page edits and deletes. Loan rows are managed with their loan. */
const PLAIN_TYPES = ["expense", "income", "transfer", "adjustment"] as const;

export type UpdateEntryResult =
  | { ok: true }
  | { ok: false; reason: "not-found" }
  | { ok: false; fieldErrors: EntryFieldErrors }
  | { ok: false; lowBalance: { walletName: string; balanceAfter: number } };

export type DeleteEntryResult = { ok: true } | { ok: false; reason: "not-found" };

/** Thrown inside the transaction to undo an edit that needs the user's confirmation. */
class LowBalanceSignal extends Error {
  constructor(readonly lowBalance: { walletName: string; balanceAfter: number }) {
    super("Low balance");
  }
}

const ownPlainEntry = (userId: string, entryId: number) =>
  and(
    eq(entries.id, entryId),
    eq(entries.userId, userId),
    isNull(entries.loanId),
    inArray(entries.type, [...PLAIN_TYPES]),
  );

/** The type of one of the user's own plain entries, or null if it is not theirs or is a loan row. */
export async function findPlainEntryType(
  db: AnyDb,
  userId: string,
  entryId: number,
): Promise<(typeof PLAIN_TYPES)[number] | null> {
  const [row] = await db
    .select({ type: entries.type })
    .from(entries)
    .where(ownPlainEntry(userId, entryId));
  return (row?.type as (typeof PLAIN_TYPES)[number] | undefined) ?? null;
}

/**
 * Edits one of the user's own expense, income, transfer or adjustment entries. Its type
 * stays the same. The wallets and category follow the same rules as a new entry, except
 * that an edit may keep a wallet or category the entry already uses even if it has since
 * been archived. Balances and reports are calculated, so they follow at once.
 *
 * An expense or transfer edit that would lower its source wallet below zero is undone
 * and reported until the user confirms, the same as when adding one.
 */
export async function updateEntry(
  db: AnyDb,
  userId: string,
  entryId: number,
  changes: EntryChanges,
  { confirmLowBalance = false }: { confirmLowBalance?: boolean } = {},
): Promise<UpdateEntryResult> {
  const [existing] = await db.select().from(entries).where(ownPlainEntry(userId, entryId));
  if (!existing) return { ok: false, reason: "not-found" };
  const { type } = existing;

  const fieldErrors = await findReferenceErrors(
    db,
    userId,
    {
      walletId: changes.walletId,
      toWalletId: type === "transfer" ? changes.toWalletId : undefined,
      categoryId: type === "expense" ? changes.categoryId : undefined,
    },
    {
      walletIds: [existing.walletId, ...(existing.toWalletId ? [existing.toWalletId] : [])],
      categoryId: existing.categoryId,
    },
  );
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  try {
    await db.transaction(async (tx) => {
      const before = await getWalletWithBalance(tx, userId, changes.walletId);
      await tx
        .update(entries)
        .set({
          walletId: changes.walletId,
          toWalletId: type === "transfer" ? changes.toWalletId : null,
          categoryId: type === "expense" ? changes.categoryId : null,
          amount: changes.amount,
          entryDate: changes.entryDate,
          note: changes.note,
        })
        .where(ownPlainEntry(userId, entryId));

      if (confirmLowBalance || (type !== "expense" && type !== "transfer")) return;
      const after = await getWalletWithBalance(tx, userId, changes.walletId);
      // Warn only when this edit is what pushes the wallet below zero or further down.
      if (before && after && after.balance < 0 && after.balance < before.balance) {
        throw new LowBalanceSignal({ walletName: after.name, balanceAfter: after.balance });
      }
    });
  } catch (error) {
    if (error instanceof LowBalanceSignal) return { ok: false, lowBalance: error.lowBalance };
    throw error;
  }
  return { ok: true };
}

/** Deletes one of the user's own expense, income, transfer or adjustment entries. */
export async function deleteEntry(
  db: AnyDb,
  userId: string,
  entryId: number,
): Promise<DeleteEntryResult> {
  const removed = await db
    .delete(entries)
    .where(ownPlainEntry(userId, entryId))
    .returning({ id: entries.id });
  return removed.length > 0 ? { ok: true } : { ok: false, reason: "not-found" };
}
