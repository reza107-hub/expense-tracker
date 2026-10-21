"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { updateAlertSettings, updateMonthStartDay } from "@/lib/settings/mutations";
import {
  validateAlertSettings,
  validateMonthStartDay,
  type AlertFormState,
  type SettingsFormState,
} from "@/lib/settings/validation";

export async function updateMonthStartDayAction(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const { userId } = await requireUser();
  const checked = validateMonthStartDay(formData);
  if (!checked.ok) {
    return { status: "error", values: checked.values, fieldErrors: checked.fieldErrors };
  }

  await updateMonthStartDay(getDb(), userId, checked.value.monthStartDay);
  // Every report and the entry list group by this day.
  revalidatePath("/", "layout");
  return { status: "saved" };
}

export async function updateAlertSettingsAction(
  _previous: AlertFormState,
  formData: FormData,
): Promise<AlertFormState> {
  const { userId } = await requireUser();
  const checked = validateAlertSettings(formData);
  if (!checked.ok) {
    return { status: "error", values: checked.values, fieldErrors: checked.fieldErrors };
  }

  await updateAlertSettings(getDb(), userId, checked.value);
  // Alerts are drawn by the layout, so every page must pick up the change.
  revalidatePath("/", "layout");
  return { status: "saved" };
}
