"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateAlertSettingsAction } from "@/actions/settings";
import InputField from "@/components/forms/input-field";
import type { AlertFormState } from "@/lib/settings/validation";
import { useT } from "@/i18n/client";

const initialState: AlertFormState = { status: "idle" };

type Props = {
  alertsEnabled: boolean;
  /** The saved limit as typed text, or empty when none is set. */
  monthlyLimit: string;
};

export default function AlertsForm({ alertsEnabled, monthlyLimit }: Props) {
  const t = useT();
  const [state, formAction, pending] = useActionState(updateAlertSettingsAction, initialState);
  const failed = state.status === "error" ? state : null;
  const enabled = failed?.values.alertsEnabled ?? alertsEnabled;

  return (
    <form
      action={formAction}
      // Remounted after a failed save so the switch shows what was submitted.
      key={failed ? `error-${String(failed.values.alertsEnabled)}` : "ok"}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <h2 className="text-base font-semibold tracking-tight">{t("settings.alerts.title")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("settings.alerts.intro")}
      </p>

      <label className="flex items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          name="alertsEnabled"
          defaultChecked={enabled}
          className="size-4 accent-primary"
        />
        {t("settings.alerts.turnOn")}
      </label>

      <InputField
        id="monthly-limit"
        name="monthlyLimit"
        label={t("settings.alerts.limit")}
        inputMode="decimal"
        defaultValue={failed?.values.monthlyLimit ?? monthlyLimit}
        error={failed?.fieldErrors.monthlyLimit}
        hint={t("settings.alerts.limitHint")}
      />

      {state.status === "saved" ? (
        <p role="status" className="text-sm text-success">
          {t("common.saved")}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        <Save className="size-4" aria-hidden="true" />
        {pending ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}
