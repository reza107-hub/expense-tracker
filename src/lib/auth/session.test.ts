import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "@/db/schema";
import { createTestAuth, registerUser } from "@/test/auth-helpers";
import { createTestDb, resetTestDb, type TestDb } from "@/test/db";

// Stand-ins for the request: its headers, a redirect that throws as Next.js does, and
// the app's database and account system, which here are the in-memory ones.
const held = vi.hoisted(() => ({
  headers: new Headers(),
  db: undefined as unknown,
  auth: undefined as unknown,
}));

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("next/headers", () => ({ headers: async () => held.headers }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));
vi.mock("@/db", () => ({ getDb: () => held.db }));
vi.mock("./instance", () => ({ getAuth: () => held.auth }));

const { currentUserId, requireUser } = await import("./session");

/** A stand-in for a Server Action: it checks the user first, then changes something. */
function makeAction(change: (userId: string) => void) {
  return async function action() {
    const { userId } = await requireUser();
    change(userId);
    return "done";
  };
}

describe("requireUser and currentUserId", () => {
  let db: TestDb;
  let close: () => Promise<void>;
  let auth: ReturnType<typeof createTestAuth>;

  beforeAll(async () => {
    const test = await createTestDb();
    db = test.db;
    close = () => test.client.close();
    auth = createTestAuth(db);
    held.db = db;
    held.auth = auth;
  });
  afterAll(() => close());
  beforeEach(async () => {
    await resetTestDb(db);
    await db.delete(user);
    held.headers = new Headers();
  });

  it("returns the user id for a valid session", async () => {
    const { userId, headers } = await registerUser(auth, "a@example.com");
    held.headers = headers;
    expect(await requireUser()).toEqual({ userId });
    expect(await currentUserId()).toBe(userId);
  });

  it("redirects to sign-in when there is no cookie", async () => {
    await expect(requireUser()).rejects.toMatchObject({ url: "/sign-in" });
    expect(await currentUserId()).toBeNull();
  });

  it("redirects for made-up, signed-out and expired sessions", async () => {
    const { headers } = await registerUser(auth, "a@example.com");

    held.headers = new Headers({ cookie: "better-auth.session_token=forged" });
    await expect(requireUser()).rejects.toMatchObject({ url: "/sign-in" });

    held.headers = headers;
    await auth.api.signOut({ headers });
    await expect(requireUser()).rejects.toMatchObject({ url: "/sign-in" });
  });
});

describe("an action that calls requireUser first", () => {
  let db: TestDb;
  let close: () => Promise<void>;
  let auth: ReturnType<typeof createTestAuth>;

  beforeAll(async () => {
    const test = await createTestDb();
    db = test.db;
    close = () => test.client.close();
    auth = createTestAuth(db);
    held.db = db;
    held.auth = auth;
  });
  afterAll(() => close());
  beforeEach(async () => {
    await resetTestDb(db);
    await db.delete(user);
    held.headers = new Headers();
  });

  it("changes nothing when called without a cookie", async () => {
    const change = vi.fn();
    await expect(makeAction(change)()).rejects.toBeInstanceOf(RedirectSignal);
    expect(change).not.toHaveBeenCalled();
  });

  it("changes nothing when called with an invalid cookie", async () => {
    const change = vi.fn();
    held.headers = new Headers({ cookie: "better-auth.session_token=not-a-real-token" });
    await expect(makeAction(change)()).rejects.toBeInstanceOf(RedirectSignal);
    expect(change).not.toHaveBeenCalled();
  });

  it("changes nothing after the user has signed out", async () => {
    const change = vi.fn();
    const { headers } = await registerUser(auth, "a@example.com");
    held.headers = headers;
    await auth.api.signOut({ headers });
    await expect(makeAction(change)()).rejects.toBeInstanceOf(RedirectSignal);
    expect(change).not.toHaveBeenCalled();
  });

  it("runs with the signed-in user's id, and only theirs", async () => {
    const change = vi.fn();
    const a = await registerUser(auth, "a@example.com");
    const b = await registerUser(auth, "b@example.com");

    held.headers = a.headers;
    await expect(makeAction(change)()).resolves.toBe("done");
    held.headers = b.headers;
    await expect(makeAction(change)()).resolves.toBe("done");

    expect(change).toHaveBeenNthCalledWith(1, a.userId);
    expect(change).toHaveBeenNthCalledWith(2, b.userId);
  });
});
