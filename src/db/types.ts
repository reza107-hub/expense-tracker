import type { PgDatabase } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Any Drizzle Postgres database or transaction over our schema. Data code takes this
 * type so it runs against Neon in the app and against in-memory PGlite in tests.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDb = PgDatabase<any, typeof schema>;
