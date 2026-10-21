import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { categories, session, settings, user } from "@/db/schema";
import { createTestAuth, registerUser } from "@/test/auth-helpers";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { resolveUserId } from "./resolve-user";

describe("resolveUserId (in-memory PGlite)", () => {
  let db: TestDb;
  let close: () => Promise<void>;
  let auth: ReturnType<typeof createTestAuth>;

  beforeAll(async () => {
    const test = await createTestDb();
    db = test.db;
    close = () => test.client.close();
    auth = createTestAuth(db);
  });
  afterAll(() => close());
  beforeEach(async () => {
    await resetTestDb(db);
    await db.delete(user);
  });

  const resolve = (headers: Headers) => resolveUserId(auth, db, headers);

  it("returns the user id for a valid session", async () => {
    const { userId, headers } = await registerUser(auth, "a@example.com");
    expect(await resolve(headers)).toBe(userId);
  });

  it("returns the right user when two people are signed in", async () => {
    const a = await registerUser(auth, "a@example.com");
    const b = await registerUser(auth, "b@example.com");
    expect(await resolve(a.headers)).toBe(a.userId);
    expect(await resolve(b.headers)).toBe(b.userId);
    expect(a.userId).not.toBe(b.userId);
  });

  it("returns null when there is no cookie", async () => {
    expect(await resolve(new Headers())).toBeNull();
  });

  it("returns null for a made-up or tampered cookie", async () => {
    const { headers } = await registerUser(auth, "a@example.com");
    const cookie = headers.get("cookie")!;
    for (const bad of [
      "better-auth.session_token=not-a-real-token",
      cookie.slice(0, -4) + "AAAA",
      "better-auth.session_token=",
    ]) {
      expect(await resolve(new Headers({ cookie: bad })), bad).toBeNull();
    }
  });

  it("returns null for a cookie signed with a different secret, even with a real session row", async () => {
    // A second app instance with another secret creates a genuine session in the same
    // database. Its cookie must still be refused, because this app did not sign it.
    const forger = createTestAuth(db, { secret: "another-secret-that-is-at-least-32-chars-long" });
    const forged = await registerUser(forger, "a@example.com");

    expect(await resolveUserId(forger, db, forged.headers)).toBe(forged.userId);
    expect(await resolve(forged.headers)).toBeNull();
  });

  it("returns null for the raw session token without its signature", async () => {
    const { headers } = await registerUser(auth, "a@example.com");
    const value = decodeURIComponent(headers.get("cookie")!.split("=").slice(1).join("="));
    const unsigned = value.split(".")[0];
    expect(await resolve(new Headers({ cookie: `better-auth.session_token=${unsigned}` }))).toBeNull();
  });

  it("returns null after the user signs out", async () => {
    const { headers } = await registerUser(auth, "a@example.com");
    expect(await resolve(headers)).not.toBeNull();
    await auth.api.signOut({ headers });
    expect(await resolve(headers)).toBeNull();
  });

  it("returns null once the session has expired", async () => {
    const { headers } = await registerUser(auth, "a@example.com");
    await db.update(session).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await resolve(headers)).toBeNull();
  });

  it("returns null when the user has been deleted", async () => {
    const { headers, userId } = await registerUser(auth, "a@example.com");
    await db.delete(user).where(eq(user.id, userId));
    expect(await resolve(headers)).toBeNull();
  });

  it("sets up an account whose defaults are missing", async () => {
    const { headers, userId } = await registerUser(auth, "a@example.com");
    await db.delete(categories).where(eq(categories.userId, userId));
    await db.delete(settings).where(eq(settings.userId, userId));

    expect(await resolve(headers)).toBe(userId);

    expect(await db.select().from(categories).where(eq(categories.userId, userId))).toHaveLength(9);
    expect(await db.select().from(settings).where(eq(settings.userId, userId))).toHaveLength(1);
  });

  it("does not bring back categories or reset settings on later requests", async () => {
    const { headers, userId } = await registerUser(auth, "a@example.com");
    await db
      .update(categories)
      .set({ name: "Groceries" })
      .where(and(eq(categories.userId, userId), eq(categories.name, "Food")));
    await db.update(settings).set({ monthStartDay: 25 }).where(eq(settings.userId, userId));

    await resolve(headers);
    await resolve(headers);

    const names = (await db.select().from(categories).where(eq(categories.userId, userId))).map(
      (c) => c.name,
    );
    expect(names).toContain("Groceries");
    expect(names).not.toContain("Food");
    const [row] = await db.select().from(settings).where(eq(settings.userId, userId));
    expect(row.monthStartDay).toBe(25);
  });
});
