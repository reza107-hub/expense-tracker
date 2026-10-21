import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { categories, entries, wallets } from "@/db/schema";
import { LOAN_FEES_CATEGORY } from "@/db/seed";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { insertUser } from "@/test/users";
import { archiveCategory } from "@/lib/categories/mutations";
import { getWalletWithBalance } from "@/lib/wallets/queries";
import { createEntry } from "./create";
import { validateEntry, type EntryType } from "./validation";

const taka = (n: number) => n * 100;

// 10 October 2026, 12:00 in Dhaka. Tomorrow is 11 October.
const NOW = new Date("2026-10-10T06:00:00Z");

function form(fields: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
}

const errorsOf = (type: EntryType, fields: Record<string, string | number>) => {
  const checked = validateEntry(type, form(fields), NOW);
  return checked.ok ? null : checked.fieldErrors;
};

describe("validateEntry", () => {
  const expense = { walletId: 1, categoryId: 2, amount: "450", entryDate: "2026-10-10" };

  it("accepts a valid expense and turns the amount into poisha", () => {
    const checked = validateEntry("expense", form({ ...expense, note: " lunch " }), NOW);
    expect(checked).toEqual({
      ok: true,
      value: {
        type: "expense",
        walletId: 1,
        categoryId: 2,
        amount: taka(450),
        entryDate: "2026-10-10",
        note: "lunch",
      },
    });
  });

  it("accepts today in Dhaka even when it is still yesterday in UTC", () => {
    const earlyDhaka = new Date("2026-10-09T20:30:00Z"); // 02:30 on the 10th in Dhaka
    const checked = validateEntry("expense", form(expense), earlyDhaka);
    expect(checked.ok).toBe(true);
  });

  it("treats a blank note as no note", () => {
    const checked = validateEntry("income", form({ walletId: 1, amount: "5", entryDate: "2026-10-10" }), NOW);
    expect(checked.ok && checked.value.note).toBeNull();
  });

  describe("rejections", () => {
    it("rejects an amount of zero", () => {
      expect(errorsOf("expense", { ...expense, amount: "0" })?.amount).toMatch(/above zero/);
      expect(errorsOf("income", { walletId: 1, amount: "0.00", entryDate: "2026-10-10" })?.amount).toBeTruthy();
    });

    it("rejects a negative amount", () => {
      expect(errorsOf("expense", { ...expense, amount: "-5" })?.amount).toBeTruthy();
    });

    it("rejects more than two decimal places", () => {
      expect(errorsOf("expense", { ...expense, amount: "1.234" })?.amount).toBeTruthy();
    });

    it("rejects an empty or non-numeric amount", () => {
      expect(errorsOf("expense", { ...expense, amount: "" })?.amount).toBeTruthy();
      expect(errorsOf("expense", { ...expense, amount: "abc" })?.amount).toBeTruthy();
    });

    it("rejects a date in the future", () => {
      expect(errorsOf("expense", { ...expense, entryDate: "2026-10-11" })?.entryDate).toMatch(/future/);
    });

    it("rejects a missing or impossible date", () => {
      expect(errorsOf("expense", { ...expense, entryDate: "" })?.entryDate).toBeTruthy();
      expect(errorsOf("expense", { ...expense, entryDate: "2026-02-30" })?.entryDate).toMatch(/valid/);
    });

    it("rejects an expense or income with no wallet chosen", () => {
      expect(errorsOf("expense", { ...expense, walletId: "" })?.walletId).toBe("Choose a wallet.");
      expect(errorsOf("income", { amount: "5", entryDate: "2026-10-10" })?.walletId).toBe("Choose a wallet.");
    });

    it("rejects an expense with no category", () => {
      expect(errorsOf("expense", { ...expense, categoryId: "" })?.categoryId).toBe("Choose a category.");
    });

    it("rejects a transfer to the same wallet", () => {
      const errors = errorsOf("transfer", { walletId: 3, toWalletId: 3, amount: "10", entryDate: "2026-10-10" });
      expect(errors?.toWalletId).toBe("Choose two different wallets.");
    });

    it("rejects a transfer missing either wallet", () => {
      const base = { amount: "10", entryDate: "2026-10-10" };
      expect(errorsOf("transfer", { ...base, toWalletId: 2 })?.walletId).toBeTruthy();
      expect(errorsOf("transfer", { ...base, walletId: 2 })?.toWalletId).toBeTruthy();
    });

    it("rejects a note that is too long", () => {
      expect(errorsOf("expense", { ...expense, note: "x".repeat(201) })?.note).toBeTruthy();
    });

    it("rejects an adjustment with no usable balance", () => {
      const base = { walletId: 1, entryDate: "2026-10-10" };
      expect(errorsOf("adjustment", { ...base, newBalance: "" })?.newBalance).toBeTruthy();
      expect(errorsOf("adjustment", { ...base, newBalance: "1.234" })?.newBalance).toBeTruthy();
    });

    it("accepts an adjustment to zero or a negative balance", () => {
      const base = { walletId: 1, entryDate: "2026-10-10" };
      expect(errorsOf("adjustment", { ...base, newBalance: "0" })).toBeNull();
      expect(errorsOf("adjustment", { ...base, newBalance: "-250.5" })).toBeNull();
    });

    it("reports every bad field at once", () => {
      const errors = errorsOf("expense", { walletId: "", categoryId: "", amount: "0", entryDate: "2030-01-01" });
      expect(Object.keys(errors ?? {}).sort()).toEqual(["amount", "categoryId", "entryDate", "walletId"]);
    });

    it("ignores any extra field, such as a phone number or a user id", () => {
      const checked = validateEntry(
        "income",
        form({ walletId: 1, amount: "5", entryDate: "2026-10-10", phone: "017", userId: "someone-else" }),
        NOW,
      );
      expect(checked.ok && Object.keys(checked.value).sort()).toEqual(
        ["amount", "entryDate", "note", "type", "walletId"],
      );
    });
  });
});

describe("createEntry", () => {
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

  async function addWallet(userId: string, name: string, opening = 0, archived = false) {
    const [row] = await db
      .insert(wallets)
      .values({
        userId,
        name,
        openingBalance: taka(opening),
        archivedAt: archived ? new Date() : null,
      })
      .returning();
    return row.id;
  }

  async function categoryId(userId: string, name: string) {
    const [row] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.name, name)));
    return row.id;
  }

  const balance = async (userId: string, walletId: number) =>
    (await getWalletWithBalance(db, userId, walletId))?.balance;
  const entryCount = async () => (await db.select().from(entries)).length;

  const date = "2026-10-01";

  it("an expense from bKash lowers only the bKash balance", async () => {
    const bkash = await addWallet("a", "bKash", 3200);
    const cash = await addWallet("a", "Cash", 1000);
    const result = await createEntry(db, "a", {
      type: "expense",
      walletId: bkash,
      categoryId: await categoryId("a", "Food"),
      amount: taka(450),
      entryDate: date,
      note: null,
    });
    expect(result.ok).toBe(true);
    expect(await balance("a", bkash)).toBe(taka(2750));
    expect(await balance("a", cash)).toBe(taka(1000));
  });

  it("income raises the balance", async () => {
    const bank = await addWallet("a", "Bank", 40000);
    await createEntry(db, "a", { type: "income", walletId: bank, amount: taka(20000), entryDate: date, note: "salary" });
    expect(await balance("a", bank)).toBe(taka(60000));
    const [row] = await db.select().from(entries);
    expect(row.note).toBe("salary");
    expect(row.categoryId).toBeNull();
  });

  it("a transfer moves money between two wallets", async () => {
    const bank = await addWallet("a", "Bank", 40000);
    const bkash = await addWallet("a", "bKash", 3200);
    await createEntry(db, "a", { type: "transfer", walletId: bank, toWalletId: bkash, amount: taka(5000), entryDate: date, note: null });
    expect(await balance("a", bank)).toBe(taka(35000));
    expect(await balance("a", bkash)).toBe(taka(8200));
  });

  it("an adjustment up or down stores the signed difference and changes only that wallet", async () => {
    const crypto = await addWallet("a", "Crypto", 50000);
    const cash = await addWallet("a", "Cash", 100);

    await createEntry(db, "a", { type: "adjustment", walletId: crypto, newBalance: taka(52000), entryDate: date, note: null });
    expect(await balance("a", crypto)).toBe(taka(52000));
    await createEntry(db, "a", { type: "adjustment", walletId: crypto, newBalance: taka(49000), entryDate: date, note: null });
    expect(await balance("a", crypto)).toBe(taka(49000));
    expect(await balance("a", cash)).toBe(taka(100));

    const rows = await db.select().from(entries).orderBy(entries.id);
    expect(rows.map((r) => r.amount)).toEqual([taka(2000), -taka(3000)]);
  });

  it("refuses an adjustment that changes nothing", async () => {
    const crypto = await addWallet("a", "Crypto", 50000);
    const result = await createEntry(db, "a", { type: "adjustment", walletId: crypto, newBalance: taka(50000), entryDate: date, note: null });
    expect(result.ok).toBe(false);
    expect(await entryCount()).toBe(0);
  });

  describe("low balance", () => {
    const expenseOf = async (walletId: number, amount: number) => ({
      type: "expense" as const,
      walletId,
      categoryId: await categoryId("a", "Food"),
      amount: taka(amount),
      entryDate: date,
      note: null,
    });

    it("warns, and saves nothing, when an expense would take a wallet below zero", async () => {
      const wallet = await addWallet("a", "bKash", 3000);
      const result = await createEntry(db, "a", await expenseOf(wallet, 5000));
      expect(result).toEqual({
        ok: false,
        lowBalance: { walletName: "bKash", balanceAfter: -taka(2000) },
      });
      expect(await entryCount()).toBe(0);
      expect(await balance("a", wallet)).toBe(taka(3000));
    });

    it("saves it when the user confirms, leaving a negative balance", async () => {
      const wallet = await addWallet("a", "bKash", 3000);
      const result = await createEntry(db, "a", await expenseOf(wallet, 5000), {
        confirmLowBalance: true,
      });
      expect(result.ok).toBe(true);
      expect(await balance("a", wallet)).toBe(-taka(2000));
    });

    it("saves nothing when the user does not confirm (the form is simply not sent again)", async () => {
      const wallet = await addWallet("a", "bKash", 3000);
      await createEntry(db, "a", await expenseOf(wallet, 5000));
      expect(await entryCount()).toBe(0);
    });

    it("does not warn when the balance lands exactly on zero or stays above it", async () => {
      const wallet = await addWallet("a", "bKash", 3000);
      expect((await createEntry(db, "a", await expenseOf(wallet, 3000))).ok).toBe(true);
      expect(await balance("a", wallet)).toBe(0);
    });

    it("warns again for any expense from a wallet that is already below zero", async () => {
      const wallet = await addWallet("a", "bKash", 100);
      await createEntry(db, "a", await expenseOf(wallet, 500), { confirmLowBalance: true });
      const result = await createEntry(db, "a", await expenseOf(wallet, 1));
      expect(!result.ok && "lowBalance" in result).toBe(true);
    });

    it("warns on a transfer from the source wallet and moves money once confirmed", async () => {
      const cash = await addWallet("a", "Cash", 1000);
      const bank = await addWallet("a", "Bank", 0);
      const transfer = {
        type: "transfer" as const,
        walletId: cash,
        toWalletId: bank,
        amount: taka(1500),
        entryDate: date,
        note: null,
      };
      const warned = await createEntry(db, "a", transfer);
      expect(warned).toEqual({
        ok: false,
        lowBalance: { walletName: "Cash", balanceAfter: -taka(500) },
      });
      expect(await entryCount()).toBe(0);

      expect((await createEntry(db, "a", transfer, { confirmLowBalance: true })).ok).toBe(true);
      expect(await balance("a", cash)).toBe(-taka(500));
      expect(await balance("a", bank)).toBe(taka(1500));
    });

    it("never warns about income, an adjustment, or the receiving wallet", async () => {
      const wallet = await addWallet("a", "Crypto", 100);
      expect(
        (await createEntry(db, "a", { type: "income", walletId: wallet, amount: taka(5), entryDate: date, note: null })).ok,
      ).toBe(true);
      expect(
        (await createEntry(db, "a", { type: "adjustment", walletId: wallet, newBalance: -taka(50), entryDate: date, note: null })).ok,
      ).toBe(true);
      expect(await balance("a", wallet)).toBe(-taka(50));
    });

    it("checks ownership before warning, so another user's wallet is just refused", async () => {
      const bWallet = await addWallet("b", "Cash", 10);
      const result = await createEntry(db, "a", await expenseOf(bWallet, 5000));
      expect(!result.ok && "fieldErrors" in result).toBe(true);
    });
  });

  describe("ownership", () => {
    it("refuses a wallet that belongs to another user, and saves nothing", async () => {
      const bWallet = await addWallet("b", "Cash", 100);
      const result = await createEntry(db, "a", { type: "income", walletId: bWallet, amount: taka(5), entryDate: date, note: null });
      expect(result).toEqual({ ok: false, fieldErrors: { walletId: "Choose one of your wallets." } });
      expect(await entryCount()).toBe(0);
      expect(await balance("b", bWallet)).toBe(taka(100));
    });

    it("refuses a category that belongs to another user, and saves nothing", async () => {
      const aWallet = await addWallet("a", "Cash", 100);
      const result = await createEntry(db, "a", {
        type: "expense",
        walletId: aWallet,
        categoryId: await categoryId("b", "Food"),
        amount: taka(5),
        entryDate: date,
        note: null,
      });
      expect(result).toEqual({ ok: false, fieldErrors: { categoryId: "Choose one of your categories." } });
      expect(await entryCount()).toBe(0);
    });

    it("refuses a destination wallet that belongs to another user", async () => {
      const aWallet = await addWallet("a", "Cash", 100);
      const bWallet = await addWallet("b", "Cash", 100);
      const result = await createEntry(db, "a", { type: "transfer", walletId: aWallet, toWalletId: bWallet, amount: taka(5), entryDate: date, note: null });
      expect(!result.ok && "fieldErrors" in result && result.fieldErrors.toWalletId).toBeTruthy();
      expect(await entryCount()).toBe(0);
      expect(await balance("b", bWallet)).toBe(taka(100));
    });

    it("refuses an adjustment of another user's wallet", async () => {
      const bWallet = await addWallet("b", "Cash", 100);
      const result = await createEntry(db, "a", { type: "adjustment", walletId: bWallet, newBalance: taka(999), entryDate: date, note: null });
      expect(result.ok).toBe(false);
      expect(await balance("b", bWallet)).toBe(taka(100));
    });

    it("refuses a wallet id that does not exist", async () => {
      const result = await createEntry(db, "a", { type: "income", walletId: 99999, amount: taka(5), entryDate: date, note: null });
      expect(result.ok).toBe(false);
    });

    it("refuses an archived wallet", async () => {
      const old = await addWallet("a", "Old", 0, true);
      const result = await createEntry(db, "a", { type: "income", walletId: old, amount: taka(5), entryDate: date, note: null });
      expect(result.ok).toBe(false);
      expect(await entryCount()).toBe(0);
    });

    it("refuses an archived category and the reserved loan category", async () => {
      const wallet = await addWallet("a", "Cash", 100);
      const shopping = await categoryId("a", "Shopping");
      await archiveCategory(db, "a", shopping);
      for (const id of [shopping, await categoryId("a", LOAN_FEES_CATEGORY)]) {
        const result = await createEntry(db, "a", { type: "expense", walletId: wallet, categoryId: id, amount: taka(5), entryDate: date, note: null });
        expect(result.ok).toBe(false);
      }
      expect(await entryCount()).toBe(0);
    });

    it("every saved entry belongs to the user who saved it", async () => {
      const aWallet = await addWallet("a", "Cash", 0);
      await createEntry(db, "a", { type: "income", walletId: aWallet, amount: taka(5), entryDate: date, note: null });
      const [row] = await db.select().from(entries);
      expect(row.userId).toBe("a");
    });
  });
});
