import { RefreshCw, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Button from "@/components/button";
import { Money } from "@/components/money";
import { MonthNav, Row } from "@/components/pieces";
import Screen, { QueryState } from "@/components/screen";
import { Body, Card, Divider, ErrorText, Heading, Muted, SuccessText } from "@/components/ui";
import { useI18n } from "@/i18n";
import { post } from "@/lib/api";
import { formatDateTime, monthKey, monthName, shiftMonth } from "@/lib/dates";
import { messageFor } from "@/lib/errors";
import { formatTaka } from "@/lib/money";
import type { AdviceView, MonthReport } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { colors } from "@/theme/colors";

function changeText(change: number, percent: number | null, t: ReturnType<typeof useI18n>["t"]): string {
  if (change === 0) return t("reports.change.none");
  const sign = change > 0 ? "+" : "-";
  const amount = `${sign}৳ ${formatTaka(Math.abs(change))}`;
  return percent === null ? `${amount} (${t("reports.change.na")})` : `${amount} (${sign}${Math.abs(percent)}%)`;
}

export default function ReportsScreen() {
  const { t } = useI18n();
  const [month, setMonth] = useState<{ year: number; month: number } | null>(null);
  const query = month ? `?month=${monthKey(month.year, month.month)}` : "";
  const report = useApi<{ report: MonthReport }>(`/reports${query}`);
  const advice = useApi<AdviceView>(`/advice${query}`);

  const period = report.data?.report.period ?? null;
  const shown = month ?? (period ? { year: period.year, month: period.month } : null);

  return (
    <Screen
      refreshing={report.refreshing}
      onRefresh={() => {
        void report.refresh();
        void advice.refresh();
      }}
    >
      {shown ? (
        <MonthNav
          label={monthName(shown.year, shown.month, t)}
          onPrevious={() => setMonth(shiftMonth(shown.year, shown.month, -1))}
          onNext={() => setMonth(shiftMonth(shown.year, shown.month, 1))}
        />
      ) : null}
      <QueryState loading={report.loading} error={report.error} hasData={!!report.data} onRetry={report.reload}>
        {report.data ? <ReportBody report={report.data.report} /> : null}
      </QueryState>
      {shown ? (
        <AdviceSection
          month={monthKey(shown.year, shown.month)}
          view={advice.data}
          error={advice.error}
          loading={advice.loading}
          reload={advice.reload}
        />
      ) : null}
    </Screen>
  );
}

function ReportBody({ report }: { report: MonthReport }) {
  const { t } = useI18n();
  const previous = monthName(report.previousPeriod.year, report.previousPeriod.month, t);
  const trendMax = Math.max(1, ...report.trend.map((p) => p.total));

  if (!report.hasEntries) {
    return (
      <Card>
        <Body>{t("reports.empty")}</Body>
      </Card>
    );
  }
  return (
    <>
      <Card>
        <Muted>{t("reports.total")}</Muted>
        <Money poisha={report.total} style={{ fontSize: 28, fontWeight: "700" }} />
        <Muted>
          {report.previousTotal === 0
            ? t("reports.noPrevious", { month: previous })
            : t("reports.compared", { change: changeText(report.change, report.changePercent, t), month: previous, amount: formatTaka(report.previousTotal) })}
        </Muted>
      </Card>

      <Card>
        <Heading>{t("reports.byCategory")}</Heading>
        {report.byCategory.length === 0 ? (
          <Muted>{t("reports.noSpending")}</Muted>
        ) : (
          report.byCategory.map((category) => (
            <View key={category.categoryId} style={styles.block}>
              <Row left={<Body>{category.name}</Body>} right={<Money poisha={category.total} />} />
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${Math.max(2, category.share)}%`, backgroundColor: colors.chart1 }]} />
              </View>
              <Muted>
                {t("reports.categoryShare", { name: category.name, percent: category.share })}
                {category.previous > 0 || category.change !== 0 ? ` · ${t("reports.vsLastMonth", { change: changeText(category.change, category.changePercent, t) })}` : ""}
              </Muted>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Heading>{t("reports.byWallet")}</Heading>
        {report.byWallet.length === 0 ? (
          <Muted>{t("reports.noSpending")}</Muted>
        ) : (
          report.byWallet.map((wallet) => <Row key={wallet.walletId} left={<Body>{wallet.name}</Body>} right={<Money poisha={wallet.total} />} />)
        )}
      </Card>

      <Card>
        <Heading>{t("reports.trend")}</Heading>
        {report.trend.map((point) => (
          <View key={`${point.period.year}-${point.period.month}`} style={styles.block}>
            <Row left={<Muted>{`${t(`monthShort.${point.period.month}` as "monthShort.1")} ${point.period.year}`}</Muted>} right={<Money poisha={point.total} style={{ fontSize: 13 }} />} />
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${Math.max(point.total === 0 ? 0 : 2, (point.total * 100) / trendMax)}%`, backgroundColor: colors.chart2 }]} />
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

function AdviceSection({
  month,
  view,
  error,
  loading,
  reload,
}: {
  month: string;
  view: AdviceView | null;
  error: unknown;
  loading: boolean;
  reload: () => Promise<void>;
}) {
  const { t, language } = useI18n();
  const [outcome, setOutcome] = useState<{ status: string; message: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function refresh() {
    setProblem(null);
    setOutcome(null);
    try {
      setOutcome(await post<{ status: string; message: string }>("/advice/refresh", { month }));
      await reload();
    } catch (failure) {
      setProblem(messageFor(failure, t));
    }
  }

  return (
    <Card>
      <Heading>{t("advice.title")}</Heading>
      <Muted>{t("advice.privacy")}</Muted>
      <QueryState loading={loading} error={error} hasData={!!view} onRetry={reload}>
        {view ? (
          <>
            {view.saved ? (
              <>
                <Body>{view.saved.advice.summary}</Body>
                {view.saved.advice.suggestions.length === 0 ? <Muted>{t("advice.noUsable")}</Muted> : null}
                {view.saved.advice.suggestions.map((suggestion, index) => (
                  <View key={`${suggestion.category}-${index}`} style={styles.block}>
                    <Divider />
                    <Body style={{ fontWeight: "600" }}>{suggestion.category}</Body>
                    <Body>{suggestion.tip}</Body>
                    <Muted>{t("advice.save", { amount: formatTaka(suggestion.saving) })}</Muted>
                  </View>
                ))}
                <Muted>{t("advice.madeOn", { time: formatDateTime(view.saved.createdAt, language) })}</Muted>
                {view.stale ? <Muted>{t("advice.changedSince")}</Muted> : null}
              </>
            ) : view.hasExpenses ? (
              <Muted>{t("advice.none")}</Muted>
            ) : (
              <Muted>{t("advice.nothing")}</Muted>
            )}
            {view.hasExpenses ? (
              <Button
                label={view.saved ? t("advice.refresh") : t("advice.get")}
                pendingLabel={t("advice.thinking")}
                icon={view.saved ? RefreshCw : Sparkles}
                onPress={refresh}
              />
            ) : null}
            <Muted>{t("advice.remaining", { remaining: view.remaining, limit: view.dailyLimit })}</Muted>
            {outcome ? (outcome.status === "created" ? <SuccessText>{outcome.message}</SuccessText> : <Muted>{outcome.message}</Muted>) : null}
            <ErrorText>{problem}</ErrorText>
          </>
        ) : null}
      </QueryState>
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: 4 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.muted, overflow: "hidden" },
  bar: { height: 8, borderRadius: 4 },
});
