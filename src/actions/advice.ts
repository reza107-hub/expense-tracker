"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { createGeminiClient } from "@/lib/advice/gemini";
import { requestAdvice, type AdviceOutcome } from "@/lib/advice/service";
import { DAILY_LIMIT } from "@/lib/advice/usage";
import { periodForMonth, todayInDhaka } from "@/lib/period";
import { getMonthStartDay } from "@/lib/settings/queries";

export type AdviceActionState =
  | { status: "idle" }
  | { status: "done"; kind: AdviceOutcome["status"]; message: string };

/** The line shown under the button for each outcome. */
function describe(outcome: AdviceOutcome): string {
  switch (outcome.status) {
    case "created":
      return "Advice updated.";
    case "unchanged":
      return "Nothing has changed since this advice was made, so it was kept.";
    case "empty":
      return "There is nothing to analyse in this month.";
    case "limit":
      return `You have used all ${DAILY_LIMIT} advice requests for today. Try again tomorrow. Any saved advice is kept.`;
    case "error":
      return `${outcome.message} Any saved advice is kept.`;
  }
}

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
  return { status: "done", kind: outcome.status, message: describe(outcome) };
}
