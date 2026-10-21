import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { entries, loans, wallets, type Loan } from "@/db/schema";
import type { AnyDb } from "@/db/types";

export type LoanStatus = "open" | "closed";

export type LoanSummary = Loan & {
  /** Principal repaid so far, in poisha. Interest and fees are not part of it. */
  repaid: number;
  /** Principal still to be repaid, in poisha. */
  outstanding: number;
  status: LoanStatus;
  /** The date the money changed hands, from the principal entry. */
  startDate: string | null;
};

/** One repayment with the interest or fee that was recorded together with it. */
export type Repayment = {
  id: number;
  loanId: number;
  walletId: number;
  walletName: string;
  entryDate: string;
  principal: number;
  /** Interest or fee in poisha. Zero when there was none. */
  fee: number;
  note: string | null;
};

/**
 * The user's loans, newest first, each with what is repaid and outstanding. Open loans
 * are the ones with an outstanding amount above zero.
 */
export async function listLoans(db: AnyDb, userId: string): Promise<LoanSummary[]> {
  const rows = await db
    .select({
      loan: loans,
      repaid: sql<number>`coalesce((
        select sum(e.amount) from entries e
        where e.user_id = loans.user_id and e.loan_id = loans.id and e.type = 'loan_repayment'
      ), 0)`.mapWith(Number),
      startDate: sql<string | null>`(
        select e.entry_date from entries e
        where e.user_id = loans.user_id and e.loan_id = loans.id and e.type = 'loan_principal'
        limit 1
      )`,
    })
    .from(loans)
    .where(eq(loans.userId, userId))
    .orderBy(desc(loans.createdAt), desc(loans.id));

  return rows.map(({ loan, repaid, startDate }) => {
    const outstanding = loan.principal - repaid;
    return {
      ...loan,
      repaid,
      outstanding,
      status: outstanding > 0 ? "open" : "closed",
      startDate,
    };
  });
}

/** One of the user's loans, or null when it is not theirs. */
export async function getLoan(
  db: AnyDb,
  userId: string,
  loanId: number,
): Promise<LoanSummary | null> {
  return (await listLoans(db, userId)).find((loan) => loan.id === loanId) ?? null;
}

/**
 * The repayments of the given loans, newest first. A fee row belongs to the repayment
 * written in the same transaction, so it shares that repayment's loan, wallet, date
 * and creation time.
 */
export async function listRepayments(
  db: AnyDb,
  userId: string,
  loanIds: number[],
): Promise<Repayment[]> {
  if (loanIds.length === 0) return [];
  const rows = await db
    .select({
      id: entries.id,
      type: entries.type,
      loanId: entries.loanId,
      walletId: entries.walletId,
      walletName: wallets.name,
      entryDate: entries.entryDate,
      amount: entries.amount,
      note: entries.note,
      createdAt: entries.createdAt,
    })
    .from(entries)
    .innerJoin(wallets, and(eq(wallets.userId, entries.userId), eq(wallets.id, entries.walletId)))
    .where(
      and(
        eq(entries.userId, userId),
        inArray(entries.loanId, loanIds),
        inArray(entries.type, ["loan_repayment", "expense", "income"]),
      ),
    )
    .orderBy(desc(entries.entryDate), desc(entries.id));

  const pairKey = (row: (typeof rows)[number]) =>
    `${row.loanId}|${row.walletId}|${row.entryDate}|${row.createdAt.getTime()}`;
  const fees = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== "loan_repayment") fees.set(pairKey(row), row.amount);
  }

  return rows
    .filter((row) => row.type === "loan_repayment")
    .map((row) => ({
      id: row.id,
      loanId: row.loanId as number,
      walletId: row.walletId,
      walletName: row.walletName,
      entryDate: row.entryDate,
      principal: row.amount,
      fee: fees.get(pairKey(row)) ?? 0,
      note: row.note,
    }));
}

/** What the user owes and what others owe the user, from open loans only, in poisha. */
export async function loanTotals(
  db: AnyDb,
  userId: string,
): Promise<{ owe: number; owed: number }> {
  const all = await listLoans(db, userId);
  let owe = 0;
  let owed = 0;
  for (const loan of all) {
    if (loan.status !== "open") continue;
    if (loan.direction === "borrowed") owe += loan.outstanding;
    else owed += loan.outstanding;
  }
  return { owe, owed };
}
