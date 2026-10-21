import { getAdviceView } from "@/data/advice";
import { formatDate } from "@/lib/entries/display";
import { monthKey } from "@/lib/entries/query-params";
import { formatTaka } from "@/lib/money";
import type { MonthReport } from "@/lib/reports/queries";
import AdviceButton from "./advice-button";

/** "20 Oct 2026, 3:42 pm" in Dhaka time. */
function formatMadeAt(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function AdviceSection({ report }: { report: MonthReport }) {
  const { period } = report;
  const view = await getAdviceView({ year: period.year, month: period.month });
  // The spending shown next to each tip is ours, from the report, not the model's.
  const spentIn = new Map(report.byCategory.map((c) => [c.name, c.total]));

  return (
    <section aria-labelledby="advice-heading" className="flex flex-col gap-3">
      <h2 id="advice-heading" className="text-base font-semibold tracking-tight">
        Saving advice
      </h2>
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground">
        <p className="text-xs text-muted-foreground">
          Only your totals for each category are sent to Google Gemini. Notes, wallet names, loan
          names and individual entries are never shared.
        </p>

        {!view.hasExpenses ? (
          <p className="text-sm text-muted-foreground">
            There is nothing to analyse in this month. Add some expenses first.
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
                            Save about ৳ {formatTaka(suggestion.saving)}
                          </span>
                        </div>
                        <p className="text-sm break-words text-foreground">{suggestion.tip}</p>
                        <p className="text-xs text-muted-foreground">
                          You spent ৳ {formatTaka(spentIn.get(suggestion.category) ?? 0)} here in{" "}
                          {formatDate(period.start)} to {formatDate(period.end)}.
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The advice had no usable suggestions this time. Try refreshing later.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Made on {formatMadeAt(view.saved.createdAt)}.
                  {view.stale ? " Your spending has changed since then." : ""}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No advice for this month yet. Press the button to get some.
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
