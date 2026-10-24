import { getLoansPage } from "@/data/loans";
import { formatTaka } from "@/lib/money";
import CreateLoanForm from "./create-loan-form";
import LoanCard from "./loan-card";
import { getTranslator } from "@/i18n/server";

function Total({ label, poisha }: { label: string; poisha: number }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">৳ {formatTaka(poisha)}</p>
    </div>
  );
}

export default async function LoansContent() {
  const [{ loans, repayments, wallets, totals, today }, { t }] = await Promise.all([
    getLoansPage(),
    getTranslator(),
  ]);
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
        aria-label={t("loans.totals")}
        className="grid gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground sm:grid-cols-2"
      >
        <Total label={t("home.youOwe")} poisha={totals.owe} />
        <Total label={t("home.othersOweYou")} poisha={totals.owed} />
      </section>

      <CreateLoanForm wallets={wallets} today={today} />

      <section aria-labelledby="open-heading" className="flex flex-col gap-3">
        <h2 id="open-heading" className="text-base font-semibold tracking-tight">
          {t("loans.open")}
        </h2>
        {open.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("loans.emptyOpen")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">{open.map(card)}</ul>
        )}
      </section>

      {closed.length > 0 ? (
        <section aria-labelledby="closed-heading" className="flex flex-col gap-3">
          <h2 id="closed-heading" className="text-base font-semibold tracking-tight">
            {t("loans.closed")}
          </h2>
          <ul className="flex flex-col gap-3">{closed.map(card)}</ul>
        </section>
      ) : null}
    </>
  );
}
