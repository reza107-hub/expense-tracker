import { bn } from "./bn";
import { en, type TranslationKey } from "./en";

export type { TranslationKey };

export const LANGUAGES = ["en", "bn"] as const;
export type Language = (typeof LANGUAGES)[number];
export type Dictionary = Record<TranslationKey, string>;

/** The cookie that remembers the choice on this device. */
export const LANGUAGE_COOKIE = "lang";
/** One year, in seconds. */
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type TranslateValues = Record<string, string | number>;
export type Translate = (key: TranslationKey, values?: TranslateValues) => string;

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "bn";
}

/** The language a stored value means. Anything unknown, or nothing at all, is English. */
export function parseLanguage(value: string | undefined | null): Language {
  return isLanguage(value) ? value : "en";
}

export function getDictionary(language: Language): Dictionary {
  return language === "bn" ? bn : en;
}

/** Fills `{name}` markers. A marker with no value is left as it is, so it shows up in review. */
export function format(text: string, values?: TranslateValues): string {
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (marker, name: string) =>
    name in values ? String(values[name]) : marker,
  );
}

/** A translate function over one dictionary. */
export function createTranslator(dictionary: Dictionary): Translate {
  return (key, values) => format(dictionary[key], values);
}

/** The `{placeholder}` names a text uses, sorted. */
export function placeholdersOf(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}
