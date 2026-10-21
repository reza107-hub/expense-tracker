import { and, eq } from "drizzle-orm";
import { aiAdvice } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import type { Period } from "@/lib/period";
import { AdviceError, toAdviceError, type AdviceClient } from "./gemini";
import { buildAdvicePayload, hashPayload } from "./payload";
import { parseAdvice, type Advice } from "./response";
import { releaseRequest, reserveRequest } from "./usage";

export type SavedAdvice = { advice: Advice; createdAt: Date; inputHash: string };

export type AdviceOutcome =
  /** The month has no expenses. Nothing was sent. */
  | { status: "empty" }
  /** The figures match the saved advice, so it was reused. Nothing was sent or counted. */
  | { status: "unchanged"; saved: SavedAdvice }
  /** New advice was made and saved. */
  | { status: "created"; saved: SavedAdvice }
  /** The daily limit is reached. Nothing was sent. Old advice, if any, is kept. */
  | { status: "limit"; saved: SavedAdvice | null }
  /** The call failed or the reply was unusable. Old advice, if any, is kept. */
  | { status: "error"; message: string; saved: SavedAdvice | null };

/** The user's saved advice for a period, or null. */
export async function getSavedAdvice(
  db: AnyDb,
  userId: string,
  period: Period,
): Promise<SavedAdvice | null> {
  const [row] = await db
    .select()
    .from(aiAdvice)
    .where(and(eq(aiAdvice.userId, userId), eq(aiAdvice.periodStart, period.start)));
  if (!row) return null;
  return { advice: row.payload as Advice, createdAt: row.createdAt, inputHash: row.inputHash };
}

async function saveAdvice(
  db: AnyDb,
  userId: string,
  period: Period,
  inputHash: string,
  advice: Advice,
): Promise<SavedAdvice> {
  const createdAt = new Date();
  await db
    .insert(aiAdvice)
    .values({
      userId,
      periodStart: period.start,
      periodEnd: period.end,
      inputHash,
      payload: advice,
      createdAt,
    })
    .onConflictDoUpdate({
      target: [aiAdvice.userId, aiAdvice.periodStart],
      set: { periodEnd: period.end, inputHash, payload: advice, createdAt },
    });
  return { advice, createdAt, inputHash };
}

/**
 * Asks for advice for one month. The order of the checks is the point:
 *  1. No expenses: say so, send nothing.
 *  2. Same figures as the saved advice: reuse it, send nothing, count nothing.
 *  3. Daily limit reached: send nothing, keep the saved advice.
 *  4. Otherwise take one request from the allowance, call the model, and give the
 *     request back if the call or the reply fails. Failures never overwrite saved advice.
 *
 * `client` is null when no key is set.
 */
export async function requestAdvice(
  db: AnyDb,
  userId: string,
  options: { period: Period; startDay: number; today: string; client: AdviceClient | null },
): Promise<AdviceOutcome> {
  const { period, startDay, today, client } = options;
  const payload = await buildAdvicePayload(db, userId, period, startDay);
  if (payload.totalSpending === 0) return { status: "empty" };

  const inputHash = hashPayload(payload);
  const saved = await getSavedAdvice(db, userId, period);
  if (saved && saved.inputHash === inputHash) return { status: "unchanged", saved };

  if (!client) {
    return {
      status: "error",
      message: "Advice is not set up on this server yet.",
      saved,
    };
  }
  if (!(await reserveRequest(db, userId, today))) return { status: "limit", saved };

  try {
    const parsed = parseAdvice(await client.generate(payload), payload);
    if (!parsed.ok) {
      await releaseRequest(db, userId, today);
      return {
        status: "error",
        message: "The advice service sent a reply we could not read. Please try again.",
        saved,
      };
    }
    return { status: "created", saved: await saveAdvice(db, userId, period, inputHash, parsed.advice) };
  } catch (error) {
    await releaseRequest(db, userId, today);
    const failure = error instanceof AdviceError ? error : toAdviceError(error);
    return { status: "error", message: failure.message, saved };
  }
}
