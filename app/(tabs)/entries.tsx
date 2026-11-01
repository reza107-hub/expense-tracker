import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Button from "@/components/button";
import { ChoiceField } from "@/components/fields";
import { Money } from "@/components/money";
import { MonthNav } from "@/components/pieces";
import Screen, { QueryState } from "@/components/screen";
import { Body, Card, Muted, Title } from "@/components/ui";
import { useI18n } from "@/i18n";
import { formatDate, monthKey, monthName, shiftMonth } from "@/lib/dates";
import { entryLabel, isPlainEntry, signedAmount } from "@/lib/entries";
import type { Category, ListedEntry, Period, Wallet } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { colors } from "@/theme/colors";

type Response = {
  period: Period;
  today: string;
  entries: ListedEntry[];
  wallets: (Pick<Wallet, "id" | "name"> & { archived: boolean })[];
  categories: (Pick<Category, "id" | "name"> & { archived: boolean; reserved: boolean })[];
};

export default function EntriesScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [month, setMonth] = useState<{ year: number; month: number } | null>(null);
  const [walletId, setWalletId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (month) params.set("month", monthKey(month.year, month.month));
  if (walletId !== null) params.set("wallet", String(walletId));
  if (categoryId !== null) params.set("category", String(categoryId));
  const query = params.toString();
  const { data, error, loading, refreshing, refresh, reload } = useApi<Response>(`/entries${query ? `?${query}` : ""}`);

  const current = data?.period ?? null;
  const shown = month ?? (current ? { year: current.year, month: current.month } : null);
  const filtered = walletId !== null || categoryId !== null;

  return (
    <Screen topInset onRefresh={refresh} refreshing={refreshing}>
      <View>
        <Title>{t("nav.entries")}</Title>
        <Muted>{t("entries.description")}</Muted>
      </View>
      <Button label={t("entries.add")} icon={Plus} onPress={() => router.push("/entry-form")} />

      {shown ? (
        <MonthNav
          label={monthName(shown.year, shown.month, t)}
          onPrevious={() => setMonth(shiftMonth(shown.year, shown.month, -1))}
          onNext={() => setMonth(shiftMonth(shown.year, shown.month, 1))}
        />
      ) : null}

      <QueryState loading={loading} error={error} hasData={!!data} onRetry={reload}>
        {data ? (
          <>
            <ChoiceField
              label={t("entries.list.filterWallet")}
              value={walletId ?? 0}
              onChange={(id) => setWalletId(id === 0 ? null : id)}
              options={[{ value: 0, label: t("entries.list.allWallets") }, ...data.wallets.map((w) => ({ value: w.id, label: w.name }))]}
            />
            <ChoiceField
              label={t("entries.list.filterCategory")}
              value={categoryId ?? 0}
              onChange={(id) => setCategoryId(id === 0 ? null : id)}
              options={[{ value: 0, label: t("entries.list.allCategories") }, ...data.categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
            {data.entries.length === 0 ? (
              <Card>
                <Body>
                  {filtered ? t("entries.list.noMatch") : t("entries.list.none", { month: monthName(data.period.year, data.period.month, t) })}
                </Body>
              </Card>
            ) : (
              <Card style={styles.list}>
                {data.entries.map((entry, index) => (
                  <EntryRow key={entry.id} entry={entry} first={index === 0} onOpen={() => router.push({ pathname: "/entry-form", params: { entry: JSON.stringify(entry) } })} />
                ))}
              </Card>
            )}
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}

function EntryRow({ entry, first, onOpen }: { entry: ListedEntry; first: boolean; onOpen: () => void }) {
  const { t } = useI18n();
  const signed = signedAmount(entry);
  const editable = isPlainEntry(entry);
  const detail =
    entry.type === "transfer"
      ? t("entries.row.route", { from: entry.walletName, to: entry.toWalletName ?? "" })
      : [entry.categoryName ?? entry.loanCounterparty, entry.walletName].filter(Boolean).join(" · ");

  return (
    <Pressable
      accessibilityRole={editable ? "button" : "text"}
      onPress={editable ? onOpen : undefined}
      style={({ pressed }) => [styles.entry, !first && styles.entryBorder, pressed && editable && { opacity: 0.8 }]}
    >
      <View style={styles.entryLeft}>
        <Text style={styles.entryTitle}>{entryLabel(entry, t)}</Text>
        <Muted>{detail}</Muted>
        {entry.note ? <Muted>{entry.note}</Muted> : null}
        <Muted>{formatDate(entry.entryDate, t)}</Muted>
      </View>
      {signed === null ? <Money poisha={entry.amount} /> : <Money poisha={signed} signed />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, gap: 0 },
  entry: { flexDirection: "row", gap: 12, justifyContent: "space-between", alignItems: "flex-start", padding: 14 },
  entryBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  entryLeft: { flex: 1, gap: 2 },
  entryTitle: { color: colors.foreground, fontSize: 15, fontWeight: "600" },
});
