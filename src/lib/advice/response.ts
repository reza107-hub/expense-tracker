import { z } from "zod";
import type { AdvicePayload } from "./payload";

export type Suggestion = {
  category: string;
  tip: string;
  /** Estimated monthly saving in poisha. Never more than the category's spending. */
  saving: number;
};

export type Advice = { summary: string; suggestions: Suggestion[] };

/** The shape the model is asked to return. Savings are in taka. */
const modelResponse = z.object({
  summary: z.string().trim().min(1).max(1200),
  suggestions: z
    .array(
      z.object({
        category: z.string().trim().min(1),
        tip: z.string().trim().min(1).max(500),
        saving: z.number(),
      }),
    )
    .max(12),
});

/** The same shape as a JSON schema, sent to the model to constrain its output. */
export const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Two or three plain sentences about the month." },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", description: "One of the category names given." },
          tip: { type: "string", description: "One short, practical tip." },
          saving: { type: "number", description: "Estimated monthly saving in taka." },
        },
        required: ["category", "tip", "saving"],
      },
    },
  },
  required: ["summary", "suggestions"],
} as const;

export type ParsedAdvice =
  | { ok: true; advice: Advice; dropped: number }
  | { ok: false };

/**
 * Reads the model's reply. A reply that is not JSON of the right shape is rejected. A
 * suggestion is dropped when its category is not one we sent, when its saving is not a
 * positive number, or when the saving is more than the user spent in that category,
 * because the figures belong to us and not to the model.
 */
export function parseAdvice(raw: string, payload: AdvicePayload): ParsedAdvice {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  const parsed = modelResponse.safeParse(json);
  if (!parsed.success) return { ok: false };

  const spent = new Map(
    payload.categories.map((c) => [c.category.toLowerCase(), { name: c.category, spent: c.spent }]),
  );
  const suggestions: Suggestion[] = [];
  for (const item of parsed.data.suggestions) {
    const known = spent.get(item.category.toLowerCase());
    const saving = Math.round(item.saving * 100);
    if (!known || !Number.isFinite(saving) || saving <= 0) continue;
    if (saving > Math.round(known.spent * 100)) continue;
    suggestions.push({ category: known.name, tip: item.tip, saving });
  }
  return {
    ok: true,
    advice: { summary: parsed.data.summary, suggestions },
    dropped: parsed.data.suggestions.length - suggestions.length,
  };
}
