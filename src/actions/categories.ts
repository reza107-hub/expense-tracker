"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import {
  archiveCategory,
  createCategory,
  renameCategory,
  restoreCategory,
  type CategoryResult,
} from "@/lib/categories/mutations";
import {
  validateCategory,
  type CategoryActionState,
  type CategoryFormState,
} from "@/lib/categories/validation";

const MESSAGES = {
  "duplicate-name": "You already have a category with this name.",
  "not-found": "This category no longer exists. Refresh the page.",
  reserved: "This category is used for loan interest and fees, so it cannot be archived.",
} as const;

const failure = (result: Extract<CategoryResult, { ok: false }>) => MESSAGES[result.reason];

export async function createCategoryAction(
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const { userId } = await requireUser();
  const checked = validateCategory(formData);
  if (!checked.ok) return { status: "error", name: checked.name, fieldError: checked.fieldError };

  const result = await createCategory(getDb(), userId, checked.name);
  if (!result.ok) return { status: "error", name: checked.name, fieldError: failure(result) };
  revalidatePath("/categories");
  return { status: "saved" };
}

export async function renameCategoryAction(
  categoryId: number,
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const { userId } = await requireUser();
  const checked = validateCategory(formData);
  if (!checked.ok) return { status: "error", name: checked.name, fieldError: checked.fieldError };

  const result = await renameCategory(getDb(), userId, categoryId, checked.name);
  if (!result.ok) return { status: "error", name: checked.name, fieldError: failure(result) };
  revalidatePath("/categories");
  return { status: "saved" };
}

export async function archiveCategoryAction(categoryId: number): Promise<CategoryActionState> {
  const { userId } = await requireUser();
  const result = await archiveCategory(getDb(), userId, categoryId);
  if (!result.ok) return { status: "error", message: failure(result) };
  revalidatePath("/categories");
  return { status: "idle" };
}

export async function restoreCategoryAction(categoryId: number): Promise<CategoryActionState> {
  const { userId } = await requireUser();
  const result = await restoreCategory(getDb(), userId, categoryId);
  if (!result.ok) return { status: "error", message: failure(result) };
  revalidatePath("/categories");
  return { status: "idle" };
}
