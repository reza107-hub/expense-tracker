import { getAdviceView } from "@/data/advice";
import { getTranslator } from "@/i18n/server";
import { formatDate, formatDateTime } from "@/lib/entries/display";
import { monthKey } from "@/lib/entries/query-params";
import { formatTaka } from "@/lib/money";
import type { MonthReport } from "@/lib/reports/queries";
import AdviceButton from "./advice-button";

export default async function AdviceSection({ report }: { report: MonthReport }) {
  const { period } = report;
  const [view, { t, language }] = await Promise.all([
    getAdviceView({ year: period.year, month: period.month }),
    getTranslator(),
  ]);
  // The spending shown next to each tip is ours, from the report, not the model's.
  const spentIn = new Map(report.byCategory.map((c) => [c.name, c.total]));

  return (
    <section aria-labelledby="advice-heading" className="flex flex-col gap-3">
      <h2 id="advice-heading" className="text-base font-semibold tracking-tight">
        {t("advice.title")}
      </h2>
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground">
        <p className="text-xs text-muted-foreground">
          {t("advice.privacy")}
        </p>

        {!view.hasExpenses ? (
          <p className="text-sm text-muted-foreground">
            {t("advice.nothing")}
          </p>
        ) : (
          <>
            {view.saved ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm break-words">{view.saved.advice.summary}</p>
                {view.saved.advice.suggestions.length > 0 ? (
                  <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                    {view.saved.advice.suggestions.map((suggestion) => (
                      <li key={suggestion.category + suggestion.tip} className="flex flex-col gap-1 p-3">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="min-w-0 truncate text-sm font-medium">
                            {suggestion.category}
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-success">
                            {t("advice.save", { amount: formatTaka(suggestion.saving) })}
                          </span>
                        </div>
                        <p className="text-sm break-words text-foreground">{suggestion.tip}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("advice.spentHere", {
                            spent: formatTaka(spentIn.get(suggestion.category) ?? 0),
                            start: formatDate(period.start, t),
                            end: formatDate(period.end, t),
                          })}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("advice.noUsable")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("advice.madeOn", { time: formatDateTime(view.saved.createdAt, language) })}
                  {view.stale ? ` ${t("advice.changedSince")}` : ""}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("advice.none")}
              </p>
            )}
            <AdviceButton
              month={monthKey(period)}
              hasSaved={view.saved !== null}
              remaining={view.remaining}
              dailyLimit={view.dailyLimit}
            />
          </>
        )}
      </div>
    </section>
  );
}
