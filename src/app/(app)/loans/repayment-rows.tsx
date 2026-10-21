"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteRepaymentAction } from "@/actions/loans";
import { formatDate } from "@/lib/entries/display";
import type { Repayment } from "@/lib/loans/queries";
import type { LoanActionState, LoanDirection } from "@/lib/loans/validation";
import { formatTaka } from "@/lib/money";

const idle: LoanActionState = { status: "idle" };

const quietButton =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

type Props = { repayments: Repayment[]; direction: LoanDirection };

/** The repayments of one loan, newest first, each with a delete that asks first. */
export default function RepaymentRows({ repayments, direction }: Props) {
  if (repayments.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">Repayments</h4>
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
            ৳ {formatTaka(repayment.principal)}
            {repayment.fee > 0
              ? ` + ৳ ${formatTaka(repayment.fee)} ${direction === "borrowed" ? "fee" : "interest"}`
              : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(repayment.entryDate)} · {repayment.walletName}
          </p>
          {repayment.note ? (
            <p className="mt-1 text-sm break-words text-foreground">{repayment.note}</p>
          ) : null}
        </div>
        {confirming ? null : (
          <button type="button" onClick={() => setConfirming(true)} className={quietButton}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </button>
        )}
      </div>
      {confirming ? (
        <form action={formAction} className="flex flex-col gap-2">
          <p className="text-sm text-foreground">
            Delete this repayment? The amount owed and your balances will change back.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            >
              {pending ? "Deleting" : "Yes, delete"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={quietButton}>
              Keep it
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
