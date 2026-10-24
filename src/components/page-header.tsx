"use client";

import { useT } from "@/i18n/client";
import type { TranslationKey } from "@/i18n";

/**
 * The title and one-line description at the top of a page. It is a client component
 * only so it can read the language the layout already provided; it holds no state.
 */
export default function PageHeader({
  titleKey,
  descriptionKey,
}: {
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
}) {
  const t = useT();
  return (
    <header>
      <h1 className="text-xl font-semibold tracking-tight">{t(titleKey)}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t(descriptionKey)}</p>
    </header>
  );
}
