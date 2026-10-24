import Link from "next/link";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { getAlertBanners } from "@/data/alerts";
import { getTranslator } from "@/i18n/server";
import { loanAlertText } from "@/lib/alerts/text";
import { formatTaka } from "@/lib/money";

const base = "flex items-start gap-3 rounded-md px-4 py-3 text-sm";
const warningTone = `${base} bg-warning text-warning-foreground`;
const dangerTone = `${base} bg-destructive text-destructive-foreground`;

/** Alert banners for the top of every page. Shows nothing when alerts are off or none apply. */
export default async function AlertBanners() {
  const [{ spending, loans }, { t }] = await Promise.all([getAlertBanners(), getTranslator()]);
  if (!spending && loans.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-4 pt-4 md:px-8 md:pt-6" aria-label={t("alerts.label")}>
      {spending ? (
        <div role="alert" className={spending.level === "exceeded" ? dangerTone : warningTone}>
          {spending.level === "exceeded" ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <p>
            {t(spending.level === "exceeded" ? "alerts.exceeded" : "alerts.warning", {
              over: formatTaka(spending.over),
              spent: formatTaka(spending.spent),
              limit: formatTaka(spending.limit),
              percent: spending.percent,
            })}{" "}
            <Link href="/reports" className="font-medium underline">
              {t("alerts.seeReport")}
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
            {loanAlertText(alert, t)}{" "}
            <Link href="/loans" className="font-medium underline">
              {t("alerts.openLoans")}
            </Link>
          </p>
        </div>
      ))}
    </div>
  );
}
