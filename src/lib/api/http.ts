/** Small helpers for the JSON API. Every error has the same shape: { error: { code, message, ... } }. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function errorResponse(error: ApiError): Response {
  return json({ error: { code: error.code, message: error.message, ...error.extra } }, error.status);
}

export const invalid = (fieldErrors: Record<string, string | undefined>, formError?: string) =>
  new ApiError(400, "INVALID_INPUT", formError ?? "Some fields need fixing.", { fieldErrors });

export const notFound = (message: string) => new ApiError(404, "NOT_FOUND", message);

/**
 * The validators in src/lib read browser forms (FormData). The app sends JSON, so it is
 * turned into the same FormData and goes through the very same rules as the website.
 * `true` becomes "on" (a ticked switch); null and missing values are left out.
 */
export function toFormData(body: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") form.set(key, value);
    else if (typeof value === "number" && Number.isFinite(value)) form.set(key, String(value));
    else if (value === true) form.set(key, "on");
  }
  return form;
}

/** Reads a JSON object body. An empty body is an empty object. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new ApiError(400, "INVALID_JSON", "The request body must be a JSON object.");
}
