"use client";

import { useActionState, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpFromLine,
  ArrowDownToLine,
  Scale,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  addExpenseAction,
  addIncomeAction,
  addTransferAction,
  adjustBalanceAction,
} from "@/actions/entries";
import InputField from "@/components/forms/input-field";
import SelectField from "@/components/forms/select-field";
import LowBalanceWarning from "./low-balance-warning";
import { formatTaka } from "@/lib/money";
import {
  NOTE_MAX,
  type EntryFormState,
  type EntryType,
} from "@/lib/entries/validation";
import { useT } from "@/i18n/client";
import type { TranslationKey } from "@/i18n";

type WalletOption = { id: number; name: string; balance: number };
type CategoryOption = { id: number; name: string };

const initialState: EntryFormState = { status: "idle" };

const TABS: {
  type: EntryType;
  labelKey: TranslationKey;
  submitKey: TranslationKey;
  icon: LucideIcon;
}[] = [
  { type: "expense", labelKey: "entries.tab.expense", submitKey: "entries.submit.expense", icon: ArrowUpFromLine },
  { type: "income", labelKey: "entries.tab.income", submitKey: "entries.submit.income", icon: ArrowDownToLine },
  { type: "transfer", labelKey: "entries.tab.transfer", submitKey: "entries.submit.transfer", icon: ArrowLeftRight },
  { type: "adjustment", labelKey: "entries.tab.adjustment", submitKey: "entries.submit.adjustment", icon: Scale },
];

const ACTIONS = {
  expense: addExpenseAction,
  income: addIncomeAction,
  transfer: addTransferAction,
  adjustment: adjustBalanceAction,
} as const;

type Props = {
  wallets: WalletOption[];
  categories: CategoryOption[];
  /** Today's date in Dhaka, as YYYY-MM-DD. */
  today: string;
};

export default function EntryForms({ wallets, categories, today }: Props) {
  const t = useT();
  const [type, setType] = useState<EntryType>("expense");

  return (
    <section
      aria-label={t("entries.form.label")}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <div role="group" aria-label={t("entries.form.typeGroup")} className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 sm:grid-cols-4">
        {TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            aria-pressed={type === tab.type}
            onClick={() => setType(tab.type)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-sm px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-card aria-pressed:text-foreground"
          >
            <tab.icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* Keyed by type so each mode starts clean and keeps its own errors. */}
      <EntryForm key={type} type={type} wallets={wallets} categories={categories} today={today} />
    </section>
  );
}

function EntryForm({ type, wallets, categories, today }: Props & { type: EntryType }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(ACTIONS[type], initialState);
  // Each save returns a new state object, so a warning the user has dismissed stays
  // dismissed, and a later warning shows again.
  const [dismissed, setDismissed] = useState<EntryFormState | null>(null);
  const failed = state.status === "error" ? state : null;
  const warning = state.status === "low-balance" && dismissed !== state ? state : null;
  const values = state.status === "error" || state.status === "low-balance" ? state.values : undefined;
  const errors = failed?.fieldErrors ?? {};
  const tab = TABS.find((candidate) => candidate.type === type)!;

  const walletOptions = wallets.map((wallet) => ({
    value: wallet.id,
    label: `${wallet.name} (৳ ${formatTaka(wallet.balance)})`,
  }));

  return (
    <form
      action={formAction}
      // Changing anything after the warning means the user is no longer confirming
      // the entry the warning described.
      onChange={() => warning && setDismissed(state)}
      className="flex flex-col gap-4"
    >
      {type === "transfer" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="entry-wallet"
            name="walletId"
            label={t("entries.field.fromWallet")}
            placeholder={t("common.chooseWallet")}
            options={walletOptions}
            defaultValue={values?.walletId}
            error={errors.walletId}
          />
          <SelectField
            id="entry-to-wallet"
            name="toWalletId"
            label={t("entries.field.toWallet")}
            placeholder={t("common.chooseWallet")}
            options={walletOptions}
            defaultValue={values?.toWalletId}
            error={errors.toWalletId}
          />
        </div>
      ) : (
        <SelectField
          id="entry-wallet"
          name="walletId"
          label={
            type === "expense"
              ? t("entries.field.payFrom")
              : type === "income"
                ? t("entries.field.addTo")
                : t("entries.field.wallet")
          }
          placeholder={t("common.chooseWallet")}
          options={walletOptions}
          defaultValue={values?.walletId}
          error={errors.walletId}
        />
      )}

      {type === "adjustment" ? (
        <InputField
          id="entry-new-balance"
          name="newBalance"
          label={t("entries.field.newBalance")}
          inputMode="decimal"
          required
          defaultValue={values?.newBalance}
          error={errors.newBalance}
          hint={t("entries.field.newBalanceHint")}
        />
      ) : (
        <InputField
          id="entry-amount"
          name="amount"
          label={t("common.amountTaka")}
          inputMode="decimal"
          required
          defaultValue={values?.amount}
          error={errors.amount}
        />
      )}

      {type === "expense" ? (
        <SelectField
          id="entry-category"
          name="categoryId"
          label={t("entries.field.category")}
          placeholder={t("entries.field.chooseCategory")}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          defaultValue={values?.categoryId}
          error={errors.categoryId}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          id="entry-date"
          name="entryDate"
          type="date"
          label={t("common.date")}
          required
          max={today}
          defaultValue={values?.entryDate ?? today}
          error={errors.entryDate}
        />
        <InputField
          id="entry-note"
          name="note"
          label={t("common.noteOptional")}
          maxLength={NOTE_MAX}
          defaultValue={values?.note}
          error={errors.note}
        />
      </div>

      {state.status === "saved" ? (
        <p role="status" className="text-sm text-success">
          {t("common.saved")}
        </p>
      ) : null}
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
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          <Plus className="size-4" aria-hidden="true" />
          {pending ? t("common.saving") : t(tab.submitKey)}
        </button>
      )}
    </form>
  );
}
