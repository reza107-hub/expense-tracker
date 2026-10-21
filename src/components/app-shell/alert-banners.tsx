import Link from "next/link";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { getAlertBanners } from "@/data/alerts";
import type { LoanAlert } from "@/lib/alerts/compute";
import { formatDate } from "@/lib/entries/display";
import { formatTaka } from "@/lib/money";

function when(daysUntil: number): string {
  if (daysUntil < 0) {
    const days = -daysUntil;
    return `was due ${days} ${days === 1 ? "day" : "days"} ago`;
  }
  if (daysUntil === 0) return "is due today";
  return `is due in ${daysUntil} ${daysUntil === 1 ? "day" : "days"}`;
}

/** The sentence for one loan alert. It reads differently for borrowed and lent loans. */
export function loanAlertText(alert: LoanAlert): string {
  const amount = `৳ ${formatTaka(alert.outstanding)}`;
  const due = `(${formatDate(alert.dueDate)})`;
  return alert.direction === "borrowed"
    ? `You owe ${amount} to ${alert.counterparty}. It ${when(alert.daysUntil)} ${due}.`
    : `${alert.counterparty} owes you ${amount}. It ${when(alert.daysUntil)} ${due}.`;
}

const base = "flex items-start gap-3 rounded-md px-4 py-3 text-sm";
const warningTone = `${base} bg-warning text-warning-foreground`;
const dangerTone = `${base} bg-destructive text-destructive-foreground`;

/** Alert banners for the top of every page. Shows nothing when alerts are off or none apply. */
export default async function AlertBanners() {
  const { spending, loans } = await getAlertBanners();
  if (!spending && loans.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-4 pt-4 md:px-8 md:pt-6" aria-label="Alerts">
      {spending ? (
        <div role="alert" className={spending.level === "exceeded" ? dangerTone : warningTone}>
          {spending.level === "exceeded" ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <p>
            {spending.level === "exceeded"
              ? `You are over your monthly limit by ৳ ${formatTaka(spending.over)}. You have spent ৳ ${formatTaka(spending.spent)} of ৳ ${formatTaka(spending.limit)}.`
              : `You have used ${spending.percent}% of your monthly limit: ৳ ${formatTaka(spending.spent)} of ৳ ${formatTaka(spending.limit)}.`}{" "}
            <Link href="/reports" className="font-medium underline">
              See report
            </Link>
          </p>
        </div>
      ) : null}
      {loans.map((alert) => (
        <div
          key={alert.loanId}
          role="alert"
          className={alert.daysUntil < 0 ? dangerTone : warningTone}
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            {loanAlertText(alert)}{" "}
            <Link href="/loans" className="font-medium underline">
              Open loans
            </Link>
          </p>
        </div>
      ))}
    </div>
  );
}
