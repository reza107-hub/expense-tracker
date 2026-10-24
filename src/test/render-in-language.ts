import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getDictionary, type Language } from "@/i18n";
import { LanguageProvider } from "@/i18n/client";

// The provider's `children` is required by its type, but createElement passes children
// as an argument, so give it a view where they are optional.
const Provider = LanguageProvider as unknown as ComponentType<{
  language: Language;
  dictionary: ReturnType<typeof getDictionary>;
  children?: ReactNode;
}>;

/** Renders a client component to HTML inside the chosen language, for tests. */
export function renderInLanguage(language: Language, element: ReactElement): string {
  return renderToStaticMarkup(
    createElement(Provider, { language, dictionary: getDictionary(language) }, element),
  );
}
