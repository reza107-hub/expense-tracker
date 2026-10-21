import { createAuth } from "@/lib/auth/auth";
import type { TestDb } from "./db";

export const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long";
export const TEST_PASSWORD = "correct horse battery";

/** An account system over the in-memory database. It sets no cookies by itself. */
export function createTestAuth(
  db: TestDb,
  options: { allowedEmails?: string[] | null; secret?: string } = {},
) {
  const { secret = TEST_SECRET, ...rest } = options;
  return createAuth({
    db,
    secret,
    baseURL: "http://localhost:3000",
    withNextCookies: false,
    ...rest,
  });
}

/**
 * Registers a user and returns their id and the request headers a browser would send
 * afterwards (the session cookie).
 */
export async function registerUser(
  auth: ReturnType<typeof createTestAuth>,
  email: string,
  password = TEST_PASSWORD,
) {
  const { headers, response } = await auth.api.signUpEmail({
    body: { name: email.split("@")[0], email, password },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { userId: response.user.id, headers: new Headers({ cookie }) };
}
