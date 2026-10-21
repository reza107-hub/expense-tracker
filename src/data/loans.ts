import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { listLoans, listRepayments, loanTotals } from "@/lib/loans/queries";
import { todayInDhaka } from "@/lib/period";
import { listWalletsWithBalance } from "@/lib/wallets/queries";

/**
 * Everything the Loans page needs for the signed-in user: their loans, each loan's
 * repayments, their active wallets, and the totals owed each way (open loans only).
 */
export async function getLoansPage() {
  const { userId } = await requireUser();
  const db = getDb();

  const [loans, wallets, totals] = await Promise.all([
    listLoans(db, userId),
    listWalletsWithBalance(db, userId),
    loanTotals(db, userId),
  ]);
  const repayments = await listRepayments(
    db,
    userId,
    loans.map((loan) => loan.id),
  );

  return {
    loans,
    repayments,
    wallets: wallets.map(({ id, name, balance }) => ({ id, name, balance })),
    totals,
    today: todayInDhaka(),
  };
}

/** What the signed-in user owes and is owed, from open loans only, in poisha. */
export async function getLoanTotals() {
  const { userId } = await requireUser();
  return loanTotals(getDb(), userId);
}
