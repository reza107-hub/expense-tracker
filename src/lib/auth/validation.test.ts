import { describe, expect, it } from "vitest";
import { MAX_SIGN_IN_FIELD_LENGTH, readSignIn, validateRegistration } from "./validation";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const register = (overrides: Record<string, string> = {}) =>
  validateRegistration(
    form({
      email: "Friend@Example.com",
      password: "correct horse",
      confirmPassword: "correct horse",
      ...overrides,
    }),
  );

describe("validateRegistration", () => {
  it("accepts a good form and normalises the email", () => {
    expect(register()).toEqual({
      ok: true,
      value: { email: "friend@example.com", password: "correct horse" },
    });
    expect(register({ email: "  A@B.co  " })).toMatchObject({
      ok: true,
      value: { email: "a@b.co" },
    });
  });

  it("asks for an email, and rejects malformed ones, against the email field", () => {
    for (const email of ["", "   ", "not-an-email", "a@", "@b.com", "a b@c.com", "a@b"]) {
      const result = register({ email });
      expect(result.ok, email).toBe(false);
      if (!result.ok) expect(result.fieldErrors.email, email).toBeTruthy();
    }
  });

  it("rejects a password shorter than 8 or longer than 128 characters", () => {
    for (const password of ["", "1234567"]) {
      const result = register({ password, confirmPassword: password });
      expect(result.ok, password).toBe(false);
      if (!result.ok) expect(result.fieldErrors.password).toMatch(/at least 8/);
    }
    const tooLong = "x".repeat(129);
    const result = register({ password: tooLong, confirmPassword: tooLong });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.password).toMatch(/at most 128/);

    expect(register({ password: "12345678", confirmPassword: "12345678" }).ok).toBe(true);
    const longest = "x".repeat(128);
    expect(register({ password: longest, confirmPassword: longest }).ok).toBe(true);
  });

  it("rejects passwords that do not match, against the confirm field", () => {
    const result = register({ confirmPassword: "something else" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.confirmPassword).toMatch(/do not match/);
      expect(result.fieldErrors.password).toBeUndefined();
    }
  });

  it("does not count a mismatch when the password itself is already wrong", () => {
    const result = register({ password: "short", confirmPassword: "different" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.password).toBeTruthy();
      expect(result.fieldErrors.confirmPassword).toBeUndefined();
    }
  });

  it("reports every problem at once", () => {
    const result = register({ email: "nope", password: "short" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors).sort()).toEqual(["email", "password"]);
  });

  it("keeps spaces inside a password and treats missing fields as empty", () => {
    const result = register({ password: "  spaces count  ", confirmPassword: "  spaces count  " });
    expect(result).toMatchObject({ ok: true, value: { password: "  spaces count  " } });
    expect(validateRegistration(new FormData()).ok).toBe(false);
  });

  it("returns the typed email so it can stay in the box", () => {
    const result = register({ email: " Typed@Example.COM ", password: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.email).toBe("typed@example.com");
  });
});

describe("readSignIn", () => {
  it("returns normalised details", () => {
    expect(readSignIn(form({ email: " A@B.co ", password: "pw" })).input).toEqual({
      email: "a@b.co",
      password: "pw",
    });
  });

  it("returns null for missing, empty or oversized fields", () => {
    expect(readSignIn(new FormData()).input).toBeNull();
    expect(readSignIn(form({ email: "a@b.co", password: "" })).input).toBeNull();
    expect(readSignIn(form({ email: "  ", password: "pw" })).input).toBeNull();
    expect(readSignIn(form({ email: "a@b.co", password: "x".repeat(129) })).input).toBeNull();
    expect(
      readSignIn(form({ email: "a".repeat(MAX_SIGN_IN_FIELD_LENGTH + 1), password: "pw" })).input,
    ).toBeNull();
  });

  it("echoes the email as typed, trimmed, for redisplay", () => {
    expect(readSignIn(form({ email: "  Typed@Example.COM ", password: "" })).email).toBe(
      "Typed@Example.COM",
    );
  });
});
