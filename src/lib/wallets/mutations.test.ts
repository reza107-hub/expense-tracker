import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { categories, entries, wallets } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { insertUser } from "@/test/users";
import { archiveWallet, createWallet, restoreWallet, updateWallet } from "./mutations";
import { getWalletWithBalance, listWalletsWithBalance } from "./queries";
import { validateWallet } from "./validation";

const taka = (n: number) => n * 100;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("validateWallet", () => {
  it("accepts a name and an opening balance", () => {
    const checked = validateWallet(form({ name: "  bKash ", openingBalance: "3,200" }));
    expect(checked).toEqual({ ok: true, value: { name: "bKash", openingBalance: taka(3200) } });
  });

  it("treats an empty balance as zero", () => {
    const checked = validateWallet(form({ name: "Savings jar", openingBalance: "" }));
    expect(checked).toEqual({ ok: true, value: { name: "Savings jar", openingBalance: 0 } });
  });

  it("rejects a missing name, a negative amount and three decimals", () => {
    const noName = validateWallet(form({ name: "  ", openingBalance: "0" }));
    expect(noName.ok).toBe(false);
    const negative = validateWallet(form({ name: "Cash", openingBalance: "-5" }));
    expect(!negative.ok && negative.fieldErrors.openingBalance).toBeTruthy();
    const decimals = validateWallet(form({ name: "Cash", openingBalance: "1.234" }));
    expect(!decimals.ok && decimals.fieldErrors.openingBalance).toBeTruthy();
  });

  it("rejects a name longer than 40 characters", () => {
    const checked = validateWallet(form({ name: "x".repeat(41), openingBalance: "0" }));
    expect(!checked.ok && checked.fieldErrors.name).toBeTruthy();
  });

  it("ignores any field other than name and opening balance", () => {
    const checked = validateWallet(
      form({ name: "bKash", openingBalance: "0", phone: "01700000000", accountNumber: "123" }),
    );
    expect(checked).toEqual({ ok: true, value: { name: "bKash", openingBalance: 0 } });
  });
});

describe("wallet changes", () => {
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
    (await listWalletsWithBalance(db, userId, { archived })).map((w) => w.name);

  async function walletId(userId: string, name: string) {
    const [row] = await db
      .select({ id: wallets.id })
      .from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.name, name)));
    return row.id;
  }

  async function spend(userId: string, wallet: number, amount: number) {
    const [food] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.name, "Food")));
    await db.insert(entries).values({
      userId,
      type: "expense",
      walletId: wallet,
      categoryId: food.id,
      amount,
      entryDate: "2026-10-01",
    });
  }

  it("creates a wallet from a preset name with an opening balance", async () => {
    expect(await createWallet(db, "a", { name: "bKash", openingBalance: taka(3200) })).toEqual({
      ok: true,
    });
    const [wallet] = await listWalletsWithBalance(db, "a");
    expect(wallet.name).toBe("bKash");
    expect(wallet.balance).toBe(taka(3200));
  });

  it("creates a custom wallet with a zero balance", async () => {
    await createWallet(db, "a", { name: "Savings jar", openingBalance: 0 });
    expect((await listWalletsWithBalance(db, "a"))[0].balance).toBe(0);
  });

  it("rejects a duplicate name for the same user, ignoring letter case", async () => {
    await createWallet(db, "a", { name: "bKash", openingBalance: 0 });
    expect(await createWallet(db, "a", { name: "BKASH", openingBalance: 0 })).toEqual({
      ok: false,
      reason: "duplicate-name",
    });
    expect(await names("a")).toEqual(["bKash"]);
  });

  it("accepts the same name for a different user", async () => {
    await createWallet(db, "a", { name: "bKash", openingBalance: 0 });
    expect(await createWallet(db, "b", { name: "bKash", openingBalance: 0 })).toEqual({
      ok: true,
    });
    expect(await names("b")).toEqual(["bKash"]);
  });

  it("renames a wallet, changes its opening balance, and refuses a clashing name", async () => {
    await createWallet(db, "a", { name: "Cash", openingBalance: taka(100) });
    await createWallet(db, "a", { name: "Bank", openingBalance: 0 });
    const cash = await walletId("a", "Cash");

    expect(await updateWallet(db, "a", cash, { name: "Wallet", openingBalance: taka(250) })).toEqual({
      ok: true,
    });
    expect((await getWalletWithBalance(db, "a", cash))?.balance).toBe(taka(250));
    expect(await names("a")).toContain("Wallet");

    expect(await updateWallet(db, "a", cash, { name: "bank", openingBalance: 0 })).toEqual({
      ok: false,
      reason: "duplicate-name",
    });
  });

  it("archives an empty wallet and keeps its past entries", async () => {
    await createWallet(db, "a", { name: "Cash", openingBalance: taka(500) });
    const cash = await walletId("a", "Cash");
    await spend("a", cash, taka(500));

    expect(await archiveWallet(db, "a", cash)).toEqual({ ok: true });
    expect(await names("a")).toEqual([]);
    expect(await names("a", true)).toEqual(["Cash"]);
    const kept = await db.select().from(entries).where(eq(entries.walletId, cash));
    expect(kept).toHaveLength(1);
  });

  it("refuses to archive a wallet that holds money", async () => {
    await createWallet(db, "a", { name: "Bank", openingBalance: taka(1000) });
    const bank = await walletId("a", "Bank");

    const result = await archiveWallet(db, "a", bank);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("balance-not-zero");
    expect(await names("a")).toEqual(["Bank"]);
  });

  it("refuses to archive a wallet that is below zero", async () => {
    await createWallet(db, "a", { name: "bKash", openingBalance: taka(100) });
    const bkash = await walletId("a", "bKash");
    await spend("a", bkash, taka(300));
    expect((await archiveWallet(db, "a", bkash)).ok).toBe(false);
  });

  it("restores an archived wallet with its calculated balance", async () => {
    await createWallet(db, "a", { name: "Cash", openingBalance: 0 });
    const cash = await walletId("a", "Cash");
    await archiveWallet(db, "a", cash);

    expect(await restoreWallet(db, "a", cash)).toEqual({ ok: true });
    expect(await names("a")).toEqual(["Cash"]);
    expect((await getWalletWithBalance(db, "a", cash))?.balance).toBe(0);
  });

  it("refuses to restore a wallet whose name is now used by an active one", async () => {
    await createWallet(db, "a", { name: "Cash", openingBalance: 0 });
    const old = await walletId("a", "Cash");
    await archiveWallet(db, "a", old);
    await createWallet(db, "a", { name: "Cash", openingBalance: 0 });

    expect(await restoreWallet(db, "a", old)).toEqual({ ok: false, reason: "duplicate-name" });
  });

  describe("with two users", () => {
    it("user B cannot rename, archive or restore user A's wallet", async () => {
      await createWallet(db, "a", { name: "Cash", openingBalance: 0 });
      await createWallet(db, "a", { name: "Old", openingBalance: 0 });
      const cash = await walletId("a", "Cash");
      const old = await walletId("a", "Old");
      await archiveWallet(db, "a", old);

      expect(await updateWallet(db, "b", cash, { name: "Hacked", openingBalance: taka(9) })).toEqual({
        ok: false,
        reason: "not-found",
      });
      expect(await archiveWallet(db, "b", cash)).toEqual({ ok: false, reason: "not-found" });
      expect(await restoreWallet(db, "b", old)).toEqual({ ok: false, reason: "not-found" });

      expect(await names("a")).toEqual(["Cash"]);
      expect(await names("a", true)).toEqual(["Old"]);
      expect((await getWalletWithBalance(db, "a", cash))?.balance).toBe(0);
    });
  });
});
