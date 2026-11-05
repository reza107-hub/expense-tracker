import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Plus, Save, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import Button from "@/components/button";
import { ChoiceField, TextField } from "@/components/fields";
import { ConfirmAction } from "@/components/pieces";
import Screen, { QueryState } from "@/components/screen";
import { Body, Card, ErrorText, Muted } from "@/components/ui";
import { useI18n } from "@/i18n";
import { del, post, put } from "@/lib/api";
import { todayInDhaka } from "@/lib/dates";
import { messageFor } from "@/lib/errors";
import { formatTaka } from "@/lib/money";
import type { Category, ListedEntry, Wallet } from "@/lib/types";
import { parseParam, useForm } from "@/lib/use-form";
import { useApi } from "@/lib/use-api";
import { colors } from "@/theme/colors";

type Kind = "expense" | "income" | "transfer" | "adjustment";
const KINDS: Kind[] = ["expense", "income", "transfer", "adjustment"];

export default function EntryFormScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ entry?: string }>();
  const existing = parseParam<ListedEntry>(params.entry);
  const editing = existing !== null;

  const wallets = useApi<{ active: Wallet[] }>("/wallets");
  const categories = useApi<{ active: Category[] }>("/categories");
  const { fieldErrors, formError, run } = useForm();

  const [kind, setKind] = useState<Kind>((existing?.type as Kind | undefined) ?? "expense");
  const [walletId, setWalletId] = useState<number | null>(existing?.walletId ?? null);
  const [toWalletId, setToWalletId] = useState<number | null>(existing?.toWalletId ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(existing?.categoryId ?? null);
  const [amount, setAmount] = useState(existing ? formatTaka(existing.amount).replace(/,/g, "") : "");
  const [charge, setCharge] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [entryDate, setEntryDate] = useState(existing?.entryDate ?? todayInDhaka());
  const [note, setNote] = useState(existing?.note ?? "");
  const [lowBalance, setLowBalance] = useState<{ walletName: string; balanceAfter: number } | null>(null);

  const walletOptions = (wallets.data?.active ?? []).map((w) => ({ value: w.id, label: w.name }));
  const categoryOptions = (categories.data?.active ?? []).filter((c) => !c.isReserved).map((c) => ({ value: c.id, label: c.name }));

  function body(confirmLowBalance: boolean) {
    const common = { walletId, entryDate, note, ...(confirmLowBalance ? { confirmLowBalance: true } : {}) };
    switch (kind) {
      case "expense":
        return { type: kind, ...common, categoryId, amount, charge };
      case "income":
        return { type: kind, ...common, amount };
      case "transfer":
        return { type: kind, ...common, toWalletId, amount, charge };
      case "adjustment":
        return editing ? { type: kind, ...common, amount } : { type: kind, ...common, newBalance };
    }
  }

  async function save(confirmLowBalance: boolean) {
    await run(
      () => (editing ? put(`/entries/${existing.id}`, body(confirmLowBalance)) : post("/entries", body(confirmLowBalance))),
      {
        onError: (error) => {
          if (error.code !== "LOW_BALANCE") return false;
          setLowBalance({ walletName: String(error.extra.walletName ?? ""), balanceAfter: Number(error.extra.balanceAfter ?? 0) });
          return true;
        },
      },
    );
  }

  const kindLabel: Record<Kind, string> = {
    expense: t("entries.tab.expense"),
    income: t("entries.tab.income"),
    transfer: t("entries.tab.transfer"),
    adjustment: t("entries.tab.adjustment"),
  };
  const submitLabel = {
    expense: t("entries.submit.expense"),
    income: t("entries.submit.income"),
    transfer: t("entries.submit.transfer"),
    adjustment: t("entries.submit.adjustment"),
  }[kind];

  const loaded = !!wallets.data && !!categories.data;

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? t("entries.edit.title") : t("entries.add.title") }} />
      <QueryState
        loading={wallets.loading || categories.loading}
        error={wallets.error ?? categories.error}
        hasData={loaded}
        onRetry={async () => {
          await Promise.all([wallets.reload(), categories.reload()]);
        }}
      >
        {loaded && walletOptions.length === 0 ? (
          <Card>
            <Body>{t("entries.needWallet")}</Body>
            <Button label={t("wallets.add.title")} icon={Plus} variant="quiet" small onPress={() => router.replace("/wallet-form")} />
          </Card>
        ) : null}
        {loaded && walletOptions.length > 0 ? (
          <>
            {!editing ? (
              <ChoiceField label={t("entries.form.typeGroup")} value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: kindLabel[k] }))} />
            ) : (
              <Muted>{kindLabel[kind]}</Muted>
            )}

            <ChoiceField
              label={kind === "transfer" ? t("entries.field.fromWallet") : kind === "expense" ? t("entries.field.payFrom") : kind === "income" ? t("entries.field.addTo") : t("entries.field.wallet")}
              value={walletId}
              onChange={setWalletId}
              options={walletOptions}
              error={fieldErrors.walletId}
            />
            {kind === "transfer" ? (
              <ChoiceField label={t("entries.field.toWallet")} value={toWalletId} onChange={setToWalletId} options={walletOptions} error={fieldErrors.toWalletId} />
            ) : null}
            {kind === "expense" ? (
              <ChoiceField label={t("entries.field.category")} value={categoryId} onChange={setCategoryId} options={categoryOptions} error={fieldErrors.categoryId} />
            ) : null}

            {kind === "adjustment" && !editing ? (
              <TextField
                label={t("entries.field.newBalance")}
                value={newBalance}
                onChangeText={setNewBalance}
                keyboardType="numbers-and-punctuation"
                hint={t("entries.field.newBalanceHint")}
                error={fieldErrors.newBalance}
              />
            ) : (
              <TextField
                label={kind === "adjustment" ? t("entries.field.balanceChange") : t("common.amountTaka")}
                value={amount}
                onChangeText={setAmount}
                keyboardType={kind === "adjustment" ? "numbers-and-punctuation" : "decimal-pad"}
                hint={kind === "adjustment" ? t("entries.field.balanceChangeHint") : undefined}
                error={fieldErrors.amount}
              />
            )}
            {!editing && (kind === "expense" || kind === "transfer") ? (
              <TextField
                label={t("entries.field.chargeOptional")}
                value={charge}
                onChangeText={setCharge}
                keyboardType="decimal-pad"
                hint={t("entries.field.chargeHint")}
                error={fieldErrors.charge}
              />
            ) : null}
            <TextField label={t("common.date")} value={entryDate} onChangeText={setEntryDate} hint={t("common.dateHint")} error={fieldErrors.entryDate} autoCapitalize="none" maxLength={10} />
            <TextField label={t("common.noteOptional")} value={note} onChangeText={setNote} error={fieldErrors.note} maxLength={200} autoCapitalize="sentences" />

            <ErrorText>{formError}</ErrorText>

            {lowBalance ? (
              <Card style={{ borderColor: colors.warning }}>
                <Body>{t("entries.lowBalance", { wallet: lowBalance.walletName, amount: formatTaka(lowBalance.balanceAfter) })}</Body>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button label={t("entries.saveAnyway")} pendingLabel={t("common.saving")} variant="warning" small onPress={() => save(true)} />
                  <Button label={t("common.cancel")} variant="quiet" small onPress={() => setLowBalance(null)} />
                </View>
              </Card>
            ) : (
              <Button
                label={editing ? t("common.save") : submitLabel}
                pendingLabel={t("common.saving")}
                icon={editing ? Save : Plus}
                onPress={() => save(false)}
              />
            )}

            {editing ? (
              <ConfirmAction
                label={t("common.delete")}
                icon={Trash2}
                small={false}
                message={t("entries.row.deleteConfirm")}
                confirmLabel={t("common.yesDelete")}
                pendingLabel={t("common.deleting")}
                describeError={(failure) => messageFor(failure, t)}
                onConfirm={async () => {
                  await del(`/entries/${existing.id}`);
                  router.back();
                }}
              />
            ) : null}
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
