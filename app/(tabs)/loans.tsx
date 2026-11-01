import { useRouter } from "expo-router";
import { HandCoins, Pencil, Plus, Trash2 } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import Button from "@/components/button";
import { Money } from "@/components/money";
import { ConfirmAction, Row } from "@/components/pieces";
import Screen, { QueryState } from "@/components/screen";
import { Body, Card, Divider, Heading, Muted, Title } from "@/components/ui";
import { useI18n } from "@/i18n";
import { del } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { messageFor } from "@/lib/errors";
import { formatTaka as formatMoney } from "@/lib/money";
import type { Loan, Repayment } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { colors } from "@/theme/colors";

type Response = { loans: Loan[]; repayments: Repayment[]; totals: { owe: number; owed: number }; today: string };

export default function LoansScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { data, error, loading, refreshing, refresh, reload } = useApi<Response>("/loans");

  const open = data?.loans.filter((loan) => loan.status === "open") ?? [];
  const closed = data?.loans.filter((loan) => loan.status === "closed") ?? [];

  return (
    <Screen topInset onRefresh={refresh} refreshing={refreshing}>
      <View>
        <Title>{t("nav.loans")}</Title>
        <Muted>{t("loans.description")}</Muted>
      </View>
      <Button label={t("loans.add.title")} icon={Plus} onPress={() => router.push("/loan-form")} />
      <QueryState loading={loading} error={error} hasData={!!data} onRetry={reload}>
        {data ? (
          <>
            <Card>
              <Heading>{t("loans.totals")}</Heading>
              <Row left={<Muted>{t("loans.owe")}</Muted>} right={<Money poisha={data.totals.owe} />} />
              <Row left={<Muted>{t("loans.owed")}</Muted>} right={<Money poisha={data.totals.owed} />} />
            </Card>
            <Heading>{t("loans.open")}</Heading>
            {open.length === 0 ? (
              <Card>
                <Body>{t("loans.emptyOpen")}</Body>
              </Card>
            ) : (
              open.map((loan) => <LoanCard key={loan.id} loan={loan} data={data} reload={reload} />)
            )}
            {closed.length > 0 ? (
              <>
                <Heading>{t("loans.closed")}</Heading>
                {closed.map((loan) => (
                  <LoanCard key={loan.id} loan={loan} data={data} reload={reload} />
                ))}
              </>
            ) : null}
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}

function LoanCard({ loan, data, reload }: { loan: Loan; data: Response; reload: () => Promise<void> }) {
  const { t } = useI18n();
  const router = useRouter();
  const repayments = data.repayments.filter((r) => r.loanId === loan.id);
  const overdue = loan.status === "open" && loan.dueDate !== null && loan.dueDate < data.today;
  const describe = (failure: unknown) => messageFor(failure, t);

  return (
    <Card>
      <Row
        left={
          <>
            <Body style={styles.name}>{loan.counterparty}</Body>
            <Muted>
              {loan.startDate
                ? t(loan.direction === "borrowed" ? "loans.card.borrowedOn" : "loans.card.lentOn", { date: formatDate(loan.startDate, t) })
                : t(loan.direction === "borrowed" ? "loans.card.borrowed" : "loans.card.lent")}
            </Muted>
          </>
        }
        right={<Muted>{t(loan.status === "open" ? "loans.status.open" : "loans.status.closed")}</Muted>}
      />
      <Row left={<Muted>{t("loans.figure.original")}</Muted>} right={<Money poisha={loan.principal} />} />
      <Row left={<Muted>{t("loans.figure.repaid")}</Muted>} right={<Money poisha={loan.repaid} />} />
      <Row left={<Muted>{t("loans.figure.outstanding")}</Muted>} right={<Money poisha={loan.outstanding} />} />
      {loan.dueDate ? (
        <Body style={overdue ? { color: colors.destructive } : undefined}>
          {t(overdue ? "loans.dueOverdue" : "loans.due", { date: formatDate(loan.dueDate, t) })}
        </Body>
      ) : null}
      {loan.note ? <Muted>{loan.note}</Muted> : null}

      {repayments.length > 0 ? (
        <>
          <Divider />
          <Heading>{t("loans.repayments")}</Heading>
          {repayments.map((repayment) => (
            <View key={repayment.id} style={styles.repayment}>
              <Row
                left={
                  <>
                    <Body>
                      {repayment.fee > 0
                        ? t(loan.direction === "borrowed" ? "loans.repayment.withFee" : "loans.repayment.withInterest", {
                            principal: formatMoney(repayment.principal),
                            fee: formatMoney(repayment.fee),
                          })
                        : `৳ ${formatMoney(repayment.principal)}`}
                    </Body>
                    <Muted>{`${formatDate(repayment.entryDate, t)} · ${repayment.walletName}`}</Muted>
                    {repayment.note ? <Muted>{repayment.note}</Muted> : null}
                  </>
                }
              />
              <ConfirmAction
                label={t("common.delete")}
                icon={Trash2}
                message={t("loans.repayment.deleteConfirm")}
                confirmLabel={t("common.yesDelete")}
                pendingLabel={t("common.deleting")}
                describeError={describe}
                onConfirm={async () => {
                  await del(`/repayments/${repayment.id}`);
                  await reload();
                }}
              />
            </View>
          ))}
        </>
      ) : null}

      <Divider />
      <View style={styles.actions}>
        {loan.status === "open" ? (
          <Button
            label={t("loans.repay")}
            icon={HandCoins}
            small
            onPress={() =>
              router.push({
                pathname: "/repay",
                params: { loanId: String(loan.id), direction: loan.direction, counterparty: loan.counterparty, outstanding: String(loan.outstanding) },
              })
            }
          />
        ) : null}
        <Button
          label={t("loans.edit")}
          icon={Pencil}
          variant="quiet"
          small
          onPress={() => router.push({ pathname: "/loan-form", params: { loan: JSON.stringify(loan) } })}
        />
      </View>
      <ConfirmAction
        label={t("common.delete")}
        icon={Trash2}
        message={t("loans.deleteConfirm", { name: loan.counterparty })}
        confirmLabel={t("common.yesDelete")}
        pendingLabel={t("common.deleting")}
        describeError={describe}
        onConfirm={async () => {
          await del(`/loans/${loan.id}`);
          await reload();
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  name: { fontWeight: "700", fontSize: 17 },
  repayment: { gap: 6 },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});
