import { parseAllowedEmails } from "./auth";

export const MIN_SECRET_LENGTH = 32;

export class AuthConfigError extends Error {}

export type AuthEnv = {
  /** Signs session cookies. Changing it signs everyone out. */
  secret: string;
  /** The public address of the app. */
  baseURL: string;
  /** Only these emails may register. Null means anyone may. */
  allowedEmails: string[] | null;
};

/** Reads the account settings from the environment. Throws if they are missing or weak. */
export function getAuthEnv(
  env: Record<string, string | undefined> = process.env,
): AuthEnv {
  const secret = env.AUTH_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new AuthConfigError(
      `AUTH_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters long`,
    );
  }

  // Vercel previews get a new address each time, so fall back to it when no fixed
  // address is set. Local development falls back to localhost.
  const baseURL =
    env.BETTER_AUTH_URL ||
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:3000");

  return { secret, baseURL, allowedEmails: parseAllowedEmails(env.ALLOWED_EMAILS) };
}
