import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { categories, type Category } from "@/db/schema";
import type { AnyDb } from "@/db/types";

/**
 * The user's categories, active ones by default. This includes the reserved
 * "Loan interest and fees" category, so the categories page can show it. Entry forms
 * must use `listSelectableCategories` instead.
 */
export async function listCategories(
  db: AnyDb,
  userId: string,
  { archived = false }: { archived?: boolean } = {},
): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        archived ? isNotNull(categories.archivedAt) : isNull(categories.archivedAt),
      ),
    )
    .orderBy(asc(categories.isReserved), asc(categories.createdAt), asc(categories.id));
}

/**
 * The categories an expense can be given: active and not reserved. The reserved loan
 * category is only ever set by the loan code, never chosen in a form.
 */
export async function listSelectableCategories(db: AnyDb, userId: string): Promise<Category[]> {
  return (await listCategories(db, userId)).filter((category) => !category.isReserved);
}
