"use client";

import { useActionState, useEffect, useState } from "react";
import { HandCoins, Pencil, Save, Trash2, X } from "lucide-react";
import {
  deleteLoanAction,
  recordRepaymentAction,
  updateLoanAction,
} from "@/actions/loans";
import InputField from "@/components/forms/input-field";
import SelectField from "@/components/forms/select-field";
import { formatTaka } from "@/lib/money";
import {
  COUNTERPARTY_MAX,
  NOTE_MAX,
  type LoanActionState,
  type LoanDirection,
  type LoanEditField,
  type LoanFormState,
  type RepaymentField,
} from "@/lib/loans/validation";
import { useT } from "@/i18n/client";

const idleAction: LoanActionState = { status: "idle" };

const buttonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";
const quietButton = `${buttonClass} text-muted-foreground hover:bg-muted hover:text-foreground`;
const primaryButton = `${buttonClass} bg-primary text-primary-foreground hover:opacity-90`;

type Wallets = { id: number; name: string; balance: number }[];

type Props = {
  loan: {
    id: number;
    direction: LoanDirection;
    counterparty: string;
    dueDate: string | null;
    note: string | null;
    outstanding: number;
    status: "open" | "closed";
  };
  wallets: Wallets;
  /** Today's date in Dhaka, as YYYY-MM-DD. */
  today: string;
};

/** Repay, edit and delete controls for one loan. */
export default function LoanControls({ loan, wallets, today }: Props) {
  const t = useT();
  const [mode, setMode] = useState<"view" | "repay" | "edit" | "delete">("view");
  const close = () => setMode("view");

  return (
    <div className="flex flex-col gap-3">
      {mode === "repay" ? (
        <RepayForm loan={loan} wallets={wallets} today={today} onClose={close} />
      ) : mode === "edit" ? (
        <EditForm loan={loan} onClose={close} />
      ) : mode === "delete" ? (
        <DeleteConfirm loan={loan} onClose={close} />
      ) : (
        <div className="flex flex-wrap gap-1">
          {loan.status === "open" ? (
            <button type="button" onClick={() => setMode("repay")} className={quietButton}>
              <HandCoins className="size-4" aria-hidden="true" />
              {loan.direction === "borrowed" ? t("loans.repay") : t("loans.recordRepayment")}
            </button>
          ) : null}
          <button type="button" onClick={() => setMode("edit")} className={quietButton}>
            <Pencil className="size-4" aria-hidden="true" />
            {t("common.edit")}
          </button>
          <button type="button" onClick={() => setMode("delete")} className={quietButton}>
            <Trash2 className="size-4" aria-hidden="true" />
            {t("common.delete")}
          </button>
        </div>
      )}
    </div>
  );
}

function RepayForm({
  loan,
  wallets,
  today,
  onClose,
}: Props & { onClose: () => void }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(
    recordRepaymentAction.bind(null, loan.id),
    { status: "idle" } as LoanFormState<RepaymentField>,
  );
  const failed = state.status === "error" ? state : null;
  const values = failed?.values;
  const errors = failed?.fieldErrors ?? {};
  const borrowed = loan.direction === "borrowed";

  useEffect(() => {
    if (state.status === "saved") onClose();
  }, [state, onClose]);

  return (
    <form action={formAction} className="panel-enter flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("loans.repayForm.outstanding", { amount: formatTaka(loan.outstanding) })}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          id={`repay-${loan.id}-principal`}
          name="principal"
          label={t("loans.repayForm.principal")}
          inputMode="decimal"
          required
          defaultValue={values?.principal}
          error={errors.principal}
        />
        <InputField
          id={`repay-${loan.id}-interest`}
          name="interest"
          label={
            borrowed ? t("loans.repayForm.feePaid") : t("loans.repayForm.interestReceived")
          }
          inputMode="decimal"
          defaultValue={values?.interest}
          error={errors.interest}
          hint={borrowed ? t("loans.repayForm.feeHint") : t("loans.repayForm.interestHint")}
        />
        <SelectField
          id={`repay-${loan.id}-wallet`}
          name="walletId"
          label={borrowed ? t("entries.field.payFrom") : t("loans.repayForm.receiveInto")}
          placeholder={t("common.chooseWallet")}
          options={wallets.map((wallet) => ({
            value: wallet.id,
            label: `${wallet.name} (৳ ${formatTaka(wallet.balance)})`,
          }))}
          defaultValue={values?.walletId}
          error={errors.walletId}
        />
        <InputField
          id={`repay-${loan.id}-date`}
          name="entryDate"
          type="date"
          label={t("common.date")}
          required
          max={today}
          defaultValue={values?.entryDate ?? today}
          error={errors.entryDate}
        />
      </div>
      <InputField
        id={`repay-${loan.id}-note`}
        name="note"
        label={t("common.noteOptional")}
        maxLength={NOTE_MAX}
        defaultValue={values?.note}
        error={errors.note}
      />
      {failed?.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {failed.formError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          <Save className="size-4" aria-hidden="true" />
          {pending ? t("common.saving") : t("loans.repayForm.save")}
        </button>
        <button type="button" onClick={onClose} className={quietButton}>
          <X className="size-4" aria-hidden="true" />
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

function EditForm({ loan, onClose }: { loan: Props["loan"]; onClose: () => void }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(
    updateLoanAction.bind(null, loan.id),
    { status: "idle" } as LoanFormState<LoanEditField>,
  );
  const failed = state.status === "error" ? state : null;
  const errors = failed?.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "saved") onClose();
  }, [state, onClose]);

  return (
    <form action={formAction} className="panel-enter flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          id={`loan-${loan.id}-counterparty`}
          name="counterparty"
          label={t("loans.add.whoWith")}
          required
          maxLength={COUNTERPARTY_MAX}
          defaultValue={failed?.values.counterparty ?? loan.counterparty}
          error={errors.counterparty}
        />
        <InputField
          id={`loan-${loan.id}-due`}
          name="dueDate"
          type="date"
          label={t("common.dueDateOptional")}
          defaultValue={failed?.values.dueDate ?? loan.dueDate ?? ""}
          error={errors.dueDate}
        />
      </div>
      <InputField
        id={`loan-${loan.id}-note`}
        name="note"
        label={t("common.noteOptional")}
        maxLength={NOTE_MAX}
        defaultValue={failed?.values.note ?? loan.note ?? ""}
        error={errors.note}
        hint={t("loans.editHint")}
      />
      {failed?.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {failed.formError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButton}>
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

function DeleteConfirm({ loan, onClose }: { loan: Props["loan"]; onClose: () => void }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(
    deleteLoanAction.bind(null, loan.id),
    idleAction,
  );

  return (
    <form action={formAction} className="panel-enter flex flex-col gap-2">
      <p className="text-sm text-foreground">
        {t("loans.deleteConfirm", { name: loan.counterparty })}
      </p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className={`${buttonClass} bg-destructive text-destructive-foreground hover:opacity-90`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {pending ? t("common.deleting") : t("common.yesDelete")}
        </button>
        <button type="button" onClick={onClose} className={quietButton}>
          {t("common.keepIt")}
        </button>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
