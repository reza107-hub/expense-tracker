import { user } from "@/db/schema";
import { seedUserDefaults } from "@/db/seed";
import type { TestDb } from "./db";

/**
 * Inserts a user row (no password, no session) and gives it the default categories
 * and settings. For data-layer tests that pass a user id straight to the code under
 * test. Use `registerUser` instead when a real session is needed.
 */
export async function insertUser(db: TestDb, id: string) {
  await db.insert(user).values({ id, name: id, email: `${id}@example.com` });
  await seedUserDefaults(db, id);
  return id;
}
