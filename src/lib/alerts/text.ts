import type { Translate, TranslationKey } from "@/i18n";
import { formatDate } from "@/lib/entries/display";
import { formatTaka } from "@/lib/money";
import type { LoanAlert } from "./compute";

/** The sentence for one loan alert. It reads differently for borrowed and lent loans. */
export function loanAlertText(alert: LoanAlert, t: Translate): string {
  const values = {
    amount: formatTaka(alert.outstanding),
    name: alert.counterparty,
    date: formatDate(alert.dueDate, t),
    days: Math.abs(alert.daysUntil),
  };
  const part =
    alert.daysUntil < 0
      ? alert.daysUntil === -1
        ? "overdue1"
        : "overdueN"
      : alert.daysUntil === 0
        ? "today"
        : alert.daysUntil === 1
          ? "soon1"
          : "soonN";
  return t(`alerts.loan.${alert.direction}.${part}` as TranslationKey, values);
}
