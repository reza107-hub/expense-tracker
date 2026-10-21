import { APIError } from "better-auth/api";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loginAttempts, user } from "@/db/schema";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";
import { SIGN_IN_LOCKED, createAuth } from "./auth";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const PASSWORD = "correct horse battery";
const MIN = 60 * 1000;
const T0 = new Date("2026-10-21T04:00:00Z");

describe("sign-in lock through Better Auth (in-memory PGlite)", () => {
  let db: TestDb;
  let close: () => Promise<void>;
  let auth: ReturnType<typeof createAuth>;
  let clock = T0;
  const advance = (minutes: number) => {
    clock = new Date(T0.getTime() + minutes * MIN);
  };

  beforeAll(async () => {
    const test = await createTestDb();
    db = test.db;
    close = () => test.client.close();
    auth = createAuth({
      db,
      secret: SECRET,
      baseURL: "http://localhost:3000",
      withNextCookies: false,
      now: () => clock,
    });
  });
  afterAll(() => close());
  beforeEach(async () => {
    await resetTestDb(db);
    await db.delete(user);
    advance(0);
    await auth.api.signUpEmail({ body: { name: "A", email: "a@example.com", password: PASSWORD } });
    await auth.api.signUpEmail({ body: { name: "B", email: "b@example.com", password: PASSWORD } });
  });

  const signIn = (email: string, password: string) =>
    auth.api.signInEmail({ body: { email, password } });

  /** Resolves to "ok", "wrong" or "locked" so tests read clearly. */
  async function outcome(email: string, password: string) {
    try {
      await signIn(email, password);
      return "ok";
    } catch (error) {
      if (error instanceof APIError && (error.body as { code?: string })?.code === SIGN_IN_LOCKED) {
        return "locked";
      }
      return "wrong";
    }
  }

  async function failFiveTimes(email: string) {
    for (let i = 0; i < 5; i++) {
      advance(i);
      expect(await outcome(email, `wrong-${i}`)).toBe("wrong");
    }
  }

  it("signs in normally and leaves no attempts behind", async () => {
    expect(await outcome("a@example.com", PASSWORD)).toBe("ok");
    expect(await db.select().from(loginAttempts)).toHaveLength(0);
  });

  it("refuses even the correct password after 5 wrong ones", async () => {
    await failFiveTimes("a@example.com");
    advance(6);
    expect(await outcome("a@example.com", PASSWORD)).toBe("locked");
  });

  it("tells the user how long to wait", async () => {
    await failFiveTimes("a@example.com");
    advance(10); // lock began at minute 4 and ends at minute 19
    const error = await signIn("a@example.com", PASSWORD).catch((e) => e);
    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).body).toMatchObject({
      code: SIGN_IN_LOCKED,
      retryAfterSeconds: 9 * 60,
    });
  });

  it("accepts the correct password again after 15 minutes", async () => {
    await failFiveTimes("a@example.com");
    advance(18);
    expect(await outcome("a@example.com", PASSWORD)).toBe("locked");
    advance(19);
    expect(await outcome("a@example.com", PASSWORD)).toBe("ok");
  });

  it("does not affect any other email", async () => {
    await failFiveTimes("a@example.com");
    advance(6);
    expect(await outcome("a@example.com", PASSWORD)).toBe("locked");
    expect(await outcome("b@example.com", PASSWORD)).toBe("ok");
  });

  it("locks an email that has no account in exactly the same way", async () => {
    for (let i = 0; i < 5; i++) {
      advance(i);
      expect(await outcome("ghost@example.com", `guess-${i}`)).toBe("wrong");
    }
    advance(6);
    expect(await outcome("ghost@example.com", PASSWORD)).toBe("locked");
  });

  it("treats the same address in another letter case as the same email", async () => {
    for (let i = 0; i < 5; i++) {
      advance(i);
      await outcome(i % 2 ? "A@Example.com" : "a@example.com", `wrong-${i}`);
    }
    advance(6);
    expect(await outcome("a@EXAMPLE.com", PASSWORD)).toBe("locked");
  });

  it("clears the count after a successful sign-in", async () => {
    for (let i = 0; i < 4; i++) {
      advance(i);
      await outcome("a@example.com", `wrong-${i}`);
    }
    advance(5);
    expect(await outcome("a@example.com", PASSWORD)).toBe("ok");
    expect(await db.select().from(loginAttempts)).toHaveLength(0);

    // Four more wrong attempts do not lock, because the earlier four were cleared.
    for (let i = 0; i < 4; i++) {
      advance(6 + i);
      expect(await outcome("a@example.com", `again-${i}`)).toBe("wrong");
    }
    advance(11);
    expect(await outcome("a@example.com", PASSWORD)).toBe("ok");
  });

  it("does not lock when wrong attempts are spread over more than 15 minutes", async () => {
    for (const m of [0, 5, 10, 16, 20, 26]) {
      advance(m);
      expect(await outcome("a@example.com", "wrong")).toBe("wrong");
    }
    advance(27);
    expect(await outcome("a@example.com", PASSWORD)).toBe("ok");
  });

  it("holds the limit against 12 parallel guesses", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => outcome("a@example.com", `guess-${i}`)),
    );
    expect(results.filter((r) => r === "wrong")).toHaveLength(5);
    expect(results.filter((r) => r === "locked")).toHaveLength(7);
    expect(await outcome("a@example.com", PASSWORD)).toBe("locked");
  });

  it("does not lock registration", async () => {
    for (let i = 0; i < 8; i++) {
      await expect(
        auth.api.signUpEmail({ body: { name: "A", email: "a@example.com", password: PASSWORD } }),
      ).rejects.toThrow();
    }
    expect(await outcome("a@example.com", PASSWORD)).toBe("ok");
  });
});
