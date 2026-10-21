import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { listCategories, listSelectableCategories } from "@/lib/categories/queries";

/** The signed-in user's active categories, including the reserved loan category. */
export async function listActiveCategories() {
  const { userId } = await requireUser();
  return listCategories(getDb(), userId);
}

/** The signed-in user's archived categories. */
export async function listArchivedCategories() {
  const { userId } = await requireUser();
  return listCategories(getDb(), userId, { archived: true });
}

/** Categories an expense form may offer: active, and never the reserved loan one. */
export async function listCategoriesForExpenseForm() {
  const { userId } = await requireUser();
  return listSelectableCategories(getDb(), userId);
}
