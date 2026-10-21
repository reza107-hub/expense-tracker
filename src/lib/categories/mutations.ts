import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { categories } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import { isUniqueViolation } from "@/lib/db-errors";

export type CategoryResult =
  | { ok: true }
  | { ok: false; reason: "duplicate-name" | "not-found" | "reserved" };

/** Runs a write and turns the "name already used" database error into a result. */
async function guardDuplicateName(write: () => Promise<CategoryResult>): Promise<CategoryResult> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate-name" };
    throw error;
  }
}

/**
 * A new category for the user. Names are unique per user ignoring letter case, and that
 * includes archived categories, so a name is never used by two categories at once.
 */
export async function createCategory(
  db: AnyDb,
  userId: string,
  name: string,
): Promise<CategoryResult> {
  return guardDuplicateName(async () => {
    await db.insert(categories).values({ userId, name });
    return { ok: true };
  });
}

/** Renames one of the user's categories. Past entries and reports show the new name. */
export async function renameCategory(
  db: AnyDb,
  userId: string,
  categoryId: number,
  name: string,
): Promise<CategoryResult> {
  return guardDuplicateName(async () => {
    const changed = await db
      .update(categories)
      .set({ name })
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .returning({ id: categories.id });
    return changed.length > 0 ? { ok: true } : { ok: false, reason: "not-found" };
  });
}

/**
 * Archives an active category of the user's. It stays on past entries and in past
 * reports but is no longer offered for new expenses. Categories are never deleted, and
 * the reserved loan category cannot be archived at all.
 */
export async function archiveCategory(
  db: AnyDb,
  userId: string,
  categoryId: number,
): Promise<CategoryResult> {
  const changed = await db
    .update(categories)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.userId, userId),
        eq(categories.isReserved, false),
        isNull(categories.archivedAt),
      ),
    )
    .returning({ id: categories.id });
  if (changed.length > 0) return { ok: true };

  // Nothing changed: say whether that was because the category is the reserved one.
  const [existing] = await db
    .select({ isReserved: categories.isReserved })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  return existing?.isReserved
    ? { ok: false, reason: "reserved" }
    : { ok: false, reason: "not-found" };
}

/** Brings an archived category back so it is offered for new expenses again. */
export async function restoreCategory(
  db: AnyDb,
  userId: string,
  categoryId: number,
): Promise<CategoryResult> {
  const changed = await db
    .update(categories)
    .set({ archivedAt: null })
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.userId, userId),
        isNotNull(categories.archivedAt),
      ),
    )
    .returning({ id: categories.id });
  return changed.length > 0 ? { ok: true } : { ok: false, reason: "not-found" };
}
