import { Tabs } from "expo-router";
import { Ellipsis, HandCoins, House, ReceiptText, Wallet } from "lucide-react-native";
import { useI18n } from "@/i18n";
import { colors } from "@/theme/colors";

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("nav.home"), tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="entries" options={{ title: t("nav.entries"), tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size} /> }} />
      <Tabs.Screen name="wallets" options={{ title: t("nav.wallets"), tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }} />
      <Tabs.Screen name="loans" options={{ title: t("nav.loans"), tabBarIcon: ({ color, size }) => <HandCoins color={color} size={size} /> }} />
      <Tabs.Screen name="more" options={{ title: t("tabs.more"), tabBarIcon: ({ color, size }) => <Ellipsis color={color} size={size} /> }} />
    </Tabs>
  );
}
