import { ApiError, GoogleGenAI } from "@google/genai";
import type { AdvicePayload } from "./payload";
import { RESPONSE_JSON_SCHEMA } from "./response";

/** Something the service can say went wrong, in words safe to show the user. */
export class AdviceError extends Error {
  constructor(
    readonly kind: "rate-limit" | "timeout" | "unavailable" | "not-configured",
    message: string,
  ) {
    super(message);
  }
}

/** Sends the figures to a model and returns its raw text reply. Swapped out in tests. */
export type AdviceClient = { generate(payload: AdvicePayload): Promise<string> };

const REQUEST_TIMEOUT_MS = 25_000;

const INSTRUCTIONS = `You help one person understand their monthly spending in Bangladeshi taka.
You receive only totals. Use only the figures given. Never invent a category or a number.
Write a short plain-language summary, then up to five suggestions. Each suggestion names one
category from the list, gives one practical tip, and estimates a realistic monthly saving in
taka that is smaller than that category's spending. Be kind and specific. Do not ask for more data.`;

/**
 * The Gemini client, or null when no key is set. The key and model come from the
 * server's environment and never leave this file.
 */
export function createGeminiClient(
  env: Record<string, string | undefined> = process.env,
): AdviceClient | null {
  const apiKey = env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL;
  if (!apiKey || !model) return null;
  const ai = new GoogleGenAI({ apiKey });

  return {
    async generate(payload) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: JSON.stringify(payload),
          config: {
            systemInstruction: INSTRUCTIONS,
            responseMimeType: "application/json",
            responseJsonSchema: RESPONSE_JSON_SCHEMA,
            temperature: 0.4,
            abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          },
        });
        return response.text ?? "";
      } catch (error) {
        throw toAdviceError(error);
      }
    },
  };
}

/** Turns whatever the library threw into one of our messages, keeping details out. */
export function toAdviceError(error: unknown): AdviceError {
  if (error instanceof AdviceError) return error;
  if (error instanceof ApiError && error.status === 429) {
    return new AdviceError(
      "rate-limit",
      "The advice service is busy right now. Please try again in a little while.",
    );
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new AdviceError("timeout", "The advice service took too long. Please try again.");
  }
  return new AdviceError(
    "unavailable",
    "The advice service could not be reached. Please try again later.",
  );
}
