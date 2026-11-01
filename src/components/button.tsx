import type { LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "@/theme/colors";
import Spinner from "./spinner";

type Variant = "primary" | "quiet" | "destructive" | "warning";

type Props = {
  label: string;
  /** Text shown next to the spinner while waiting, for example "Saving". Defaults to `label`. */
  pendingLabel?: string;
  /** If this returns a promise, the button shows a spinner and ignores taps until it settles. */
  onPress: () => void | Promise<unknown>;
  icon?: LucideIcon;
  variant?: Variant;
  /** Forces the spinner, for work that is started somewhere else. */
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  fullWidth?: boolean;
};

const STYLES: Record<Variant, { background: string; text: string; border?: string }> = {
  primary: { background: colors.primary, text: colors.primaryForeground },
  quiet: { background: "transparent", text: colors.foreground, border: colors.border },
  destructive: { background: colors.destructive, text: colors.destructiveForeground },
  warning: { background: colors.warning, text: colors.warningForeground },
};

/**
 * The one button for every call to action. When `onPress` returns a promise the button
 * shows a spinner and cannot be pressed twice, so a slow connection never looks frozen
 * and a payment is never sent twice.
 */
export default function Button({
  label,
  pendingLabel,
  onPress,
  icon: Icon,
  variant = "primary",
  loading = false,
  disabled = false,
  small = false,
  fullWidth = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const waiting = busy || loading;
  const style = STYLES[variant];

  async function handlePress() {
    if (waiting || disabled) return;
    const result = onPress();
    if (result instanceof Promise) {
      setBusy(true);
      try {
        await result;
      } finally {
        if (mounted.current) setBusy(false);
      }
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: waiting || disabled, busy: waiting }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        fullWidth && styles.full,
        { backgroundColor: style.background, borderColor: style.border ?? style.background },
        (waiting || disabled) && styles.dim,
        pressed && !waiting && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        {waiting ? <Spinner color={style.text} /> : Icon ? <Icon size={18} color={style.text} /> : null}
        <Text style={[styles.text, { color: style.text }]} numberOfLines={1}>
          {waiting ? (pendingLabel ?? label) : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: radius - 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  small: { minHeight: 36, paddingHorizontal: 12 },
  full: { alignSelf: "stretch" },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  text: { fontSize: 15, fontWeight: "600" },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
});
