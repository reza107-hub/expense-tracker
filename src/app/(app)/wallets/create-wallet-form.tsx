"use client";

import { useActionState, useRef } from "react";
import { Plus } from "lucide-react";
import InputField from "@/components/forms/input-field";
import { createWalletAction } from "@/actions/wallets";
import { WALLET_NAME_MAX, WALLET_PRESETS, type WalletFormState } from "@/lib/wallets/validation";

const initialState: WalletFormState = { status: "idle" };

export default function CreateWalletForm() {
  const [state, formAction, pending] = useActionState(createWalletAction, initialState);
  const nameRef = useRef<HTMLInputElement>(null);
  const failed = state.status === "error" ? state : null;

  function pickPreset(preset: string) {
    if (!nameRef.current) return;
    nameRef.current.value = preset;
    nameRef.current.focus();
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <h2 className="text-base font-semibold tracking-tight">Add a wallet</h2>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium" id="preset-label">
          Quick pick
        </span>
        <div role="group" aria-labelledby="preset-label" className="flex flex-wrap gap-2">
          {WALLET_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => pickPreset(preset)}
              className="h-8 rounded-md border border-border bg-muted px-3 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          ref={nameRef}
          id="wallet-name"
          name="name"
          label="Name"
          required
          maxLength={WALLET_NAME_MAX}
          defaultValue={failed?.values.name}
          error={failed?.fieldErrors.name}
          hint="Pick one above or type your own."
        />
        <InputField
          id="wallet-opening-balance"
          name="openingBalance"
          label="Opening balance (taka)"
          inputMode="decimal"
          placeholder="0"
          defaultValue={failed?.values.openingBalance}
          error={failed?.fieldErrors.openingBalance}
          hint="How much is in it now. Leave empty for zero."
        />
      </div>

      {failed?.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {failed.formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        <Plus className="size-4" aria-hidden="true" />
        {pending ? "Adding" : "Add wallet"}
      </button>
    </form>
  );
}
