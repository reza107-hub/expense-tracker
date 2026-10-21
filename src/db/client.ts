import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import * as schema from "./schema";
import type { AnyDb } from "./types";

export type Db = AnyDb;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** True for a database on this machine, for example during local development. */
export function isLocalDatabase(connectionString: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(connectionString).hostname);
  } catch {
    return false;
  }
}

/**
 * Opens the database. Neon is reached over a WebSocket pool (not the HTTP driver)
 * because loan repayments and loan deletes need real transactions (see design.md,
 * decision 4). A database on this machine uses the standard Postgres driver, so the
 * app can run locally without touching the live data.
 *
 * Tests must never reach a real database. Vitest sets `VITEST`, and this refuses to
 * connect while it is set. Tests use `createTestDb` (in-memory PGlite) instead.
 */
export function createDb(connectionString: string): {
  db: Db;
  pool: { end(): Promise<void> };
} {
  if (process.env.VITEST) {
    throw new Error(
      "createDb is blocked under Vitest. Use createTestDb from src/test/db.ts.",
    );
  }
  if (isLocalDatabase(connectionString)) {
    const pool = new PgPool({ connectionString });
    return { db: drizzlePg(pool, { schema }), pool };
  }
  const pool = new NeonPool({ connectionString });
  return { db: drizzleNeon(pool, { schema }), pool };
}
