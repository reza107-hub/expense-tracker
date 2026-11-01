import type { Translate } from "@/i18n";
import { ApiError } from "./api";

/** A sentence for a failure the person can read, in their language where we know the case. */
export function messageFor(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK") return t("error.network");
    if (error.code === "NOT_CONFIGURED") return t("error.notConfigured");
    if (error.code === "SIGN_IN_LOCKED") {
      const seconds = Number(error.extra.retryAfterSeconds ?? 900);
      const minutes = Math.max(1, Math.ceil(seconds / 60));
      return minutes === 1 ? t("auth.signIn.locked1") : t("auth.signIn.lockedN", { minutes });
    }
    if (error.code === "INVALID_CREDENTIALS") return t("auth.signIn.invalid");
    if (error.code === "SERVER_ERROR" || error.code === "NOT_CONFIGURED") return t("error.server");
    return error.message;
  }
  return t("error.generic");
}
