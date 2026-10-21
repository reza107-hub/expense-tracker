import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { entries, loans, wallets } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { insertUser } from "@/test/users";
import { getWalletWithBalance } from "@/lib/wallets/queries";
import {
  createLoan,
  deleteLoan,
  deleteRepayment,
  recordRepayment,
  updateLoan,
} from "./mutations";
import { getLoan, listLoans, listRepayments, loanTotals } from "./queries";
import { validateLoan, validateLoanEdit, validateRepayment } from "./validation";

const taka = (n: number) => n * 100;

// 10 October 2026, 12:00 in Dhaka.
const NOW = new Date("2026-10-10T06:00:00Z");
const DATE = "2026-10-05";

function form(fields: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
}

describe("loan forms", () => {
  const loan = {
    direction: "borrowed",
    counterparty: "  Rahim   bhai ",
    amount: "50,000",
    walletId: 3,
    entryDate: DATE,
  };

  it("accepts a loan, tidies the name and turns the amount into poisha", () => {
    expect(validateLoan(form({ ...loan, dueDate: "2027-01-01", note: " for rent " }), NOW)).toEqual({
      ok: true,
      value: {
        direction: "borrowed",
        counterparty: "Rahim bhai",
        amount: taka(50000),
        walletId: 3,
        entryDate: DATE,
        dueDate: "2027-01-01",
        note: "for rent",
      },
    });
  });

  it("makes the due date and note optional", () => {
    const checked = validateLoan(form(loan), NOW);
    expect(checked.ok && checked.value.dueDate).toBeNull();
    expect(checked.ok && checked.value.note).toBeNull();
  });

  it("rejects a missing name, a bad direction, a zero amount and a future loan date", () => {
    const checked = validateLoan(
      form({ ...loan, direction: "gift", counterparty: " ", amount: "0", entryDate: "2026-10-11" }),
      NOW,
    );
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(Object.keys(checked.fieldErrors).sort()).toEqual([
      "amount",
      "counterparty",
      "direction",
      "entryDate",
    ]);
  });

  it("rejects an invalid due date", () => {
    const checked = validateLoan(form({ ...loan, dueDate: "2026-02-31" }), NOW);
    expect(!checked.ok && checked.fieldErrors.dueDate).toBeTruthy();
  });

  it("reads only its own fields, so a phone number sent along is dropped", () => {
    const checked = validateLoan(form({ ...loan, phone: "01700000000", account: "123" }), NOW);
    expect(checked.ok && JSON.stringify(checked.value)).not.toMatch(/0170|123/);
  });

  it("reads a repayment with no interest as zero interest", () => {
    const checked = validateRepayment(
      form({ walletId: 1, principal: "10000", entryDate: DATE }),
      NOW,
    );
    expect(checked).toEqual({
      ok: true,
      value: { walletId: 1, principal: taka(10000), interest: 0, entryDate: DATE, note: null },
    });
  });

  it("rejects a zero principal and a zero or malformed interest", () => {
    const checked = validateRepayment(
      form({ walletId: 1, principal: "0", interest: "0", entryDate: DATE }),
      NOW,
    );
    expect(!checked.ok && Object.keys(checked.fieldErrors).sort()).toEqual(["interest", "principal"]);
  });

  it("checks the edit form", () => {
    expect(validateLoanEdit(form({ counterparty: " Karim ", dueDate: "", note: "" }))).toEqual({
      ok: true,
      value: { counterparty: "Karim", dueDate: null, note: null },
    });
    const bad = validateLoanEdit(form({ counterparty: "" }));
    expect(!bad.ok && bad.fieldErrors.counterparty).toBeTruthy();
  });
});

describe("loans", () => {
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

  async function addWallet(userId: string, name: string, opening: number) {
    const [row] = await db
      .insert(wallets)
      .values({ userId, name, openingBalance: taka(opening) })
      .returning();
    return row.id;
  }

  const balanceOf = async (userId: string, walletId: number) =>
    (await getWalletWithBalance(db, userId, walletId))?.balance;

  /** Sums of the ledger that count as spending and income. Loan principal is neither. */
  async function spendingAndIncome(userId: string) {
    const rows = await db.select().from(entries).where(eq(entries.userId, userId));
    const sum = (type: string) =>
      rows.filter((r) => r.type === type).reduce((total, r) => total + r.amount, 0);
    return { spending: sum("expense"), income: sum("income") };
  }

  const newLoan = (direction: "borrowed" | "lent", walletId: number, amount: number) => ({
    direction,
    counterparty: direction === "borrowed" ? "Rahim bhai" : "Karim",
    amount: taka(amount),
    walletId,
    entryDate: DATE,
    dueDate: null,
    note: null,
  });

  const repayment = (walletId: number, principal: number, interest = 0, entryDate = DATE) => ({
    walletId,
    principal: taka(principal),
    interest: taka(interest),
    entryDate,
    note: null,
  });

  async function openLoan(
    userId: string,
    direction: "borrowed" | "lent",
    walletId: number,
    amount: number,
  ) {
    const result = await createLoan(db, userId, newLoan(direction, walletId, amount));
    if (!result.ok) throw new Error("loan was not created");
    return result.id;
  }

  describe("createLoan", () => {
    it("borrowing raises the wallet and owes the amount, with no income or spending", async () => {
      const bank = await addWallet("a", "Bank", 1000);
      const id = await openLoan("a", "borrowed", bank, 50000);

      expect(await balanceOf("a", bank)).toBe(taka(51000));
      expect(await spendingAndIncome("a")).toEqual({ spending: 0, income: 0 });
      expect(await loanTotals(db, "a")).toEqual({ owe: taka(50000), owed: 0 });
      expect(await getLoan(db, "a", id)).toMatchObject({
        counterparty: "Rahim bhai",
        principal: taka(50000),
        repaid: 0,
        outstanding: taka(50000),
        status: "open",
        startDate: DATE,
      });
    });

    it("lending lowers the wallet and is owed back, with no spending", async () => {
      const cash = await addWallet("a", "Cash", 20000);
      await openLoan("a", "lent", cash, 10000);

      expect(await balanceOf("a", cash)).toBe(taka(10000));
      expect(await spendingAndIncome("a")).toEqual({ spending: 0, income: 0 });
      expect(await loanTotals(db, "a")).toEqual({ owe: 0, owed: taka(10000) });
    });

    it("refuses another user's wallet and an archived one, and writes nothing", async () => {
      const theirs = await addWallet("b", "Bank", 0);
      const archived = await addWallet("a", "Old", 0);
      await db.update(wallets).set({ archivedAt: new Date() }).where(eq(wallets.id, archived));

      for (const walletId of [theirs, archived]) {
        const result = await createLoan(db, "a", newLoan("borrowed", walletId, 100));
        expect(result.ok).toBe(false);
      }
      expect(await db.select().from(loans)).toHaveLength(0);
      expect(await db.select().from(entries)).toHaveLength(0);
    });
  });

  describe("recordRepayment", () => {
    it("a partial repayment of a borrowed loan lowers the wallet and the outstanding", async () => {
      const bank = await addWallet("a", "Bank", 0);
      const bkash = await addWallet("a", "bKash", 20000);
      const id = await openLoan("a", "borrowed", bank, 50000);

      const result = await recordRepayment(db, "a", id, repayment(bkash, 10000));

      expect(result).toEqual({ ok: true });
      expect(await balanceOf("a", bkash)).toBe(taka(10000));
      expect(await getLoan(db, "a", id)).toMatchObject({
        repaid: taka(10000),
        outstanding: taka(40000),
        status: "open",
      });
      expect(await spendingAndIncome("a")).toEqual({ spending: 0, income: 0 });
      expect(await loanTotals(db, "a")).toEqual({ owe: taka(40000), owed: 0 });
    });

    it("a fee on a borrowed loan lowers the wallet and counts as spending, not principal", async () => {
      const bank = await addWallet("a", "Bank", 0);
      const bkash = await addWallet("a", "bKash", 20000);
      const id = await openLoan("a", "borrowed", bank, 50000);

      await recordRepayment(db, "a", id, repayment(bkash, 10000, 500));

      expect(await balanceOf("a", bkash)).toBe(taka(9500));
      expect(await spendingAndIncome("a")).toEqual({ spending: taka(500), income: 0 });
      expect((await getLoan(db, "a", id))?.outstanding).toBe(taka(40000));

      const [fee] = await db.select().from(entries).where(eq(entries.type, "expense"));
      const [category] = await db.execute(
        sql`select name, is_reserved from categories where id = ${fee.categoryId}`,
      ).then((r) => r.rows as { name: string; is_reserved: boolean }[]);
      expect(category).toEqual({ name: "Loan interest and fees", is_reserved: true });
    });

    it("interest on a lent loan raises the wallet and counts as income, not principal", async () => {
      const cash = await addWallet("a", "Cash", 20000);
      const id = await openLoan("a", "lent", cash, 10000);

      await recordRepayment(db, "a", id, repayment(cash, 2000, 100));

      expect(await balanceOf("a", cash)).toBe(taka(12100));
      expect(await spendingAndIncome("a")).toEqual({ spending: 0, income: taka(100) });
      expect((await getLoan(db, "a", id))?.outstanding).toBe(taka(8000));
    });

    it("rejects more principal than is outstanding and writes nothing", async () => {
      const bank = await addWallet("a", "Bank", 0);
      const id = await openLoan("a", "borrowed", bank, 1000);
      await recordRepayment(db, "a", id, repayment(bank, 400));
      const before = await db.select().from(entries);

      const result = await recordRepayment(db, "a", id, repayment(bank, 700, 50));

      expect(result).toMatchObject({
        ok: false,
        fieldErrors: { principal: expect.stringContaining("600") },
      });
      expect(await db.select().from(entries)).toHaveLength(before.length);
    });

    it("the final repayment closes the loan and a closed loan takes no more", async () => {
      const bank = await addWallet("a", "Bank", 0);
      const id = await openLoan("a", "borrowed", bank, 1000);

      await recordRepayment(db, "a", id, repayment(bank, 1000));

      expect(await getLoan(db, "a", id)).toMatchObject({ outstanding: 0, status: "closed" });
      expect(await loanTotals(db, "a")).toEqual({ owe: 0, owed: 0 });
      const again = await recordRepayment(db, "a", id, repayment(bank, 1));
      expect(again).toMatchObject({ ok: false, fieldErrors: { principal: expect.any(String) } });
    });

    it("two repayments sent at once cannot overpay", async () => {
      const bank = await addWallet("a", "Bank", 0);
      const id = await openLoan("a", "borrowed", bank, 1000);

      const results = await Promise.all([
        recordRepayment(db, "a", id, repayment(bank, 700)),
        recordRepayment(db, "a", id, repayment(bank, 700)),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect((await getLoan(db, "a", id))?.outstanding).toBe(taka(300));
    });

    it("refuses another user's loan and another user's wallet", async () => {
      const aBank = await addWallet("a", "Bank", 0);
      const bBank = await addWallet("b", "Bank", 0);
      const id = await openLoan("a", "borrowed", aBank, 1000);

      expect(await recordRepayment(db, "b", id, repayment(bBank, 100))).toEqual({
        ok: false,
        reason: "not-found",
      });
      expect(await recordRepayment(db, "a", id, repayment(bBank, 100))).toMatchObject({
        ok: false,
        fieldErrors: { walletId: expect.any(String) },
      });
      expect((await getLoan(db, "a", id))?.repaid).toBe(0);
    });
  });

  describe("listRepayments", () => {
    it("pairs each repayment with its own fee", async () => {
      const bank = await addWallet("a", "Bank", 0);
      const id = await openLoan("a", "borrowed", bank, 50000);
      await recordRepayment(db, "a", id, repayment(bank, 10000, 500, "2026-10-06"));
      await recordRepayment(db, "a", id, repayment(bank, 5000, 0, "2026-10-07"));
      await recordRepayment(db, "a", id, repayment(bank, 2000, 100, "2026-10-08"));

      const list = await listRepayments(db, "a", [id]);

      expect(list.map((r) => [r.entryDate, r.principal, r.fee, r.walletName])).toEqual([
        ["2026-10-08", taka(2000), taka(100), "Bank"],
        ["2026-10-07", taka(5000), 0, "Bank"],
        ["2026-10-06", taka(10000), taka(500), "Bank"],
      ]);
    });

    it("never returns another user's repayments", async () => {
      const bank = await addWallet("a", "Bank", 0);
      const id = await openLoan("a", "borrowed", bank, 1000);
      await recordRepayment(db, "a", id, repayment(bank, 100));

      expect(await listRepayments(db, "b", [id])).toEqual([]);
      expect(await listLoans(db, "b")).toEqual([]);
    });
  });

  describe("deleteRepayment", () => {
    it("removes the repayment and its fee, and reopens a closed loan", async () => {
      const bank = await addWallet("a", "Bank", 0);
      const id = await openLoan("a", "borrowed", bank, 1000);
      await recordRepayment(db, "a", id, repayment(bank, 400, 0, "2026-10-06"));
      await recordRepayment(db, "a", id, repayment(bank, 600, 50, "2026-10-07"));
      expect((await getLoan(db, "a", id))?.status).toBe("closed");
      const before = await balanceOf("a", bank);

      const last = (await listRepayments(db, "a", [id]))[0];
      expect(await deleteRepayment(db, "a", last.id)).toEqual({ ok: true });

      expect(await getLoan(db, "a", id)).toMatchObject({
        status: "open",
        outstanding: taka(600),
        repaid: taka(400),
      });
      // The 600 principal and the 50 fee come back to the wallet.
      expect(await balanceOf("a", bank)).toBe((before as number) + taka(650));
      expect(await spendingAndIncome("a")).toEqual({ spending: 0, income: 0 });
      // The earlier repayment is untouched.
      expect(await listRepayments(db, "a", [id])).toHaveLength(1);
    });

    it("leaves another user's repayment alone", async () => {
      const bank = await addWallet("a", "Bank", 0);
      const id = await openLoan("a", "borrowed", bank, 1000);
      await recordRepayment(db, "a", id, repayment(bank, 100));
      const [row] = await listRepayments(db, "a", [id]);

      expect(await deleteRepayment(db, "b", row.id)).toEqual({ ok: false, reason: "not-found" });
      expect(await listRepayments(db, "a", [id])).toHaveLength(1);
    });
  });

  describe("updateLoan", () => {
    it("changes the counterparty, due date and note but never the money", async () => {
      const bank = await addWallet("a", "Bank", 0);
      const id = await openLoan("a", "borrowed", bank, 1000);

      const result = await updateLoan(db, "a", id, {
        counterparty: "Rahim",
        dueDate: "2026-12-31",
        note: "rent",
      });

      expect(result).toEqual({ ok: true });
      expect(await getLoan(db, "a", id)).toMatchObject({
        counterparty: "Rahim",
        dueDate: "2026-12-31",
        note: "rent",
        principal: taka(1000),
      });
      expect(await balanceOf("a", bank)).toBe(taka(1000));
    });

    it("refuses another user's loan", async () => {
      const bank = await addWallet("a", "Bank", 0);
      const id = await openLoan("a", "borrowed", bank, 1000);

      const result = await updateLoan(db, "b", id, { counterparty: "X", dueDate: null, note: null });

      expect(result).toEqual({ ok: false, reason: "not-found" });
      expect((await getLoan(db, "a", id))?.counterparty).toBe("Rahim bhai");
    });
  });

  describe("deleteLoan", () => {
    it("removes the loan, its repayments and fees, and their effect on wallets and spending", async () => {
      const bank = await addWallet("a", "Bank", 500);
      const bkash = await addWallet("a", "bKash", 500);
      const id = await openLoan("a", "borrowed", bank, 50000);
      await recordRepayment(db, "a", id, repayment(bkash, 100, 10));
      await recordRepayment(db, "a", id, repayment(bkash, 200, 20));

      expect(await deleteLoan(db, "a", id)).toEqual({ ok: true });

      expect(await listLoans(db, "a")).toEqual([]);
      expect(await db.select().from(entries)).toHaveLength(0);
      expect(await balanceOf("a", bank)).toBe(taka(500));
      expect(await balanceOf("a", bkash)).toBe(taka(500));
      expect(await spendingAndIncome("a")).toEqual({ spending: 0, income: 0 });
      expect(await loanTotals(db, "a")).toEqual({ owe: 0, owed: 0 });
    });

    it("leaves another user's loan alone", async () => {
      const bank = await addWallet("a", "Bank", 0);
      const id = await openLoan("a", "borrowed", bank, 1000);

      expect(await deleteLoan(db, "b", id)).toEqual({ ok: false, reason: "not-found" });
      expect(await listLoans(db, "a")).toHaveLength(1);
      expect(await db.select().from(entries)).toHaveLength(1);
    });
  });

  it("totals count open loans only and keep each user's separate", async () => {
    const bank = await addWallet("a", "Bank", 0);
    const other = await addWallet("b", "Bank", 0);
    const borrowed = await openLoan("a", "borrowed", bank, 50000);
    await openLoan("a", "lent", bank, 3000);
    const closed = await openLoan("a", "lent", bank, 700);
    await recordRepayment(db, "a", borrowed, repayment(bank, 10000));
    await recordRepayment(db, "a", closed, repayment(bank, 700));
    await openLoan("b", "borrowed", other, 999);

    expect(await loanTotals(db, "a")).toEqual({ owe: taka(40000), owed: taka(3000) });
    expect(await loanTotals(db, "b")).toEqual({ owe: taka(999), owed: 0 });
  });
});
