"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { EMAIL_NOT_ALLOWED, SIGN_IN_LOCKED } from "./auth";
import { AuthConfigError } from "./env";
import { getAuth } from "./instance";
import { SIGN_IN_PATH } from "./session";
import type { RegisterState, SignInState } from "./types";
import { readSignIn, validateRegistration } from "./validation";

const errorCode = (error: unknown): string | undefined =>
  error instanceof APIError ? (error.body as { code?: string } | undefined)?.code : undefined;

/** Public by design: this is how an account is created. */
export async function register(
  _previous: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const checked = validateRegistration(formData);
  if (!checked.ok) {
    return { status: "error", email: checked.email, fieldErrors: checked.fieldErrors };
  }
  const { email, password } = checked.value;

  try {
    await getAuth().api.signUpEmail({
      body: { name: email.split("@")[0], email, password },
      headers: await headers(),
    });
  } catch (error) {
    const code = errorCode(error);
    if (code === EMAIL_NOT_ALLOWED) {
      return {
        status: "error",
        email,
        fieldErrors: { email: "This email is not allowed to register." },
      };
    }
    if (code?.startsWith("USER_ALREADY_EXISTS")) {
      return {
        status: "error",
        email,
        fieldErrors: { email: "This email is already registered. Sign in instead." },
      };
    }
    if (error instanceof AuthConfigError) {
      console.error(`Accounts are not configured: ${error.message}`);
      return { status: "error", email, fieldErrors: {}, formError: "Sign-up is not set up yet." };
    }
    console.error("Registration failed", error);
    return {
      status: "error",
      email,
      fieldErrors: {},
      formError: "Could not create the account. Try again.",
    };
  }

  redirect("/");
}

/** Public by design: this is how a session starts. */
export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const { input, email: typed } = readSignIn(formData);
  if (!input) return { status: "invalid", email: typed };

  try {
    await getAuth().api.signInEmail({ body: input, headers: await headers() });
  } catch (error) {
    if (errorCode(error) === SIGN_IN_LOCKED) {
      const { retryAfterSeconds } = (error as APIError).body as { retryAfterSeconds: number };
      return { status: "locked", email: typed, retryAfterSeconds };
    }
    if (error instanceof APIError) return { status: "invalid", email: typed };
    if (error instanceof AuthConfigError) {
      console.error(`Accounts are not configured: ${error.message}`);
      return { status: "error", email: typed, message: "Sign-in is not set up yet." };
    }
    console.error("Sign-in failed", error);
    return { status: "error", email: typed, message: "Something went wrong. Try again." };
  }

  redirect("/");
}

/** Ends the session on this browser. Safe to call when already signed out. */
export async function signOut(): Promise<void> {
  try {
    await getAuth().api.signOut({ headers: await headers() });
  } catch {
    // Already signed out, or the session no longer exists. Either way, go to sign-in.
  }
  redirect(SIGN_IN_PATH);
}
