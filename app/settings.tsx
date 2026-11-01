import { Save } from "lucide-react-native";
import { useEffect, useState } from "react";
import Button from "@/components/button";
import { SwitchField, TextField } from "@/components/fields";
import Screen, { QueryState } from "@/components/screen";
import { Card, ErrorText, Heading, Muted, SuccessText } from "@/components/ui";
import { useI18n } from "@/i18n";
import { ApiError, put } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import { formatTaka } from "@/lib/money";
import { useApi } from "@/lib/use-api";

type Settings = { monthStartDay: number; alertsEnabled: boolean; monthlyLimit: number | null };

export default function SettingsScreen() {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh, reload } = useApi<Settings>("/settings");
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Muted>{t("settings.description")}</Muted>
      <QueryState loading={loading} error={error} hasData={!!data} onRetry={reload}>
        {data ? (
          <>
            <MonthStartCard initial={data.monthStartDay} />
            <AlertsCard initial={data} />
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}

/** Saves one settings form and keeps its own message, so the two cards never mix. */
function useSave() {
  const { t } = useI18n();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(send: () => Promise<unknown>) {
    setFieldErrors({});
    setFormError(null);
    setSaved(false);
    try {
      await send();
      setSaved(true);
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fieldErrors).length > 0) setFieldErrors(failure.fieldErrors);
      else setFormError(messageFor(failure, t));
    }
  }
  return { fieldErrors, formError, saved, save };
}

function MonthStartCard({ initial }: { initial: number }) {
  const { t } = useI18n();
  const [day, setDay] = useState(String(initial));
  const { fieldErrors, formError, saved, save } = useSave();
  return (
    <Card>
      <Heading>{t("settings.monthStart.title")}</Heading>
      <TextField
        label={t("settings.monthStart.label")}
        value={day}
        onChangeText={setDay}
        keyboardType="number-pad"
        hint={t("settings.monthStart.hint")}
        error={fieldErrors.monthStartDay}
        maxLength={2}
      />
      <ErrorText>{formError}</ErrorText>
      {saved ? <SuccessText>{t("settings.saved")}</SuccessText> : null}
      <Button label={t("common.save")} pendingLabel={t("common.saving")} icon={Save} onPress={() => save(() => put("/settings/month-start-day", { monthStartDay: day }))} />
    </Card>
  );
}

function AlertsCard({ initial }: { initial: Settings }) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(initial.alertsEnabled);
  const [limit, setLimit] = useState(initial.monthlyLimit ? formatTaka(initial.monthlyLimit).replace(/,/g, "") : "");
  const { fieldErrors, formError, saved, save } = useSave();
  useEffect(() => {
    setEnabled(initial.alertsEnabled);
  }, [initial.alertsEnabled]);
  return (
    <Card>
      <Heading>{t("settings.alerts.title")}</Heading>
      <Muted>{t("settings.alerts.intro")}</Muted>
      <SwitchField label={t("settings.alerts.turnOn")} value={enabled} onChange={setEnabled} />
      <TextField
        label={t("settings.alerts.limit")}
        value={limit}
        onChangeText={setLimit}
        keyboardType="decimal-pad"
        hint={t("settings.alerts.limitHint")}
        error={fieldErrors.monthlyLimit}
      />
      <ErrorText>{formError}</ErrorText>
      {saved ? <SuccessText>{t("settings.saved")}</SuccessText> : null}
      <Button label={t("common.save")} pendingLabel={t("common.saving")} icon={Save} onPress={() => save(() => put("/settings/alerts", { alertsEnabled: enabled, monthlyLimit: limit }))} />
    </Card>
  );
}
