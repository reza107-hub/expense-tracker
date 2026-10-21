"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateMonthStartDayAction } from "@/actions/settings";
import InputField from "@/components/forms/input-field";
import type { SettingsFormState } from "@/lib/settings/validation";

const initialState: SettingsFormState = { status: "idle" };

export default function MonthStartForm({ monthStartDay }: { monthStartDay: number }) {
  const [state, formAction, pending] = useActionState(updateMonthStartDayAction, initialState);
  const failed = state.status === "error" ? state : null;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <h2 className="text-base font-semibold tracking-tight">Month start day</h2>
      <InputField
        id="month-start-day"
        name="monthStartDay"
        label="Day your month starts (1 to 28)"
        inputMode="decimal"
        required
        maxLength={2}
        defaultValue={failed?.values.monthStartDay ?? String(monthStartDay)}
        error={failed?.fieldErrors.monthStartDay}
        hint="For example, 25 if you are paid on the 25th. October then runs from 25 October to 24 November. Your entries do not change."
      />
      {state.status === "saved" ? (
        <p role="status" className="text-sm text-success">
          Saved.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        <Save className="size-4" aria-hidden="true" />
        {pending ? "Saving" : "Save"}
      </button>
    </form>
  );
}
