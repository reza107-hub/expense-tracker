import { Wallet } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "@/components/screen";
import { LanguageSwitch } from "@/components/language-switch";
import { Card, Muted } from "@/components/ui";
import { useI18n } from "@/i18n";
import { colors } from "@/theme/colors";

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <Screen topInset>
      <View style={styles.top}>
        <View style={styles.brand}>
          <Wallet size={22} color={colors.primary} />
          <Text style={styles.brandText}>{t("app.name")}</Text>
        </View>
        <LanguageSwitch />
      </View>
      <Card style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Muted>{subtitle}</Muted>
        {children}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { color: colors.foreground, fontSize: 18, fontWeight: "700" },
  card: { gap: 14, padding: 20, marginTop: 24 },
  title: { color: colors.foreground, fontSize: 24, fontWeight: "700" },
});
