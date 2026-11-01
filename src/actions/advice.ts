"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { createGeminiClient } from "@/lib/advice/gemini";
import { describeOutcome } from "@/lib/advice/describe";
import { requestAdvice, type AdviceOutcome } from "@/lib/advice/service";
import { periodForMonth, todayInDhaka } from "@/lib/period";
import { getMonthStartDay } from "@/lib/settings/queries";

export type AdviceActionState =
  | { status: "idle" }
  | { status: "done"; kind: AdviceOutcome["status"]; message: string };

/**
 * Makes or refreshes the advice for one month. The month comes from the page as
 * "YYYY-MM"; the user comes from the session, never from the browser.
 */
export async function refreshAdviceAction(monthKey: string): Promise<AdviceActionState> {
  const { userId } = await requireUser();
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey);
  if (!match) {
    return { status: "done", kind: "error", message: "That month is not valid. Refresh the page." };
  }

  const db = getDb();
  const startDay = await getMonthStartDay(db, userId);
  const outcome = await requestAdvice(db, userId, {
    period: periodForMonth(Number(match[1]), Number(match[2]), startDay),
    startDay,
    today: todayInDhaka(),
    client: createGeminiClient(),
  });

  revalidatePath("/reports");
  return { status: "done", kind: outcome.status, message: describeOutcome(outcome) };
}
