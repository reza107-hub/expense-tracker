import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getAuth } from "./instance";
import { resolveUserId } from "./resolve-user";

export const SIGN_IN_PATH = "/sign-in";

/** The signed-in user's id, or null. Reads `headers()`. */
export async function currentUserId(): Promise<string | null> {
  // Read the request first. That marks this as per-request work, so a build skips it
  // instead of trying to open the database and the account system.
  const requestHeaders = await headers();
  return resolveUserId(getAuth(), getDb(), requestHeaders);
}

/**
 * Call this first in every Server Action and every data read, and use the id it
 * returns for every query. Never take a user id from the browser.
 *
 * The route guard (proxy.ts) only redirects page visits that have no cookie, and
 * Server Actions can be called directly, so each one has to check for itself. Without
 * a valid session this redirects to sign-in, which stops the caller before anything is
 * read or changed.
 *
 * Because it reads `headers()`, anything that calls it must render behind a
 * `<Suspense>` boundary (Cache Components).
 */
export async function requireUser(): Promise<{ userId: string }> {
  const userId = await currentUserId();
  if (!userId) redirect(SIGN_IN_PATH);
  return { userId };
}
