import { getLoansPage } from "@/data/loans";
import { formatTaka } from "@/lib/money";
import CreateLoanForm from "./create-loan-form";
import LoanCard from "./loan-card";

function Total({ label, poisha }: { label: string; poisha: number }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">৳ {formatTaka(poisha)}</p>
    </div>
  );
}

export default async function LoansContent() {
  const { loans, repayments, wallets, totals, today } = await getLoansPage();
  const open = loans.filter((loan) => loan.status === "open");
  const closed = loans.filter((loan) => loan.status === "closed");

  const card = (loan: (typeof loans)[number]) => (
    <li key={loan.id}>
      <LoanCard
        loan={loan}
        repayments={repayments.filter((r) => r.loanId === loan.id)}
        wallets={wallets}
        today={today}
      />
    </li>
  );

  return (
    <>
      <section
        aria-label="Loan totals"
        className="grid gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground sm:grid-cols-2"
      >
        <Total label="You owe" poisha={totals.owe} />
        <Total label="Others owe you" poisha={totals.owed} />
      </section>

      <CreateLoanForm wallets={wallets} today={today} />

      <section aria-labelledby="open-heading" className="flex flex-col gap-3">
        <h2 id="open-heading" className="text-base font-semibold tracking-tight">
          Open loans
        </h2>
        {open.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No open loans. Add one above when you borrow or lend money.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">{open.map(card)}</ul>
        )}
      </section>

      {closed.length > 0 ? (
        <section aria-labelledby="closed-heading" className="flex flex-col gap-3">
          <h2 id="closed-heading" className="text-base font-semibold tracking-tight">
            Closed loans
          </h2>
          <ul className="flex flex-col gap-3">{closed.map(card)}</ul>
        </section>
      ) : null}
    </>
  );
}
