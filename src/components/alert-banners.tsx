import { TriangleAlert } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { useI18n, type Key, type Translate } from "@/i18n";
import { formatDate } from "@/lib/dates";
import { formatTaka } from "@/lib/money";
import type { Alerts, LoanAlert } from "@/lib/types";
import { colors } from "@/theme/colors";

function loanText(alert: LoanAlert, t: Translate): string {
  const base = `alerts.loan.${alert.direction}`;
  const days = Math.abs(alert.daysUntil);
  const key =
    alert.daysUntil < 0
      ? days === 1
        ? "overdue1"
        : "overdueN"
      : alert.daysUntil === 0
        ? "today"
        : days === 1
          ? "soon1"
          : "soonN";
  return t(`${base}.${key}` as Key, {
    amount: formatTaka(alert.outstanding),
    name: alert.counterparty,
    date: formatDate(alert.dueDate, t),
    days,
  });
}

export default function AlertBanners({ alerts }: { alerts: Alerts }) {
  const { t } = useI18n();
  const { spending, loans } = alerts;
  if (!spending && loans.length === 0) return null;
  return (
    <View style={styles.list} accessibilityLabel={t("alerts.label")}>
      {spending ? (
        <Banner danger={spending.level === "exceeded"}>
          {t(spending.level === "exceeded" ? "alerts.exceeded" : "alerts.warning", {
            over: formatTaka(spending.over),
            spent: formatTaka(spending.spent),
            limit: formatTaka(spending.limit),
            percent: spending.percent,
          })}
        </Banner>
      ) : null}
      {loans.map((loan) => (
        <Banner key={loan.loanId} danger={loan.daysUntil < 0}>
          {loanText(loan, t)}
        </Banner>
      ))}
    </View>
  );
}

function Banner({ danger, children }: { danger: boolean; children: string }) {
  const tone = danger ? colors.destructive : colors.warning;
  return (
    <View style={[styles.banner, { borderColor: tone }]} accessibilityRole="alert">
      <TriangleAlert size={18} color={tone} />
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  banner: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 10, borderWidth: 1, backgroundColor: colors.card },
  text: { flex: 1, color: colors.foreground, fontSize: 14, lineHeight: 20 },
});
