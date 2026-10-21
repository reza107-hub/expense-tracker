import { describe, expect, it } from "vitest";
import { AuthConfigError, getAuthEnv } from "./env";

const secret = "x".repeat(32);

describe("getAuthEnv", () => {
  it("reads the secret, address and allow-list", () => {
    expect(
      getAuthEnv({
        AUTH_SECRET: secret,
        BETTER_AUTH_URL: "https://expenses.example.com",
        ALLOWED_EMAILS: "A@x.com, b@x.com",
      }),
    ).toEqual({
      secret,
      baseURL: "https://expenses.example.com",
      allowedEmails: ["a@x.com", "b@x.com"],
    });
  });

  it("allows anyone to register when no allow-list is set", () => {
    expect(getAuthEnv({ AUTH_SECRET: secret }).allowedEmails).toBeNull();
    expect(getAuthEnv({ AUTH_SECRET: secret, ALLOWED_EMAILS: " " }).allowedEmails).toBeNull();
  });

  it("falls back to the Vercel address, then to localhost", () => {
    expect(getAuthEnv({ AUTH_SECRET: secret, VERCEL_URL: "my-app-abc.vercel.app" }).baseURL).toBe(
      "https://my-app-abc.vercel.app",
    );
    expect(getAuthEnv({ AUTH_SECRET: secret }).baseURL).toBe("http://localhost:3000");
  });

  it("prefers the fixed address over the Vercel one", () => {
    expect(
      getAuthEnv({
        AUTH_SECRET: secret,
        BETTER_AUTH_URL: "https://expenses.example.com",
        VERCEL_URL: "my-app-abc.vercel.app",
      }).baseURL,
    ).toBe("https://expenses.example.com");
  });

  it("throws when the secret is missing or too short", () => {
    expect(() => getAuthEnv({})).toThrow(AuthConfigError);
    expect(() => getAuthEnv({ AUTH_SECRET: "" })).toThrow(AuthConfigError);
    expect(() => getAuthEnv({ AUTH_SECRET: "x".repeat(31) })).toThrow(AuthConfigError);
  });
});
