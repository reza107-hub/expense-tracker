"use client";

import { useTransition } from "react";
import { setLanguageAction } from "@/lib/i18n/actions";
import { useLanguage, useT } from "@/i18n/client";
import { LANGUAGES, type Language } from "@/i18n";

/**
 * The "EN" and "বাং" choice. The current language is marked. Choosing the other one
 * saves it, then the page refreshes in place, so the address and the page stay the same.
 */
export default function LanguageSwitch() {
  const language = useLanguage();
  const t = useT();
  const [pending, startTransition] = useTransition();

  function choose(next: Language) {
    if (next === language) return;
    startTransition(async () => {
      await setLanguageAction(next);
    });
  }

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className="inline-flex items-center rounded-md border border-border bg-muted p-0.5 text-xs font-medium"
    >
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={language === code}
          disabled={pending}
          onClick={() => choose(code)}
          className="h-7 min-w-9 rounded-sm px-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-card aria-pressed:text-foreground disabled:opacity-60"
        >
          {t(`language.${code}`)}
        </button>
      ))}
    </div>
  );
}
