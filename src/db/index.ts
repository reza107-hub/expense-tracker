import { createDb, type Db } from "./client";

let cached: Db | undefined;

/** The app's database, created on first use from `DATABASE_URL` (pooled). */
export function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    cached = createDb(url).db;
  }
  return cached;
}
