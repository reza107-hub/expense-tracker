import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { categories, entries, loans, wallets } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { insertUser } from "@/test/users";
import { archiveCategory } from "@/lib/categories/mutations";
import { archiveWallet } from "@/lib/wallets/mutations";
import { getWalletWithBalance } from "@/lib/wallets/queries";
import { createEntry } from "./create";
import { deleteEntry, updateEntry } from "./modify";
import { validateEntryChanges } from "./validation";

const taka = (n: number) => n * 100;
const NOW = new Date("2026-10-10T06:00:00Z");

function form(fields: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
}

describe("validateEntryChanges", () => {
  it("applies the same rules as adding an entry", () => {
    const bad = validateEntryChanges(
      "expense",
      form({ walletId: 1, categoryId: 1, amount: "0", entryDate: "2030-01-01" }),
      NOW,
    );
    expect(!bad.ok && Object.keys(bad.fieldErrors).sort()).toEqual(["amount", "entryDate"]);
  });

  it("returns the changes without a type", () => {
    const ok = validateEntryChanges(
      "transfer",
      form({ walletId: 1, toWalletId: 2, amount: "10", entryDate: "2026-10-01", note: "x" }),
      NOW,
    );
    expect(ok).toEqual({
      ok: true,
      value: { walletId: 1, toWalletId: 2, amount: taka(10), entryDate: "2026-10-01", note: "x" },
    });
  });

  it("takes an adjustment as a signed change, and refuses zero", () => {
    const base = { walletId: 1, entryDate: "2026-10-01" };
    const down = validateEntryChanges("adjustment", form({ ...base, amount: "-30.5" }), NOW);
    expect(down.ok && down.value.amount).toBe(-3050);
    const up = validateEntryChanges("adjustment", form({ ...base, amount: "20" }), NOW);
    expect(up.ok && up.value.amount).toBe(2000);
    const zero = validateEntryChanges("adjustment", form({ ...base, amount: "0" }), NOW);
    expect(!zero.ok && zero.fieldErrors.amount).toBeTruthy();
  });
});

describe("editing and deleting entries", () => {
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

  const date = "2026-10-01";

  async function addWallet(userId: string, name: string, opening = 0) {
    const [row] = await db
      .insert(wallets)
      .values({ userId, name, openingBalance: taka(opening) })
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
  const row = async (id: number) => (await db.select().from(entries).where(eq(entries.id, id)))[0];

  async function addExpense(userId: string, walletId: number, amount: number, category = "Food") {
    const result = await createEntry(db, userId, {
      type: "expense",
      walletId,
      categoryId: await categoryId(userId, category),
      amount: taka(amount),
      entryDate: date,
      note: "orig",
    });
    if (!result.ok) throw new Error("setup failed");
    return result.id;
  }

  async function changesFor(entryId: number, patch: Partial<Parameters<typeof updateEntry>[3]>) {
    const e = await row(entryId);
    return {
      walletId: e.walletId,
      toWalletId: e.toWalletId ?? undefined,
      categoryId: e.categoryId ?? undefined,
      amount: e.amount,
      entryDate: e.entryDate,
      note: e.note,
      ...patch,
    };
  }

  describe("edit", () => {
    it("changing an expense from 450 to 500 lowers the balance by a further 50", async () => {
      const wallet = await addWallet("a", "bKash", 3200);
      const id = await addExpense("a", wallet, 450);
      expect(await balance("a", wallet)).toBe(taka(2750));

      expect(await updateEntry(db, "a", id, await changesFor(id, { amount: taka(500) }))).toEqual({ ok: true });
      expect(await balance("a", wallet)).toBe(taka(2700));
      expect((await row(id)).amount).toBe(taka(500));
    });

    it("moves an expense to another wallet, category, date and note", async () => {
      const bkash = await addWallet("a", "bKash", 1000);
      const cash = await addWallet("a", "Cash", 1000);
      const id = await addExpense("a", bkash, 100);

      const result = await updateEntry(db, "a", id, await changesFor(id, {
        walletId: cash,
        categoryId: await categoryId("a", "Bills"),
        entryDate: "2026-09-20",
        note: "changed",
      }));
      expect(result.ok).toBe(true);
      expect(await balance("a", bkash)).toBe(taka(1000));
      expect(await balance("a", cash)).toBe(taka(900));
      expect(await row(id)).toMatchObject({ entryDate: "2026-09-20", note: "changed", type: "expense" });
    });

    it("edits a transfer's amount and wallets", async () => {
      const bank = await addWallet("a", "Bank", 1000);
      const bkash = await addWallet("a", "bKash", 0);
      const cash = await addWallet("a", "Cash", 0);
      const made = await createEntry(db, "a", { type: "transfer", walletId: bank, toWalletId: bkash, amount: taka(100), entryDate: date, note: null });
      if (!made.ok) throw new Error("setup failed");

      await updateEntry(db, "a", made.id, await changesFor(made.id, { toWalletId: cash, amount: taka(250) }));
      expect(await balance("a", bank)).toBe(taka(750));
      expect(await balance("a", bkash)).toBe(0);
      expect(await balance("a", cash)).toBe(taka(250));
    });

    it("edits an income and an adjustment (signed)", async () => {
      const wallet = await addWallet("a", "Crypto", 1000);
      const income = await createEntry(db, "a", { type: "income", walletId: wallet, amount: taka(100), entryDate: date, note: null });
      const adjust = await createEntry(db, "a", { type: "adjustment", walletId: wallet, newBalance: taka(1300), entryDate: date, note: null });
      if (!income.ok || !adjust.ok) throw new Error("setup failed");
      expect(await balance("a", wallet)).toBe(taka(1300));

      await updateEntry(db, "a", income.id, await changesFor(income.id, { amount: taka(150) }));
      expect(await balance("a", wallet)).toBe(taka(1350));
      await updateEntry(db, "a", adjust.id, await changesFor(adjust.id, { amount: -taka(100) }));
      expect(await balance("a", wallet)).toBe(taka(1050));
    });

    it("refuses a wallet or category that belongs to another user, and changes nothing", async () => {
      const wallet = await addWallet("a", "bKash", 1000);
      const bWallet = await addWallet("b", "Cash", 1000);
      const id = await addExpense("a", wallet, 100);

      const w = await updateEntry(db, "a", id, await changesFor(id, { walletId: bWallet }));
      expect(w).toEqual({ ok: false, fieldErrors: { walletId: "Choose one of your wallets." } });
      const c = await updateEntry(db, "a", id, await changesFor(id, { categoryId: await categoryId("b", "Food") }));
      expect(!c.ok && "fieldErrors" in c && c.fieldErrors.categoryId).toBeTruthy();
      expect((await row(id)).walletId).toBe(wallet);
      expect(await balance("b", bWallet)).toBe(taka(1000));
    });

    it("keeps working when the entry's wallet and category have been archived since", async () => {
      const wallet = await addWallet("a", "Old", 0);
      const shopping = await categoryId("a", "Shopping");
      const made = await createEntry(db, "a", { type: "income", walletId: wallet, amount: taka(50), entryDate: date, note: null });
      const spent = await createEntry(db, "a", { type: "expense", walletId: wallet, categoryId: shopping, amount: taka(50), entryDate: date, note: null });
      if (!made.ok || !spent.ok) throw new Error("setup failed");
      await archiveWallet(db, "a", wallet);
      await archiveCategory(db, "a", shopping);

      const result = await updateEntry(db, "a", spent.id, await changesFor(spent.id, { note: "still editable" }));
      expect(result).toEqual({ ok: true });
      expect((await row(spent.id)).note).toBe("still editable");
    });

    it("refuses to move an entry onto an archived wallet", async () => {
      const wallet = await addWallet("a", "bKash", 1000);
      const old = await addWallet("a", "Old", 0);
      await archiveWallet(db, "a", old);
      const id = await addExpense("a", wallet, 10);
      const result = await updateEntry(db, "a", id, await changesFor(id, { walletId: old }));
      expect(result.ok).toBe(false);
    });

    it("another user cannot edit it", async () => {
      const wallet = await addWallet("a", "bKash", 1000);
      const id = await addExpense("a", wallet, 100);
      const bWallet = await addWallet("b", "Cash", 0);
      const result = await updateEntry(db, "b", id, { walletId: bWallet, categoryId: await categoryId("b", "Food"), amount: taka(1), entryDate: date, note: "hijack" });
      expect(result).toEqual({ ok: false, reason: "not-found" });
      expect(await row(id)).toMatchObject({ userId: "a", note: "orig" });
    });

    it("warns, and changes nothing, when the edit would take the wallet below zero", async () => {
      const wallet = await addWallet("a", "bKash", 1000);
      const id = await addExpense("a", wallet, 100);
      const result = await updateEntry(db, "a", id, await changesFor(id, { amount: taka(1500) }));
      expect(result).toEqual({ ok: false, lowBalance: { walletName: "bKash", balanceAfter: -taka(500) } });
      expect((await row(id)).amount).toBe(taka(100));
      expect(await balance("a", wallet)).toBe(taka(900));

      const confirmed = await updateEntry(db, "a", id, await changesFor(id, { amount: taka(1500) }), { confirmLowBalance: true });
      expect(confirmed.ok).toBe(true);
      expect(await balance("a", wallet)).toBe(-taka(500));
    });

    it("does not warn about a note-only edit on a wallet that is already below zero", async () => {
      const wallet = await addWallet("a", "bKash", 0);
      const id = (await createEntry(db, "a", { type: "expense", walletId: wallet, categoryId: await categoryId("a", "Food"), amount: taka(100), entryDate: date, note: null }, { confirmLowBalance: true })) as { ok: true; id: number };
      const result = await updateEntry(db, "a", id.id, await changesFor(id.id, { note: "tidy" }));
      expect(result).toEqual({ ok: true });
    });
  });

  describe("loan entries", () => {
    it("are not edited or deleted here", async () => {
      const wallet = await addWallet("a", "Bank", 0);
      const [loan] = await db.insert(loans).values({ userId: "a", direction: "borrowed", counterparty: "Rahim", principal: taka(500) }).returning();
      const [principal] = await db.insert(entries).values({ userId: "a", type: "loan_principal", walletId: wallet, loanId: loan.id, amount: taka(500), entryDate: date }).returning();

      expect(await updateEntry(db, "a", principal.id, await changesFor(principal.id, { amount: taka(1) }))).toEqual({ ok: false, reason: "not-found" });
      expect(await deleteEntry(db, "a", principal.id)).toEqual({ ok: false, reason: "not-found" });
      expect(await balance("a", wallet)).toBe(taka(500));
    });

    it("an expense linked to a loan (a fee) is also left to the loan", async () => {
      const wallet = await addWallet("a", "Bank", 1000);
      const [loan] = await db.insert(loans).values({ userId: "a", direction: "borrowed", counterparty: "Rahim", principal: taka(500) }).returning();
      const fees = await categoryId("a", "Loan interest and fees");
      const [fee] = await db.insert(entries).values({ userId: "a", type: "expense", walletId: wallet, categoryId: fees, loanId: loan.id, amount: taka(5), entryDate: date }).returning();
      expect(await deleteEntry(db, "a", fee.id)).toEqual({ ok: false, reason: "not-found" });
    });
  });

  describe("delete", () => {
    it("deleting a 450 expense restores the balance", async () => {
      const wallet = await addWallet("a", "bKash", 3200);
      const id = await addExpense("a", wallet, 450);
      expect(await balance("a", wallet)).toBe(taka(2750));

      expect(await deleteEntry(db, "a", id)).toEqual({ ok: true });
      expect(await balance("a", wallet)).toBe(taka(3200));
      expect(await db.select().from(entries)).toHaveLength(0);
    });

    it("deleting a transfer restores both wallets", async () => {
      const bank = await addWallet("a", "Bank", 1000);
      const bkash = await addWallet("a", "bKash", 0);
      const made = await createEntry(db, "a", { type: "transfer", walletId: bank, toWalletId: bkash, amount: taka(300), entryDate: date, note: null });
      if (!made.ok) throw new Error("setup failed");
      await deleteEntry(db, "a", made.id);
      expect(await balance("a", bank)).toBe(taka(1000));
      expect(await balance("a", bkash)).toBe(0);
    });

    it("another user cannot delete it, and a missing id is just not found", async () => {
      const wallet = await addWallet("a", "bKash", 100);
      const id = await addExpense("a", wallet, 10);
      expect(await deleteEntry(db, "b", id)).toEqual({ ok: false, reason: "not-found" });
      expect(await db.select().from(entries)).toHaveLength(1);
      expect(await deleteEntry(db, "a", 99999)).toEqual({ ok: false, reason: "not-found" });
    });
  });
});
