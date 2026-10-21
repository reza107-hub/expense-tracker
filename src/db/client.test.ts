import { describe, expect, it } from "vitest";
import { createDb, isLocalDatabase } from "./client";

describe("isLocalDatabase", () => {
  it("recognises a database on this machine", () => {
    for (const url of [
      "postgresql://u:p@localhost:5432/db",
      "postgres://u:p@127.0.0.1:5499/postgres",
      "postgresql://u:p@[::1]:5432/db",
    ]) {
      expect(isLocalDatabase(url), url).toBe(true);
    }
  });

  it("treats Neon and any other remote host as remote", () => {
    for (const url of [
      "postgresql://u:p@ep-round-leaf-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb",
      "postgresql://u:p@db.example.com/db",
      "postgresql://u:p@localhost.evil.com/db",
      "postgresql://u:p@127.0.0.1.evil.com/db",
    ]) {
      expect(isLocalDatabase(url), url).toBe(false);
    }
  });

  it("treats anything unreadable as remote", () => {
    expect(isLocalDatabase("")).toBe(false);
    expect(isLocalDatabase("not a url")).toBe(false);
  });
});

describe("createDb under Vitest", () => {
  it("refuses to connect, even to a local database", () => {
    expect(() => createDb("postgresql://u:p@127.0.0.1:5499/db")).toThrow(/blocked under Vitest/);
    expect(() => createDb("postgresql://u:p@db.example.com/db")).toThrow(/blocked under Vitest/);
  });
});
