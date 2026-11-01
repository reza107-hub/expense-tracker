import { useRouter } from "expo-router";
import { ChartColumn, ChevronRight, LogOut, Settings, Tags } from "lucide-react-native";
import type { ComponentType } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Button from "@/components/button";
import { LanguageSwitch } from "@/components/language-switch";
import Screen from "@/components/screen";
import { Card, Muted, Title } from "@/components/ui";
import { useI18n, type Key } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { colors } from "@/theme/colors";

type Item = { href: "/reports" | "/categories" | "/settings"; label: Key; icon: ComponentType<{ size?: number; color?: string }> };

const ITEMS: Item[] = [
  { href: "/reports", label: "more.reports", icon: ChartColumn },
  { href: "/categories", label: "more.categories", icon: Tags },
  { href: "/settings", label: "more.settings", icon: Settings },
];

export default function MoreScreen() {
  const { t } = useI18n();
  const { email, signOut } = useAuth();
  const router = useRouter();
  return (
    <Screen topInset>
      <Title>{t("tabs.more")}</Title>
      {email ? <Muted>{t("more.account", { email })}</Muted> : null}
      <Card style={styles.menu}>
        {ITEMS.map(({ href, label, icon: Icon }, index) => (
          <Pressable
            key={href}
            accessibilityRole="button"
            onPress={() => router.push(href)}
            style={({ pressed }) => [styles.item, index > 0 && styles.itemBorder, pressed && { opacity: 0.8 }]}
          >
            <Icon size={20} color={colors.primary} />
            <Text style={styles.itemText}>{t(label)}</Text>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </Card>
      <Card>
        <View style={styles.language}>
          <Text style={styles.itemText}>{t("more.language")}</Text>
          <LanguageSwitch />
        </View>
      </Card>
      <Button label={t("nav.signOut")} icon={LogOut} variant="quiet" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  menu: { padding: 0, gap: 0 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, minHeight: 54 },
  itemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  itemText: { flex: 1, color: colors.foreground, fontSize: 16 },
  language: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
