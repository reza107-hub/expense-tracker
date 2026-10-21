import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { account, session, user } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { createAuth, normaliseEmail, SESSION_LIFETIME_SECONDS } from "./auth";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const PASSWORD = "correct horse battery";

describe("normaliseEmail", () => {
  it("trims and lower-cases", () => {
    expect(normaliseEmail("  Friend@Example.COM ")).toBe("friend@example.com");
    expect(normaliseEmail("a@b.co")).toBe("a@b.co");
  });
});

describe("Better Auth accounts (in-memory PGlite)", () => {
  let db: TestDb;
  let close: () => Promise<void>;
  let auth: ReturnType<typeof createAuth>;

  beforeAll(async () => {
    const test = await createTestDb();
    db = test.db;
    close = () => test.client.close();
    auth = createAuth({
      db,
      secret: SECRET,
      baseURL: "http://localhost:3000",
      withNextCookies: false,
    });
  });
  afterAll(() => close());
  beforeEach(async () => {
    await resetTestDb(db);
    await db.delete(user); // cascades to sessions and accounts
  });

  const register = (email: string, password = PASSWORD) =>
    auth.api.signUpEmail({ body: { name: "Friend", email, password } });

  it("registers a user and stores only a hash of the password", async () => {
    const result = await register("friend@example.com");
    expect(result.user.email).toBe("friend@example.com");

    const [row] = await db.select().from(account).where(eq(account.userId, result.user.id));
    expect(row.password).toBeTruthy();
    expect(row.password).not.toContain(PASSWORD);
    expect(row.password!.length).toBeGreaterThan(50);
    expect(row.providerId).toBe("credential");
  });

  it("stores emails in lower case", async () => {
    await register("Friend@Example.COM");
    const [row] = await db.select().from(user);
    expect(row.email).toBe("friend@example.com");
  });

  it("rejects a second account for the same email in another letter case", async () => {
    await register("friend@example.com");
    await expect(register("FRIEND@example.com")).rejects.toThrow();
    expect(await db.select().from(user)).toHaveLength(1);
  });

  it("rejects passwords shorter than 8 or longer than 128 characters", async () => {
    await expect(register("a@example.com", "1234567")).rejects.toThrow();
    await expect(register("b@example.com", "x".repeat(129))).rejects.toThrow();
    expect(await db.select().from(user)).toHaveLength(0);
    await expect(register("c@example.com", "12345678")).resolves.toBeTruthy();
    await expect(register("d@example.com", "x".repeat(128))).resolves.toBeTruthy();
  });

  it("rejects a malformed email", async () => {
    await expect(register("not-an-email")).rejects.toThrow();
    expect(await db.select().from(user)).toHaveLength(0);
  });

  it("signs in with the right password and rejects the wrong one", async () => {
    await register("friend@example.com");
    const ok = await auth.api.signInEmail({
      body: { email: "friend@example.com", password: PASSWORD },
    });
    expect(ok.user.email).toBe("friend@example.com");

    await expect(
      auth.api.signInEmail({ body: { email: "friend@example.com", password: "wrong-password" } }),
    ).rejects.toThrow();
    await expect(
      auth.api.signInEmail({ body: { email: "nobody@example.com", password: PASSWORD } }),
    ).rejects.toThrow();
  });

  it("signs in regardless of the letter case typed", async () => {
    await register("friend@example.com");
    const ok = await auth.api.signInEmail({
      body: { email: "FRIEND@Example.com", password: PASSWORD },
    });
    expect(ok.user.email).toBe("friend@example.com");
  });

  it("creates a session that lasts 90 days", async () => {
    await register("friend@example.com");
    const [row] = await db.select().from(session);
    const lifetimeSeconds = (row.expiresAt.getTime() - row.createdAt.getTime()) / 1000;
    expect(Math.round(lifetimeSeconds)).toBe(SESSION_LIFETIME_SECONDS);
  });

  it("sets an httpOnly, lax session cookie when registering", async () => {
    const { headers } = await auth.api.signUpEmail({
      body: { name: "Friend", email: "friend@example.com", password: PASSWORD },
      returnHeaders: true,
    });
    const cookie = headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/session_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=7776000/); // 90 days
  });

  it("ends a session on sign-out", async () => {
    const { headers } = await auth.api.signUpEmail({
      body: { name: "Friend", email: "friend@example.com", password: PASSWORD },
      returnHeaders: true,
    });
    const cookie = (headers.get("set-cookie") ?? "").split(";")[0];
    const requestHeaders = new Headers({ cookie });

    expect(await auth.api.getSession({ headers: requestHeaders })).not.toBeNull();
    await auth.api.signOut({ headers: requestHeaders });
    expect(await auth.api.getSession({ headers: requestHeaders })).toBeNull();
  });
});
