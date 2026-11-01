import { Text, type StyleProp, type TextStyle } from "react-native";
import { formatTaka } from "@/lib/money";
import { colors } from "@/theme/colors";

/** "৳ 1,00,000" from whole poisha. `signed` adds + for gains and colours gains and losses. */
export function Money({
  poisha,
  signed = false,
  style,
}: {
  poisha: number;
  signed?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const color = signed ? (poisha > 0 ? colors.success : poisha < 0 ? colors.destructive : colors.foreground) : colors.foreground;
  const text = formatTaka(poisha);
  return <Text style={[{ color, fontSize: 15, fontWeight: "600" }, style]}>{`৳ ${signed && poisha > 0 ? "+" : ""}${text}`}</Text>;
}
