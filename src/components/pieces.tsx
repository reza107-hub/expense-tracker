import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useI18n } from "@/i18n";
import { colors } from "@/theme/colors";
import Button from "./button";
import { Body, ErrorText } from "./ui";

/** Previous and next month with the month name between. */
export function MonthNav({
  label,
  onPrevious,
  onNext,
  canGoNext = true,
}: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext?: boolean;
}) {
  const { t } = useI18n();
  return (
    <View style={styles.monthNav}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("entries.list.previousMonth")} onPress={onPrevious} hitSlop={8} style={styles.arrow}>
        <ChevronLeft size={22} color={colors.foreground} />
      </Pressable>
      <Text style={styles.monthLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("entries.list.nextMonth")}
        onPress={onNext}
        disabled={!canGoNext}
        hitSlop={8}
        style={[styles.arrow, !canGoNext && { opacity: 0.35 }]}
      >
        <ChevronRight size={22} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

/**
 * A destructive action that asks once before it runs. `onConfirm` may return a promise:
 * the confirm button then shows a spinner. A failure message stays under the buttons.
 */
export function ConfirmAction({
  label,
  icon,
  message,
  confirmLabel,
  pendingLabel,
  onConfirm,
  describeError,
  small = true,
}: {
  label: string;
  icon?: Parameters<typeof Button>[0]["icon"];
  message: string;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<unknown>;
  describeError: (error: unknown) => string;
  small?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return <Button label={label} icon={icon} variant="quiet" small={small} onPress={() => setOpen(true)} />;
  }
  return (
    <View style={styles.confirm}>
      <Body>{message}</Body>
      <ErrorText>{error}</ErrorText>
      <View style={styles.confirmButtons}>
        <Button
          label={confirmLabel}
          pendingLabel={pendingLabel}
          variant="destructive"
          small
          onPress={async () => {
            setError(null);
            try {
              await onConfirm();
            } catch (failure) {
              setError(describeError(failure));
            }
          }}
        />
        <Button label={t("common.keepIt")} variant="quiet" small onPress={() => { setOpen(false); setError(null); }} />
      </View>
    </View>
  );
}

export function Row({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.rowBetween}>
      <View style={styles.rowLeft}>{left}</View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthLabel: { color: colors.foreground, fontSize: 17, fontWeight: "600" },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  confirm: { gap: 8 },
  confirmButtons: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowLeft: { flex: 1, gap: 2 },
});
