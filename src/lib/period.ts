/**
 * Reporting months. A period starts on `startDay` and runs to the day before the
 * next start. It is named for the month it starts in: with start day 25, "October"
 * covers 25 October to 24 November.
 *
 * Dates are plain "YYYY-MM-DD" strings and all maths is done in UTC, so no time
 * zone can shift an entry into another day. Only `todayInDhaka` looks at a clock.
 */

export const DHAKA_TIME_ZONE = "Asia/Dhaka";

export type Period = {
  /** Year of the month the period is named for. */
  year: number;
  /** Month the period is named for, 1 to 12. */
  month: number;
  /** First day, inclusive. */
  start: string;
  /** Last day, inclusive. */
  end: string;
};

function assertStartDay(startDay: number) {
  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 28) {
    throw new RangeError("Month start day must be a whole number from 1 to 28");
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateString(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

function parseDateString(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`Invalid date: ${date}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`Invalid date: ${date}`);
  }
  return { year, month, day };
}

/** Add or subtract whole months, returning the year and month (1 to 12). */
function addMonths(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function dayBefore(year: number, month: number, day: number) {
  const d = new Date(Date.UTC(year, month - 1, day - 1));
  return toDateString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** The period named for `year`/`month`. */
export function periodForMonth(year: number, month: number, startDay: number): Period {
  assertStartDay(startDay);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("Month must be a whole number from 1 to 12");
  }
  const next = addMonths(year, month, 1);
  return {
    year,
    month,
    start: toDateString(year, month, startDay),
    end: dayBefore(next.year, next.month, startDay),
  };
}

/** The period that contains `date`. */
export function periodContaining(date: string, startDay: number): Period {
  assertStartDay(startDay);
  const { year, month, day } = parseDateString(date);
  if (day >= startDay) return periodForMonth(year, month, startDay);
  const prev = addMonths(year, month, -1);
  return periodForMonth(prev.year, prev.month, startDay);
}

/** The period `delta` months before (negative) or after (positive) `period`. */
export function shiftPeriod(period: Period, delta: number, startDay: number): Period {
  const target = addMonths(period.year, period.month, delta);
  return periodForMonth(target.year, target.month, startDay);
}

/** Today's calendar date in Bangladesh. */
export function todayInDhaka(now: Date = new Date()): string {
  // The en-CA locale formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DHAKA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** True when `date` is after today in Bangladesh. */
export function isFutureDate(date: string, now: Date = new Date()): boolean {
  parseDateString(date);
  return date > todayInDhaka(now);
}
