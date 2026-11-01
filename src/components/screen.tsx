import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";
import { messageFor } from "@/lib/errors";
import { colors } from "@/theme/colors";
import Button from "./button";
import Spinner from "./spinner";

type Props = {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Leave room under the system top bar. Tab screens and forms with no header set this. */
  topInset?: boolean;
};

export default function Screen({ children, onRefresh, refreshing = false, topInset = false }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: 16 + (topInset ? insets.top : 0), paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.card} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Shows a spinner for the first load and a retry button when it failed. Otherwise the content. */
export function QueryState({
  loading,
  error,
  hasData,
  onRetry,
  children,
}: {
  loading: boolean;
  error: unknown;
  hasData: boolean;
  onRetry: () => void | Promise<unknown>;
  children: ReactNode;
}) {
  const { t } = useI18n();
  if (loading && !hasData) {
    return (
      <View style={styles.center}>
        <Spinner color={colors.primary} size="large" />
        <Text style={styles.muted}>{t("common.loading")}</Text>
      </View>
    );
  }
  if (error && !hasData) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert" style={styles.errorText}>
          {messageFor(error, t)}
        </Text>
        <Button label={t("common.retry")} onPress={onRetry} variant="quiet" />
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, gap: 16 },
  center: { alignItems: "center", gap: 12, paddingVertical: 48 },
  muted: { color: colors.mutedForeground },
  errorText: { color: colors.destructive, textAlign: "center", fontSize: 15 },
});
