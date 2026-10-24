"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createLoanAction } from "@/actions/loans";
import InputField from "@/components/forms/input-field";
import SelectField from "@/components/forms/select-field";
import { formatTaka } from "@/lib/money";
import {
  COUNTERPARTY_MAX,
  NOTE_MAX,
  type LoanField,
  type LoanFormState,
} from "@/lib/loans/validation";
import { useT } from "@/i18n/client";

const initialState: LoanFormState<LoanField> = { status: "idle" };

type Props = {
  wallets: { id: number; name: string; balance: number }[];
  /** Today's date in Dhaka, as YYYY-MM-DD. */
  today: string;
};

export default function CreateLoanForm({ wallets, today }: Props) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createLoanAction, initialState);
  const failed = state.status === "error" ? state : null;
  const values = failed?.values;
  const errors = failed?.fieldErrors ?? {};

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <h2 className="text-base font-semibold tracking-tight">{t("loans.add.title")}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="loan-direction"
          name="direction"
          label={t("loans.add.type")}
          placeholder={t("loans.add.chooseType")}
          options={[
            { value: "borrowed", label: t("loans.add.borrowed") },
            { value: "lent", label: t("loans.add.lent") },
          ]}
          defaultValue={values?.direction}
          error={errors.direction}
        />
        <InputField
          id="loan-counterparty"
          name="counterparty"
          label={t("loans.add.whoWith")}
          required
          maxLength={COUNTERPARTY_MAX}
          defaultValue={values?.counterparty}
          error={errors.counterparty}
          hint={t("loans.add.whoWithHint")}
        />
        <InputField
          id="loan-amount"
          name="amount"
          label={t("common.amountTaka")}
          inputMode="decimal"
          required
          defaultValue={values?.amount}
          error={errors.amount}
        />
        <SelectField
          id="loan-wallet"
          name="walletId"
          label={t("entries.field.wallet")}
          placeholder={t("common.chooseWallet")}
          options={wallets.map((wallet) => ({
            value: wallet.id,
            label: `${wallet.name} (৳ ${formatTaka(wallet.balance)})`,
          }))}
          defaultValue={values?.walletId}
          error={errors.walletId}
          hint={t("loans.add.walletHint")}
        />
        <InputField
          id="loan-date"
          name="entryDate"
          type="date"
          label={t("common.date")}
          required
          max={today}
          defaultValue={values?.entryDate ?? today}
          error={errors.entryDate}
        />
        <InputField
          id="loan-due-date"
          name="dueDate"
          type="date"
          label={t("common.dueDateOptional")}
          defaultValue={values?.dueDate}
          error={errors.dueDate}
        />
      </div>
      <InputField
        id="loan-note"
        name="note"
        label={t("common.noteOptional")}
        maxLength={NOTE_MAX}
        defaultValue={values?.note}
        error={errors.note}
      />

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

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        <Plus className="size-4" aria-hidden="true" />
        {pending ? t("common.saving") : t("loans.add.submit")}
      </button>
    </form>
  );
}
