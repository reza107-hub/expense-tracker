import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Suspense } from "react";
import { getReport } from "@/data/reports";
import { formatDate, monthName } from "@/lib/entries/display";
import { monthKey, parseEntriesQuery } from "@/lib/entries/query-params";
import { formatTaka } from "@/lib/money";
import { periodContaining, shiftPeriod } from "@/lib/period";
import { percentOf } from "@/lib/reports/queries";
import AdviceSection from "./advice-section";

/** "+৳ 1,500 (20%)", or "(n/a)" when there was no spending to compare with. */
function describeChange(change: number, percent: number | null): string {
  if (change === 0 && percent === null) return "no change";
  const sign = change > 0 ? "+" : change < 0 ? "-" : "";
  const amount = `${sign}৳ ${formatTaka(Math.abs(change))}`;
  return percent === null ? `${amount} (n/a)` : `${amount} (${percent > 0 ? "+" : ""}${percent}%)`;
}

const navLink =
  "inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export default async function ReportContent({
  searchParams,
}: {
  searchParams: PageProps<"/reports">["searchParams"];
}) {
  const { month } = parseEntriesQuery(await searchParams);
  const { report, startDay, today } = await getReport(month);
  const { period } = report;

  const previous = shiftPeriod(period, -1, startDay);
  const next = shiftPeriod(period, 1, startDay);
  // No point paging into months that have not started yet.
  const showNext = next.start <= periodContaining(today, startDay).end;
  const maxTrend = Math.max(...report.trend.map((t) => t.total), 1);

  return (
    <>
      <nav aria-label="Month" className="flex items-center justify-between gap-3">
        <Link href={`/reports?month=${monthKey(previous)}`} className={navLink}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          {monthName(previous.year, previous.month)}
        </Link>
        <div className="text-center">
          <h2 className="text-base font-semibold tracking-tight">
            {monthName(period.year, period.month)}
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatDate(period.start)} to {formatDate(period.end)}
          </p>
        </div>
        {showNext ? (
          <Link href={`/reports?month=${monthKey(next)}`} className={navLink}>
            {monthName(next.year, next.month)}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className="w-9" aria-hidden="true" />
        )}
      </nav>

      {!report.hasEntries ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nothing is recorded in this month.{" "}
          <Link href="/entries" className="font-medium text-primary hover:underline">
            Add an entry
          </Link>
        </p>
      ) : (
        <>
          <section
            aria-label="Total spending"
            className="rounded-lg border border-border bg-card p-4 text-card-foreground"
          >
            <p className="text-sm text-muted-foreground">Total spending</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              ৳ {formatTaka(report.total)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {report.previousTotal === 0
                ? `Nothing was spent in ${monthName(previous.year, previous.month)}.`
                : `${describeChange(report.change, report.changePercent)} compared with ${monthName(previous.year, previous.month)} (৳ ${formatTaka(report.previousTotal)}).`}
            </p>
          </section>

          <section aria-labelledby="category-heading" className="flex flex-col gap-3">
            <h2 id="category-heading" className="text-base font-semibold tracking-tight">
              By category
            </h2>
            {report.byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No spending in this month.</p>
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
                      aria-label={`${category.name} is ${category.share}% of spending`}
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
                        : `${describeChange(category.change, category.changePercent)} vs last month`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="wallet-heading" className="flex flex-col gap-3">
            <h2 id="wallet-heading" className="text-base font-semibold tracking-tight">
              By wallet
            </h2>
            {report.byWallet.length === 0 ? (
              <p className="text-sm text-muted-foreground">No spending in this month.</p>
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
          Last six months
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
                {monthName(p.year, p.month).slice(0, 3)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading advice</p>}>
        <AdviceSection report={report} />
      </Suspense>
    </>
  );
}
