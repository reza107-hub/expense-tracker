import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loginAttempts } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import {
  LOCK_WINDOW_MS,
  beginSignInAttempt,
  clearAttempts,
  computeLockedUntil,
  getLockedUntil,
} from "./lockout";

const MIN = 60 * 1000;
const T0 = new Date("2026-10-21T04:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * MIN);

describe("computeLockedUntil", () => {
  it("is not locked with no attempts or with four", () => {
    expect(computeLockedUntil([], at(0))).toBeNull();
    expect(computeLockedUntil([at(0), at(1), at(2), at(3)], at(4))).toBeNull();
  });

  it("locks on the fifth attempt within 15 minutes, for 15 minutes from that attempt", () => {
    const attempts = [at(0), at(1), at(2), at(3), at(4)];
    expect(computeLockedUntil(attempts, at(4))?.getTime()).toBe(at(19).getTime());
    expect(computeLockedUntil(attempts, at(18.9))).not.toBeNull();
  });

  it("unlocks exactly when 15 minutes have passed since the lock began", () => {
    const attempts = [at(0), at(1), at(2), at(3), at(4)];
    expect(computeLockedUntil(attempts, at(19))).toBeNull();
    expect(computeLockedUntil(attempts, at(20))).toBeNull();
  });

  it("does not lock when the fifth attempt is more than 15 minutes after the first", () => {
    expect(computeLockedUntil([at(0), at(5), at(10), at(14), at(15)], at(15))).toBeNull();
    expect(computeLockedUntil([at(0), at(1), at(2), at(3), at(16)], at(16))).toBeNull();
  });

  it("locks on the first fifth attempt that fits inside a 15 minute window", () => {
    // 0, 10, 11, 12, 13 are five attempts within 13 minutes, so the lock starts at 13.
    const attempts = [at(0), at(10), at(11), at(12), at(13), at(14)];
    expect(computeLockedUntil(attempts, at(14))?.getTime()).toBe(at(28).getTime());
  });

  it("drops an attempt that has aged out of the window before counting", () => {
    // Minute 0 is 16 minutes before minute 16, so the streak is 16, 17, 18, 19.
    const attempts = [at(0), at(16), at(17), at(18), at(19)];
    expect(computeLockedUntil(attempts, at(19))).toBeNull();
    expect(computeLockedUntil([...attempts, at(20)], at(20))?.getTime()).toBe(at(35).getTime());
  });

  it("does not reuse attempts from an earlier lock", () => {
    const attempts = [at(0), at(1), at(2), at(3), at(4), at(20)];
    expect(computeLockedUntil(attempts, at(20))).toBeNull();
  });

  it("starts a fresh lock after a full new streak", () => {
    const attempts = [at(0), at(1), at(2), at(3), at(4), at(20), at(21), at(22), at(23), at(24)];
    expect(computeLockedUntil(attempts, at(24))?.getTime()).toBe(at(39).getTime());
  });

  it("ignores the order the attempts arrive in", () => {
    const attempts = [at(4), at(0), at(3), at(1), at(2)];
    expect(computeLockedUntil(attempts, at(4))?.getTime()).toBe(at(19).getTime());
  });

  it("exposes a 15 minute window", () => {
    expect(LOCK_WINDOW_MS).toBe(15 * MIN);
  });
});

describe("per-email lock storage (in-memory PGlite)", () => {
  let db: TestDb;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const test = await createTestDb();
    db = test.db;
    close = () => test.client.close();
  });
  afterAll(() => close());
  beforeEach(() => resetTestDb(db));

  const begin = (email: string, minutes: number) => beginSignInAttempt(db, email, at(minutes));
  const count = async () => (await db.select().from(loginAttempts)).length;

  it("allows the first five attempts, then locks the sixth", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await begin("a@example.com", i)).toEqual({ status: "allowed" });
    }
    const sixth = await begin("a@example.com", 5);
    expect(sixth.status).toBe("locked");
    if (sixth.status === "locked") expect(sixth.until.getTime()).toBe(at(19).getTime());
  });

  it("does not record an attempt that is refused", async () => {
    for (let i = 0; i < 5; i++) await begin("a@example.com", i);
    await begin("a@example.com", 6);
    await begin("a@example.com", 7);
    expect(await count()).toBe(5);
  });

  it("unlocks once the lock period ends", async () => {
    for (let i = 0; i < 5; i++) await begin("a@example.com", i);
    expect((await begin("a@example.com", 18)).status).toBe("locked");
    expect((await begin("a@example.com", 19)).status).toBe("allowed");
  });

  it("keeps each email separate", async () => {
    for (let i = 0; i < 5; i++) await begin("a@example.com", i);
    expect((await begin("a@example.com", 5)).status).toBe("locked");
    expect((await begin("b@example.com", 5)).status).toBe("allowed");
    expect(await getLockedUntil(db, "b@example.com", at(5))).toBeNull();
  });

  it("clears only the given email", async () => {
    for (let i = 0; i < 3; i++) await begin("a@example.com", i);
    await begin("b@example.com", 3);
    await clearAttempts(db, "a@example.com");
    const left = await db.select().from(loginAttempts);
    expect(left.map((r) => r.email)).toEqual(["b@example.com"]);
  });

  it("removes attempts older than a day", async () => {
    await begin("a@example.com", 0);
    await begin("a@example.com", 25 * 60);
    expect(await count()).toBe(1);
  });

  it("holds the limit against a burst of parallel attempts", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => begin("a@example.com", 0)),
    );
    expect(results.filter((r) => r.status === "allowed")).toHaveLength(5);
    expect(results.filter((r) => r.status === "locked")).toHaveLength(7);
    expect(await count()).toBe(5);
  });
});
