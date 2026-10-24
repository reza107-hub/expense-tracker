import { cookies } from "next/headers";
import {
  LANGUAGE_COOKIE,
  createTranslator,
  getDictionary,
  parseLanguage,
  type Dictionary,
  type Language,
  type Translate,
} from "./index";

/**
 * The language saved on this device, or English. It reads cookies, so with Cache
 * Components it must run inside a <Suspense> boundary.
 */
export async function getLanguage(): Promise<Language> {
  return parseLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value);
}

/** The language, its text, and a translate function, for Server Components. */
export async function getTranslator(): Promise<{
  language: Language;
  dictionary: Dictionary;
  t: Translate;
}> {
  const language = await getLanguage();
  const dictionary = getDictionary(language);
  return { language, dictionary, t: createTranslator(dictionary) };
}
