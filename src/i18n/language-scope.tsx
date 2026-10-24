import type { ReactNode } from "react";
import { LanguageProvider } from "./client";
import { getTranslator } from "./server";

/**
 * Reads the saved language and shares it with everything inside. Put it inside a
 * <Suspense> boundary, because it reads cookies.
 */
export default async function LanguageScope({ children }: { children: ReactNode }) {
  const { language, dictionary } = await getTranslator();
  return (
    <LanguageProvider language={language} dictionary={dictionary}>
      {children}
    </LanguageProvider>
  );
}
