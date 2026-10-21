import { getSettings } from "@/data/settings";
import { formatTaka } from "@/lib/money";
import AlertsForm from "./alerts-form";
import MonthStartForm from "./month-start-form";

export default async function SettingsContent() {
  const { monthStartDay, alertsEnabled, monthlyLimit } = await getSettings();
  return (
    <>
      <MonthStartForm monthStartDay={monthStartDay} />
      <AlertsForm
        alertsEnabled={alertsEnabled}
        monthlyLimit={monthlyLimit === null ? "" : formatTaka(monthlyLimit)}
      />
    </>
  );
}
