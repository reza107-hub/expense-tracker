"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import TextField from "@/components/auth/text-field";
import { register } from "@/lib/auth/actions";
import type { RegisterState } from "@/lib/auth/types";

const initialState: RegisterState = { status: "idle" };

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, initialState);
  const errors = state.status === "error" ? state.fieldErrors : {};

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
        defaultValue={state.status === "error" ? state.email : undefined}
        error={errors.email}
      />
      <TextField
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        hint="At least 8 characters."
        error={errors.password}
      />
      <TextField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        error={errors.confirmPassword}
      />

      {state.status === "error" && state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        <UserPlus className="size-4" aria-hidden="true" />
        {pending ? "Creating account" : "Create account"}
      </button>
    </form>
  );
}
