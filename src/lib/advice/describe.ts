import type { AdviceOutcome } from "./service";
import { DAILY_LIMIT } from "./usage";

/** The line shown under the advice button for each outcome. */
export function describeOutcome(outcome: AdviceOutcome): string {
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
