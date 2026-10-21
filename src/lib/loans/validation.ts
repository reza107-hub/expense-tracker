import { z } from "zod";
import { parseTaka } from "@/lib/money";
import { isFutureDate } from "@/lib/period";
import { NOTE_MAX, amountField, dateField, idField, noteField } from "@/lib/entries/validation";

export const COUNTERPARTY_MAX = 60;

export type LoanDirection = "borrowed" | "lent";

export type LoanField =
  | "direction"
  | "counterparty"
  | "amount"
  | "walletId"
  | "entryDate"
  | "dueDate"
  | "note";
export type RepaymentField = "walletId" | "principal" | "interest" | "entryDate" | "note";
export type LoanEditField = "counterparty" | "dueDate" | "note";

type Errors<F extends string> = Partial<Record<F, string>>;

/** A form that failed keeps what was typed, so the boxes are not emptied. */
export type LoanFormState<F extends string> =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; values: Errors<F>; fieldErrors: Errors<F>; formError?: string };

/** State for one-button actions (delete) that can only fail with a message. */
export type LoanActionState = { status: "idle" } | { status: "error"; message: string };

/** A checked loan, ready to save. Amounts are whole poisha. */
export type NewLoan = {
  direction: LoanDirection;
  counterparty: string;
  amount: number;
  walletId: number;
  entryDate: string;
  dueDate: string | null;
  note: string | null;
};

export type NewRepayment = {
  walletId: number;
  principal: number;
  /** Interest or fee paid or received on top of the principal. Zero when there is none. */
  interest: number;
  entryDate: string;
  note: string | null;
};

export type LoanChanges = { counterparty: string; dueDate: string | null; note: string | null };

type Checked<F extends string, T> =
  | { ok: true; value: T }
  | { ok: false; values: Errors<F>; fieldErrors: Errors<F> };

const counterpartyField = z
  .string()
  .transform((text) => text.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, "Enter who the loan is with.")
      .max(COUNTERPARTY_MAX, `Use ${COUNTERPARTY_MAX} characters or fewer.`),
  );

/** A due date is optional and, unlike an entry date, may be in the future. */
const dueDateField = z
  .string()
  .superRefine((text, ctx) => {
    if (text === "") return;
    try {
      isFutureDate(text);
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
    }
  })
  .transform((text) => text || null);

/** Interest or a fee is optional. When given it must be above zero. */
const interestField = z
  .string()
  .superRefine((text, ctx) => {
    if (text === "") return;
    const poisha = parseTaka(text);
    if (poisha === null || poisha <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter an amount above zero, with at most two decimal places, or leave it empty.",
      });
    }
  })
  .transform((text) => (text === "" ? 0 : (parseTaka(text) as number)));

/** Runs a schema over the named form fields and reports errors per field. */
function check<F extends string, T>(
  schema: z.ZodType<T>,
  fields: readonly F[],
  formData: FormData,
): Checked<F, T> {
  const values: Errors<F> = {};
  for (const field of fields) {
    const raw = formData.get(field);
    if (typeof raw === "string") values[field] = raw.trim();
  }
  const parsed = schema.safeParse(Object.fromEntries(fields.map((f) => [f, values[f] ?? ""])));
  if (parsed.success) return { ok: true, value: parsed.data };

  const fieldErrors: Errors<F> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as F | undefined;
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { ok: false, values, fieldErrors };
}

const LOAN_FIELDS = [
  "direction",
  "counterparty",
  "amount",
  "walletId",
  "entryDate",
  "dueDate",
  "note",
] as const satisfies readonly LoanField[];

/**
 * Reads the loan form: who it is with, the amount, the wallet, the date, an optional
 * due date and note. Nothing else is accepted, so a loan never holds a phone number or
 * an account number. Wallet ownership is checked against the database when it is saved.
 */
export function validateLoan(formData: FormData, now = new Date()): Checked<LoanField, NewLoan> {
  return check(
    z.object({
      direction: z.enum(["borrowed", "lent"], { error: "Choose borrowed or lent." }),
      counterparty: counterpartyField,
      amount: amountField,
      walletId: idField("Choose a wallet."),
      entryDate: dateField(now),
      dueDate: dueDateField,
      note: noteField,
    }),
    LOAN_FIELDS,
    formData,
  );
}

const REPAYMENT_FIELDS = [
  "walletId",
  "principal",
  "interest",
  "entryDate",
  "note",
] as const satisfies readonly RepaymentField[];

/** Reads a repayment form. Whether the principal fits the outstanding amount is checked on save. */
export function validateRepayment(
  formData: FormData,
  now = new Date(),
): Checked<RepaymentField, NewRepayment> {
  return check(
    z.object({
      walletId: idField("Choose a wallet."),
      principal: amountField,
      interest: interestField,
      entryDate: dateField(now),
      note: noteField,
    }),
    REPAYMENT_FIELDS,
    formData,
  );
}

const EDIT_FIELDS = ["counterparty", "dueDate", "note"] as const satisfies readonly LoanEditField[];

/** Reads the loan edit form: only the counterparty, due date and note can change. */
export function validateLoanEdit(formData: FormData): Checked<LoanEditField, LoanChanges> {
  return check(
    z.object({ counterparty: counterpartyField, dueDate: dueDateField, note: noteField }),
    EDIT_FIELDS,
    formData,
  );
}

export { NOTE_MAX };
