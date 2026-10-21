import { getDb } from "@/db";
import { createAuth, type Auth } from "./auth";
import { getAuthEnv } from "./env";

let cached: Auth | undefined;

/** The app's account system, created on first use from the environment. */
export function getAuth(): Auth {
  if (!cached) {
    const { secret, baseURL, allowedEmails } = getAuthEnv();
    cached = createAuth({ db: getDb(), secret, baseURL, allowedEmails });
  }
  return cached;
}
