import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { categories, entries, wallets } from "@/db/schema";
import { DEFAULT_CATEGORIES, LOAN_FEES_CATEGORY } from "@/db/seed";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { insertUser } from "@/test/users";
import {
  archiveCategory,
  createCategory,
  renameCategory,
  restoreCategory,
} from "./mutations";
import { listCategories, listSelectableCategories } from "./queries";
import { validateCategory } from "./validation";

function form(name: string) {
  const data = new FormData();
  data.set("name", name);
  return data;
}

describe("validateCategory", () => {
  it("trims and collapses spaces", () => {
    expect(validateCategory(form("  Eating   out "))).toEqual({ ok: true, name: "Eating out" });
  });

  it("rejects an empty name and one over 40 characters", () => {
    expect(validateCategory(form("   ")).ok).toBe(false);
    expect(validateCategory(form("x".repeat(41))).ok).toBe(false);
  });
});

describe("categories", () => {
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
    await db.execute(sql`delete from "user"`);
    await insertUser(db, "a");
    await insertUser(db, "b");
  });

  const names = async (userId: string, archived = false) =>
    (await listCategories(db, userId, { archived })).map((c) => c.name);

  async function idOf(userId: string, name: string) {
    const [row] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.name, name)));
    return row.id;
  }

  it("gives a new account the defaults, and expense forms never see the reserved one", async () => {
    expect(await names("a")).toEqual([...DEFAULT_CATEGORIES, LOAN_FEES_CATEGORY]);
    const selectable = (await listSelectableCategories(db, "a")).map((c) => c.name);
    expect(selectable).toEqual([...DEFAULT_CATEGORIES]);
    expect(selectable).not.toContain(LOAN_FEES_CATEGORY);
  });

  it("adds a custom category", async () => {
    expect(await createCategory(db, "a", "Education")).toEqual({ ok: true });
    expect((await listSelectableCategories(db, "a")).map((c) => c.name)).toContain("Education");
  });

  it("rejects a duplicate name ignoring letter case", async () => {
    expect(await createCategory(db, "a", "food")).toEqual({ ok: false, reason: "duplicate-name" });
    expect(await createCategory(db, "a", "FOOD")).toEqual({ ok: false, reason: "duplicate-name" });
  });

  it("rejects a name that matches an archived category", async () => {
    await archiveCategory(db, "a", await idOf("a", "Shopping"));
    expect(await createCategory(db, "a", "shopping")).toEqual({
      ok: false,
      reason: "duplicate-name",
    });
  });

  it("accepts a name another user already has", async () => {
    await createCategory(db, "a", "Education");
    expect(await createCategory(db, "b", "Education")).toEqual({ ok: true });
  });

  it("renames a category and refuses a clashing name", async () => {
    const other = await idOf("a", "Other");
    expect(await renameCategory(db, "a", other, "Misc")).toEqual({ ok: true });
    expect(await names("a")).toContain("Misc");
    expect(await names("a")).not.toContain("Other");
    expect(await renameCategory(db, "a", other, "food")).toEqual({
      ok: false,
      reason: "duplicate-name",
    });
  });

  it("archives a used category without touching its past entries, and restores it", async () => {
    const shopping = await idOf("a", "Shopping");
    const [wallet] = await db
      .insert(wallets)
      .values({ userId: "a", name: "Cash", openingBalance: 100000 })
      .returning();
    await db.insert(entries).values({
      userId: "a",
      type: "expense",
      walletId: wallet.id,
      categoryId: shopping,
      amount: 25000,
      entryDate: "2026-10-01",
    });

    expect(await archiveCategory(db, "a", shopping)).toEqual({ ok: true });
    expect((await listSelectableCategories(db, "a")).map((c) => c.name)).not.toContain("Shopping");
    expect(await names("a", true)).toEqual(["Shopping"]);
    const [kept] = await db.select().from(entries).where(eq(entries.categoryId, shopping));
    expect(kept.amount).toBe(25000);

    expect(await restoreCategory(db, "a", shopping)).toEqual({ ok: true });
    expect((await listSelectableCategories(db, "a")).map((c) => c.name)).toContain("Shopping");
    expect(await names("a", true)).toEqual([]);
  });

  it("never archives the reserved loan category", async () => {
    const reserved = await idOf("a", LOAN_FEES_CATEGORY);
    expect(await archiveCategory(db, "a", reserved)).toEqual({ ok: false, reason: "reserved" });
    expect(await names("a")).toContain(LOAN_FEES_CATEGORY);
    expect(await names("a", true)).toEqual([]);
  });

  it("cannot delete: there is no delete function, only archive", async () => {
    const mutations = await import("./mutations");
    expect(Object.keys(mutations).sort()).toEqual([
      "archiveCategory",
      "createCategory",
      "renameCategory",
      "restoreCategory",
    ]);
  });

  describe("with two users", () => {
    it("one user's changes never show for the other", async () => {
      const aFood = await idOf("a", "Food");
      await renameCategory(db, "a", aFood, "Groceries");
      await createCategory(db, "a", "Education");
      await archiveCategory(db, "a", await idOf("a", "Rent"));

      expect(await names("b")).toContain("Food");
      expect(await names("b")).toContain("Rent");
      expect(await names("b")).not.toContain("Groceries");
      expect(await names("b")).not.toContain("Education");
      expect(await names("b", true)).toEqual([]);
    });

    it("user B cannot rename, archive or restore user A's category", async () => {
      const aFood = await idOf("a", "Food");
      const aRent = await idOf("a", "Rent");
      await archiveCategory(db, "a", aRent);

      expect(await renameCategory(db, "b", aFood, "Hacked")).toEqual({
        ok: false,
        reason: "not-found",
      });
      expect(await archiveCategory(db, "b", aFood)).toEqual({ ok: false, reason: "not-found" });
      expect(await restoreCategory(db, "b", aRent)).toEqual({ ok: false, reason: "not-found" });

      expect(await names("a")).toContain("Food");
      expect(await names("a", true)).toEqual(["Rent"]);
    });
  });
});
