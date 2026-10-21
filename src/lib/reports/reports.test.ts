import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { categories, entries, settings, wallets } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { insertUser } from "@/test/users";
import { createEntry } from "@/lib/entries/create";
import { createLoan, recordRepayment } from "@/lib/loans/mutations";
import { periodContaining, periodForMonth } from "@/lib/period";
import { updateMonthStartDay } from "@/lib/settings/mutations";
import { getMonthStartDay } from "@/lib/settings/queries";
import { validateMonthStartDay } from "@/lib/settings/validation";
import { getOverview } from "./overview";
import { getMonthReport, percentOf } from "./queries";

const taka = (n: number) => n * 100;

function form(day: string) {
  const data = new FormData();
  data.set("monthStartDay", day);
  return data;
}

describe("validateMonthStartDay", () => {
  it("accepts 1 to 28", () => {
    for (const day of ["1", "15", "28", " 25 "]) {
      expect(validateMonthStartDay(form(day)).ok).toBe(true);
    }
  });

  it("rejects 31 and anything else outside 1 to 28 with an explanation", () => {
    for (const day of ["31", "29", "0", "-1", "", "ab", "2.5", "100"]) {
      const checked = validateMonthStartDay(form(day));
      expect(checked.ok).toBe(false);
      expect(!checked.ok && checked.fieldErrors.monthStartDay).toMatch(/1 to 28/);
    }
  });
});

describe("reports", () => {
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

  async function addWallet(userId: string, name: string, opening = 0) {
    const [row] = await db
      .insert(wallets)
      .values({ userId, name, openingBalance: taka(opening) })
      .returning();
    return row.id;
  }

  async function categoryId(userId: string, name: string) {
    const [row] = await db
      .select()
      .from(categories)
      .where(sql`${categories.userId} = ${userId} and ${categories.name} = ${name}`);
    return row.id;
  }

  async function expense(userId: string, walletId: number, category: string, amount: number, date: string) {
    const result = await createEntry(
      db,
      userId,
      {
        type: "expense",
        walletId,
        categoryId: await categoryId(userId, category),
        amount: taka(amount),
        entryDate: date,
        note: null,
      },
      { confirmLowBalance: true },
    );
    if (!result.ok) throw new Error("expense was not saved");
  }

  async function income(userId: string, walletId: number, amount: number, date: string) {
    await createEntry(db, userId, {
      type: "income",
      walletId,
      amount: taka(amount),
      entryDate: date,
      note: null,
    });
  }

  const OCTOBER = periodForMonth(2026, 10, 1);

  describe("getMonthReport", () => {
    it("counts only expenses: not income, transfers or loans", async () => {
      const bank = await addWallet("a", "Bank", 100000);
      const cash = await addWallet("a", "Cash");
      await expense("a", bank, "Food", 6000, "2026-10-05");
      await income("a", bank, 20000, "2026-10-06");
      await createEntry(db, "a", {
        type: "transfer",
        walletId: bank,
        toWalletId: cash,
        amount: taka(5000),
        entryDate: "2026-10-07",
        note: null,
      });
      await createLoan(db, "a", {
        direction: "borrowed",
        counterparty: "Rahim",
        amount: taka(50000),
        walletId: bank,
        entryDate: "2026-10-08",
        dueDate: null,
        note: null,
      });

      const report = await getMonthReport(db, "a", OCTOBER, 1);

      expect(report.total).toBe(taka(6000));
      expect(report.hasEntries).toBe(true);
    });

    it("groups by category and wallet with shares, largest first", async () => {
      const bank = await addWallet("a", "Bank", 100000);
      const bkash = await addWallet("a", "bKash", 100000);
      await expense("a", bank, "Food", 8000, "2026-10-02");
      await expense("a", bkash, "Transport", 7000, "2026-10-03");
      await expense("a", bkash, "Bills", 5000, "2026-10-04");

      const report = await getMonthReport(db, "a", OCTOBER, 1);

      expect(report.total).toBe(taka(20000));
      expect(report.byCategory.map((c) => [c.name, c.total, c.share])).toEqual([
        ["Food", taka(8000), 40],
        ["Transport", taka(7000), 35],
        ["Bills", taka(5000), 25],
      ]);
      expect(report.byWallet.map((w) => [w.name, w.total])).toEqual([
        ["bKash", taka(12000)],
        ["Bank", taka(8000)],
      ]);
    });

    it("compares with the previous month by amount and percentage", async () => {
      const bank = await addWallet("a", "Bank", 100000);
      await expense("a", bank, "Food", 7500, "2026-09-10");
      await expense("a", bank, "Food", 9000, "2026-10-10");
      await expense("a", bank, "Bills", 1000, "2026-10-11");
      await expense("a", bank, "Transport", 500, "2026-09-12");

      const report = await getMonthReport(db, "a", OCTOBER, 1);

      const food = report.byCategory.find((c) => c.name === "Food");
      expect(food).toMatchObject({ change: taka(1500), changePercent: 20 });
      // No spending last month means no percentage, not a divide by zero.
      expect(report.byCategory.find((c) => c.name === "Bills")).toMatchObject({
        change: taka(1000),
        changePercent: null,
      });
      // A category that dropped to nothing is still listed.
      expect(report.byCategory.find((c) => c.name === "Transport")).toMatchObject({
        total: 0,
        change: -taka(500),
        changePercent: -100,
        share: 0,
      });
      expect(report).toMatchObject({
        total: taka(10000),
        previousTotal: taka(8000),
        change: taka(2000),
        changePercent: 25,
      });
    });

    it("shows six months with zeros before the first entry", async () => {
      const bank = await addWallet("a", "Bank", 100000);
      await expense("a", bank, "Food", 300, "2026-10-01");
      await expense("a", bank, "Food", 200, "2026-08-31");

      const { trend } = await getMonthReport(db, "a", OCTOBER, 1);

      expect(trend.map((t) => `${t.period.year}-${t.period.month}`)).toEqual([
        "2026-5", "2026-6", "2026-7", "2026-8", "2026-9", "2026-10",
      ]);
      expect(trend.map((t) => t.total)).toEqual([0, 0, 0, taka(200), 0, taka(300)]);
    });

    it("an empty month has no entries, no spending and no percentages", async () => {
      await addWallet("a", "Bank");

      const report = await getMonthReport(db, "a", OCTOBER, 1);

      expect(report).toMatchObject({
        total: 0,
        hasEntries: false,
        byCategory: [],
        byWallet: [],
        changePercent: null,
      });
    });

    it("counts interest and fees on a borrowed loan as spending", async () => {
      const bank = await addWallet("a", "Bank", 100000);
      const loan = await createLoan(db, "a", {
        direction: "borrowed",
        counterparty: "Rahim",
        amount: taka(50000),
        walletId: bank,
        entryDate: "2026-10-01",
        dueDate: null,
        note: null,
      });
      if (!loan.ok) throw new Error("loan");
      await recordRepayment(db, "a", loan.id, {
        walletId: bank,
        principal: taka(10000),
        interest: taka(500),
        entryDate: "2026-10-09",
        note: null,
      });

      const report = await getMonthReport(db, "a", OCTOBER, 1);

      expect(report.total).toBe(taka(500));
      expect(report.byCategory.map((c) => c.name)).toEqual(["Loan interest and fees"]);
    });

    it("never includes another user's entries", async () => {
      const mine = await addWallet("a", "Bank", 100000);
      const theirs = await addWallet("b", "Bank", 100000);
      await expense("a", mine, "Food", 100, "2026-10-05");
      await expense("b", theirs, "Food", 9999, "2026-10-05");

      const report = await getMonthReport(db, "a", OCTOBER, 1);

      expect(report.total).toBe(taka(100));
      expect(report.byWallet).toHaveLength(1);
      expect(report.trend[5].total).toBe(taka(100));
    });
  });

  describe("month start day", () => {
    it("regroups reports without changing any entry, and only for that user", async () => {
      const mineBank = await addWallet("a", "Bank", 100000);
      const theirBank = await addWallet("b", "Bank", 100000);
      for (const [user, wallet] of [["a", mineBank], ["b", theirBank]] as const) {
        await expense(user, wallet, "Food", 100, "2026-10-10");
        await expense(user, wallet, "Food", 200, "2026-10-26");
      }
      const before = await db.select().from(entries).orderBy(entries.id);

      expect(await getMonthStartDay(db, "a")).toBe(1);
      expect((await getMonthReport(db, "a", OCTOBER, 1)).total).toBe(taka(300));

      await updateMonthStartDay(db, "a", 25);

      expect(await getMonthStartDay(db, "a")).toBe(25);
      expect(await getMonthStartDay(db, "b")).toBe(1);
      // October now runs 25 October to 24 November, so only the 26th is in it.
      const october = periodForMonth(2026, 10, 25);
      expect(october).toMatchObject({ start: "2026-10-25", end: "2026-11-24" });
      expect((await getMonthReport(db, "a", october, 25)).total).toBe(taka(200));
      expect((await getMonthReport(db, "b", OCTOBER, 1)).total).toBe(taka(300));
      // Not a single entry was touched.
      expect(await db.select().from(entries).orderBy(entries.id)).toEqual(before);
    });

    it("creates the settings row if it is missing", async () => {
      await db.delete(settings).where(eq(settings.userId, "a"));
      await updateMonthStartDay(db, "a", 10);
      expect(await getMonthStartDay(db, "a")).toBe(10);
    });

    it("the database also refuses a day outside 1 to 28", async () => {
      await expect(updateMonthStartDay(db, "a", 31)).rejects.toThrow();
    });
  });

  describe("getOverview", () => {
    it("shows net position 8,200 when the balance is 48,200 and 40,000 is owed", async () => {
      const bank = await addWallet("a", "Bank", 8200);
      await createLoan(db, "a", {
        direction: "borrowed",
        counterparty: "Rahim bhai",
        amount: taka(40000),
        walletId: bank,
        entryDate: "2026-10-01",
        dueDate: null,
        note: null,
      });

      const overview = await getOverview(db, "a", "2026-10-10");

      expect(overview).toMatchObject({
        totalBalance: taka(48200),
        owe: taka(40000),
        owed: 0,
        netPosition: taka(8200),
        monthSpending: 0,
      });
      expect(overview.wallets.map((w) => [w.name, w.balance])).toEqual([["Bank", taka(48200)]]);
    });

    it("adds money owed to the user and uses the period containing today", async () => {
      const cash = await addWallet("a", "Cash", 10000);
      await createLoan(db, "a", {
        direction: "lent",
        counterparty: "Karim",
        amount: taka(3000),
        walletId: cash,
        entryDate: "2026-10-01",
        dueDate: null,
        note: null,
      });
      await expense("a", cash, "Food", 500, "2026-10-02");
      await updateMonthStartDay(db, "a", 15);

      // With start day 15, 10 October belongs to the period that began on 15 September.
      const early = await getOverview(db, "a", "2026-10-10");
      expect(early.period).toEqual(periodContaining("2026-10-10", 15));
      expect(early.monthSpending).toBe(taka(500));
      expect(early).toMatchObject({
        totalBalance: taka(6500),
        owed: taka(3000),
        netPosition: taka(9500),
      });

      const later = await getOverview(db, "a", "2026-10-20");
      expect(later.monthSpending).toBe(0);
    });

    it("shows nothing of another user's money", async () => {
      await addWallet("b", "Bank", 99999);
      const overview = await getOverview(db, "a", "2026-10-10");
      expect(overview).toMatchObject({ wallets: [], totalBalance: 0, netPosition: 0 });
    });
  });

  it("percentOf rounds and refuses to divide by zero", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(5, 0)).toBeNull();
    expect(percentOf(-500, 500)).toBe(-100);
  });
});
