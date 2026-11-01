import { useLocalSearchParams } from "expo-router";
import { Save } from "lucide-react-native";
import { useState } from "react";
import Button from "@/components/button";
import { ChoiceField, TextField } from "@/components/fields";
import Screen, { QueryState } from "@/components/screen";
import { Body, ErrorText, Muted } from "@/components/ui";
import { useI18n } from "@/i18n";
import { post } from "@/lib/api";
import { todayInDhaka } from "@/lib/dates";
import { formatTaka } from "@/lib/money";
import type { Wallet } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useForm } from "@/lib/use-form";

export default function RepayScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ loanId: string; direction: "borrowed" | "lent"; counterparty: string; outstanding: string }>();
  const wallets = useApi<{ active: Wallet[] }>("/wallets");
  const { fieldErrors, formError, run } = useForm();
  const borrowed = params.direction === "borrowed";

  const [walletId, setWalletId] = useState<number | null>(null);
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const [entryDate, setEntryDate] = useState(todayInDhaka());
  const [note, setNote] = useState("");

  return (
    <Screen>
      <Body>{params.counterparty}</Body>
      <Muted>{t("loans.repayForm.outstanding", { amount: formatTaka(Number(params.outstanding ?? 0)) })}</Muted>
      <QueryState loading={wallets.loading} error={wallets.error} hasData={!!wallets.data} onRetry={wallets.reload}>
        <ChoiceField
          label={borrowed ? t("entries.field.payFrom") : t("loans.repayForm.receiveInto")}
          value={walletId}
          onChange={setWalletId}
          options={(wallets.data?.active ?? []).map((w) => ({ value: w.id, label: w.name }))}
          error={fieldErrors.walletId}
        />
        <TextField label={t("loans.repayForm.principal")} value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" error={fieldErrors.principal} />
        <TextField
          label={borrowed ? t("loans.repayForm.feePaid") : t("loans.repayForm.interestReceived")}
          value={interest}
          onChangeText={setInterest}
          keyboardType="decimal-pad"
          hint={borrowed ? t("loans.repayForm.feeHint") : t("loans.repayForm.interestHint")}
          error={fieldErrors.interest}
        />
        <TextField label={t("common.date")} value={entryDate} onChangeText={setEntryDate} hint={t("common.dateHint")} error={fieldErrors.entryDate} autoCapitalize="none" maxLength={10} />
        <TextField label={t("common.noteOptional")} value={note} onChangeText={setNote} error={fieldErrors.note} maxLength={200} />
        <ErrorText>{formError}</ErrorText>
        <Button
          label={t("loans.repayForm.save")}
          pendingLabel={t("common.saving")}
          icon={Save}
          onPress={() => run(() => post(`/loans/${params.loanId}/repayments`, { walletId, principal, interest, entryDate, note }))}
        />
      </QueryState>
    </Screen>
  );
}
