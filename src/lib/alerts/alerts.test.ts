import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { categories, entries, wallets } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { insertUser } from "@/test/users";
import { createEntry } from "@/lib/entries/create";
import { deleteEntry } from "@/lib/entries/modify";
import { createLoan, recordRepayment, updateLoan } from "@/lib/loans/mutations";
import { updateAlertSettings, updateMonthStartDay } from "@/lib/settings/mutations";
import { getAlertSettings } from "@/lib/settings/queries";
import { validateAlertSettings } from "@/lib/settings/validation";
import { daysBetween, getAlerts, loanAlerts, spendingAlert } from "./compute";

const taka = (n: number) => n * 100;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("validateAlertSettings", () => {
  it("refuses to turn alerts on without a limit", () => {
    const checked = validateAlertSettings(form({ alertsEnabled: "on", monthlyLimit: "  " }));
    expect(checked.ok).toBe(false);
    expect(!checked.ok && checked.fieldErrors.monthlyLimit).toMatch(/limit/);
  });

  it("refuses a zero, negative or malformed limit", () => {
    for (const monthlyLimit of ["0", "-5", "abc", "1.234"]) {
      expect(validateAlertSettings(form({ monthlyLimit })).ok).toBe(false);
    }
  });

  it("saves a limit with alerts off, and clears it when emptied", () => {
    expect(validateAlertSettings(form({ monthlyLimit: "30,000" }))).toEqual({
      ok: true,
      value: { alertsEnabled: false, monthlyLimit: taka(30000) },
    });
    expect(validateAlertSettings(form({ monthlyLimit: "" }))).toEqual({
      ok: true,
      value: { alertsEnabled: false, monthlyLimit: null },
    });
  });

  it("accepts alerts on with a limit", () => {
    expect(validateAlertSettings(form({ alertsEnabled: "on", monthlyLimit: "500" }))).toEqual({
      ok: true,
      value: { alertsEnabled: true, monthlyLimit: taka(500) },
    });
  });
});

describe("spendingAlert", () => {
  const limit = taka(30000);

  it("is silent below 80%", () => {
    expect(spendingAlert(taka(23999), limit)).toBeNull();
  });

  it("warns from exactly 80%", () => {
    expect(spendingAlert(taka(24000), limit)).toMatchObject({ level: "warning", percent: 80, over: 0 });
  });

  it("is still a warning exactly at the limit", () => {
    expect(spendingAlert(limit, limit)).toMatchObject({ level: "warning", percent: 100 });
  });

  it("is exceeded above the limit and says by how much", () => {
    expect(spendingAlert(taka(30500), limit)).toMatchObject({
      level: "exceeded",
      over: taka(500),
    });
  });
});

describe("loan alerts", () => {
  const loan = (over: object) =>
    ({
      id: 1,
      direction: "borrowed",
      counterparty: "Rahim bhai",
      outstanding: taka(40000),
      dueDate: "2026-10-15",
      status: "open",
      ...over,
    }) as Parameters<typeof loanAlerts>[0][number];

  it("counts days across month and year ends", () => {
    expect(daysBetween("2026-10-10", "2026-10-15")).toBe(5);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysBetween("2026-10-10", "2026-10-07")).toBe(-3);
  });

  it("alerts for overdue, today, and up to 7 days ahead, but not 8", () => {
    const loans = [
      loan({ id: 1, dueDate: "2026-10-03" }),
      loan({ id: 2, dueDate: "2026-10-10" }),
      loan({ id: 3, dueDate: "2026-10-17" }),
      loan({ id: 4, dueDate: "2026-10-18" }),
      loan({ id: 5, dueDate: null }),
    ];
    expect(loanAlerts(loans, "2026-10-10").map((a) => [a.loanId, a.daysUntil])).toEqual([
      [1, -7],
      [2, 0],
      [3, 7],
    ]);
  });

  it("never alerts for a closed loan", () => {
    expect(loanAlerts([loan({ status: "closed", dueDate: "2026-10-01" })], "2026-10-10")).toEqual([]);
  });
});

describe("getAlerts", () => {
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

  const TODAY = "2026-10-20";

  async function addWallet(userId: string, name: string) {
    const [row] = await db
      .insert(wallets)
      .values({ userId, name, openingBalance: taka(1000000) })
      .returning();
    return row.id;
  }

  async function spend(userId: string, walletId: number, amount: number, date = "2026-10-05") {
    const [food] = await db
      .select()
      .from(categories)
      .where(sql`${categories.userId} = ${userId} and ${categories.name} = 'Food'`);
    const result = await createEntry(db, userId, {
      type: "expense",
      walletId,
      categoryId: food.id,
      amount: taka(amount),
      entryDate: date,
      note: null,
    });
    if (!result.ok) throw new Error("expense was not saved");
    return result.id;
  }

  const turnOn = (userId: string, limit = 30000) =>
    updateAlertSettings(db, userId, { alertsEnabled: true, monthlyLimit: taka(limit) });

  it("shows nothing while alerts are off, however much is spent", async () => {
    const bank = await addWallet("a", "Bank");
    await updateAlertSettings(db, "a", { alertsEnabled: false, monthlyLimit: taka(100) });
    await spend("a", bank, 5000);

    expect(await getAlerts(db, "a", TODAY)).toEqual({ spending: null, loans: [] });
  });

  it("new accounts start with alerts off", async () => {
    expect(await getAlertSettings(db, "a")).toEqual({ alertsEnabled: false, monthlyLimit: null });
  });

  it("adds spending across wallets: 18,000 Bank plus 13,000 bKash passes a 30,000 limit", async () => {
    const bank = await addWallet("a", "Bank");
    const bkash = await addWallet("a", "bKash");
    await turnOn("a");
    await spend("a", bank, 18000);
    await spend("a", bkash, 13000);

    const { spending } = await getAlerts(db, "a", TODAY);

    expect(spending).toMatchObject({
      level: "exceeded",
      spent: taka(31000),
      over: taka(1000),
    });
  });

  it("warns at 80% and exceeds once an expense takes spending from 29,500 to 30,500", async () => {
    const bank = await addWallet("a", "Bank");
    await turnOn("a");
    await spend("a", bank, 24000);
    expect((await getAlerts(db, "a", TODAY)).spending?.level).toBe("warning");

    await spend("a", bank, 5500);
    expect((await getAlerts(db, "a", TODAY)).spending?.level).toBe("warning");

    await spend("a", bank, 1000);
    expect((await getAlerts(db, "a", TODAY)).spending).toMatchObject({
      level: "exceeded",
      over: taka(500),
    });
  });

  it("deleting an expense clears the alert", async () => {
    const bank = await addWallet("a", "Bank");
    await turnOn("a");
    await spend("a", bank, 10000);
    const big = await spend("a", bank, 15000);
    expect((await getAlerts(db, "a", TODAY)).spending).not.toBeNull();

    await deleteEntry(db, "a", big);

    expect((await getAlerts(db, "a", TODAY)).spending).toBeNull();
  });

  it("a new reporting month starts clean", async () => {
    const bank = await addWallet("a", "Bank");
    await turnOn("a");
    await spend("a", bank, 40000, "2026-10-05");

    expect((await getAlerts(db, "a", "2026-10-31")).spending?.level).toBe("exceeded");
    expect((await getAlerts(db, "a", "2026-11-01")).spending).toBeNull();
  });

  it("follows the user's month start day", async () => {
    const bank = await addWallet("a", "Bank");
    await turnOn("a");
    await updateMonthStartDay(db, "a", 25);
    await spend("a", bank, 40000, "2026-10-26");

    expect((await getAlerts(db, "a", "2026-11-10")).spending?.level).toBe("exceeded");
    expect((await getAlerts(db, "a", "2026-11-25")).spending).toBeNull();
  });

  it("one user's alert settings never affect another", async () => {
    const mine = await addWallet("a", "Bank");
    const theirs = await addWallet("b", "Bank");
    await turnOn("a");
    await spend("a", mine, 100);
    await spend("b", theirs, 99999);

    expect(await getAlerts(db, "b", TODAY)).toEqual({ spending: null, loans: [] });
    expect((await getAlerts(db, "a", TODAY)).spending).toBeNull();

    await turnOn("b", 1000);
    expect((await getAlerts(db, "b", TODAY)).spending?.level).toBe("exceeded");
    expect((await getAlerts(db, "a", TODAY)).spending).toBeNull();
  });

  describe("loan due alerts", () => {
    async function borrow(walletId: number, dueDate: string | null) {
      const result = await createLoan(db, "a", {
        direction: "borrowed",
        counterparty: "Rahim bhai",
        amount: taka(40000),
        walletId,
        entryDate: "2026-10-01",
        dueDate,
        note: null,
      });
      if (!result.ok) throw new Error("loan");
      return result.id;
    }

    it("alerts for a borrowed loan due in 5 days, then clears when it is closed", async () => {
      const bank = await addWallet("a", "Bank");
      await updateAlertSettings(db, "a", { alertsEnabled: true, monthlyLimit: null });
      const id = await borrow(bank, "2026-10-25");

      const { loans } = await getAlerts(db, "a", TODAY);
      expect(loans).toEqual([
        expect.objectContaining({
          loanId: id,
          direction: "borrowed",
          counterparty: "Rahim bhai",
          outstanding: taka(40000),
          daysUntil: 5,
        }),
      ]);

      await recordRepayment(db, "a", id, {
        walletId: bank,
        principal: taka(40000),
        interest: 0,
        entryDate: "2026-10-20",
        note: null,
      });
      expect((await getAlerts(db, "a", TODAY)).loans).toEqual([]);
    });

    it("uses the outstanding amount, picks up a due date added by editing, and respects the switch", async () => {
      const bank = await addWallet("a", "Bank");
      await updateAlertSettings(db, "a", { alertsEnabled: true, monthlyLimit: null });
      const id = await borrow(bank, null);
      expect((await getAlerts(db, "a", TODAY)).loans).toEqual([]);

      await updateLoan(db, "a", id, { counterparty: "Rahim bhai", dueDate: "2026-10-18", note: null });
      await recordRepayment(db, "a", id, {
        walletId: bank,
        principal: taka(10000),
        interest: 0,
        entryDate: "2026-10-19",
        note: null,
      });
      expect((await getAlerts(db, "a", TODAY)).loans[0]).toMatchObject({
        outstanding: taka(30000),
        daysUntil: -2,
      });

      await updateAlertSettings(db, "a", { alertsEnabled: false, monthlyLimit: null });
      expect((await getAlerts(db, "a", TODAY)).loans).toEqual([]);
    });

    it("never shows another user's loans", async () => {
      const bank = await addWallet("a", "Bank");
      await borrow(bank, "2026-10-21");
      await updateAlertSettings(db, "b", { alertsEnabled: true, monthlyLimit: null });

      expect((await getAlerts(db, "b", TODAY)).loans).toEqual([]);
    });
  });

  it("an alert can be raised without touching entries", async () => {
    // The alert is calculated, so toggling settings leaves the ledger as it was.
    const bank = await addWallet("a", "Bank");
    await spend("a", bank, 100);
    const before = await db.select().from(entries);
    await turnOn("a");
    await getAlerts(db, "a", TODAY);
    expect(await db.select().from(entries)).toEqual(before);
  });
});
