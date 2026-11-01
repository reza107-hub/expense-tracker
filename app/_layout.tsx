import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Spinner from "@/components/spinner";
import { I18nProvider, useI18n } from "@/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { colors } from "@/theme/colors";

function Routes() {
  const { status } = useAuth();
  const { t } = useI18n();

  if (status === "loading") {
    return (
      <View style={styles.splash}>
        <Spinner color={colors.primary} size="large" />
      </View>
    );
  }

  const modal = { presentation: "modal" as const };
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerTitleStyle: { color: colors.foreground },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={status === "signedIn"}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="reports" options={{ title: t("nav.reports") }} />
        <Stack.Screen name="categories" options={{ title: t("nav.categories") }} />
        <Stack.Screen name="settings" options={{ title: t("nav.settings") }} />
        <Stack.Screen name="entry-form" options={{ ...modal, title: t("entries.add.title") }} />
        <Stack.Screen name="wallet-form" options={{ ...modal, title: t("wallets.add.title") }} />
        <Stack.Screen name="loan-form" options={{ ...modal, title: t("loans.add.title") }} />
        <Stack.Screen name="repay" options={{ ...modal, title: t("loans.repay.title") }} />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Routes />
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
