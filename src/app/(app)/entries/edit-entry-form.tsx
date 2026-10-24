"use client";

import { useActionState, useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import { updateEntryAction } from "@/actions/entries-modify";
import InputField from "@/components/forms/input-field";
import SelectField from "@/components/forms/select-field";
import { formatTaka } from "@/lib/money";
import type { ListedEntry } from "@/lib/entries/list";
import { NOTE_MAX, type EntryFormState } from "@/lib/entries/validation";
import LowBalanceWarning from "./low-balance-warning";
import { useT } from "@/i18n/client";

export type WalletChoice = { id: number; name: string; archived: boolean };
export type CategoryChoice = { id: number; name: string; archived: boolean; reserved: boolean };

type Props = {
  entry: ListedEntry;
  wallets: WalletChoice[];
  categories: CategoryChoice[];
  onClose: () => void;
};

const idle: EntryFormState = { status: "idle" };

/** Edits one plain entry in place. The entry's type cannot be changed. */
export default function EditEntryForm({ entry, wallets, categories, onClose }: Props) {
  const t = useT();
  const [state, formAction, pending] = useActionState(updateEntryAction.bind(null, entry.id), idle);
  const [dismissed, setDismissed] = useState<EntryFormState | null>(null);
  const failed = state.status === "error" ? state : null;
  const warning = state.status === "low-balance" && dismissed !== state ? state : null;
  const values = state.status === "error" || state.status === "low-balance" ? state.values : undefined;
  const errors = failed?.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "saved") onClose();
  }, [state, onClose]);

  // New entries may only use active wallets and categories, but an entry keeps the ones
  // it already has, even if they were archived later.
  const usable = (w: WalletChoice) => !w.archived || w.id === entry.walletId || w.id === entry.toWalletId;
  const walletOptions = wallets.filter(usable).map((w) => ({
    value: w.id,
    label: w.archived ? t("entries.archivedSuffix", { name: w.name }) : w.name,
  }));
  const categoryOptions = categories
    .filter((c) => (!c.reserved && !c.archived) || c.id === entry.categoryId)
    .map((c) => ({ value: c.id, label: c.archived ? t("entries.archivedSuffix", { name: c.name }) : c.name }));

  const id = `entry-${entry.id}`;
  const isTransfer = entry.type === "transfer";
  const isAdjustment = entry.type === "adjustment";

  return (
    <form
      action={formAction}
      onChange={() => warning && setDismissed(state)}
      className="panel-enter flex flex-col gap-4"
    >
      <div className={isTransfer ? "grid gap-4 sm:grid-cols-2" : undefined}>
        <SelectField
          id={`${id}-wallet`}
          name="walletId"
          label={isTransfer ? t("entries.field.fromWallet") : t("entries.field.wallet")}
          placeholder={t("common.chooseWallet")}
          options={walletOptions}
          defaultValue={values?.walletId ?? String(entry.walletId)}
          error={errors.walletId}
        />
        {isTransfer ? (
          <SelectField
            id={`${id}-to-wallet`}
            name="toWalletId"
            label={t("entries.field.toWallet")}
            placeholder={t("common.chooseWallet")}
            options={walletOptions}
            defaultValue={values?.toWalletId ?? String(entry.toWalletId ?? "")}
            error={errors.toWalletId}
          />
        ) : null}
      </div>

      <InputField
        id={`${id}-amount`}
        name="amount"
        label={isAdjustment ? t("entries.field.balanceChange") : t("common.amountTaka")}
        inputMode="decimal"
        required
        defaultValue={values?.amount ?? formatTaka(entry.amount)}
        error={errors.amount}
        hint={isAdjustment ? t("entries.field.balanceChangeHint") : undefined}
      />

      {entry.type === "expense" ? (
        <SelectField
          id={`${id}-category`}
          name="categoryId"
          label={t("entries.field.category")}
          placeholder={t("entries.field.chooseCategory")}
          options={categoryOptions}
          defaultValue={values?.categoryId ?? String(entry.categoryId ?? "")}
          error={errors.categoryId}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          id={`${id}-date`}
          name="entryDate"
          type="date"
          label={t("common.date")}
          required
          defaultValue={values?.entryDate ?? entry.entryDate}
          error={errors.entryDate}
        />
        <InputField
          id={`${id}-note`}
          name="note"
          label={t("common.noteOptional")}
          maxLength={NOTE_MAX}
          defaultValue={values?.note ?? entry.note ?? ""}
          error={errors.note}
        />
      </div>

      {failed?.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {failed.formError}
        </p>
      ) : null}

      {warning ? (
        <LowBalanceWarning
          walletName={warning.walletName}
          balanceAfter={warning.balanceAfter}
          pending={pending}
          onCancel={() => setDismissed(state)}
        />
      ) : (
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
          >
            <Save className="size-4" aria-hidden="true" />
            {pending ? t("common.saving") : t("common.save")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-4" aria-hidden="true" />
            {t("common.cancel")}
          </button>
        </div>
      )}
    </form>
  );
}
