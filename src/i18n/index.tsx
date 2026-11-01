import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { appBn } from "./app-bn";
import { appEn, type AppKey } from "./app-en";
import { bn } from "./bn";
import { en, type TranslationKey } from "./en";

export type Key = TranslationKey | AppKey;
export type Language = "en" | "bn";
export const LANGUAGES: readonly Language[] = ["en", "bn"];
export type Translate = (key: Key, values?: Record<string, string | number>) => string;

const dictionaries: Record<Language, Record<string, string>> = {
  en: { ...en, ...appEn },
  bn: { ...bn, ...appBn },
};

const STORAGE_KEY = "language";

/** Fills `{name}` markers. A marker with no value is left as it is, so it shows up in review. */
export function format(text: string, values?: Record<string, string | number>): string {
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (marker, name: string) =>
    name in values ? String(values[name]) : marker,
  );
}

type Value = { language: Language; setLanguage: (language: Language) => void; t: Translate };

const I18nContext = createContext<Value | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((saved) => {
        if (saved === "en" || saved === "bn") setLanguageState(saved);
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<Value>(() => {
    const dictionary = dictionaries[language];
    return {
      language,
      setLanguage,
      t: (key, values) => format(dictionary[key] ?? key, values),
    };
  }, [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Value {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
