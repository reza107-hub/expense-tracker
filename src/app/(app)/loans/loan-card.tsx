import { formatDate } from "@/lib/entries/display";
import type { LoanSummary, Repayment } from "@/lib/loans/queries";
import { formatTaka } from "@/lib/money";
import LoanControls from "./loan-controls";
import RepaymentRows from "./repayment-rows";

type Props = {
  loan: LoanSummary;
  repayments: Repayment[];
  wallets: { id: number; name: string; balance: number }[];
  today: string;
};

function Figure({ label, poisha }: { label: string; poisha: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">৳ {formatTaka(poisha)}</dd>
    </div>
  );
}

/** One loan: who, how much, what is left, and its repayments and controls. */
export default function LoanCard({ loan, repayments, wallets, today }: Props) {
  const borrowed = loan.direction === "borrowed";
  // Due-date alerts arrive with the alerts work. Here the date is only shown.
  const overdue = loan.status === "open" && loan.dueDate !== null && loan.dueDate < today;

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-medium">{loan.counterparty}</h3>
          <p className="text-sm text-muted-foreground">
            {borrowed ? "You borrowed" : "You lent"}
            {loan.startDate ? ` on ${formatDate(loan.startDate)}` : ""}
          </p>
        </div>
        <span
          className={
            loan.status === "open"
              ? "shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground"
              : "shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium text-success"
          }
        >
          {loan.status === "open" ? "Open" : "Closed"}
        </span>
      </header>

      <dl className="grid grid-cols-3 gap-3">
        <Figure label="Original" poisha={loan.principal} />
        <Figure label="Repaid" poisha={loan.repaid} />
        <Figure label="Outstanding" poisha={loan.outstanding} />
      </dl>

      {loan.dueDate ? (
        <p className={overdue ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          Due {formatDate(loan.dueDate)}
          {overdue ? " (overdue)" : ""}
        </p>
      ) : null}
      {loan.note ? <p className="text-sm break-words text-foreground">{loan.note}</p> : null}

      <RepaymentRows repayments={repayments} direction={loan.direction} />

      <LoanControls
        loan={{
          id: loan.id,
          direction: loan.direction,
          counterparty: loan.counterparty,
          dueDate: loan.dueDate,
          note: loan.note,
          outstanding: loan.outstanding,
          status: loan.status,
        }}
        wallets={wallets}
        today={today}
      />
    </article>
  );
}
