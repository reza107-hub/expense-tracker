import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { account, session, user, verification } from "@/db/schema";
import { seedUserDefaults } from "@/db/seed";
import type { AnyDb } from "@/db/types";
import { beginSignInAttempt, clearAttempts } from "./lockout";

export const SESSION_LIFETIME_SECONDS = 90 * 24 * 60 * 60;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Code on the error thrown when sign-in is locked for an email. */
export const SIGN_IN_LOCKED = "SIGN_IN_LOCKED";
/** Code on the error thrown when an email is not on the sign-up allow-list. */
export const EMAIL_NOT_ALLOWED = "EMAIL_NOT_ALLOWED";

const SIGN_IN_PATH = "/sign-in/email";

/** Emails are the same address regardless of letter case or surrounding spaces. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Reads the sign-up allow-list from a comma, space or line separated list.
 * Returns null, meaning sign-up is open, when the list is missing or empty.
 */
export function parseAllowedEmails(value: string | undefined): string[] | null {
  const emails = (value ?? "")
    .split(/[\s,;]+/)
    .map(normaliseEmail)
    .filter(Boolean);
  return emails.length > 0 ? emails : null;
}

type AuthOptions = {
  db: AnyDb;
  /** Signs session cookies. Changing it signs everyone out. */
  secret: string;
  /** The public address of the app, for example https://expenses.example.com */
  baseURL: string;
  /**
   * Lets Server Actions set and clear the session cookie. It needs a Next.js request,
   * so tests turn it off.
   */
  withNextCookies?: boolean;
  /** The current time. Tests replace it to move through the 15 minute lock. */
  now?: () => Date;
  /** Only these emails may register. Null or empty means anyone may. */
  allowedEmails?: string[] | null;
};

/**
 * The one place accounts are configured. The HTTP handler (/api/auth) is never
 * mounted: Server Actions call `auth.api.*` directly.
 */
export function createAuth({
  db,
  secret,
  baseURL,
  withNextCookies = true,
  now = () => new Date(),
  allowedEmails = null,
}: AuthOptions) {
  return betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      requireEmailVerification: false,
      autoSignIn: true,
    },
    session: {
      expiresIn: SESSION_LIFETIME_SECONDS,
      // Sessions are checked against the database on every request, so signing out
      // takes effect at once.
      cookieCache: { enabled: false },
    },
    databaseHooks: {
      user: {
        create: {
          // Registration is refused for emails that are not on the allow-list.
          before: async (newUser) => {
            if (allowedEmails && !allowedEmails.includes(normaliseEmail(newUser.email))) {
              throw new APIError("FORBIDDEN", {
                code: EMAIL_NOT_ALLOWED,
                message: "This email is not allowed to register.",
              });
            }
          },
          // Every new account starts with the default categories and settings. If this
          // fails the account still exists, and the next request sets it up (requireUser).
          after: async (newUser) => {
            try {
              await seedUserDefaults(db, newUser.id);
            } catch (error) {
              console.error("Could not set up a new account's defaults", error);
            }
          },
        },
      },
    },
    hooks: {
      // Per-email lock: 5 attempts in 15 minutes lock that email for 15 minutes.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_IN_PATH) return;
        const email = normaliseEmail(String((ctx.body as { email?: unknown })?.email ?? ""));
        if (!email) return; // The library rejects a missing email itself.

        const start = await beginSignInAttempt(db, email, now());
        if (start.status === "locked") {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((start.until.getTime() - now().getTime()) / 1000),
          );
          throw new APIError("TOO_MANY_REQUESTS", {
            code: SIGN_IN_LOCKED,
            message: "Too many sign-in attempts. Try again later.",
            retryAfterSeconds,
          });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_IN_PATH || !ctx.context.newSession) return;
        await clearAttempts(db, normaliseEmail(ctx.context.newSession.user.email));
      }),
    },
    plugins: withNextCookies ? [nextCookies()] : [],
  });
}

export type Auth = ReturnType<typeof createAuth>;
