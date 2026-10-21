import { ensureUserDefaults } from "@/db/seed";
import type { AnyDb } from "@/db/types";
import type { Auth } from "./auth";

/**
 * The id of the user the request's session cookie belongs to, or null.
 *
 * The session is looked up in the database on every call, so a signed-out, expired or
 * deleted session is refused at once. A user whose defaults are missing (their account
 * was created but setting it up failed) is set up here.
 *
 * This holds no Next.js code so tests can run it against an in-memory database.
 */
export async function resolveUserId(
  auth: Auth,
  db: AnyDb,
  headers: Headers,
): Promise<string | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  await ensureUserDefaults(db, session.user.id);
  return session.user.id;
}
