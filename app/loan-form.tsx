import { Stack, useLocalSearchParams } from "expo-router";
import { Plus, Save } from "lucide-react-native";
import { useState } from "react";
import Button from "@/components/button";
import { ChoiceField, TextField } from "@/components/fields";
import Screen, { QueryState } from "@/components/screen";
import { ErrorText, Muted } from "@/components/ui";
import { useI18n } from "@/i18n";
import { post, put } from "@/lib/api";
import { todayInDhaka } from "@/lib/dates";
import type { Loan, Wallet } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { parseParam, useForm } from "@/lib/use-form";

export default function LoanFormScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ loan?: string }>();
  const existing = parseParam<Loan>(params.loan);
  const wallets = useApi<{ active: Wallet[] }>(existing ? null : "/wallets");
  const { fieldErrors, formError, run } = useForm();

  const [direction, setDirection] = useState<"borrowed" | "lent" | null>(existing?.direction ?? null);
  const [counterparty, setCounterparty] = useState(existing?.counterparty ?? "");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState<number | null>(null);
  const [entryDate, setEntryDate] = useState(todayInDhaka());
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? "");
  const [note, setNote] = useState(existing?.note ?? "");

  const ready = existing ? true : !!wallets.data;

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t("loans.edit.title") : t("loans.add.title") }} />
      <QueryState loading={!existing && wallets.loading} error={wallets.error} hasData={ready} onRetry={wallets.reload}>
        {!existing ? (
          <ChoiceField
            label={t("loans.add.type")}
            value={direction}
            onChange={setDirection}
            options={[
              { value: "borrowed", label: t("loans.add.borrowed") },
              { value: "lent", label: t("loans.add.lent") },
            ]}
            error={fieldErrors.direction}
          />
        ) : null}
        <TextField
          label={t("loans.add.whoWith")}
          value={counterparty}
          onChangeText={setCounterparty}
          hint={t("loans.add.whoWithHint")}
          error={fieldErrors.counterparty}
          maxLength={60}
          autoCapitalize="words"
        />
        {!existing ? (
          <>
            <TextField label={t("loans.add.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={fieldErrors.amount} />
            <ChoiceField
              label={t("common.chooseWallet")}
              value={walletId}
              onChange={setWalletId}
              options={(wallets.data?.active ?? []).map((w) => ({ value: w.id, label: w.name }))}
              hint={t("loans.add.walletHint")}
              error={fieldErrors.walletId}
            />
            <TextField label={t("loans.add.date")} value={entryDate} onChangeText={setEntryDate} hint={t("common.dateHint")} error={fieldErrors.entryDate} autoCapitalize="none" maxLength={10} />
          </>
        ) : (
          <Muted>{t("loans.editHint")}</Muted>
        )}
        <TextField label={t("common.dueDateOptional")} value={dueDate} onChangeText={setDueDate} hint={t("common.dateHint")} error={fieldErrors.dueDate} autoCapitalize="none" maxLength={10} />
        <TextField label={t("common.noteOptional")} value={note} onChangeText={setNote} error={fieldErrors.note} maxLength={200} />
        <ErrorText>{formError}</ErrorText>
        <Button
          label={existing ? t("common.save") : t("loans.add.submit")}
          pendingLabel={t("common.saving")}
          icon={existing ? Save : Plus}
          onPress={() =>
            run(() =>
              existing
                ? put(`/loans/${existing.id}`, { counterparty, dueDate, note })
                : post("/loans", { direction, counterparty, amount, walletId, entryDate, dueDate, note }),
            )
          }
        />
      </QueryState>
    </Screen>
  );
}
