import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { categories, entries, loans, wallets } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { insertUser } from "@/test/users";
import { periodForMonth } from "@/lib/period";
import { getMonthStartDay } from "@/lib/settings/queries";
import { listEntries } from "./list";

describe("listEntries", () => {
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

  const october = periodForMonth(2026, 10, 1);

  async function wallet(userId: string, name: string) {
    const [row] = await db.insert(wallets).values({ userId, name }).returning();
    return row.id;
  }
  async function category(userId: string, name: string) {
    const [row] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.name, name)));
    return row.id;
  }
  async function add(values: typeof entries.$inferInsert) {
    await db.insert(entries).values(values);
  }
  const notes = async (
    userId: string,
    period = october,
    filters: Parameters<typeof listEntries>[3] = {},
  ) => (await listEntries(db, userId, period, filters)).map((e) => e.note);

  it("lists a month newest first, and the same day by newest saved", async () => {
    const w = await wallet("a", "Cash");
    const food = await category("a", "Food");
    const base = { userId: "a", type: "expense" as const, walletId: w, categoryId: food, amount: 100 };
    await add({ ...base, entryDate: "2026-10-03", note: "old" });
    await add({ ...base, entryDate: "2026-10-20", note: "newest" });
    await add({ ...base, entryDate: "2026-10-10", note: "first of day" });
    await add({ ...base, entryDate: "2026-10-10", note: "second of day" });
    expect(await notes("a")).toEqual(["newest", "second of day", "first of day", "old"]);
  });

  it("includes the first and last day of the period and nothing outside it", async () => {
    const w = await wallet("a", "Cash");
    const base = { userId: "a", type: "income" as const, walletId: w, amount: 100 };
    await add({ ...base, entryDate: "2026-09-30", note: "before" });
    await add({ ...base, entryDate: "2026-10-01", note: "first day" });
    await add({ ...base, entryDate: "2026-10-31", note: "last day" });
    await add({ ...base, entryDate: "2026-11-01", note: "after" });
    expect(await notes("a")).toEqual(["last day", "first day"]);
  });

  it("follows the user's month start day", async () => {
    const w = await wallet("a", "Cash");
    await db.execute(sql`update settings set month_start_day = 25 where user_id = 'a'`);
    const startDay = await getMonthStartDay(db, "a");
    expect(startDay).toBe(25);
    const base = { userId: "a", type: "income" as const, walletId: w, amount: 100 };
    await add({ ...base, entryDate: "2026-10-24", note: "september period" });
    await add({ ...base, entryDate: "2026-10-25", note: "october period" });
    await add({ ...base, entryDate: "2026-11-24", note: "still october period" });
    expect(await notes("a", periodForMonth(2026, 10, startDay))).toEqual([
      "still october period",
      "october period",
    ]);
  });

  it("filters by wallet, and a transfer shows for both its wallets", async () => {
    const bkash = await wallet("a", "bKash");
    const bank = await wallet("a", "Bank");
    const cash = await wallet("a", "Cash");
    const food = await category("a", "Food");
    const date = "2026-10-05";
    await add({ userId: "a", type: "expense", walletId: bkash, categoryId: food, amount: 1, entryDate: date, note: "bkash spend" });
    await add({ userId: "a", type: "expense", walletId: cash, categoryId: food, amount: 1, entryDate: date, note: "cash spend" });
    await add({ userId: "a", type: "transfer", walletId: bank, toWalletId: bkash, amount: 1, entryDate: date, note: "bank to bkash" });

    expect((await notes("a", october, { walletId: bkash })).sort()).toEqual(["bank to bkash", "bkash spend"]);
    expect((await notes("a", october, { walletId: bank })).sort()).toEqual(["bank to bkash"]);
    expect(await notes("a", october, { walletId: cash })).toEqual(["cash spend"]);
  });

  it("filters by category", async () => {
    const w = await wallet("a", "Cash");
    const food = await category("a", "Food");
    const bills = await category("a", "Bills");
    const base = { userId: "a", type: "expense" as const, walletId: w, amount: 1, entryDate: "2026-10-05" };
    await add({ ...base, categoryId: food, note: "lunch" });
    await add({ ...base, categoryId: bills, note: "electricity" });
    expect(await notes("a", october, { categoryId: bills })).toEqual(["electricity"]);
  });

  it("combines both filters", async () => {
    const bkash = await wallet("a", "bKash");
    const cash = await wallet("a", "Cash");
    const food = await category("a", "Food");
    const base = { userId: "a", type: "expense" as const, categoryId: food, amount: 1, entryDate: "2026-10-05" };
    await add({ ...base, walletId: bkash, note: "bkash food" });
    await add({ ...base, walletId: cash, note: "cash food" });
    expect(await notes("a", october, { walletId: cash, categoryId: food })).toEqual(["cash food"]);
  });

  it("returns names for wallets, categories and loans", async () => {
    const bank = await wallet("a", "Bank");
    const bkash = await wallet("a", "bKash");
    const [loan] = await db
      .insert(loans)
      .values({ userId: "a", direction: "borrowed", counterparty: "Rahim bhai", principal: 5000 })
      .returning();
    await add({ userId: "a", type: "transfer", walletId: bank, toWalletId: bkash, amount: 500, entryDate: "2026-10-05", note: null });
    await add({ userId: "a", type: "loan_principal", walletId: bank, loanId: loan.id, amount: 5000, entryDate: "2026-10-06", note: null });

    const [loanRow, transferRow] = await listEntries(db, "a", october);
    expect(loanRow).toMatchObject({ walletName: "Bank", loanDirection: "borrowed", loanCounterparty: "Rahim bhai", categoryName: null });
    expect(transferRow).toMatchObject({ walletName: "Bank", toWalletName: "bKash" });
  });

  it("only ever returns the signed-in user's entries", async () => {
    const aWallet = await wallet("a", "Cash");
    const bWallet = await wallet("b", "Cash");
    await add({ userId: "a", type: "income", walletId: aWallet, amount: 1, entryDate: "2026-10-05", note: "mine" });
    await add({ userId: "b", type: "income", walletId: bWallet, amount: 1, entryDate: "2026-10-05", note: "theirs" });

    expect(await notes("a")).toEqual(["mine"]);
    expect(await notes("b")).toEqual(["theirs"]);
    // Naming another user's wallet in a filter still shows nothing of theirs.
    expect(await notes("a", october, { walletId: bWallet })).toEqual([]);
  });

  it("returns an empty list for a month with no entries", async () => {
    expect(await notes("a")).toEqual([]);
  });
});
