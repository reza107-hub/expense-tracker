import { and, eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/db/seed";
import { categories, settings, user, wallets } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { EMAIL_NOT_ALLOWED, createAuth, parseAllowedEmails } from "./auth";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const PASSWORD = "correct horse battery";

describe("parseAllowedEmails", () => {
  it("means open sign-up when missing or empty", () => {
    expect(parseAllowedEmails(undefined)).toBeNull();
    expect(parseAllowedEmails("")).toBeNull();
    expect(parseAllowedEmails("  \n , ; ")).toBeNull();
  });

  it("splits on commas, semicolons, spaces and new lines, and normalises", () => {
    expect(parseAllowedEmails("A@x.com, b@X.com\nc@x.com;  d@x.com ")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
    ]);
  });
});

describe("sign-up rules (in-memory PGlite)", () => {
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
  });

  const makeAuth = (allowedEmails: string[] | null = null) =>
    createAuth({
      db,
      secret: SECRET,
      baseURL: "http://localhost:3000",
      withNextCookies: false,
      allowedEmails,
    });
  const register = (auth: ReturnType<typeof makeAuth>, email: string) =>
    auth.api.signUpEmail({ body: { name: "Friend", email, password: PASSWORD } });
  const categoriesOf = (userId: string) =>
    db.select().from(categories).where(eq(categories.userId, userId));

  describe("allow-list", () => {
    it("accepts anyone when no list is configured", async () => {
      const auth = makeAuth(null);
      await expect(register(auth, "stranger@example.com")).resolves.toBeTruthy();
      expect(await db.select().from(user)).toHaveLength(1);
    });

    it("accepts an email on the list, in any letter case", async () => {
      const auth = makeAuth(["friend@example.com"]);
      await expect(register(auth, "Friend@Example.COM")).resolves.toBeTruthy();
      expect(await db.select().from(user)).toHaveLength(1);
    });

    it("rejects an email that is not on the list and creates nothing", async () => {
      const auth = makeAuth(["friend@example.com"]);
      const error = await register(auth, "stranger@example.com").catch((e) => e);

      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).body).toMatchObject({ code: EMAIL_NOT_ALLOWED });
      expect(await db.select().from(user)).toHaveLength(0);
      expect(await db.select().from(categories)).toHaveLength(0);
      expect(await db.select().from(settings)).toHaveLength(0);
    });

    it("does not let a lookalike address through", async () => {
      const auth = makeAuth(["friend@example.com"]);
      for (const email of ["friend@example.com.evil.com", "xfriend@example.com", "friend+1@example.com"]) {
        await expect(register(auth, email), email).rejects.toThrow();
      }
      expect(await db.select().from(user)).toHaveLength(0);
    });

    it("only limits registration: an existing account can still sign in", async () => {
      await register(makeAuth(null), "old@example.com");
      const strict = makeAuth(["friend@example.com"]);
      const ok = await strict.api.signInEmail({
        body: { email: "old@example.com", password: PASSWORD },
      });
      expect(ok.user.email).toBe("old@example.com");
    });
  });

  describe("defaults for a new account", () => {
    it("creates the default categories, the loan category and the default settings", async () => {
      const auth = makeAuth();
      const { user: created } = await register(auth, "friend@example.com");

      const rows = await categoriesOf(created.id);
      expect(rows).toHaveLength(DEFAULT_CATEGORIES.length + 1);
      expect(rows.filter((r) => r.isReserved)).toHaveLength(1);

      const [row] = await db.select().from(settings).where(eq(settings.userId, created.id));
      expect(row).toMatchObject({ monthStartDay: 1, alertsEnabled: false });
    });

    it("starts with no wallets", async () => {
      const { user: created } = await register(makeAuth(), "friend@example.com");
      expect(await db.select().from(wallets).where(eq(wallets.userId, created.id))).toHaveLength(0);
    });

    it("gives two users separate defaults", async () => {
      const auth = makeAuth();
      const { user: a } = await register(auth, "a@example.com");
      await db
        .update(categories)
        .set({ name: "Mine", archivedAt: new Date() })
        .where(and(eq(categories.userId, a.id), eq(categories.name, "Other")));
      await db.update(settings).set({ monthStartDay: 25 }).where(eq(settings.userId, a.id));

      const { user: b } = await register(auth, "b@example.com");

      const bNames = (await categoriesOf(b.id)).map((r) => r.name);
      expect(bNames).toContain("Other");
      expect(bNames).not.toContain("Mine");
      const [bSettings] = await db.select().from(settings).where(eq(settings.userId, b.id));
      expect(bSettings.monthStartDay).toBe(1);
    });
  });
});
