import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import AlertBanners from "@/components/alert-banners";
import Button from "@/components/button";
import { Money } from "@/components/money";
import { Row } from "@/components/pieces";
import Screen, { QueryState } from "@/components/screen";
import { Body, Card, Divider, Heading, Muted, Title } from "@/components/ui";
import { useI18n } from "@/i18n";
import { monthName } from "@/lib/dates";
import type { Alerts, Overview } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function HomeScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { data, error, loading, refreshing, refresh, reload } = useApi<{ overview: Overview; alerts: Alerts }>("/dashboard");

  return (
    <Screen topInset onRefresh={refresh} refreshing={refreshing}>
      <View>
        <Title>{t("nav.home")}</Title>
        <Muted>{t("home.description")}</Muted>
      </View>
      <QueryState loading={loading} error={error} hasData={!!data} onRetry={reload}>
        {data ? (
          <>
            <AlertBanners alerts={data.alerts} />
            <Card>
              <Muted>{t("home.currentBalance")}</Muted>
              <Money poisha={data.overview.totalBalance} style={styles.big} />
              <Divider />
              <Row left={<Muted>{t("home.netPosition")}</Muted>} right={<Money poisha={data.overview.netPosition} />} />
              <Row left={<Muted>{t("home.youOwe")}</Muted>} right={<Money poisha={data.overview.owe} />} />
              <Row left={<Muted>{t("home.othersOweYou")}</Muted>} right={<Money poisha={data.overview.owed} />} />
            </Card>
            <Card>
              <Muted>{t("home.spendingIn", { month: monthName(data.overview.period.year, data.overview.period.month, t) })}</Muted>
              <Money poisha={data.overview.monthSpending} style={styles.big} />
              <Button label={t("home.seeReport")} variant="quiet" small onPress={() => router.push("/reports")} />
            </Card>
            <Card>
              <Heading>{t("home.wallets")}</Heading>
              {data.overview.wallets.length === 0 ? (
                <>
                  <Body>{t("home.noWallets")}</Body>
                  <Button label={t("home.addWalletLink")} icon={Plus} variant="quiet" small onPress={() => router.push("/wallet-form")} />
                </>
              ) : (
                data.overview.wallets.map((wallet) => (
                  <Row key={wallet.id} left={<Body>{wallet.name}</Body>} right={<Money poisha={wallet.balance} />} />
                ))
              )}
            </Card>
            <Button label={t("home.addEntry")} icon={Plus} fullWidth onPress={() => router.push("/entry-form")} />
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 28, fontWeight: "700" },
});
