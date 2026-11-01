import { ActivityIndicator } from "react-native";

/** A spinning ring. Pass the colour of the text it sits next to. */
export default function Spinner({ color, size = "small" }: { color: string; size?: "small" | "large" }) {
  return <ActivityIndicator size={size} color={color} accessibilityLabel="Loading" />;
}
