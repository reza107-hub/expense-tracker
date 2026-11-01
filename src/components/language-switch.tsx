import { Pressable, StyleSheet, Text, View } from "react-native";
import { LANGUAGES, useI18n } from "@/i18n";
import { colors } from "@/theme/colors";

/** EN / বাং toggle. */
export function LanguageSwitch() {
  const { language, setLanguage, t } = useI18n();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t("language.label")} style={styles.group}>
      {LANGUAGES.map((code) => {
        const selected = code === language;
        return (
          <Pressable
            key={code}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => setLanguage(code)}
            style={[styles.option, selected && styles.selected]}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>{t(`language.${code}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: "row", backgroundColor: colors.muted, borderRadius: 8, padding: 2 },
  option: { minWidth: 44, minHeight: 32, alignItems: "center", justifyContent: "center", borderRadius: 6, paddingHorizontal: 8 },
  selected: { backgroundColor: colors.card },
  text: { color: colors.mutedForeground, fontSize: 13 },
  textSelected: { color: colors.foreground, fontWeight: "600" },
});
