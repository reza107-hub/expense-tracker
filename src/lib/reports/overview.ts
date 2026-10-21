import type { AnyDb } from "@/db/types";
import { loanTotals } from "@/lib/loans/queries";
import { periodContaining, type Period } from "@/lib/period";
import { getMonthStartDay } from "@/lib/settings/queries";
import { listWalletsWithBalance, type WalletWithBalance } from "@/lib/wallets/queries";
import { totalSpending } from "./queries";

export type Overview = {
  wallets: WalletWithBalance[];
  /** Sum of the active wallet balances, in poisha. */
  totalBalance: number;
  /** What the user owes, from open loans, in poisha. */
  owe: number;
  /** What others owe the user, from open loans, in poisha. */
  owed: number;
  /** Total balance plus money owed to the user minus money the user owes. */
  netPosition: number;
  /** The period that contains today, and its spending. */
  period: Period;
  monthSpending: number;
};

/** The numbers on the home page, for one user. */
export async function getOverview(db: AnyDb, userId: string, today: string): Promise<Overview> {
  const startDay = await getMonthStartDay(db, userId);
  const period = periodContaining(today, startDay);

  const [wallets, totals, monthSpending] = await Promise.all([
    listWalletsWithBalance(db, userId),
    loanTotals(db, userId),
    totalSpending(db, userId, period),
  ]);
  const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);

  return {
    wallets,
    totalBalance,
    owe: totals.owe,
    owed: totals.owed,
    netPosition: totalBalance + totals.owed - totals.owe,
    period,
    monthSpending,
  };
}
