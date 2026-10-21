/**
 * Money is stored as whole poisha (1 taka = 100 poisha) in plain integers.
 * No floating point is used to parse or add money.
 */

/** Largest single amount accepted: 10,000,000,000.00 taka. Keeps sums far below 2^53. */
export const MAX_POISHA = 1_000_000_000_000;

// Whole part: plain digits, standard grouping (1,234,567) or lakh grouping (12,34,567).
const AMOUNT_PATTERN =
  /^(-)?(\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3}|\d+)(?:\.(\d{1,2}))?$/;

type ParseOptions = {
  /** Allow a leading minus, for example a balance that is below zero. */
  allowNegative?: boolean;
};

/**
 * Parse a taka amount typed by a person into poisha.
 * Accepts digits with optional standard or lakh comma grouping and at most two decimals.
 * Returns null for anything else, including three decimals and amounts above MAX_POISHA.
 */
export function parseTaka(
  input: string,
  { allowNegative = false }: ParseOptions = {},
): number | null {
  const match = AMOUNT_PATTERN.exec(input.trim());
  if (!match) return null;

  const [, minus, whole, fraction = ""] = match;
  if (minus && !allowNegative) return null;

  const poisha =
    Number(whole.replaceAll(",", "")) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(poisha) || poisha > MAX_POISHA) return null;

  return minus && poisha !== 0 ? -poisha : poisha;
}

/** Group digits the Bangladeshi way: 1,00,000 (last three, then pairs). */
function groupLakh(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/** Format poisha as a taka string. Decimals show only when needed: 48,200 or 1,250.50. */
export function formatTaka(poisha: number): string {
  if (!Number.isSafeInteger(poisha)) {
    throw new RangeError("Amount must be a whole number of poisha");
  }
  const negative = poisha < 0;
  const abs = Math.abs(poisha);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;

  const text = groupLakh(String(whole)) + (fraction ? `.${String(fraction).padStart(2, "0")}` : "");
  return negative ? `-${text}` : text;
}
