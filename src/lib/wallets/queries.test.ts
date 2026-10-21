import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { categories, entries, loans, wallets } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { insertUser } from "@/test/users";
import {
  getWalletWithBalance,
  listWalletsWithBalance,
  totalBalance,
} from "./queries";

const taka = (n: number) => n * 100;

describe("wallet balances", () => {
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
  });

  async function addWallet(userId: string, name: string, opening = 0) {
    const [wallet] = await db
      .insert(wallets)
      .values({ userId, name, openingBalance: taka(opening) })
      .returning();
    return wallet.id;
  }

  async function categoryId(userId: string) {
    const [row] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.name, "Food")));
    return row.id;
  }

  async function addEntry(
    userId: string,
    values: Omit<typeof entries.$inferInsert, "userId" | "entryDate">,
  ) {
    const [entry] = await db
      .insert(entries)
      .values({ userId, entryDate: "2026-10-01", ...values })
      .returning();
    return entry.id;
  }

  async function addLoan(userId: string, direction: "borrowed" | "lent", amount: number) {
    const [loan] = await db
      .insert(loans)
      .values({ userId, direction, counterparty: "Someone", principal: taka(amount) })
      .returning();
    return loan.id;
  }

  async function balanceOf(userId: string, walletId: number) {
    return (await getWalletWithBalance(db, userId, walletId))?.balance;
  }

  it("starts at the opening balance", async () => {
    await insertUser(db, "a");
    const id = await addWallet("a", "bKash", 3200);
    expect(await balanceOf("a", id)).toBe(taka(3200));
  });

  it("an expense lowers the balance and deleting it restores it", async () => {
    await insertUser(db, "a");
    const id = await addWallet("a", "bKash", 3200);
    const entryId = await addEntry("a", {
      type: "expense",
      walletId: id,
      categoryId: await categoryId("a"),
      amount: taka(450),
    });
    expect(await balanceOf("a", id)).toBe(taka(2750));

    await db.delete(entries).where(eq(entries.id, entryId));
    expect(await balanceOf("a", id)).toBe(taka(3200));
  });

  it("income raises the balance", async () => {
    await insertUser(db, "a");
    const id = await addWallet("a", "Bank", 40000);
    await addEntry("a", { type: "income", walletId: id, amount: taka(20000) });
    expect(await balanceOf("a", id)).toBe(taka(60000));
  });

  it("a transfer moves money from the source to the destination", async () => {
    await insertUser(db, "a");
    const bank = await addWallet("a", "Bank", 40000);
    const bkash = await addWallet("a", "bKash", 3200);
    await addEntry("a", {
      type: "transfer",
      walletId: bank,
      toWalletId: bkash,
      amount: taka(5000),
    });
    expect(await balanceOf("a", bank)).toBe(taka(35000));
    expect(await balanceOf("a", bkash)).toBe(taka(8200));
    expect(await totalBalance(db, "a")).toBe(taka(43200));
  });

  it("an adjustment applies its signed difference", async () => {
    await insertUser(db, "a");
    const id = await addWallet("a", "Crypto", 50000);
    await addEntry("a", { type: "adjustment", walletId: id, amount: taka(2000) });
    expect(await balanceOf("a", id)).toBe(taka(52000));
    await addEntry("a", { type: "adjustment", walletId: id, amount: -taka(500) });
    expect(await balanceOf("a", id)).toBe(taka(51500));
  });

  it("a borrowed loan brings money in and a repayment takes it out", async () => {
    await insertUser(db, "a");
    const id = await addWallet("a", "Bank", 0);
    const loanId = await addLoan("a", "borrowed", 50000);
    await addEntry("a", { type: "loan_principal", walletId: id, loanId, amount: taka(50000) });
    expect(await balanceOf("a", id)).toBe(taka(50000));

    await addEntry("a", { type: "loan_repayment", walletId: id, loanId, amount: taka(10000) });
    // The fee is its own expense row linked to the loan.
    await addEntry("a", {
      type: "expense",
      walletId: id,
      loanId,
      categoryId: await categoryId("a"),
      amount: taka(500),
    });
    expect(await balanceOf("a", id)).toBe(taka(39500));
  });

  it("a lent loan sends money out and a repayment brings it back with interest", async () => {
    await insertUser(db, "a");
    const id = await addWallet("a", "Cash", 20000);
    const loanId = await addLoan("a", "lent", 10000);
    await addEntry("a", { type: "loan_principal", walletId: id, loanId, amount: taka(10000) });
    expect(await balanceOf("a", id)).toBe(taka(10000));

    await addEntry("a", { type: "loan_repayment", walletId: id, loanId, amount: taka(2000) });
    await addEntry("a", { type: "income", walletId: id, loanId, amount: taka(100) });
    expect(await balanceOf("a", id)).toBe(taka(12100));
  });

  it("deleting a loan removes its effect on the wallet", async () => {
    await insertUser(db, "a");
    const id = await addWallet("a", "Bank", 1000);
    const loanId = await addLoan("a", "borrowed", 5000);
    await addEntry("a", { type: "loan_principal", walletId: id, loanId, amount: taka(5000) });
    expect(await balanceOf("a", id)).toBe(taka(6000));

    await db.delete(loans).where(eq(loans.id, loanId));
    expect(await balanceOf("a", id)).toBe(taka(1000));
  });

  it("can go below zero", async () => {
    await insertUser(db, "a");
    const id = await addWallet("a", "bKash", 3000);
    await addEntry("a", {
      type: "expense",
      walletId: id,
      categoryId: await categoryId("a"),
      amount: taka(5000),
    });
    expect(await balanceOf("a", id)).toBe(-taka(2000));
  });

  it("totals only active wallets, and lists archived ones separately", async () => {
    await insertUser(db, "a");
    await addWallet("a", "Cash", 5000);
    await addWallet("a", "Bank", 40000);
    await addWallet("a", "bKash", 3200);
    const [old] = await db
      .insert(wallets)
      .values({ userId: "a", name: "Old", openingBalance: 0, archivedAt: new Date() })
      .returning();

    expect(await totalBalance(db, "a")).toBe(taka(48200));
    const active = await listWalletsWithBalance(db, "a");
    expect(active.map((w) => w.name)).toEqual(["Cash", "Bank", "bKash"]);
    const archived = await listWalletsWithBalance(db, "a", { archived: true });
    expect(archived.map((w) => w.id)).toEqual([old.id]);
  });

  describe("with two users", () => {
    it("another user's entries never change a balance", async () => {
      await insertUser(db, "a");
      await insertUser(db, "b");
      const aWallet = await addWallet("a", "bKash", 3200);
      const bWallet = await addWallet("b", "bKash", 1000);

      await addEntry("b", { type: "income", walletId: bWallet, amount: taka(9000) });
      await addEntry("b", {
        type: "expense",
        walletId: bWallet,
        categoryId: await categoryId("b"),
        amount: taka(200),
      });

      expect(await balanceOf("a", aWallet)).toBe(taka(3200));
      expect(await balanceOf("b", bWallet)).toBe(taka(9800));
      expect(await totalBalance(db, "a")).toBe(taka(3200));
    });

    it("a user cannot list or read another user's wallets", async () => {
      await insertUser(db, "a");
      await insertUser(db, "b");
      const aWallet = await addWallet("a", "Cash", 100);
      await addWallet("b", "Cash", 100);

      expect((await listWalletsWithBalance(db, "b")).map((w) => w.id)).not.toContain(aWallet);
      expect(await getWalletWithBalance(db, "b", aWallet)).toBeNull();
    });

    it("the database refuses an entry that uses another user's wallet", async () => {
      await insertUser(db, "a");
      await insertUser(db, "b");
      const aWallet = await addWallet("a", "Cash", 100);
      await expect(
        addEntry("b", { type: "income", walletId: aWallet, amount: taka(1) }),
      ).rejects.toThrow();
    });
  });
});
