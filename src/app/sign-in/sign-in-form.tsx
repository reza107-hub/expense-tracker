"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import TextField from "@/components/auth/text-field";
import { signIn } from "@/lib/auth/actions";
import { minutesFor } from "@/lib/auth/lock-message";
import type { SignInState } from "@/lib/auth/types";

const initialState: SignInState = { status: "idle" };

function messageFor(state: SignInState): string | null {
  switch (state.status) {
    case "invalid":
      return "Incorrect email or password.";
    case "locked": {
      const minutes = minutesFor(state.retryAfterSeconds);
      return `Too many attempts for this email. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
    }
    case "error":
      return state.message;
    default:
      return null;
  }
}

export default function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const message = messageFor(state);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <TextField
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        autoFocus
        maxLength={320}
        defaultValue={state.status === "idle" ? undefined : state.email}
      />
      <TextField
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        maxLength={128}
      />

      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        <LockKeyhole className="size-4" aria-hidden="true" />
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
