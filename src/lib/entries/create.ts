import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { categories, entries, wallets } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import { formatTaka } from "@/lib/money";
import { getWalletWithBalance } from "@/lib/wallets/queries";
import type { EntryFieldErrors, NewEntry } from "./validation";

export type CreateEntryResult =
  | { ok: true; id: number }
  | { ok: false; fieldErrors: EntryFieldErrors }
  /** Nothing was saved: the entry would take a wallet below zero and was not confirmed. */
  | { ok: false; lowBalance: { walletName: string; balanceAfter: number } };

export type CreateEntryOptions = {
  /** The user has seen the low-balance warning and still wants to save. */
  confirmLowBalance?: boolean;
};

/** Charges are saved as expenses in this category. It is created for the user on first use. */
export const CHARGES_CATEGORY = "Transaction charges";

const NOT_YOURS_WALLET = "Choose one of your wallets.";

/** The ids, out of those asked for, that are active wallets of this user. */
async function ownActiveWalletIds(db: AnyDb, userId: string, ids: number[]): Promise<Set<number>> {
  const rows = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.userId, userId), inArray(wallets.id, ids), isNull(wallets.archivedAt)));
  return new Set(rows.map((row) => row.id));
}

/** True when the category is an active, non-reserved category of this user. */
async function isOwnSelectableCategory(
  db: AnyDb,
  userId: string,
  categoryId: number,
): Promise<boolean> {
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.id, categoryId),
        eq(categories.isReserved, false),
        isNull(categories.archivedAt),
      ),
    );
  return rows.length > 0;
}

/** The id of the user's charges category, creating it the first time a charge is saved. */
async function chargesCategoryId(db: AnyDb, userId: string): Promise<number> {
  const where = and(eq(categories.userId, userId), sql`lower(${categories.name}) = ${CHARGES_CATEGORY.toLowerCase()}`);
  const [existing] = await db.select({ id: categories.id }).from(categories).where(where);
  if (existing) return existing.id;
  await db.insert(categories).values({ userId, name: CHARGES_CATEGORY }).onConflictDoNothing();
  const [created] = await db.select({ id: categories.id }).from(categories).where(where);
  return created.id;
}

/**
 * The field errors for an entry whose wallets or category are not usable. Wallets must
 * be the user's own and active, and a category must be the user's own, active and not
 * the reserved loan one. `keep` lists ids an existing entry already uses: an edit may
 * leave those alone even if they have since been archived.
 */
export async function findReferenceErrors(
  db: AnyDb,
  userId: string,
  refs: { walletId: number; toWalletId?: number; categoryId?: number },
  keep: { walletIds?: number[]; categoryId?: number | null } = {},
): Promise<EntryFieldErrors> {
  const fieldErrors: EntryFieldErrors = {};
  const walletIds = [refs.walletId, ...(refs.toWalletId === undefined ? [] : [refs.toWalletId])];
  const owned = await ownActiveWalletIds(db, userId, walletIds);
  const walletOk = (id: number) => owned.has(id) || (keep.walletIds ?? []).includes(id);

  if (!walletOk(refs.walletId)) fieldErrors.walletId = NOT_YOURS_WALLET;
  if (refs.toWalletId !== undefined && !walletOk(refs.toWalletId)) {
    fieldErrors.toWalletId = NOT_YOURS_WALLET;
  }
  if (
    refs.categoryId !== undefined &&
    refs.categoryId !== keep.categoryId &&
    !(await isOwnSelectableCategory(db, userId, refs.categoryId))
  ) {
    fieldErrors.categoryId = "Choose one of your categories.";
  }
  return fieldErrors;
}

/**
 * Saves the entry row and, when there is a charge, a second expense row on the same
 * wallet and date, in one transaction. The charge lowers the wallet like any expense.
 */
async function insertWithCharge(
  db: AnyDb,
  userId: string,
  values: typeof entries.$inferInsert,
  charge: number,
): Promise<{ id: number }> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(entries).values(values).returning({ id: entries.id });
    if (charge > 0) {
      await tx.insert(entries).values({
        userId,
        type: "expense",
        walletId: values.walletId,
        categoryId: await chargesCategoryId(tx, userId),
        amount: charge,
        entryDate: values.entryDate,
        note: values.note ? `Charge: ${values.note}` : "Charge",
      });
    }
    return row;
  });
}

/**
 * Saves one expense, income, transfer or balance adjustment for the user.
 *
 * An expense or transfer that would take its source wallet below zero is not saved
 * until the user confirms. Saving then is allowed: a wallet may go negative.
 *
 * The wallets and category must be the user's own and active. A wallet or category
 * that belongs to someone else, is archived, or does not exist is refused with a field
 * error and nothing is written. The database enforces the same rule with composite
 * foreign keys, so a mistake here still cannot link two users' data.
 */
export async function createEntry(
  db: AnyDb,
  userId: string,
  entry: NewEntry,
  { confirmLowBalance = false }: CreateEntryOptions = {},
): Promise<CreateEntryResult> {
  const fieldErrors = await findReferenceErrors(db, userId, {
    walletId: entry.walletId,
    toWalletId: entry.type === "transfer" ? entry.toWalletId : undefined,
    categoryId: entry.type === "expense" ? entry.categoryId : undefined,
  });
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  if (!confirmLowBalance && (entry.type === "expense" || entry.type === "transfer")) {
    const source = await getWalletWithBalance(db, userId, entry.walletId);
    const balanceAfter = (source?.balance ?? 0) - entry.amount - (entry.charge ?? 0);
    if (source && balanceAfter < 0) {
      return { ok: false, lowBalance: { walletName: source.name, balanceAfter } };
    }
  }

  const base = { userId, entryDate: entry.entryDate, note: entry.note, walletId: entry.walletId };

  switch (entry.type) {
    case "expense":
    case "income": {
      const row = await insertWithCharge(
        db,
        userId,
        {
          ...base,
          type: entry.type,
          amount: entry.amount,
          categoryId: entry.type === "expense" ? entry.categoryId : null,
        },
        entry.type === "expense" ? (entry.charge ?? 0) : 0,
      );
      return { ok: true, id: row.id };
    }
    case "transfer": {
      const row = await insertWithCharge(
        db,
        userId,
        { ...base, type: "transfer", toWalletId: entry.toWalletId, amount: entry.amount },
        entry.charge ?? 0,
      );
      return { ok: true, id: row.id };
    }
    case "adjustment": {
      // The row stores only the difference, so it changes nothing but this wallet.
      const wallet = await getWalletWithBalance(db, userId, entry.walletId);
      const difference = entry.newBalance - (wallet?.balance ?? 0);
      if (difference === 0) {
        return {
          ok: false,
          fieldErrors: { newBalance: `The balance is already ${formatTaka(entry.newBalance)}.` },
        };
      }
      const [row] = await db
        .insert(entries)
        .values({ ...base, type: "adjustment", amount: difference })
        .returning({ id: entries.id });
      return { ok: true, id: row.id };
    }
  }
}
