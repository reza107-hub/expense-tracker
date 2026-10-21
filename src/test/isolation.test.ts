import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { getDb } from "@/db/index";
import { createTestDb, resetTestDb, type TestDb } from "./db";
import { PRODUCTION_ENV } from "./production-env";

describe("test isolation", () => {
  let db: TestDb;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const test = await createTestDb();
    db = test.db;
    close = () => test.client.close();
  });
  afterAll(() => close());

  it("has no production credentials in the environment", () => {
    const leaked = Object.keys(process.env).filter((key) =>
      PRODUCTION_ENV.test(key),
    );
    expect(leaked).toEqual([]);
  });

  it("refuses to open a connection to a real database", () => {
    expect(() => createDb("postgresql://user:pass@example.neon.tech/db")).toThrow(
      /blocked under Vitest/,
    );
  });

  it("cannot build the app database even if a URL is supplied", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@example.neon.tech/db";
    try {
      expect(() => getDb()).toThrow(/blocked under Vitest/);
    } finally {
      delete process.env.DATABASE_URL;
    }
  });

  it("blocks real network calls", () => {
    expect(() => fetch("https://example.com")).toThrow(/Network access is blocked/);
  });

  it("gives each test database the full schema, empty", async () => {
    const tables = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual([
      "account",
      "ai_advice",
      "ai_usage",
      "categories",
      "entries",
      "loans",
      "login_attempts",
      "session",
      "settings",
      "user",
      "verification",
      "wallets",
    ]);
    const count = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from wallets`,
    );
    expect(count.rows[0].n).toBe(0);
  });

  it("keeps data inside one in-memory database", async () => {
    await db.execute(
      sql`insert into "user" (id, name, email) values ('probe', 'Probe', 'probe@example.com')`,
    );
    await db.execute(
      sql`insert into wallets (user_id, name) values ('probe', 'Isolation probe')`,
    );
    const other = await createTestDb();
    try {
      const rows = await other.db.execute<{ n: number }>(
        sql`select count(*)::int as n from wallets`,
      );
      expect(rows.rows[0].n).toBe(0);
    } finally {
      await other.client.close();
    }
    await resetTestDb(db);
    await db.execute(sql`delete from "user"`);
    const after = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from wallets`,
    );
    expect(after.rows[0].n).toBe(0);
  });

  it("never reads .env files or Neon packages from test helpers", () => {
    const code = readFileSync(
      fileURLToPath(new URL("./db.ts", import.meta.url)),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/dotenv|\.env|neon|process\.env/i);
  });
});
