import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import {
  getWalletWithBalance,
  listWalletsWithBalance,
  totalBalance,
} from "@/lib/wallets/queries";

/** The signed-in user's active wallets with calculated balances. */
export async function listWallets() {
  const { userId } = await requireUser();
  return listWalletsWithBalance(getDb(), userId);
}

/** The signed-in user's archived wallets with calculated balances. */
export async function listArchivedWallets() {
  const { userId } = await requireUser();
  return listWalletsWithBalance(getDb(), userId, { archived: true });
}

/** One of the signed-in user's wallets, or null when it is not theirs. */
export async function getWallet(walletId: number) {
  const { userId } = await requireUser();
  return getWalletWithBalance(getDb(), userId, walletId);
}

/** The total of the signed-in user's active wallet balances, in poisha. */
export async function getTotalBalance() {
  const { userId } = await requireUser();
  return totalBalance(getDb(), userId);
}
