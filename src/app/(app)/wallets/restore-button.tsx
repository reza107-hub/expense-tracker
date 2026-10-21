"use client";

import { useActionState } from "react";
import { ArchiveRestore } from "lucide-react";
import { restoreWalletAction } from "@/actions/wallets";
import type { WalletActionState } from "@/lib/wallets/validation";

const idle: WalletActionState = { status: "idle" };

export default function RestoreButton({ walletId }: { walletId: number }) {
  const [state, formAction, pending] = useActionState(
    restoreWalletAction.bind(null, walletId),
    idle,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        <ArchiveRestore className="size-4" aria-hidden="true" />
        {pending ? "Restoring" : "Restore"}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
