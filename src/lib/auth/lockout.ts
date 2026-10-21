import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { loginAttempts } from "@/db/schema";
import type { AnyDb } from "@/db/types";

export const LOCK_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES = 5;

const KEEP_ATTEMPTS_MS = 24 * 60 * 60 * 1000;

/**
 * Works out whether sign-in is locked. Five attempts within 15 minutes start a lock
 * that lasts 15 minutes from the fifth. Returns when it ends, or null.
 *
 * Attempts made before an earlier lock ended are not reused for the next lock.
 */
export function computeLockedUntil(attempts: Date[], now: Date): Date | null {
  const times = attempts.map((a) => a.getTime()).sort((a, b) => a - b);
  let streak: number[] = [];
  let lockEnd: number | null = null;

  for (const t of times) {
    if (lockEnd !== null && t < lockEnd) continue;
    streak = streak.filter((s) => t - s < LOCK_WINDOW_MS);
    streak.push(t);
    if (streak.length >= MAX_FAILURES) {
      lockEnd = t + LOCK_WINDOW_MS;
      streak = [];
    }
  }

  return lockEnd !== null && now.getTime() < lockEnd ? new Date(lockEnd) : null;
}

/** When sign-in for this email unlocks, or null if it is not locked. */
export async function getLockedUntil(
  db: AnyDb,
  email: string,
  now: Date,
): Promise<Date | null> {
  // A lock that is still active began less than 15 minutes ago, and its five
  // attempts fall within 15 minutes before that, so 30 minutes is enough history.
  const since = new Date(now.getTime() - 2 * LOCK_WINDOW_MS);
  const rows = await db
    .select({ at: loginAttempts.attemptedAt })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, email), gt(loginAttempts.attemptedAt, since)))
    .orderBy(asc(loginAttempts.attemptedAt));
  return computeLockedUntil(
    rows.map((r) => r.at),
    now,
  );
}

export type AttemptStart =
  | { status: "allowed" }
  | { status: "locked"; until: Date };

/**
 * Called before the password is checked. If the email is locked, refuses. Otherwise
 * records this attempt and lets it go ahead.
 *
 * The attempt is recorded before the password is checked, and the check and the
 * record happen together under a lock on the email, so a burst of parallel guesses
 * cannot all read the same count and slip past the limit. A successful sign-in then
 * clears the record (see `clearAttempts`).
 *
 * `email` is the address that was typed, whether or not it has an account, so an
 * unknown address locks exactly like a real one.
 */
export async function beginSignInAttempt(
  db: AnyDb,
  email: string,
  now: Date,
): Promise<AttemptStart> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${email}, 0))`);

    const until = await getLockedUntil(tx, email, now);
    if (until) return { status: "locked", until };

    await tx.insert(loginAttempts).values({ email, attemptedAt: now });
    // Keep the table small. Old attempts can no longer affect a lock.
    await tx
      .delete(loginAttempts)
      .where(lt(loginAttempts.attemptedAt, new Date(now.getTime() - KEEP_ATTEMPTS_MS)));
    return { status: "allowed" };
  });
}

/** Forgets the attempts for one email, after a successful sign-in. */
export async function clearAttempts(db: AnyDb, email: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.email, email));
}
