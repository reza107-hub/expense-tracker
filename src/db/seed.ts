import { eq } from "drizzle-orm";
import { categories, settings } from "./schema";
import type { AnyDb } from "./types";

export const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Bills",
  "Shopping",
  "Health",
  "Mobile recharge",
  "Rent",
  "Other",
] as const;

/** Reserved. Used only for loan interest and fees, never offered in expense forms. */
export const LOAN_FEES_CATEGORY = "Loan interest and fees";

/**
 * Sets an account up if it has not been set up yet. One cheap read when it has, so it
 * is safe to call on every request.
 */
export async function ensureUserDefaults(db: AnyDb, userId: string): Promise<void> {
  const existing = await db
    .select({ userId: settings.userId })
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);
  if (existing.length === 0) await seedUserDefaults(db, userId);
}

/**
 * Gives one user the default categories, the reserved loan category and the default
 * settings (month starts on day 1, alerts off). Returns true when it set the account up.
 *
 * The settings row marks an account as set up. Defaults are created only when that row
 * is first created, so calling this again changes nothing, even if the user has since
 * renamed, archived or added categories. Everything happens in one transaction, so an
 * account is never left half set up.
 */
export async function seedUserDefaults(db: AnyDb, userId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const created = await tx
      .insert(settings)
      .values({ userId })
      .onConflictDoNothing()
      .returning({ userId: settings.userId });
    if (created.length === 0) return false;

    await tx.insert(categories).values([
      ...DEFAULT_CATEGORIES.map((name) => ({ userId, name })),
      { userId, name: LOAN_FEES_CATEGORY, isReserved: true },
    ]);
    return true;
  });
}
