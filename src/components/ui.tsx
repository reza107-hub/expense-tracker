import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { colors, radius } from "@/theme/colors";

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  );
}

export function SuccessText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <Text style={styles.success}>{children}</Text>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export const row: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 8 };

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    padding: 16,
    gap: 8,
  },
  title: { color: colors.foreground, fontSize: 24, fontWeight: "700" },
  heading: { color: colors.foreground, fontSize: 17, fontWeight: "600" },
  muted: { color: colors.mutedForeground, fontSize: 13, lineHeight: 18 },
  body: { color: colors.foreground, fontSize: 15, lineHeight: 21 },
  error: { color: colors.destructive, fontSize: 14, lineHeight: 20 },
  success: { color: colors.success, fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
