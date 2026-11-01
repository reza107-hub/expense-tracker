import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useI18n } from "@/i18n";
import { ApiError } from "./api";
import { messageFor } from "./errors";

/**
 * State shared by every form: errors per field, one message for the whole form, and a
 * `run` that sends the request. Server field errors land under the matching box. When a
 * save works, the screen closes.
 */
export function useForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const run = useCallback(
    async (send: () => Promise<unknown>, { close = true, onError }: { close?: boolean; onError?: (error: ApiError) => boolean } = {}) => {
      setFieldErrors({});
      setFormError(null);
      try {
        await send();
        if (close) router.back();
        return true;
      } catch (failure) {
        if (failure instanceof ApiError && onError?.(failure)) return false;
        if (failure instanceof ApiError && Object.keys(failure.fieldErrors).length > 0) {
          setFieldErrors(failure.fieldErrors);
          if (failure.code !== "INVALID_INPUT") setFormError(failure.message);
        } else {
          setFormError(messageFor(failure, t));
        }
        return false;
      }
    },
    [router, t],
  );

  return { fieldErrors, formError, run, clearErrors: () => { setFieldErrors({}); setFormError(null); } };
}

/** Parses a screen parameter holding JSON, or null when it is missing or broken. */
export function parseParam<T>(value: string | string[] | undefined): T | null {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
