import { z } from "zod";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, normaliseEmail } from "./auth";
import type { RegisterField } from "./types";

export type RegisterInput = { email: string; password: string };

export type RegisterValidation =
  | { ok: true; value: RegisterInput }
  | { ok: false; email: string; fieldErrors: Partial<Record<RegisterField, string>> };

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

/** Checks the registration form. Each problem is reported against its own field. */
export function validateRegistration(form: FormData): RegisterValidation {
  const email = normaliseEmail(text(form.get("email")));
  const password = text(form.get("password"));
  const confirmPassword = text(form.get("confirmPassword"));
  const fieldErrors: Partial<Record<RegisterField, string>> = {};

  if (!email) fieldErrors.email = "Enter your email address.";
  else if (!z.email().safeParse(email).success) fieldErrors.email = "Enter a valid email address.";

  if (password.length < MIN_PASSWORD_LENGTH) {
    fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    fieldErrors.password = `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  }

  if (!fieldErrors.password && password !== confirmPassword) {
    fieldErrors.confirmPassword = "The passwords do not match.";
  }

  return Object.keys(fieldErrors).length > 0
    ? { ok: false, email, fieldErrors }
    : { ok: true, value: { email, password } };
}

/** The most the sign-in form accepts, so a huge value is never hashed. */
export const MAX_SIGN_IN_FIELD_LENGTH = 320;

export type SignInInput = { email: string; password: string };

/** Returns the sign-in details, or null when either is missing or absurdly long. */
export function readSignIn(form: FormData): { input: SignInInput | null; email: string } {
  const rawEmail = text(form.get("email"));
  const email = normaliseEmail(rawEmail);
  const password = text(form.get("password"));
  const usable =
    email.length > 0 &&
    password.length > 0 &&
    email.length <= MAX_SIGN_IN_FIELD_LENGTH &&
    password.length <= MAX_PASSWORD_LENGTH;
  return { input: usable ? { email, password } : null, email: rawEmail.trim() };
}
