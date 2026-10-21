"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import {
  createLoan,
  deleteLoan,
  deleteRepayment,
  recordRepayment,
  updateLoan,
} from "@/lib/loans/mutations";
import {
  validateLoan,
  validateLoanEdit,
  validateRepayment,
  type LoanActionState,
  type LoanEditField,
  type LoanField,
  type LoanFormState,
  type RepaymentField,
} from "@/lib/loans/validation";

const NOT_FOUND = "This loan no longer exists. Refresh the page.";

/** Balances, the loan list, entries, reports and alerts all depend on loans. */
function refresh() {
  revalidatePath("/", "layout");
}

export async function createLoanAction(
  _previous: LoanFormState<LoanField>,
  formData: FormData,
): Promise<LoanFormState<LoanField>> {
  const { userId } = await requireUser();
  const checked = validateLoan(formData);
  if (!checked.ok) {
    return { status: "error", values: checked.values, fieldErrors: checked.fieldErrors };
  }

  const result = await createLoan(getDb(), userId, checked.value);
  if (!result.ok) {
    const values = Object.fromEntries(
      [...formData.entries()].filter(([, v]) => typeof v === "string"),
    ) as Partial<Record<LoanField, string>>;
    return { status: "error", values, fieldErrors: result.fieldErrors };
  }
  refresh();
  return { status: "saved" };
}

export async function recordRepaymentAction(
  loanId: number,
  _previous: LoanFormState<RepaymentField>,
  formData: FormData,
): Promise<LoanFormState<RepaymentField>> {
  const { userId } = await requireUser();
  const checked = validateRepayment(formData);
  if (!checked.ok) {
    return { status: "error", values: checked.values, fieldErrors: checked.fieldErrors };
  }

  const result = await recordRepayment(getDb(), userId, loanId, checked.value);
  if (!result.ok) {
    const values = {
      walletId: String(formData.get("walletId") ?? ""),
      principal: String(formData.get("principal") ?? ""),
      interest: String(formData.get("interest") ?? ""),
      entryDate: String(formData.get("entryDate") ?? ""),
      note: String(formData.get("note") ?? ""),
    };
    return "fieldErrors" in result
      ? { status: "error", values, fieldErrors: result.fieldErrors }
      : { status: "error", values, fieldErrors: {}, formError: NOT_FOUND };
  }
  refresh();
  return { status: "saved" };
}

export async function updateLoanAction(
  loanId: number,
  _previous: LoanFormState<LoanEditField>,
  formData: FormData,
): Promise<LoanFormState<LoanEditField>> {
  const { userId } = await requireUser();
  const checked = validateLoanEdit(formData);
  if (!checked.ok) {
    return { status: "error", values: checked.values, fieldErrors: checked.fieldErrors };
  }

  const result = await updateLoan(getDb(), userId, loanId, checked.value);
  if (!result.ok) {
    const values = {
      counterparty: String(formData.get("counterparty") ?? ""),
      dueDate: String(formData.get("dueDate") ?? ""),
      note: String(formData.get("note") ?? ""),
    };
    return { status: "error", values, fieldErrors: {}, formError: NOT_FOUND };
  }
  refresh();
  return { status: "saved" };
}

export async function deleteLoanAction(loanId: number): Promise<LoanActionState> {
  const { userId } = await requireUser();
  const result = await deleteLoan(getDb(), userId, loanId);
  if (!result.ok) return { status: "error", message: NOT_FOUND };
  refresh();
  return { status: "idle" };
}

export async function deleteRepaymentAction(repaymentId: number): Promise<LoanActionState> {
  const { userId } = await requireUser();
  const result = await deleteRepayment(getDb(), userId, repaymentId);
  if (!result.ok) {
    return { status: "error", message: "This repayment no longer exists. Refresh the page." };
  }
  refresh();
  return { status: "idle" };
}
