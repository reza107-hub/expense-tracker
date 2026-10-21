import { and, eq, inArray } from "drizzle-orm";
import { categories, entries, loans } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import { findReferenceErrors } from "@/lib/entries/create";
import { formatTaka } from "@/lib/money";
import type { LoanChanges, LoanField, NewLoan, NewRepayment, RepaymentField } from "./validation";

export type CreateLoanResult =
  | { ok: true; id: number }
  | { ok: false; fieldErrors: Partial<Record<LoanField, string>> };

export type RepaymentResult =
  | { ok: true }
  | { ok: false; reason: "not-found" }
  | { ok: false; fieldErrors: Partial<Record<RepaymentField, string>> };

export type LoanResult = { ok: true } | { ok: false; reason: "not-found" };

/** The ledger rows written together for one repayment: the principal, and any fee. */
const REPAYMENT_ROW_TYPES = ["loan_repayment", "expense", "income"] as const;

/**
 * Records a loan and its principal entry in one transaction. "I borrowed" raises the
 * wallet and "I lent" lowers it. Neither is income or spending. The wallet must be one
 * of the user's active wallets.
 */
export async function createLoan(
  db: AnyDb,
  userId: string,
  loan: NewLoan,
): Promise<CreateLoanResult> {
  const fieldErrors = await findReferenceErrors(db, userId, { walletId: loan.walletId });
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(loans)
      .values({
        userId,
        direction: loan.direction,
        counterparty: loan.counterparty,
        principal: loan.amount,
        dueDate: loan.dueDate,
        note: loan.note,
      })
      .returning({ id: loans.id });
    await tx.insert(entries).values({
      userId,
      type: "loan_principal",
      walletId: loan.walletId,
      loanId: row.id,
      amount: loan.amount,
      entryDate: loan.entryDate,
      note: loan.note,
    });
    return { ok: true as const, id: row.id };
  });
}

/**
 * Records a repayment against one of the user's loans. The principal cannot be more
 * than what is still outstanding. An interest or fee amount is a second row in the same
 * transaction: spending in the reserved loan category for a borrowed loan, income for a
 * lent loan. It never changes the outstanding principal.
 *
 * The loan row is locked while the outstanding amount is read, so two repayments sent
 * at once cannot both pass the check and overpay.
 */
export async function recordRepayment(
  db: AnyDb,
  userId: string,
  loanId: number,
  repayment: NewRepayment,
): Promise<RepaymentResult> {
  const walletErrors = await findReferenceErrors(db, userId, { walletId: repayment.walletId });
  if (Object.keys(walletErrors).length > 0) {
    return { ok: false, fieldErrors: { walletId: walletErrors.walletId } };
  }

  return db.transaction(async (tx) => {
    const [loan] = await tx
      .select()
      .from(loans)
      .where(and(eq(loans.id, loanId), eq(loans.userId, userId)))
      .for("update");
    if (!loan) return { ok: false as const, reason: "not-found" as const };

    const repaidRows = await tx
      .select({ amount: entries.amount })
      .from(entries)
      .where(
        and(
          eq(entries.userId, userId),
          eq(entries.loanId, loanId),
          eq(entries.type, "loan_repayment"),
        ),
      );
    const outstanding = loan.principal - repaidRows.reduce((sum, row) => sum + row.amount, 0);
    if (repayment.principal > outstanding) {
      return {
        ok: false as const,
        fieldErrors: {
          principal:
            outstanding === 0
              ? "This loan is already fully repaid."
              : `Only ৳ ${formatTaka(outstanding)} is still outstanding.`,
        },
      };
    }

    const base = {
      userId,
      walletId: repayment.walletId,
      loanId,
      entryDate: repayment.entryDate,
      note: repayment.note,
    };
    await tx.insert(entries).values({ ...base, type: "loan_repayment", amount: repayment.principal });

    if (repayment.interest > 0) {
      if (loan.direction === "borrowed") {
        const [category] = await tx
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.userId, userId), eq(categories.isReserved, true)));
        if (!category) throw new Error("The reserved loan interest category is missing.");
        await tx.insert(entries).values({
          ...base,
          type: "expense",
          categoryId: category.id,
          amount: repayment.interest,
        });
      } else {
        await tx.insert(entries).values({ ...base, type: "income", amount: repayment.interest });
      }
    }
    return { ok: true as const };
  });
}

/**
 * Deletes one repayment and the interest or fee recorded with it, so the outstanding
 * amount, the wallet and spending all go back. A loan whose final repayment is deleted
 * is open again, because its status is calculated.
 */
export async function deleteRepayment(
  db: AnyDb,
  userId: string,
  repaymentId: number,
): Promise<LoanResult> {
  return db.transaction(async (tx) => {
    const [repayment] = await tx
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.id, repaymentId),
          eq(entries.userId, userId),
          eq(entries.type, "loan_repayment"),
        ),
      );
    if (!repayment || repayment.loanId === null) return { ok: false as const, reason: "not-found" as const };

    // The fee row was written in the same transaction, so it has the same creation time.
    const rows = await tx
      .select({ id: entries.id, createdAt: entries.createdAt })
      .from(entries)
      .where(
        and(
          eq(entries.userId, userId),
          eq(entries.loanId, repayment.loanId),
          eq(entries.walletId, repayment.walletId),
          eq(entries.entryDate, repayment.entryDate),
          inArray(entries.type, [...REPAYMENT_ROW_TYPES]),
        ),
      );
    const ids = rows
      .filter((row) => row.createdAt.getTime() === repayment.createdAt.getTime())
      .map((row) => row.id);
    await tx.delete(entries).where(and(eq(entries.userId, userId), inArray(entries.id, ids)));
    return { ok: true as const };
  });
}

/** Changes a loan's counterparty, due date and note. The money cannot be edited here. */
export async function updateLoan(
  db: AnyDb,
  userId: string,
  loanId: number,
  changes: LoanChanges,
): Promise<LoanResult> {
  const changed = await db
    .update(loans)
    .set(changes)
    .where(and(eq(loans.id, loanId), eq(loans.userId, userId)))
    .returning({ id: loans.id });
  return changed.length > 0 ? { ok: true } : { ok: false, reason: "not-found" };
}

/**
 * Deletes a loan with its principal, repayments, interest and fees, in one transaction.
 * Wallet balances and reports follow, because they are calculated from the entries.
 */
export async function deleteLoan(db: AnyDb, userId: string, loanId: number): Promise<LoanResult> {
  return db.transaction(async (tx) => {
    const [loan] = await tx
      .select({ id: loans.id })
      .from(loans)
      .where(and(eq(loans.id, loanId), eq(loans.userId, userId)));
    if (!loan) return { ok: false as const, reason: "not-found" as const };

    await tx.delete(entries).where(and(eq(entries.userId, userId), eq(entries.loanId, loanId)));
    await tx.delete(loans).where(and(eq(loans.id, loanId), eq(loans.userId, userId)));
    return { ok: true as const };
  });
}
