import type { Period } from "@/lib/period";

export type EntriesQuery = {
  /** The month asked for, or null for the month that contains today. */
  month: { year: number; month: number } | null;
  walletId?: number;
  categoryId?: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function id(value: string | undefined): number | undefined {
  return value !== undefined && /^\d{1,9}$/.test(value) ? Number(value) : undefined;
}

/**
 * Reads `?month=2026-10&wallet=3&category=2`. Anything that does not look right is
 * ignored rather than raising an error, because anyone can type anything in an address.
 */
export function parseEntriesQuery(params: SearchParams): EntriesQuery {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(first(params.month) ?? "");
  return {
    month: match ? { year: Number(match[1]), month: Number(match[2]) } : null,
    walletId: id(first(params.wallet)),
    categoryId: id(first(params.category)),
  };
}

/** `2026-10` for the month a period is named after. */
export function monthKey({ year, month }: Pick<Period, "year" | "month">): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** The address of the entries page for a month and filters. */
export function entriesHref(
  period: Pick<Period, "year" | "month">,
  { walletId, categoryId }: Pick<EntriesQuery, "walletId" | "categoryId">,
): string {
  const search = new URLSearchParams({ month: monthKey(period) });
  if (walletId !== undefined) search.set("wallet", String(walletId));
  if (categoryId !== undefined) search.set("category", String(categoryId));
  return `/entries?${search}`;
}
