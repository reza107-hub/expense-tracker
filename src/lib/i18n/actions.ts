"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANGUAGE_COOKIE, LANGUAGE_COOKIE_MAX_AGE, isLanguage } from "@/i18n";

/**
 * Remembers the chosen language on this device. It works before sign-in, so it does not
 * call requireUser, and it touches no user data: the cookie holds only "en" or "bn".
 * Anything else is ignored.
 */
export async function setLanguageAction(language: string): Promise<void> {
  if (!isLanguage(language)) return;
  (await cookies()).set(LANGUAGE_COOKIE, language, {
    path: "/",
    maxAge: LANGUAGE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  // Every page's text depends on it.
  revalidatePath("/", "layout");
}
