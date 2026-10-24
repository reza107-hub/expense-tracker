import Form from "next/form";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { formatDate, monthName } from "@/lib/entries/display";
import type { ListedEntry } from "@/lib/entries/list";
import { entriesHref, monthKey } from "@/lib/entries/query-params";
import { shiftPeriod, type Period } from "@/lib/period";
import type { CategoryChoice, WalletChoice } from "./edit-entry-form";
import EntryRows from "./entry-rows";
import { getTranslator } from "@/i18n/server";

type Props = {
  period: Period;
  today: string;
  startDay: number;
  entries: ListedEntry[];
  wallets: WalletChoice[];
  categories: CategoryChoice[];
  filters: { walletId?: number; categoryId?: number };
};

const navLink =
  "inline-flex size-9 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const selectClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function EntryList({
  period,
  today,
  startDay,
  entries,
  wallets,
  categories,
  filters,
}: Props) {
  const { t } = await getTranslator();
  const previous = shiftPeriod(period, -1, startDay);
  const next = shiftPeriod(period, 1, startDay);
  // No point paging into a month that has not started yet.
  const hasNext = next.start <= today;
  const filtered = filters.walletId !== undefined || filters.categoryId !== undefined;

  return (
    <section aria-labelledby="list-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="list-heading" className="text-base font-semibold tracking-tight">
            {monthName(period.year, period.month, t)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("reports.range", {
              start: formatDate(period.start, t),
              end: formatDate(period.end, t),
            })}
          </p>
        </div>
        <nav aria-label={t("reports.monthNav")} className="flex gap-2">
          <Link
            href={entriesHref(previous, filters)}
            aria-label={t("entries.list.previousMonth")}
            className={navLink}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
          {hasNext ? (
            <Link href={entriesHref(next, filters)} aria-label={t("entries.list.nextMonth")} className={navLink}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span aria-hidden="true" className={`${navLink} opacity-40`}>
              <ChevronRight className="size-4" />
            </span>
          )}
        </nav>
      </div>

      <Form action="/entries" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="month" value={monthKey(period)} />
        <select
          name="wallet"
          aria-label={t("entries.list.filterWallet")}
          defaultValue={filters.walletId ?? ""}
          className={selectClass}
        >
          <option value="">{t("entries.list.allWallets")}</option>
          {wallets.map((wallet) => (
            <option key={wallet.id} value={wallet.id}>
              {wallet.name}
            </option>
          ))}
        </select>
        <select
          name="category"
          aria-label={t("entries.list.filterCategory")}
          defaultValue={filters.categoryId ?? ""}
          className={selectClass}
        >
          <option value="">{t("entries.list.allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-muted px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Filter className="size-4" aria-hidden="true" />
            {t("entries.list.filter")}
          </button>
          {filtered ? (
            <Link
              href={entriesHref(period, {})}
              className="inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {t("entries.list.clear")}
            </Link>
          ) : null}
        </div>
      </Form>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {filtered
            ? t("entries.list.noMatch")
            : t("entries.list.none", { month: monthName(period.year, period.month, t) })}
        </p>
      ) : (
        <EntryRows entries={entries} wallets={wallets} categories={categories} />
      )}
    </section>
  );
}
