"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteRepaymentAction } from "@/actions/loans";
import { formatDate } from "@/lib/entries/display";
import type { Repayment } from "@/lib/loans/queries";
import type { LoanActionState, LoanDirection } from "@/lib/loans/validation";
import { formatTaka } from "@/lib/money";
import { useT } from "@/i18n/client";

const idle: LoanActionState = { status: "idle" };

const quietButton =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

type Props = { repayments: Repayment[]; direction: LoanDirection };

/** The repayments of one loan, newest first, each with a delete that asks first. */
export default function RepaymentRows({ repayments, direction }: Props) {
  const t = useT();
  if (repayments.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">{t("loans.repayments")}</h4>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {repayments.map((repayment) => (
          <RepaymentRow key={repayment.id} repayment={repayment} direction={direction} />
        ))}
      </ul>
    </div>
  );
}

function RepaymentRow({
  repayment,
  direction,
}: {
  repayment: Repayment;
  direction: LoanDirection;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    deleteRepaymentAction.bind(null, repayment.id),
    idle,
  );

  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm tabular-nums">
            {repayment.fee > 0
              ? t(direction === "borrowed" ? "loans.repayment.withFee" : "loans.repayment.withInterest", {
                  principal: formatTaka(repayment.principal),
                  fee: formatTaka(repayment.fee),
                })
              : `৳ ${formatTaka(repayment.principal)}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(repayment.entryDate, t)} · {repayment.walletName}
          </p>
          {repayment.note ? (
            <p className="mt-1 text-sm break-words text-foreground">{repayment.note}</p>
          ) : null}
        </div>
        {confirming ? null : (
          <button type="button" onClick={() => setConfirming(true)} className={quietButton}>
            <Trash2 className="size-4" aria-hidden="true" />
            {t("common.delete")}
          </button>
        )}
      </div>
      {confirming ? (
        <form action={formAction} className="panel-enter flex flex-col gap-2">
          <p className="text-sm text-foreground">
            {t("loans.repayment.deleteConfirm")}
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            >
              {pending ? t("common.deleting") : t("common.yesDelete")}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={quietButton}>
              {t("common.keepIt")}
            </button>
          </div>
          {state.status === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}
