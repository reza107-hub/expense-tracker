"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { createEntry } from "@/lib/entries/create";
import {
  CONFIRM_LOW_BALANCE_FIELD,
  readEntryValues,
  validateEntry,
  type EntryFormState,
  type EntryType,
} from "@/lib/entries/validation";

/** Checks the form, saves the entry for this user, and returns what the form should show. */
async function save(
  userId: string,
  type: EntryType,
  formData: FormData,
): Promise<EntryFormState> {
  const checked = validateEntry(type, formData);
  if (!checked.ok) {
    return { status: "error", values: checked.values, fieldErrors: checked.fieldErrors };
  }

  const result = await createEntry(getDb(), userId, checked.value, {
    confirmLowBalance: formData.get(CONFIRM_LOW_BALANCE_FIELD) === "yes",
  });
  if (!result.ok && "lowBalance" in result) {
    return { status: "low-balance", values: readEntryValues(formData), ...result.lowBalance };
  }
  if (!result.ok) {
    return { status: "error", values: readEntryValues(formData), fieldErrors: result.fieldErrors };
  }

  // Balances, the entry list, reports and alerts all depend on entries.
  revalidatePath("/", "layout");
  return { status: "saved" };
}

export async function addExpenseAction(
  _previous: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const { userId } = await requireUser();
  return save(userId, "expense", formData);
}

export async function addIncomeAction(
  _previous: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const { userId } = await requireUser();
  return save(userId, "income", formData);
}

export async function addTransferAction(
  _previous: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const { userId } = await requireUser();
  return save(userId, "transfer", formData);
}

export async function adjustBalanceAction(
  _previous: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const { userId } = await requireUser();
  return save(userId, "adjustment", formData);
}
