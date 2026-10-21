import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aiAdvice, aiUsage, categories, wallets } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { insertUser } from "@/test/users";
import { createEntry } from "@/lib/entries/create";
import { createLoan, recordRepayment } from "@/lib/loans/mutations";
import { periodForMonth } from "@/lib/period";
import { updateAlertSettings } from "@/lib/settings/mutations";
import { AdviceError, toAdviceError, type AdviceClient } from "./gemini";
import { buildAdvicePayload, hashPayload, type AdvicePayload } from "./payload";
import { parseAdvice } from "./response";
import { getSavedAdvice, requestAdvice } from "./service";
import { DAILY_LIMIT, releaseRequest, remainingRequests, reserveRequest } from "./usage";

const taka = (n: number) => n * 100;
const OCTOBER = periodForMonth(2026, 10, 1);
const TODAY = "2026-10-20";

const payload: AdvicePayload = {
  totalSpending: 4000,
  previousMonthTotalSpending: 0,
  monthlyLimit: null,
  totalOwed: 0,
  loanInterestAndFees: 0,
  categories: [
    { category: "Food", spent: 3000, previousMonthSpent: 0 },
    { category: "Transport", spent: 1000, previousMonthSpent: 0 },
  ],
};
const reply = (suggestions: object[], summary = "A calm month.") =>
  JSON.stringify({ summary, suggestions });

describe("parseAdvice", () => {
  it("drops a suggestion that saves 5,000 on a category where 3,000 was spent", () => {
    const parsed = parseAdvice(
      reply([
        { category: "Food", tip: "Cook at home.", saving: 5000 },
        { category: "Transport", tip: "Walk short trips.", saving: 400 },
      ]),
      payload,
    );
    expect(parsed).toEqual({
      ok: true,
      dropped: 1,
      advice: {
        summary: "A calm month.",
        suggestions: [{ category: "Transport", tip: "Walk short trips.", saving: taka(400) }],
      },
    });
  });

  it("keeps a saving equal to the spending, but not one poisha over", () => {
    const parsed = parseAdvice(
      reply([
        { category: "Food", tip: "All of it.", saving: 3000 },
        { category: "Transport", tip: "Over.", saving: 1000.01 },
      ]),
      payload,
    );
    expect(parsed.ok && parsed.advice.suggestions.map((s) => s.category)).toEqual(["Food"]);
  });

  it("drops unknown categories and zero or negative savings, and matches names ignoring case", () => {
    const parsed = parseAdvice(
      reply([
        { category: "Holidays", tip: "x", saving: 10 },
        { category: "food", tip: "Lower case name.", saving: 100 },
        { category: "Transport", tip: "x", saving: 0 },
        { category: "Transport", tip: "x", saving: -5 },
      ]),
      payload,
    );
    expect(parsed.ok && parsed.advice.suggestions).toEqual([
      { category: "Food", tip: "Lower case name.", saving: taka(100) },
    ]);
  });

  it("rejects text that is not JSON and JSON of the wrong shape", () => {
    expect(parseAdvice("Sure! Here is some advice", payload)).toEqual({ ok: false });
    expect(parseAdvice("{}", payload)).toEqual({ ok: false });
    expect(parseAdvice(JSON.stringify({ summary: "", suggestions: [] }), payload)).toEqual({ ok: false });
    expect(parseAdvice(JSON.stringify({ summary: "x", suggestions: [{ category: "Food" }] }), payload)).toEqual({ ok: false });
  });
});

describe("toAdviceError", () => {
  it("never repeats the library's own message, which could hold the key or request", () => {
    const failure = toAdviceError(new Error("request to ...?key=SECRET failed"));
    expect(failure.kind).toBe("unavailable");
    expect(failure.message).not.toMatch(/SECRET|key/);
  });

  it("recognises a timeout", () => {
    const timeout = Object.assign(new Error("slow"), { name: "TimeoutError" });
    expect(toAdviceError(timeout).kind).toBe("timeout");
  });
});

describe("advice", () => {
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
    await insertUser(db, "user-alpha-123");
    await insertUser(db, "user-beta-456");
  });

  const A = "user-alpha-123";
  const B = "user-beta-456";

  async function addWallet(userId: string, name: string) {
    const [row] = await db
      .insert(wallets)
      .values({ userId, name, openingBalance: taka(1000000) })
      .returning();
    return row.id;
  }

  async function spend(
    userId: string,
    walletId: number,
    category: string,
    amount: number,
    note: string | null = null,
    date = "2026-10-05",
  ) {
    const [cat] = await db
      .select()
      .from(categories)
      .where(sql`${categories.userId} = ${userId} and ${categories.name} = ${category}`);
    const result = await createEntry(db, userId, {
      type: "expense",
      walletId,
      categoryId: cat.id,
      amount: taka(amount),
      entryDate: date,
      note,
    });
    if (!result.ok) throw new Error("expense was not saved");
  }

  /** A client that records its calls and answers from a queue of replies or errors. */
  function fakeClient(...answers: (string | Error)[]) {
    const calls: AdvicePayload[] = [];
    const client: AdviceClient = {
      async generate(p) {
        calls.push(p);
        const answer = answers[Math.min(calls.length - 1, answers.length - 1)];
        if (answer instanceof Error) throw answer;
        return answer;
      },
    };
    return { client, calls };
  }

  const good = reply([{ category: "Food", tip: "Cook at home.", saving: 50 }]);
  const ask = (userId: string, client: AdviceClient | null, today = TODAY) =>
    requestAdvice(db, userId, { period: OCTOBER, startDay: 1, today, client });

  describe("buildAdvicePayload", () => {
    it("holds only figures: no notes, wallet or counterparty names, email or ids", async () => {
      const wallet = await addWallet(A, "Hidden Savings Wallet");
      await spend(A, wallet, "Food", 800, "Lunch with Rahim");
      await updateAlertSettings(db, A, { alertsEnabled: false, monthlyLimit: taka(30000) });
      const loan = await createLoan(db, A, {
        direction: "borrowed",
        counterparty: "Karim Uddin",
        amount: taka(40000),
        walletId: wallet,
        entryDate: "2026-10-02",
        dueDate: null,
        note: "private loan note",
      });
      if (!loan.ok) throw new Error("loan");
      await recordRepayment(db, A, loan.id, {
        walletId: wallet,
        principal: taka(1000),
        interest: taka(200),
        entryDate: "2026-10-09",
        note: null,
      });

      const built = await buildAdvicePayload(db, A, OCTOBER, 1);
      const text = JSON.stringify(built);

      for (const secret of [
        "Lunch with Rahim",
        "Rahim",
        "Hidden Savings Wallet",
        "Karim Uddin",
        "private loan note",
        "user-alpha-123",
        "@example.com",
      ]) {
        expect(text).not.toContain(secret);
      }
      expect(Object.keys(built).sort()).toEqual([
        "categories",
        "loanInterestAndFees",
        "monthlyLimit",
        "previousMonthTotalSpending",
        "totalOwed",
        "totalSpending",
      ]);
      expect(built).toMatchObject({
        totalSpending: 1000,
        monthlyLimit: 30000,
        totalOwed: 39000,
        loanInterestAndFees: 200,
        categories: [{ category: "Food", spent: 800, previousMonthSpent: 0 }],
      });
    });

    it("uses only the signed-in user's own spending", async () => {
      await spend(B, await addWallet(B, "W"), "Food", 9999);
      const built = await buildAdvicePayload(db, A, OCTOBER, 1);
      expect(built.totalSpending).toBe(0);
      expect(built.categories).toEqual([]);
    });

    it("gives the same hash for the same figures and another for different ones", async () => {
      const wallet = await addWallet(A, "W");
      await spend(A, wallet, "Food", 100);
      const first = hashPayload(await buildAdvicePayload(db, A, OCTOBER, 1));
      expect(hashPayload(await buildAdvicePayload(db, A, OCTOBER, 1))).toBe(first);
      await spend(A, wallet, "Food", 1);
      expect(hashPayload(await buildAdvicePayload(db, A, OCTOBER, 1))).not.toBe(first);
    });
  });

  describe("requestAdvice", () => {
    it("makes no request for a month with no expenses", async () => {
      const { client, calls } = fakeClient(good);
      expect(await ask(A, client)).toEqual({ status: "empty" });
      expect(calls).toHaveLength(0);
      expect(await remainingRequests(db, A, TODAY)).toBe(DAILY_LIMIT);
    });

    it("creates advice, saves it with a time, and a later visit reads it without a request", async () => {
      await spend(A, await addWallet(A, "W"), "Food", 800);
      const { client, calls } = fakeClient(good);

      const outcome = await ask(A, client);

      expect(outcome.status).toBe("created");
      expect(calls).toHaveLength(1);
      const saved = await getSavedAdvice(db, A, OCTOBER);
      expect(saved?.advice.suggestions).toEqual([
        { category: "Food", tip: "Cook at home.", saving: taka(50) },
      ]);
      expect(saved?.createdAt).toBeInstanceOf(Date);
      expect(calls).toHaveLength(1);
    });

    it("a refresh with the same figures reuses the saved advice: no request, no count", async () => {
      await spend(A, await addWallet(A, "W"), "Food", 800);
      const { client, calls } = fakeClient(good);
      await ask(A, client);
      const remaining = await remainingRequests(db, A, TODAY);

      const again = await ask(A, client);

      expect(again.status).toBe("unchanged");
      expect(calls).toHaveLength(1);
      expect(await remainingRequests(db, A, TODAY)).toBe(remaining);
    });

    it("a refresh after new spending makes a new request and replaces the advice", async () => {
      const wallet = await addWallet(A, "W");
      await spend(A, wallet, "Food", 800);
      const { client, calls } = fakeClient(
        good,
        reply([{ category: "Food", tip: "Plan meals.", saving: 70 }], "New summary."),
      );
      await ask(A, client);
      await spend(A, wallet, "Food", 100);

      const outcome = await ask(A, client);

      expect(outcome.status).toBe("created");
      expect(calls).toHaveLength(2);
      const saved = await getSavedAdvice(db, A, OCTOBER);
      expect(saved?.advice.summary).toBe("New summary.");
      expect(await db.select().from(aiAdvice)).toHaveLength(1);
    });

    it("each user sees only their own saved advice", async () => {
      await spend(A, await addWallet(A, "W"), "Food", 800);
      await ask(A, fakeClient(good).client);

      expect(await getSavedAdvice(db, B, OCTOBER)).toBeNull();
      expect(await getSavedAdvice(db, A, OCTOBER)).not.toBeNull();
    });

    it("says it is not set up when there is no client, without counting a request", async () => {
      await spend(A, await addWallet(A, "W"), "Food", 800);
      const outcome = await ask(A, null);
      expect(outcome).toMatchObject({ status: "error", saved: null });
      expect(await remainingRequests(db, A, TODAY)).toBe(DAILY_LIMIT);
    });
  });

  describe("failures keep the old advice and the allowance", () => {
    async function withSavedAdvice() {
      const wallet = await addWallet(A, "W");
      await spend(A, wallet, "Food", 800);
      await ask(A, fakeClient(good).client);
      await spend(A, wallet, "Food", 100); // figures changed, so a refresh would call
      return remainingRequests(db, A, TODAY);
    }

    const failures: [string, string | Error][] = [
      ["a rate limit", new AdviceError("rate-limit", "The advice service is busy right now. Please try again in a little while.")],
      ["a timeout", new AdviceError("timeout", "The advice service took too long. Please try again.")],
      ["an unexpected error", new Error("socket hang up")],
      ["a reply that is not JSON", "I am sorry, I cannot help"],
      ["a reply of the wrong shape", JSON.stringify({ advice: "x" })],
    ];

    for (const [name, answer] of failures) {
      it(`${name}: shows a message, keeps the saved advice, uses no allowance`, async () => {
        const remaining = await withSavedAdvice();

        const outcome = await ask(A, fakeClient(answer).client);

        expect(outcome).toMatchObject({ status: "error", message: expect.any(String) });
        expect(outcome.status === "error" && outcome.saved?.advice.summary).toBe("A calm month.");
        expect((await getSavedAdvice(db, A, OCTOBER))?.advice.summary).toBe("A calm month.");
        expect(await remainingRequests(db, A, TODAY)).toBe(remaining);
      });
    }

    it("the rate-limit message tells the user to try again later", async () => {
      await withSavedAdvice();
      const outcome = await ask(
        A,
        fakeClient(new AdviceError("rate-limit", "The advice service is busy right now. Please try again in a little while.")).client,
      );
      expect(outcome.status === "error" && outcome.message).toMatch(/try again/);
    });
  });

  describe("daily limit", () => {
    it("allows 5 fresh requests; the sixth makes no call and keeps the saved advice", async () => {
      const wallet = await addWallet(A, "W");
      const { client, calls } = fakeClient(good);
      for (let i = 0; i < DAILY_LIMIT; i++) {
        await spend(A, wallet, "Food", 10 + i);
        expect((await ask(A, client)).status).toBe("created");
      }
      expect(calls).toHaveLength(5);
      await spend(A, wallet, "Food", 1);

      const sixth = await ask(A, client);

      expect(sixth.status).toBe("limit");
      expect(sixth.status === "limit" && sixth.saved).not.toBeNull();
      expect(calls).toHaveLength(5);
      expect(await remainingRequests(db, A, TODAY)).toBe(0);
    });

    it("reused advice does not count, even at the limit", async () => {
      const wallet = await addWallet(A, "W");
      const { client } = fakeClient(good);
      for (let i = 0; i < DAILY_LIMIT; i++) {
        await spend(A, wallet, "Food", 10 + i);
        await ask(A, client);
      }
      expect((await ask(A, client)).status).toBe("unchanged");
      expect(await remainingRequests(db, A, TODAY)).toBe(0);
    });

    it("another user is unaffected, and the next day starts fresh", async () => {
      const walletA = await addWallet(A, "W");
      const walletB = await addWallet(B, "W");
      const { client } = fakeClient(good);
      for (let i = 0; i < DAILY_LIMIT; i++) {
        await spend(A, walletA, "Food", 10 + i);
        await ask(A, client);
      }
      await spend(B, walletB, "Food", 500);

      expect((await ask(B, client)).status).toBe("created");
      expect(await remainingRequests(db, B, TODAY)).toBe(DAILY_LIMIT - 1);
      expect(await remainingRequests(db, A, "2026-10-21")).toBe(DAILY_LIMIT);
    });

    it("two requests at once cannot get past the limit", async () => {
      const results = await Promise.all(
        Array.from({ length: 9 }, () => reserveRequest(db, A, TODAY)),
      );
      expect(results.filter(Boolean)).toHaveLength(DAILY_LIMIT);
      const [row] = await db.select().from(aiUsage).where(eq(aiUsage.userId, A));
      expect(row.count).toBe(DAILY_LIMIT);
    });

    it("giving a request back never takes the count below zero", async () => {
      await releaseRequest(db, A, TODAY);
      await reserveRequest(db, A, TODAY);
      await releaseRequest(db, A, TODAY);
      await releaseRequest(db, A, TODAY);
      expect(await remainingRequests(db, A, TODAY)).toBe(DAILY_LIMIT);
    });
  });
});
