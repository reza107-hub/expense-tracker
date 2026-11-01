import { Stack, useLocalSearchParams } from "expo-router";
import { Plus, Save } from "lucide-react-native";
import { useState } from "react";
import Button from "@/components/button";
import { ChoiceField, TextField } from "@/components/fields";
import Screen from "@/components/screen";
import { ErrorText } from "@/components/ui";
import { useI18n } from "@/i18n";
import { post, put } from "@/lib/api";
import { formatTaka } from "@/lib/money";
import type { Wallet } from "@/lib/types";
import { parseParam, useForm } from "@/lib/use-form";

const PRESETS = ["Cash", "Bank", "bKash", "Nagad", "Rocket", "Upay", "Crypto"];

export default function WalletFormScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ wallet?: string }>();
  const existing = parseParam<Wallet>(params.wallet);
  const { fieldErrors, formError, run } = useForm();
  const [name, setName] = useState(existing?.name ?? "");
  const [balance, setBalance] = useState(existing ? formatTaka(existing.openingBalance).replace(/,/g, "") : "");

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t("wallets.edit.title") : t("wallets.add.title") }} />
      {!existing ? (
        <ChoiceField
          label={t("wallets.add.quickPick")}
          value={PRESETS.includes(name) ? name : null}
          onChange={setName}
          options={PRESETS.map((preset) => ({ value: preset, label: preset }))}
        />
      ) : null}
      <TextField
        label={t("wallets.name")}
        value={name}
        onChangeText={setName}
        hint={existing ? undefined : t("wallets.add.nameHint")}
        error={fieldErrors.name}
        maxLength={40}
        autoCapitalize="words"
      />
      <TextField
        label={t("common.openingBalanceTaka")}
        value={balance}
        onChangeText={setBalance}
        keyboardType="decimal-pad"
        hint={existing ? t("wallets.edit.balanceHint") : t("wallets.add.balanceHint")}
        error={fieldErrors.openingBalance}
      />
      <ErrorText>{formError}</ErrorText>
      <Button
        label={existing ? t("common.save") : t("wallets.add.submit")}
        pendingLabel={existing ? t("common.saving") : t("common.adding")}
        icon={existing ? Save : Plus}
        onPress={() =>
          run(() =>
            existing
              ? put(`/wallets/${existing.id}`, { name, openingBalance: balance })
              : post("/wallets", { name, openingBalance: balance }),
          )
        }
      />
    </Screen>
  );
}
