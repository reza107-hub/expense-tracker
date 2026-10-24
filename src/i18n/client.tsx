"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { createTranslator, type Dictionary, type Language, type Translate } from "./index";

type Value = { language: Language; t: Translate };

const LanguageContext = createContext<Value | null>(null);

/**
 * Gives client components the chosen language. It is handed only that language's text,
 * so the browser never downloads both. It also keeps `<html lang>` right: the root
 * layout cannot read the cookie without stopping the whole app from prerendering, so the
 * attribute is corrected here once the page is in the browser.
 */
export function LanguageProvider({
  language,
  dictionary,
  children,
}: {
  language: Language;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ language, t: createTranslator(dictionary) }),
    [language, dictionary],
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function useLanguageContext(): Value {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useT must be used inside a LanguageProvider.");
  return value;
}

/** The translate function for client components. */
export function useT(): Translate {
  return useLanguageContext().t;
}

/** The chosen language, for client components. */
export function useLanguage(): Language {
  return useLanguageContext().language;
}
