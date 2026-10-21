import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { wallets } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import { isUniqueViolation } from "@/lib/db-errors";
import { formatTaka } from "@/lib/money";
import { listWalletsWithBalance, type WalletWithBalance } from "./queries";
import type { WalletInput } from "./validation";

export type WalletResult =
  | { ok: true }
  | { ok: false; reason: "duplicate-name" | "not-found" }
  | { ok: false; reason: "balance-not-zero"; message: string };

/** Runs a write and turns the "name already used" database error into a result. */
async function guardDuplicateName(write: () => Promise<WalletResult>): Promise<WalletResult> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate-name" };
    throw error;
  }
}

/** A new wallet for the user. A name matching one of their active wallets is refused. */
export async function createWallet(
  db: AnyDb,
  userId: string,
  { name, openingBalance }: WalletInput,
): Promise<WalletResult> {
  return guardDuplicateName(async () => {
    await db.insert(wallets).values({ userId, name, openingBalance });
    return { ok: true };
  });
}

/** Changes the name and opening balance of one of the user's active wallets. */
export async function updateWallet(
  db: AnyDb,
  userId: string,
  walletId: number,
  { name, openingBalance }: WalletInput,
): Promise<WalletResult> {
  return guardDuplicateName(async () => {
    const changed = await db
      .update(wallets)
      .set({ name, openingBalance })
      .where(
        and(eq(wallets.id, walletId), eq(wallets.userId, userId), isNull(wallets.archivedAt)),
      )
      .returning({ id: wallets.id });
    return changed.length > 0 ? { ok: true } : { ok: false, reason: "not-found" };
  });
}

/**
 * Archives one of the user's active wallets, but only when its balance is exactly zero.
 * Past entries stay, so reports are unchanged.
 */
export async function archiveWallet(
  db: AnyDb,
  userId: string,
  walletId: number,
): Promise<WalletResult> {
  const active: WalletWithBalance[] = await listWalletsWithBalance(db, userId);
  const wallet = active.find((w) => w.id === walletId);
  if (!wallet) return { ok: false, reason: "not-found" };
  if (wallet.balance !== 0) {
    return {
      ok: false,
      reason: "balance-not-zero",
      message: `${wallet.name} still holds ${formatTaka(wallet.balance)}. Move or adjust the balance to zero first.`,
    };
  }

  const changed = await db
    .update(wallets)
    .set({ archivedAt: new Date() })
    .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId), isNull(wallets.archivedAt)))
    .returning({ id: wallets.id });
  return changed.length > 0 ? { ok: true } : { ok: false, reason: "not-found" };
}

/**
 * Brings an archived wallet back. If the user has since made an active wallet with the
 * same name, the database refuses and this reports a duplicate name.
 */
export async function restoreWallet(
  db: AnyDb,
  userId: string,
  walletId: number,
): Promise<WalletResult> {
  return guardDuplicateName(async () => {
    const changed = await db
      .update(wallets)
      .set({ archivedAt: null })
      .where(
        and(eq(wallets.id, walletId), eq(wallets.userId, userId), isNotNull(wallets.archivedAt)),
      )
      .returning({ id: wallets.id });
    return changed.length > 0 ? { ok: true } : { ok: false, reason: "not-found" };
  });
}
