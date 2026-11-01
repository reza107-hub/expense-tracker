/* eslint-disable @typescript-eslint/no-explicit-any -- replies are untyped JSON read by the test */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestAuth, TEST_PASSWORD } from "@/test/auth-helpers";
import { createTestDb, type TestDb } from "@/test/db";
import { handleApi } from "./routes";

let db: TestDb;
let close: () => Promise<void>;

beforeAll(async () => {
  const created = await createTestDb();
  db = created.db;
  close = () => created.client.close();
});
afterAll(() => close());
beforeEach(async () => {
  await db.execute(sql`truncate table "user" restart identity cascade`);
});

const auth = () => createTestAuth(db);

/** Calls the API the way the phone does: JSON in, JSON out, bearer token. */
async function call(method: string, path: string, options: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const response = await handleApi(
    new Request(`http://localhost:3000/api/v1${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    { db, getAuth: auth, adviceClient: () => null },
  );
  return { status: response.status, data: (await response.json()) as any };
}

async function register(email: string) {
  const { status, data } = await call("POST", "/auth/register", {
    body: { email, password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD },
  });
  expect(status).toBe(201);
  return data.token as string;
}

describe("sign-in and tokens", () => {
  it("registers, then signs in with the same account and gets a working token", async () => {
    await register("reza@example.com");
    const signIn = await call("POST", "/auth/sign-in", {
      body: { email: "Reza@Example.com ", password: TEST_PASSWORD },
    });
    expect(signIn.status).toBe(200);
    expect(signIn.data.user.email).toBe("reza@example.com");
    const me = await call("GET", "/me", { token: signIn.data.token });
    expect(me.status).toBe(200);
    expect(me.data.user.email).toBe("reza@example.com");
  });

  it("rejects a wrong password with 401 and the same message as an unknown email", async () => {
    await register("reza@example.com");
    const wrong = await call("POST", "/auth/sign-in", {
      body: { email: "reza@example.com", password: "not the password" },
    });
    const unknown = await call("POST", "/auth/sign-in", {
      body: { email: "nobody@example.com", password: "not the password" },
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.data.error.message).toBe(unknown.data.error.message);
  });

  it("locks an email after five wrong attempts", async () => {
    await register("reza@example.com");
    for (let i = 0; i < 5; i++) {
      await call("POST", "/auth/sign-in", { body: { email: "reza@example.com", password: "bad password" } });
    }
    const locked = await call("POST", "/auth/sign-in", {
      body: { email: "reza@example.com", password: TEST_PASSWORD },
    });
    expect(locked.status).toBe(429);
    expect(locked.data.error.code).toBe("SIGN_IN_LOCKED");
    expect(locked.data.error.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("refuses a duplicate email and a short password", async () => {
    await register("reza@example.com");
    const again = await call("POST", "/auth/register", {
      body: { email: "reza@example.com", password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD },
    });
    expect(again.status).toBe(409);
    const short = await call("POST", "/auth/register", {
      body: { email: "new@example.com", password: "short", confirmPassword: "short" },
    });
    expect(short.status).toBe(400);
    expect(short.data.error.fieldErrors.password).toBeTruthy();
  });

  it("answers 401 without a token, with a bad token, and after sign-out", async () => {
    expect((await call("GET", "/wallets")).status).toBe(401);
    expect((await call("GET", "/wallets", { token: "garbage.token" })).status).toBe(401);
    const token = await register("reza@example.com");
    expect((await call("GET", "/wallets", { token })).status).toBe(200);
    await call("POST", "/auth/sign-out", { token });
    expect((await call("GET", "/wallets", { token })).status).toBe(401);
  });

  it("returns 404 for unknown addresses and 405 for the wrong method", async () => {
    const token = await register("reza@example.com");
    expect((await call("GET", "/nope", { token })).status).toBe(404);
    expect((await call("DELETE", "/wallets", { token })).status).toBe(405);
  });
});

describe("money flows through the same rules as the website", () => {
  it("creates wallets and entries, and balances come from the ledger", async () => {
    const token = await register("reza@example.com");
    expect((await call("POST", "/wallets", { token, body: { name: "Cash", openingBalance: "1000" } })).status).toBe(201);
    const dup = await call("POST", "/wallets", { token, body: { name: "cash" } });
    expect(dup.status).toBe(409);
    expect(dup.data.error.fieldErrors.name).toBeTruthy();

    const wallets = await call("GET", "/wallets", { token });
    const cash = wallets.data.active[0];
    expect(cash.balance).toBe(100000);

    const categories = await call("GET", "/categories", { token });
    const category = categories.data.active.find((c: any) => !c.isReserved);

    const expense = await call("POST", "/entries", {
      token,
      body: { type: "expense", walletId: cash.id, categoryId: category.id, amount: "250.50", entryDate: "2020-01-02", note: "Lunch" },
    });
    expect(expense.status).toBe(201);
    const income = await call("POST", "/entries", {
      token,
      body: { type: "income", walletId: cash.id, amount: "100", entryDate: "2020-01-03" },
    });
    expect(income.status).toBe(201);

    const after = await call("GET", "/wallets", { token });
    expect(after.data.active[0].balance).toBe(100000 - 25050 + 10000);
    expect(after.data.total).toBe(after.data.active[0].balance);

    const list = await call("GET", "/entries?month=2020-01", { token });
    expect(list.data.entries).toHaveLength(2);

    const dash = await call("GET", "/dashboard", { token });
    expect(dash.status).toBe(200);
  });

  it("rejects bad input with field errors and a future date", async () => {
    const token = await register("reza@example.com");
    await call("POST", "/wallets", { token, body: { name: "Cash" } });
    const bad = await call("POST", "/entries", { token, body: { type: "income", walletId: 1, amount: "-5", entryDate: "2999-01-01" } });
    expect(bad.status).toBe(400);
    expect(bad.data.error.fieldErrors.amount).toBeTruthy();
    expect(bad.data.error.fieldErrors.entryDate).toBeTruthy();
    expect((await call("POST", "/entries", { token, body: { type: "bogus" } })).status).toBe(400);
  });

  it("asks for confirmation before a wallet goes below zero, then saves when confirmed", async () => {
    const token = await register("reza@example.com");
    await call("POST", "/wallets", { token, body: { name: "Cash", openingBalance: "10" } });
    const categories = await call("GET", "/categories", { token });
    const category = categories.data.active.find((c: any) => !c.isReserved);
    const body = { type: "expense", walletId: 1, categoryId: category.id, amount: "50", entryDate: "2020-01-02" };
    const first = await call("POST", "/entries", { token, body });
    expect(first.status).toBe(409);
    expect(first.data.error.code).toBe("LOW_BALANCE");
    const second = await call("POST", "/entries", { token, body: { ...body, confirmLowBalance: true } });
    expect(second.status).toBe(201);
  });

  it("edits and deletes an entry", async () => {
    const token = await register("reza@example.com");
    await call("POST", "/wallets", { token, body: { name: "Cash", openingBalance: "100" } });
    const created = await call("POST", "/entries", { token, body: { type: "income", walletId: 1, amount: "10", entryDate: "2020-01-02" } });
    const entryId = created.data.id;
    const edit = await call("PUT", `/entries/${entryId}`, { token, body: { walletId: 1, amount: "20", entryDate: "2020-01-02" } });
    expect(edit.status).toBe(200);
    expect((await call("GET", "/wallets", { token })).data.active[0].balance).toBe(12000);
    expect((await call("DELETE", `/entries/${entryId}`, { token })).status).toBe(200);
    expect((await call("DELETE", `/entries/${entryId}`, { token })).status).toBe(404);
  });

  it("records a loan and a repayment", async () => {
    const token = await register("reza@example.com");
    await call("POST", "/wallets", { token, body: { name: "Cash", openingBalance: "0" } });
    const loan = await call("POST", "/loans", {
      token,
      body: { direction: "borrowed", counterparty: "Karim", amount: "500", walletId: 1, entryDate: "2020-01-02" },
    });
    expect(loan.status).toBe(201);
    const repay = await call("POST", `/loans/${loan.data.id}/repayments`, {
      token,
      body: { walletId: 1, principal: "200", interest: "10", entryDate: "2020-01-05" },
    });
    expect(repay.status).toBe(201);
    const over = await call("POST", `/loans/${loan.data.id}/repayments`, {
      token,
      body: { walletId: 1, principal: "9999", entryDate: "2020-01-06" },
    });
    expect(over.status).toBe(400);
    const page = await call("GET", "/loans", { token });
    expect(page.data.loans).toHaveLength(1);
    expect(page.data.totals).toBeDefined();
  });

  it("saves settings and reports", async () => {
    const token = await register("reza@example.com");
    expect((await call("PUT", "/settings/month-start-day", { token, body: { monthStartDay: 5 } })).status).toBe(200);
    expect((await call("PUT", "/settings/month-start-day", { token, body: { monthStartDay: 31 } })).status).toBe(400);
    expect((await call("PUT", "/settings/alerts", { token, body: { alertsEnabled: true } })).status).toBe(400);
    expect((await call("PUT", "/settings/alerts", { token, body: { alertsEnabled: true, monthlyLimit: "5000" } })).status).toBe(200);
    const settings = await call("GET", "/settings", { token });
    expect(settings.data.monthStartDay).toBe(5);
    expect(settings.data.alertsEnabled).toBe(true);
    expect((await call("GET", "/reports?month=2020-01", { token })).status).toBe(200);
  });

  it("handles advice with no key set", async () => {
    const token = await register("reza@example.com");
    expect((await call("GET", "/advice", { token })).data.saved).toBeNull();
    const refresh = await call("POST", "/advice/refresh", { token, body: { month: "2020-01" } });
    expect(refresh.data.status).toBe("empty");
    expect((await call("POST", "/advice/refresh", { token, body: { month: "bad" } })).status).toBe(400);
  });
});

describe("data isolation", () => {
  it("never shows or changes another user's data", async () => {
    const alice = await register("alice@example.com");
    const bob = await register("bob@example.com");
    await call("POST", "/wallets", { token: alice, body: { name: "Alice cash", openingBalance: "500" } });
    const aliceWallet = (await call("GET", "/wallets", { token: alice })).data.active[0];

    expect((await call("GET", "/wallets", { token: bob })).data.active).toHaveLength(0);
    expect((await call("PUT", `/wallets/${aliceWallet.id}`, { token: bob, body: { name: "Mine now" } })).status).toBe(404);
    expect((await call("POST", `/wallets/${aliceWallet.id}/archive`, { token: bob })).status).toBe(404);

    const bobEntry = await call("POST", "/entries", {
      token: bob,
      body: { type: "income", walletId: aliceWallet.id, amount: "10", entryDate: "2020-01-02" },
    });
    expect(bobEntry.status).toBe(400);

    const stillAlice = (await call("GET", "/wallets", { token: alice })).data.active[0];
    expect(stillAlice.name).toBe("Alice cash");
    expect(stillAlice.balance).toBe(50000);
  });
});
