import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getReport } from "@/data/reports";
import { getTranslator } from "@/i18n/server";
import type { Translate } from "@/i18n";
import { formatDate, monthName, monthShort } from "@/lib/entries/display";
import { monthKey, parseEntriesQuery } from "@/lib/entries/query-params";
import { formatTaka } from "@/lib/money";
import { periodContaining, shiftPeriod } from "@/lib/period";
import { percentOf } from "@/lib/reports/queries";
import { Reveal } from "@/components/page-transition";
import { AdviceSkeleton } from "@/components/skeleton";
import AdviceSection from "./advice-section";

/** "+৳ 1,500 (+20%)", or "(n/a)" when there was no spending to compare with. */
function describeChange(change: number, percent: number | null, t: Translate): string {
  if (change === 0 && percent === null) return t("reports.change.none");
  const sign = change > 0 ? "+" : change < 0 ? "-" : "";
  const amount = `${sign}৳ ${formatTaka(Math.abs(change))}`;
  return percent === null
    ? `${amount} (${t("reports.change.na")})`
    : `${amount} (${percent > 0 ? "+" : ""}${percent}%)`;
}

const navLink =
  "inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export default async function ReportContent({
  searchParams,
}: {
  searchParams: PageProps<"/reports">["searchParams"];
}) {
  const { month } = parseEntriesQuery(await searchParams);
  const [{ report, startDay, today }, { t }] = await Promise.all([getReport(month), getTranslator()]);
  const { period } = report;

  const previous = shiftPeriod(period, -1, startDay);
  const next = shiftPeriod(period, 1, startDay);
  // No point paging into months that have not started yet.
  const showNext = next.start <= periodContaining(today, startDay).end;
  const maxTrend = Math.max(...report.trend.map((point) => point.total), 1);

  return (
    <>
      <nav aria-label={t("reports.monthNav")} className="flex items-center justify-between gap-3">
        <Link href={`/reports?month=${monthKey(previous)}`} className={navLink}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          {monthShort(previous.month, t)} {previous.year}
        </Link>
        <div className="text-center">
          <h2 className="text-base font-semibold tracking-tight">
            {monthName(period.year, period.month, t)}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("reports.range", {
              start: formatDate(period.start, t),
              end: formatDate(period.end, t),
            })}
          </p>
        </div>
        {showNext ? (
          <Link href={`/reports?month=${monthKey(next)}`} className={navLink}>
            {monthShort(next.month, t)} {next.year}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className="w-9" aria-hidden="true" />
        )}
      </nav>

      {!report.hasEntries ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("reports.empty")}{" "}
          <Link href="/entries" className="font-medium text-primary hover:underline">
            {t("reports.addEntryLink")}
          </Link>
        </p>
      ) : (
        <>
          <section
            aria-label={t("reports.total")}
            className="rounded-lg border border-border bg-card p-4 text-card-foreground"
          >
            <p className="text-sm text-muted-foreground">{t("reports.total")}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              ৳ {formatTaka(report.total)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {report.previousTotal === 0
                ? t("reports.noPrevious", { month: monthName(previous.year, previous.month, t) })
                : t("reports.compared", {
                    change: describeChange(report.change, report.changePercent, t),
                    month: monthName(previous.year, previous.month, t),
                    amount: formatTaka(report.previousTotal),
                  })}
            </p>
          </section>

          <section aria-labelledby="category-heading" className="flex flex-col gap-3">
            <h2 id="category-heading" className="text-base font-semibold tracking-tight">
              {t("reports.byCategory")}
            </h2>
            {report.byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("reports.noSpending")}</p>
            ) : (
              <ul className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
                {report.byCategory.map((category) => (
                  <li key={category.categoryId} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="min-w-0 truncate text-sm font-medium">{category.name}</span>
                      <span className="shrink-0 text-sm tabular-nums">
                        ৳ {formatTaka(category.total)}
                        {report.total > 0 ? ` · ${category.share}%` : ""}
                      </span>
                    </div>
                    <div
                      role="img"
                      aria-label={t("reports.categoryShare", { name: category.name, percent: category.share })}
                      className="h-2 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${category.share}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {category.previous === 0 && category.total === 0
                        ? ""
                        : t("reports.vsLastMonth", {
                            change: describeChange(category.change, category.changePercent, t),
                          })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="wallet-heading" className="flex flex-col gap-3">
            <h2 id="wallet-heading" className="text-base font-semibold tracking-tight">
              {t("reports.byWallet")}
            </h2>
            {report.byWallet.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("reports.noSpending")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card text-card-foreground">
                {report.byWallet.map((wallet) => (
                  <li key={wallet.walletId} className="flex items-baseline justify-between gap-4 p-3">
                    <span className="min-w-0 truncate text-sm font-medium">{wallet.name}</span>
                    <span className="shrink-0 text-sm tabular-nums">
                      ৳ {formatTaka(wallet.total)}
                      {report.total > 0 ? ` · ${percentOf(wallet.total, report.total)}%` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section aria-labelledby="trend-heading" className="flex flex-col gap-3">
        <h2 id="trend-heading" className="text-base font-semibold tracking-tight">
          {t("reports.trend")}
        </h2>
        <ol className="grid grid-cols-6 gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground">
          {report.trend.map(({ period: p, total }) => (
            <li key={monthKey(p)} className="flex flex-col items-center gap-1">
              <span className="text-[0.7rem] text-muted-foreground tabular-nums">
                {total === 0 ? "0" : formatTaka(total)}
              </span>
              <div className="flex h-24 w-full items-end rounded-sm bg-muted">
                <div
                  className="w-full rounded-sm bg-primary"
                  style={{ height: `${Math.round((total * 100) / maxTrend)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {monthShort(p.month, t)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <Reveal fallback={<AdviceSkeleton />}>
        <AdviceSection report={report} />
      </Reveal>
    </>
  );
}
