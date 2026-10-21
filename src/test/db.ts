import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

/**
 * A brand-new in-memory Postgres (PGlite) with every migration applied. It lives
 * only inside the test process and is gone when the process ends. It has no network
 * connection and shares nothing with Neon, so tests can never touch real data.
 */
export async function createTestDb() {
  const client = new PGlite("memory://");
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, client };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>["db"];

/** Empties every app table and restarts id counters. Call from `beforeEach`. */
export async function resetTestDb(db: TestDb) {
  await db.execute(sql`
    truncate table
      entries, loans, categories, wallets, settings, ai_advice, login_attempts
    restart identity cascade
  `);
}
