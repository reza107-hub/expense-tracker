import { z } from "zod";
import { parseTaka } from "@/lib/money";

export type SettingsField = "monthStartDay";

export type SettingsFormState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "error";
      /** Kept so the typed value is still in the box after a failed attempt. */
      values: Partial<Record<SettingsField, string>>;
      fieldErrors: Partial<Record<SettingsField, string>>;
    };

export const MONTH_START_DAY_MESSAGE = "Enter a whole day from 1 to 28.";

const monthStartDay = z
  .string()
  .regex(/^\d{1,2}$/, MONTH_START_DAY_MESSAGE)
  .transform(Number)
  .refine((day) => day >= 1 && day <= 28, MONTH_START_DAY_MESSAGE);

type Checked =
  | { ok: true; value: { monthStartDay: number } }
  | {
      ok: false;
      values: Partial<Record<SettingsField, string>>;
      fieldErrors: Partial<Record<SettingsField, string>>;
    };

/**
 * Reads the month start day. It is limited to 1 to 28 so that every month contains it.
 * The database enforces the same range.
 */
export function validateMonthStartDay(formData: FormData): Checked {
  const raw = formData.get("monthStartDay");
  const typed = typeof raw === "string" ? raw.trim() : "";
  const parsed = monthStartDay.safeParse(typed);
  if (parsed.success) return { ok: true, value: { monthStartDay: parsed.data } };
  return {
    ok: false,
    values: { monthStartDay: typed },
    fieldErrors: { monthStartDay: parsed.error.issues[0].message },
  };
}

export type AlertField = "monthlyLimit";

export type AlertFormState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "error";
      values: { alertsEnabled: boolean; monthlyLimit: string };
      fieldErrors: Partial<Record<AlertField, string>>;
    };

type CheckedAlerts =
  | { ok: true; value: { alertsEnabled: boolean; monthlyLimit: number | null } }
  | {
      ok: false;
      values: { alertsEnabled: boolean; monthlyLimit: string };
      fieldErrors: Partial<Record<AlertField, string>>;
    };

/**
 * Reads the alerts form: a switch and a limit. The limit is one amount for all of the
 * user's wallets together. It must be above zero when given, and alerts cannot be
 * turned on without one. When that happens nothing is saved, so alerts stay as they were.
 */
export function validateAlertSettings(formData: FormData): CheckedAlerts {
  const alertsEnabled = formData.get("alertsEnabled") === "on";
  const raw = formData.get("monthlyLimit");
  const typed = typeof raw === "string" ? raw.trim() : "";
  const values = { alertsEnabled, monthlyLimit: typed };

  if (typed === "") {
    if (alertsEnabled) {
      return {
        ok: false,
        values,
        fieldErrors: { monthlyLimit: "Enter a monthly limit to turn alerts on." },
      };
    }
    return { ok: true, value: { alertsEnabled: false, monthlyLimit: null } };
  }

  const limit = parseTaka(typed);
  if (limit === null || limit <= 0) {
    return {
      ok: false,
      values,
      fieldErrors: {
        monthlyLimit: "Enter an amount above zero, with at most two decimal places.",
      },
    };
  }
  return { ok: true, value: { alertsEnabled, monthlyLimit: limit } };
}
