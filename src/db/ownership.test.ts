import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import {
  aiAdvice,
  aiUsage,
  categories,
  entries,
  loans,
  settings,
  user,
  wallets,
} from "./schema";

const MIGRATIONS = fileURLToPath(new URL("../../drizzle", import.meta.url));

function migrationStatements(file: string) {
  return readFileSync(join(MIGRATIONS, file), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
}
const sqlFiles = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
const [first, second, ownership] = sqlFiles;

async function apply(client: PGlite, file: string) {
  for (const statement of migrationStatements(file)) await client.exec(statement);
}

describe("ownership migration on a database shaped like the live one", () => {
  it("is the third migration", () => {
    expect(sqlFiles).toHaveLength(3);
    expect(ownership).toMatch(/^0002_/);
  });

  it("upgrades a database that holds only the old seed rows", async () => {
    const client = new PGlite("memory://");
    await apply(client, first);
    await apply(client, second);
    await client.exec(`
      insert into categories (name) values ('Food'), ('Loan interest and fees');
      insert into settings (id, month_start_day) values (1, 1);
    `);

    await apply(client, ownership);

    const rows = async (table: string) =>
      (await client.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n;
    expect(await rows("categories")).toBe(0);
    expect(await rows("settings")).toBe(0);

    // The new shape is in place.
    const columns = await client.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'settings' order by 1`,
    );
    expect(columns.rows.map((r) => r.column_name)).toEqual([
      "alerts_enabled",
      "month_start_day",
      "monthly_limit",
      "updated_at",
      "user_id",
    ]);
    await client.close();
  });

  it("refuses to run, and changes nothing, when rows without an owner exist", async () => {
    const client = new PGlite("memory://");
    await apply(client, first);
    await apply(client, second);
    await client.exec(`insert into wallets (name) values ('Cash')`);

    await expect(apply(client, ownership)).rejects.toThrow(/Refusing to add owners/);

    const wallets = await client.query<{ n: number }>(`select count(*)::int as n from wallets`);
    expect(wallets.rows[0].n).toBe(1);
    const cols = await client.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'wallets'`,
    );
    expect(cols.rows.map((r) => r.column_name)).not.toContain("user_id");
    await client.close();
  });
});

describe("data ownership rules (in-memory PGlite)", () => {
  let db: TestDb;
  let close: () => Promise<void>;
  let walletA: number;
  let walletA2: number;
  let walletB: number;
  let categoryA: number;
  let categoryB: number;
  let loanA: number;

  beforeAll(async () => {
    const test = await createTestDb();
    db = test.db;
    close = () => test.client.close();
  });
  afterAll(() => close());

  beforeEach(async () => {
    await resetTestDb(db);
    await db.delete(user);
    await db.insert(user).values([
      { id: "user-a", name: "A", email: "a@example.com" },
      { id: "user-b", name: "B", email: "b@example.com" },
    ]);
    [{ id: walletA }, { id: walletA2 }] = await db
      .insert(wallets)
      .values([
        { userId: "user-a", name: "bKash" },
        { userId: "user-a", name: "Bank" },
      ])
      .returning({ id: wallets.id });
    [{ id: walletB }] = await db
      .insert(wallets)
      .values({ userId: "user-b", name: "bKash" })
      .returning({ id: wallets.id });
    [{ id: categoryA }] = await db
      .insert(categories)
      .values({ userId: "user-a", name: "Food" })
      .returning({ id: categories.id });
    [{ id: categoryB }] = await db
      .insert(categories)
      .values({ userId: "user-b", name: "Food" })
      .returning({ id: categories.id });
    [{ id: loanA }] = await db
      .insert(loans)
      .values({ userId: "user-a", direction: "borrowed", counterparty: "Rahim", principal: 100000 })
      .returning({ id: loans.id });
  });

  const expense = (userId: string, walletId: number, categoryId: number) =>
    db.insert(entries).values({
      userId,
      type: "expense",
      walletId,
      categoryId,
      amount: 45000,
      entryDate: "2026-10-21",
    });

  it("lets two users use the same wallet and category names", async () => {
    expect(await db.select().from(wallets).where(eq(wallets.name, "bKash"))).toHaveLength(2);
    expect(await db.select().from(categories).where(eq(categories.name, "Food"))).toHaveLength(2);
  });

  it("still rejects a duplicate name inside one account, ignoring case", async () => {
    await expect(
      db.insert(wallets).values({ userId: "user-a", name: "BKASH" }),
    ).rejects.toThrow();
    await expect(
      db.insert(categories).values({ userId: "user-a", name: "food" }),
    ).rejects.toThrow();
  });

  it("accepts an entry that uses the user's own wallet and category", async () => {
    await expect(expense("user-a", walletA, categoryA)).resolves.toBeTruthy();
  });

  it("rejects an entry that uses another user's wallet", async () => {
    await expect(expense("user-b", walletA, categoryB)).rejects.toThrow();
    expect(await db.select().from(entries)).toHaveLength(0);
  });

  it("rejects an entry that uses another user's category", async () => {
    await expect(expense("user-a", walletA, categoryB)).rejects.toThrow();
  });

  it("rejects a transfer into another user's wallet", async () => {
    await expect(
      db.insert(entries).values({
        userId: "user-a",
        type: "transfer",
        walletId: walletA,
        toWalletId: walletB,
        amount: 1000,
        entryDate: "2026-10-21",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(entries).values({
        userId: "user-a",
        type: "transfer",
        walletId: walletA,
        toWalletId: walletA2,
        amount: 1000,
        entryDate: "2026-10-21",
      }),
    ).resolves.toBeTruthy();
  });

  it("rejects an entry that attaches to another user's loan", async () => {
    await expect(
      db.insert(entries).values({
        userId: "user-b",
        type: "loan_principal",
        walletId: walletB,
        loanId: loanA,
        amount: 1000,
        entryDate: "2026-10-21",
      }),
    ).rejects.toThrow();
  });

  it("removes a loan's entries when the loan is deleted, and only that loan's", async () => {
    await db.insert(entries).values({
      userId: "user-a",
      type: "loan_principal",
      walletId: walletA,
      loanId: loanA,
      amount: 100000,
      entryDate: "2026-10-03",
    });
    await expense("user-a", walletA, categoryA);
    await db.delete(loans).where(eq(loans.id, loanA));
    const left = await db.select().from(entries);
    expect(left).toHaveLength(1);
    expect(left[0].type).toBe("expense");
  });

  it("keeps a wallet that still has entries", async () => {
    await expense("user-a", walletA, categoryA);
    await expect(db.delete(wallets).where(eq(wallets.id, walletA))).rejects.toThrow();
  });

  it("allows one settings row per user and no more", async () => {
    await db.insert(settings).values({ userId: "user-a" });
    await db.insert(settings).values({ userId: "user-b", monthStartDay: 25 });
    await expect(db.insert(settings).values({ userId: "user-a" })).rejects.toThrow();
    const rows = await db.select().from(settings);
    expect(rows.find((r) => r.userId === "user-b")?.monthStartDay).toBe(25);
    expect(rows.find((r) => r.userId === "user-a")?.monthStartDay).toBe(1);
  });

  it("keeps advice and daily usage separate per user", async () => {
    const advice = (userId: string, hash: string) =>
      db.insert(aiAdvice).values({
        userId,
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        inputHash: hash,
        payload: {},
      });
    await advice("user-a", "h1");
    await advice("user-b", "h2");
    await expect(advice("user-a", "h3")).rejects.toThrow();

    await db.insert(aiUsage).values({ userId: "user-a", day: "2026-10-21", count: 3 });
    await db.insert(aiUsage).values({ userId: "user-b", day: "2026-10-21", count: 1 });
    await expect(
      db.insert(aiUsage).values({ userId: "user-a", day: "2026-10-21", count: 1 }),
    ).rejects.toThrow();
  });

  it("removes a user's data, and only theirs, when the user is deleted", async () => {
    await expense("user-a", walletA, categoryA);
    await expense("user-b", walletB, categoryB);
    await db.insert(settings).values([{ userId: "user-a" }, { userId: "user-b" }]);

    await db.delete(user).where(eq(user.id, "user-a"));

    expect(await db.select().from(wallets)).toHaveLength(1);
    expect(await db.select().from(categories)).toHaveLength(1);
    expect(await db.select().from(entries)).toHaveLength(1);
    expect(await db.select().from(loans)).toHaveLength(0);
    expect(await db.select().from(settings)).toHaveLength(1);
  });

  it("rejects data with no owner or an unknown owner", async () => {
    await expect(
      db.execute(sql`insert into wallets (name) values ('Orphan')`),
    ).rejects.toThrow();
    await expect(
      db.insert(wallets).values({ userId: "nobody", name: "Ghost" }),
    ).rejects.toThrow();
  });
});
