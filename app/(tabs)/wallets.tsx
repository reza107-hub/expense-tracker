import { useRouter } from "expo-router";
import { ArchiveRestore, Pencil, Plus } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import Button from "@/components/button";
import { Money } from "@/components/money";
import { Row } from "@/components/pieces";
import Screen, { QueryState } from "@/components/screen";
import { Body, Card, Divider, ErrorText, Heading, Muted, Title } from "@/components/ui";
import { useI18n } from "@/i18n";
import { post } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import type { Wallet } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Response = { active: Wallet[]; archived: Wallet[]; total: number };

export default function WalletsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { data, error, loading, refreshing, refresh, reload } = useApi<Response>("/wallets");
  const [problem, setProblem] = useState<string | null>(null);

  async function change(wallet: Wallet, action: "archive" | "restore") {
    setProblem(null);
    try {
      await post(`/wallets/${wallet.id}/${action}`);
      await reload();
    } catch (failure) {
      setProblem(messageFor(failure, t));
    }
  }

  return (
    <Screen topInset onRefresh={refresh} refreshing={refreshing}>
      <View>
        <Title>{t("nav.wallets")}</Title>
        <Muted>{t("wallets.description")}</Muted>
      </View>
      <Button label={t("wallets.add.title")} icon={Plus} onPress={() => router.push("/wallet-form")} />
      <QueryState loading={loading} error={error} hasData={!!data} onRetry={reload}>
        {data ? (
          <>
            <Card>
              <Muted>{t("wallets.totalBalance")}</Muted>
              <Money poisha={data.total} style={{ fontSize: 28, fontWeight: "700" }} />
            </Card>
            <ErrorText>{problem}</ErrorText>
            <Heading>{t("wallets.yourWallets")}</Heading>
            {data.active.length === 0 ? (
              <Card>
                <Body>{t("wallets.empty")}</Body>
              </Card>
            ) : (
              data.active.map((wallet) => (
                <Card key={wallet.id}>
                  <Row left={<Body>{wallet.name}</Body>} right={<Money poisha={wallet.balance} />} />
                  <Divider />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Button
                      label={t("common.edit")}
                      icon={Pencil}
                      variant="quiet"
                      small
                      onPress={() => router.push({ pathname: "/wallet-form", params: { wallet: JSON.stringify(wallet) } })}
                    />
                    <Button label={t("common.archive")} pendingLabel={t("common.archiving")} variant="quiet" small onPress={() => change(wallet, "archive")} />
                  </View>
                </Card>
              ))
            )}
            {data.archived.length > 0 ? (
              <>
                <Heading>{t("wallets.archivedTitle")}</Heading>
                {data.archived.map((wallet) => (
                  <Card key={wallet.id}>
                    <Row left={<Body>{wallet.name}</Body>} right={<Money poisha={wallet.balance} />} />
                    <Button
                      label={t("common.restore")}
                      pendingLabel={t("common.restoring")}
                      icon={ArchiveRestore}
                      variant="quiet"
                      small
                      onPress={() => change(wallet, "restore")}
                    />
                  </Card>
                ))}
              </>
            ) : null}
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
