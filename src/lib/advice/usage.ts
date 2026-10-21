import { and, eq, lt, sql } from "drizzle-orm";
import { aiUsage } from "@/db/schema";
import type { AnyDb } from "@/db/types";

/** Fresh requests to the model each user may make per day (Dhaka time). */
export const DAILY_LIMIT = 5;

/**
 * Takes one request from the user's allowance for `day`, in a single statement that
 * inserts the row or adds one only while the count is below the limit. Two requests at
 * once therefore cannot both slip under it. Returns false when the limit is reached.
 */
export async function reserveRequest(db: AnyDb, userId: string, day: string): Promise<boolean> {
  const rows = await db
    .insert(aiUsage)
    .values({ userId, day, count: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: { count: sql`${aiUsage.count} + 1` },
      setWhere: lt(aiUsage.count, DAILY_LIMIT),
    })
    .returning({ count: aiUsage.count });
  return rows.length > 0;
}

/** Gives a request back, because the call failed and should not use up the allowance. */
export async function releaseRequest(db: AnyDb, userId: string, day: string): Promise<void> {
  await db
    .update(aiUsage)
    .set({ count: sql`greatest(${aiUsage.count} - 1, 0)` })
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)));
}

/** How many fresh requests the user has left today. */
export async function remainingRequests(db: AnyDb, userId: string, day: string): Promise<number> {
  const [row] = await db
    .select({ count: aiUsage.count })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)));
  return Math.max(DAILY_LIMIT - (row?.count ?? 0), 0);
}
