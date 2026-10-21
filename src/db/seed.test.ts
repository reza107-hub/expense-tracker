import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { DEFAULT_CATEGORIES, LOAN_FEES_CATEGORY, seedUserDefaults } from "./seed";
import { categories, settings, user } from "./schema";

describe("seedUserDefaults (in-memory PGlite)", () => {
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
    await db.insert(user).values([
      { id: "user-a", name: "A", email: "a@example.com" },
      { id: "user-b", name: "B", email: "b@example.com" },
    ]);
  });

  const categoriesOf = (userId: string) =>
    db.select().from(categories).where(eq(categories.userId, userId));

  it("creates the default categories, the reserved one and the default settings", async () => {
    expect(await seedUserDefaults(db, "user-a")).toBe(true);

    const rows = await categoriesOf("user-a");
    expect(rows.map((r) => r.name).sort()).toEqual(
      [...DEFAULT_CATEGORIES, LOAN_FEES_CATEGORY].sort(),
    );
    expect(rows.filter((r) => r.isReserved).map((r) => r.name)).toEqual([LOAN_FEES_CATEGORY]);
    expect(rows.every((r) => r.archivedAt === null)).toBe(true);

    const [row] = await db.select().from(settings).where(eq(settings.userId, "user-a"));
    expect(row).toMatchObject({ monthStartDay: 1, alertsEnabled: false, monthlyLimit: null });
  });

  it("creates no wallets, entries or loans", async () => {
    await seedUserDefaults(db, "user-a");
    const wallets = await db.execute(`select count(*)::int as n from wallets` as never);
    expect((wallets.rows[0] as { n: number }).n).toBe(0);
  });

  it("is safe to run twice: no duplicates and nothing reported as created", async () => {
    expect(await seedUserDefaults(db, "user-a")).toBe(true);
    expect(await seedUserDefaults(db, "user-a")).toBe(false);
    expect(await categoriesOf("user-a")).toHaveLength(DEFAULT_CATEGORIES.length + 1);
    expect(await db.select().from(settings)).toHaveLength(1);
  });

  it("does not bring back categories the user renamed or archived", async () => {
    await seedUserDefaults(db, "user-a");
    await db
      .update(categories)
      .set({ name: "Groceries" })
      .where(and(eq(categories.userId, "user-a"), eq(categories.name, "Food")));
    await db
      .update(categories)
      .set({ archivedAt: new Date() })
      .where(and(eq(categories.userId, "user-a"), eq(categories.name, "Shopping")));

    await seedUserDefaults(db, "user-a");

    const rows = await categoriesOf("user-a");
    expect(rows).toHaveLength(DEFAULT_CATEGORIES.length + 1);
    expect(rows.map((r) => r.name)).toContain("Groceries");
    expect(rows.map((r) => r.name)).not.toContain("Food");
    expect(rows.find((r) => r.name === "Shopping")?.archivedAt).not.toBeNull();
  });

  it("does not overwrite settings the user has changed", async () => {
    await seedUserDefaults(db, "user-a");
    await db
      .update(settings)
      .set({ monthStartDay: 25, alertsEnabled: true, monthlyLimit: 3000000 })
      .where(eq(settings.userId, "user-a"));

    await seedUserDefaults(db, "user-a");

    const [row] = await db.select().from(settings).where(eq(settings.userId, "user-a"));
    expect(row).toMatchObject({ monthStartDay: 25, alertsEnabled: true, monthlyLimit: 3000000 });
  });

  it("gives two users separate copies", async () => {
    await seedUserDefaults(db, "user-a");
    await db.update(categories).set({ name: "Mine" }).where(
      and(eq(categories.userId, "user-a"), eq(categories.name, "Other")),
    );
    await db.update(settings).set({ monthStartDay: 25 }).where(eq(settings.userId, "user-a"));

    await seedUserDefaults(db, "user-b");

    const b = await categoriesOf("user-b");
    expect(b.map((r) => r.name)).toContain("Other");
    expect(b.map((r) => r.name)).not.toContain("Mine");
    const [bSettings] = await db.select().from(settings).where(eq(settings.userId, "user-b"));
    expect(bSettings.monthStartDay).toBe(1);
    expect(await db.select().from(settings)).toHaveLength(2);
  });

  it("leaves nothing behind when it fails part-way", async () => {
    // The user does not exist, so the settings insert fails and the whole step rolls back.
    await expect(seedUserDefaults(db, "no-such-user")).rejects.toThrow();
    expect(await db.select().from(categories)).toHaveLength(0);
    expect(await db.select().from(settings)).toHaveLength(0);
  });
});
