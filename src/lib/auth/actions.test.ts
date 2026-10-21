import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { categories, loginAttempts, session, settings, user } from "@/db/schema";
import { TEST_PASSWORD, createTestAuth, registerUser } from "@/test/auth-helpers";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import type { RegisterState, SignInState } from "./types";

// Stand-ins for the request: its headers, a redirect that throws as Next.js does, and
// the account system, which here runs over the in-memory database.
const held = vi.hoisted(() => ({
  headers: new Headers(),
  auth: undefined as unknown,
  authError: undefined as unknown,
}));

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("next/headers", () => ({ headers: async () => held.headers }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));
vi.mock("@/db", () => ({ getDb: () => undefined }));
vi.mock("./instance", () => ({
  getAuth: () => {
    if (held.authError) throw held.authError;
    return held.auth;
  },
}));

const { register, signIn, signOut } = await import("./actions");
const { AuthConfigError } = await import("./env");

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const idleRegister: RegisterState = { status: "idle" };
const idleSignIn: SignInState = { status: "idle" };

describe("account actions (in-memory PGlite)", () => {
  let db: TestDb;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const test = await createTestDb();
    db = test.db;
    close = () => test.client.close();
  });
  afterAll(() => close());
  beforeEach(async () => {
    await resetTestDb(db);
    await db.delete(user);
    held.headers = new Headers();
    held.authError = undefined;
    held.auth = createTestAuth(db);
  });

  const registerForm = (overrides: Record<string, string> = {}) =>
    form({
      email: "Friend@Example.com",
      password: "correct horse",
      confirmPassword: "correct horse",
      ...overrides,
    });
  const users = () => db.select().from(user);

  describe("register", () => {
    it("creates the account, signs in and goes to the dashboard", async () => {
      await expect(register(idleRegister, registerForm())).rejects.toMatchObject({ url: "/" });

      const [created] = await users();
      expect(created.email).toBe("friend@example.com");
      expect(await db.select().from(session)).toHaveLength(1);
      expect(await db.select().from(categories).where(eq(categories.userId, created.id))).toHaveLength(9);
      expect(await db.select().from(settings).where(eq(settings.userId, created.id))).toHaveLength(1);
    });

    it("rejects mismatched passwords and creates nothing", async () => {
      const state = await register(idleRegister, registerForm({ confirmPassword: "different" }));
      expect(state).toMatchObject({
        status: "error",
        fieldErrors: { confirmPassword: expect.stringMatching(/do not match/) },
      });
      expect(await users()).toHaveLength(0);
    });

    it("rejects a weak password and a malformed email, field by field", async () => {
      const state = await register(
        idleRegister,
        registerForm({ email: "nope", password: "short", confirmPassword: "short" }),
      );
      expect(state).toMatchObject({
        status: "error",
        email: "nope",
        fieldErrors: { email: expect.any(String), password: expect.any(String) },
      });
      expect(await users()).toHaveLength(0);
    });

    it("rejects an email that is already registered, in any letter case", async () => {
      await registerUser(createTestAuth(db), "friend@example.com");
      const state = await register(idleRegister, registerForm({ email: "FRIEND@example.COM" }));
      expect(state).toMatchObject({
        status: "error",
        fieldErrors: { email: expect.stringMatching(/already registered/) },
      });
      expect(await users()).toHaveLength(1);
    });

    it("rejects an email that is not on the allow-list and creates nothing", async () => {
      held.auth = createTestAuth(db, { allowedEmails: ["someone-else@example.com"] });
      const state = await register(idleRegister, registerForm());
      expect(state).toMatchObject({
        status: "error",
        fieldErrors: { email: expect.stringMatching(/not allowed/) },
      });
      expect(await users()).toHaveLength(0);
    });

    it("accepts an email on the allow-list", async () => {
      held.auth = createTestAuth(db, { allowedEmails: ["friend@example.com"] });
      await expect(register(idleRegister, registerForm())).rejects.toMatchObject({ url: "/" });
      expect(await users()).toHaveLength(1);
    });

    it("keeps the typed email and never returns a password", async () => {
      const state = await register(idleRegister, registerForm({ password: "short", confirmPassword: "short" }));
      expect(state).toMatchObject({ email: "friend@example.com" });
      expect(JSON.stringify(state)).not.toContain("short");
      expect(JSON.stringify(state)).not.toContain("correct horse");
    });

    it("explains a setup problem without crashing", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      held.authError = new AuthConfigError("AUTH_SECRET must be set");
      const state = await register(idleRegister, registerForm());
      expect(state).toMatchObject({ status: "error", formError: "Sign-up is not set up yet." });
      errors.mockRestore();
    });

    it("gives a general message for an unexpected failure", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      held.authError = new Error("database is down");
      const state = await register(idleRegister, registerForm());
      expect(state).toMatchObject({ status: "error", formError: "Could not create the account. Try again." });
      expect(JSON.stringify(state)).not.toContain("database is down");
      errors.mockRestore();
    });
  });

  describe("signIn", () => {
    beforeEach(async () => {
      await registerUser(createTestAuth(db), "friend@example.com");
      await db.delete(session);
    });
    const attempt = (email: string, password: string) =>
      signIn(idleSignIn, form({ email, password }));

    it("signs in with the correct details, in any letter case, and goes to the dashboard", async () => {
      await expect(attempt("friend@example.com", TEST_PASSWORD)).rejects.toMatchObject({ url: "/" });
      await expect(attempt("  FRIEND@Example.com ", TEST_PASSWORD)).rejects.toMatchObject({ url: "/" });
      expect(await db.select().from(session)).toHaveLength(2);
    });

    it("gives the same generic answer for a wrong password and an unknown email", async () => {
      const wrong = await attempt("friend@example.com", "wrong-password");
      const unknown = await attempt("nobody@example.com", TEST_PASSWORD);
      expect(wrong).toMatchObject({ status: "invalid" });
      expect(unknown).toMatchObject({ status: "invalid" });
      expect(Object.keys(wrong).sort()).toEqual(Object.keys(unknown).sort());
      expect(await db.select().from(session)).toHaveLength(0);
    });

    it("keeps the typed email for redisplay", async () => {
      expect(await attempt(" Friend@Example.COM ", "wrong")).toMatchObject({
        status: "invalid",
        email: "Friend@Example.COM",
      });
    });

    it("treats empty and oversized fields as invalid without counting an attempt", async () => {
      expect(await attempt("", "pw")).toMatchObject({ status: "invalid" });
      expect(await attempt("friend@example.com", "")).toMatchObject({ status: "invalid" });
      expect(await attempt("friend@example.com", "x".repeat(129))).toMatchObject({ status: "invalid" });
      expect(await db.select().from(loginAttempts)).toHaveLength(0);
    });

    it("locks one email after five wrong passwords and then refuses the correct one", async () => {
      for (let i = 0; i < 5; i++) {
        expect(await attempt("friend@example.com", `wrong-${i}`)).toMatchObject({ status: "invalid" });
      }
      const refused = await attempt("friend@example.com", TEST_PASSWORD);
      expect(refused).toMatchObject({ status: "locked", email: "friend@example.com" });
      if (refused.status === "locked") {
        expect(refused.retryAfterSeconds).toBeGreaterThan(14 * 60);
        expect(refused.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
      }
      expect(await db.select().from(session)).toHaveLength(0);
    });

    it("does not lock a different email", async () => {
      await registerUser(createTestAuth(db), "other@example.com");
      await db.delete(session);
      for (let i = 0; i < 6; i++) await attempt("friend@example.com", `wrong-${i}`);
      await expect(attempt("other@example.com", TEST_PASSWORD)).rejects.toMatchObject({ url: "/" });
    });

    it("explains a setup problem and an unexpected failure without leaking details", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      held.authError = new AuthConfigError("AUTH_SECRET must be set");
      expect(await attempt("friend@example.com", TEST_PASSWORD)).toMatchObject({
        status: "error",
        message: "Sign-in is not set up yet.",
      });
      held.authError = new Error("connection refused 10.0.0.5");
      const state = await attempt("friend@example.com", TEST_PASSWORD);
      expect(state).toMatchObject({ status: "error", message: "Something went wrong. Try again." });
      expect(JSON.stringify(state)).not.toContain("10.0.0.5");
      errors.mockRestore();
    });

    it("never puts the password in the returned state", async () => {
      const state = await attempt("friend@example.com", "very-secret-guess");
      expect(JSON.stringify(state)).not.toContain("very-secret-guess");
    });
  });

  describe("signOut", () => {
    it("ends the session and goes to sign-in", async () => {
      const { headers } = await registerUser(createTestAuth(db), "friend@example.com");
      held.headers = headers;
      expect(await db.select().from(session)).toHaveLength(1);

      await expect(signOut()).rejects.toMatchObject({ url: "/sign-in" });
      expect(await db.select().from(session)).toHaveLength(0);
    });

    it("works when nobody is signed in", async () => {
      await expect(signOut()).rejects.toMatchObject({ url: "/sign-in" });
    });

    it("only ends the caller's own session", async () => {
      const a = await registerUser(createTestAuth(db), "a@example.com");
      await registerUser(createTestAuth(db), "b@example.com");
      held.headers = a.headers;
      await expect(signOut()).rejects.toMatchObject({ url: "/sign-in" });
      expect(await db.select().from(session)).toHaveLength(1);
    });
  });
});
