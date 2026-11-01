import type { Language, Translate } from "@/i18n";

/** Today's date in Dhaka as "YYYY-MM-DD". Bangladesh has no daylight saving, so it is UTC+6. */
export function todayInDhaka(now: Date = new Date()): string {
  return new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export const monthName = (year: number, month: number, t: Translate) => `${t(`month.${month}` as "month.1")} ${year}`;

/** "5 Oct 2026" from "2026-10-05". Plain string work, so no time zone can shift it. */
export function formatDate(date: string, t: Translate): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${t(`monthShort.${month}` as "monthShort.1")} ${year}`;
}

/** "20 Oct 2026, 3:42 pm" in Dhaka time. Latin digits in both languages, like the website. */
export function formatDateTime(iso: string, language: Language): string {
  try {
    return new Intl.DateTimeFormat(language === "bn" ? "bn-BD-u-nu-latn" : "en-GB", {
      timeZone: "Asia/Dhaka",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}
