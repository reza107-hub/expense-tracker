import { z } from "zod";
import { parseTaka } from "@/lib/money";
import { isFutureDate } from "@/lib/period";

export const NOTE_MAX = 200;

export type EntryType = "expense" | "income" | "transfer" | "adjustment";

export type EntryField =
  | "walletId"
  | "toWalletId"
  | "categoryId"
  | "amount"
  | "newBalance"
  | "entryDate"
  | "note";

export type EntryFieldErrors = Partial<Record<EntryField, string>>;

/** What the browser sent, as text, so a failed form can be shown again as typed. */
export type EntryValues = Partial<Record<EntryField, string>>;

/** A checked entry, ready to save. Amounts are whole poisha. */
export type NewEntry =
  | {
      type: "expense";
      walletId: number;
      categoryId: number;
      amount: number;
      entryDate: string;
      note: string | null;
    }
  | { type: "income"; walletId: number; amount: number; entryDate: string; note: string | null }
  | {
      type: "transfer";
      walletId: number;
      toWalletId: number;
      amount: number;
      entryDate: string;
      note: string | null;
    }
  | {
      type: "adjustment";
      walletId: number;
      /** The balance the wallet should show afterwards. The saved row holds the difference. */
      newBalance: number;
      entryDate: string;
      note: string | null;
    };

export type EntryFormState =
  | { status: "idle" }
  | { status: "saved" }
  /** Nothing saved yet. The form asks the user to confirm taking a wallet below zero. */
  | {
      status: "low-balance";
      values: EntryValues;
      walletName: string;
      balanceAfter: number;
    }
  | {
      status: "error";
      values: EntryValues;
      fieldErrors: EntryFieldErrors;
      formError?: string;
    };

/** State for the delete button, which can only fail with a message. */
export type EntryActionState =
  | { status: "idle" }
  | { status: "error"; message: string };

type Checked =
  | { ok: true; value: NewEntry }
  | { ok: false; values: EntryValues; fieldErrors: EntryFieldErrors };

const AMOUNT_MESSAGE = "Enter an amount above zero, with at most two decimal places.";

export const idField = (message: string) =>
  z
    .string()
    .regex(/^\d{1,9}$/, message)
    .transform(Number);

export const amountField = z
  .string()
  .superRefine((text, ctx) => {
    const poisha = parseTaka(text);
    if (poisha === null || poisha <= 0) ctx.addIssue({ code: "custom", message: AMOUNT_MESSAGE });
  })
  .transform((text) => parseTaka(text) as number);

/** A balance may be zero or below, so only the shape of the number is checked. */
const balanceField = z
  .string()
  .superRefine((text, ctx) => {
    if (parseTaka(text, { allowNegative: true }) === null) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the new balance, with at most two decimal places.",
      });
    }
  })
  .transform((text) => parseTaka(text, { allowNegative: true }) as number);

export const noteField = z
  .string()
  .max(NOTE_MAX, `Use ${NOTE_MAX} characters or fewer.`)
  .transform((text) => text || null);

export function dateField(now: Date) {
  return z.string().superRefine((text, ctx) => {
    let future: boolean;
    try {
      future = isFutureDate(text, now);
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return;
    }
    if (future) ctx.addIssue({ code: "custom", message: "The date cannot be in the future." });
  });
}

function schemaFor(type: EntryType, now: Date) {
  const common = { entryDate: dateField(now), note: noteField };
  const wallet = idField("Choose a wallet.");
  switch (type) {
    case "expense":
      return z.object({
        walletId: wallet,
        categoryId: idField("Choose a category."),
        amount: amountField,
        ...common,
      });
    case "income":
      return z.object({ walletId: wallet, amount: amountField, ...common });
    case "transfer":
      return z
        .object({
          walletId: idField("Choose the wallet to take money from."),
          toWalletId: idField("Choose the wallet to move money to."),
          amount: amountField,
          ...common,
        })
        .refine((v) => v.walletId !== v.toWalletId, {
          path: ["toWalletId"],
          message: "Choose two different wallets.",
        });
    case "adjustment":
      return z.object({ walletId: wallet, newBalance: balanceField, ...common });
  }
}

/** The hidden-button value that says the user confirmed the low-balance warning. */
export const CONFIRM_LOW_BALANCE_FIELD = "confirmLowBalance";

const FIELDS: EntryField[] = [
  "walletId",
  "toWalletId",
  "categoryId",
  "amount",
  "newBalance",
  "entryDate",
  "note",
];

/** The entry fields from a form, trimmed. Anything else in the form is ignored. */
export function readEntryValues(formData: FormData): EntryValues {
  const values: EntryValues = {};
  for (const field of FIELDS) {
    const raw = formData.get(field);
    if (typeof raw === "string") values[field] = raw.trim();
  }
  return values;
}

/**
 * Checks one entry form. Amounts must be above zero with at most two decimals, dates
 * cannot be in the future (Dhaka time), a transfer needs two different wallets, and an
 * expense needs a category. Ownership of the wallets and category is checked later,
 * against the database, when the entry is saved.
 */
export function validateEntry(type: EntryType, formData: FormData, now = new Date()): Checked {
  const values = readEntryValues(formData);

  const parsed = schemaFor(type, now).safeParse(
    Object.fromEntries(FIELDS.map((field) => [field, values[field] ?? ""])),
  );
  if (parsed.success) {
    return { ok: true, value: { type, ...parsed.data } as NewEntry };
  }

  const fieldErrors: EntryFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as EntryField | undefined;
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { ok: false, values, fieldErrors };
}

/** The new details for an existing entry. Its type never changes. */
export type EntryChanges = {
  walletId: number;
  toWalletId?: number;
  categoryId?: number;
  /** Above zero, except for an adjustment, where it is the signed change (not zero). */
  amount: number;
  entryDate: string;
  note: string | null;
};

type CheckedChanges =
  | { ok: true; value: EntryChanges }
  | { ok: false; values: EntryValues; fieldErrors: EntryFieldErrors };

/** The signed change an adjustment applies. Negative lowers the balance, zero is refused. */
const changeField = z
  .string()
  .superRefine((text, ctx) => {
    const poisha = parseTaka(text, { allowNegative: true });
    if (poisha === null || poisha === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the change in balance, not zero, with at most two decimal places.",
      });
    }
  })
  .transform((text) => parseTaka(text, { allowNegative: true }) as number);

/**
 * Checks the form for editing an entry. It follows the same rules as adding one. For an
 * adjustment the amount is the signed change in balance, because that is what is stored.
 */
export function validateEntryChanges(
  type: EntryType,
  formData: FormData,
  now = new Date(),
): CheckedChanges {
  if (type !== "adjustment") {
    const checked = validateEntry(type, formData, now);
    if (!checked.ok) return checked;
    const entry = checked.value as Extract<NewEntry, { amount: number }>;
    return {
      ok: true,
      value: {
        walletId: entry.walletId,
        toWalletId: entry.type === "transfer" ? entry.toWalletId : undefined,
        categoryId: entry.type === "expense" ? entry.categoryId : undefined,
        amount: entry.amount,
        entryDate: entry.entryDate,
        note: entry.note,
      },
    };
  }

  const values = readEntryValues(formData);
  const parsed = z
    .object({
      walletId: idField("Choose a wallet."),
      amount: changeField,
      entryDate: dateField(now),
      note: noteField,
    })
    .safeParse(Object.fromEntries(FIELDS.map((field) => [field, values[field] ?? ""])));
  if (parsed.success) return { ok: true, value: parsed.data };

  const fieldErrors: EntryFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as EntryField | undefined;
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { ok: false, values, fieldErrors };
}
