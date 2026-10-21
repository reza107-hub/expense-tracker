"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { deleteEntry, findPlainEntryType, updateEntry } from "@/lib/entries/modify";
import {
  CONFIRM_LOW_BALANCE_FIELD,
  readEntryValues,
  validateEntryChanges,
  type EntryActionState,
  type EntryFormState,
} from "@/lib/entries/validation";

const NOT_FOUND = "This entry no longer exists, or is managed on the Loans page. Refresh the page.";

export async function updateEntryAction(
  entryId: number,
  _previous: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const { userId } = await requireUser();
  const db = getDb();

  // The type comes from the saved entry, never from the browser.
  const type = await findPlainEntryType(db, userId, entryId);
  if (!type) {
    return { status: "error", values: {}, fieldErrors: {}, formError: NOT_FOUND };
  }

  const checked = validateEntryChanges(type, formData);
  if (!checked.ok) {
    return { status: "error", values: checked.values, fieldErrors: checked.fieldErrors };
  }

  const result = await updateEntry(db, userId, entryId, checked.value, {
    confirmLowBalance: formData.get(CONFIRM_LOW_BALANCE_FIELD) === "yes",
  });
  if (result.ok) {
    revalidatePath("/", "layout");
    return { status: "saved" };
  }
  const values = readEntryValues(formData);
  if ("lowBalance" in result) return { status: "low-balance", values, ...result.lowBalance };
  if ("fieldErrors" in result) return { status: "error", values, fieldErrors: result.fieldErrors };
  return { status: "error", values, fieldErrors: {}, formError: NOT_FOUND };
}

export async function deleteEntryAction(entryId: number): Promise<EntryActionState> {
  const { userId } = await requireUser();
  const result = await deleteEntry(getDb(), userId, entryId);
  if (!result.ok) return { status: "error", message: NOT_FOUND };
  revalidatePath("/", "layout");
  return { status: "idle" };
}
