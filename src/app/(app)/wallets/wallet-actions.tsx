"use client";

import { useActionState, useEffect, useState } from "react";
import { Archive, Pencil, Save, X } from "lucide-react";
import InputField from "@/components/forms/input-field";
import { archiveWalletAction, updateWalletAction } from "@/actions/wallets";
import { WALLET_NAME_MAX, type WalletActionState, type WalletFormState } from "@/lib/wallets/validation";
import { useT } from "@/i18n/client";

const idleForm: WalletFormState = { status: "idle" };
const idleAction: WalletActionState = { status: "idle" };

const buttonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";
const quietButton = `${buttonClass} text-muted-foreground hover:bg-muted hover:text-foreground`;

type Props = {
  walletId: number;
  name: string;
  /** The opening balance as typed text, for the edit box. */
  openingBalance: string;
};

/** Edit and archive controls for one active wallet. */
export default function WalletActions({ walletId, name, openingBalance }: Props) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [archiveState, archiveAction, archiving] = useActionState(
    archiveWalletAction.bind(null, walletId),
    idleAction,
  );

  return (
    <div className="flex flex-col gap-3">
      {editing ? (
        <EditForm
          walletId={walletId}
          name={name}
          openingBalance={openingBalance}
          onClose={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => setEditing(true)} className={quietButton}>
            <Pencil className="size-4" aria-hidden="true" />
            {t("common.edit")}
          </button>
          <form action={archiveAction}>
            <button type="submit" disabled={archiving} className={quietButton}>
              <Archive className="size-4" aria-hidden="true" />
              {archiving ? t("common.archiving") : t("common.archive")}
            </button>
          </form>
        </div>
      )}

      {archiveState.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {archiveState.message}
        </p>
      ) : null}
    </div>
  );
}

function EditForm({
  walletId,
  name,
  openingBalance,
  onClose,
}: Props & { onClose: () => void }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(
    updateWalletAction.bind(null, walletId),
    idleForm,
  );
  const failed = state.status === "error" ? state : null;

  useEffect(() => {
    if (state.status === "saved") onClose();
  }, [state, onClose]);

  return (
    <form action={formAction} className="panel-enter flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          id={`wallet-${walletId}-name`}
          name="name"
          label={t("common.name")}
          required
          maxLength={WALLET_NAME_MAX}
          defaultValue={failed?.values.name ?? name}
          error={failed?.fieldErrors.name}
        />
        <InputField
          id={`wallet-${walletId}-opening`}
          name="openingBalance"
          label={t("common.openingBalanceTaka")}
          inputMode="decimal"
          defaultValue={failed?.values.openingBalance ?? openingBalance}
          error={failed?.fieldErrors.openingBalance}
          hint={t("wallets.edit.balanceHint")}
        />
      </div>

      {failed?.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {failed.formError}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className={`${buttonClass} bg-primary text-primary-foreground hover:opacity-90`}
        >
          <Save className="size-4" aria-hidden="true" />
          {pending ? t("common.saving") : t("common.save")}
        </button>
        <button type="button" onClick={onClose} className={quietButton}>
          <X className="size-4" aria-hidden="true" />
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
