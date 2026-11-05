import { useState } from "react";
import { Check, ChevronDown } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { colors, radius } from "@/theme/colors";

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words";
  autoComplete?: "email" | "password" | "new-password" | "off";
  maxLength?: number;
  placeholder?: string;
  editable?: boolean;
};

export function TextField({ label, error, hint, multiline, editable = true, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...input}
        editable={editable}
        multiline={multiline}
        accessibilityLabel={label}
        placeholderTextColor={colors.mutedForeground}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && { borderColor: colors.ring },
          !!error && { borderColor: colors.destructive },
          !editable && { opacity: 0.6 },
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

type Option<V> = { value: V; label: string };

/** Pick one from a list, shown as a dropdown field that opens a list of choices. */
export function ChoiceField<V extends string | number>({
  label,
  options,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  options: Option<V>[];
  value: V | null;
  onChange: (value: V) => void;
  error?: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? "" }}
        onPress={() => setOpen(true)}
        style={[styles.input, styles.dropdown, !!error && { borderColor: colors.destructive }]}
      >
        <Text style={[styles.dropdownText, !selected && { color: colors.mutedForeground }]} numberOfLines={1}>
          {selected?.label ?? "—"}
        </Text>
        <ChevronDown size={18} color={colors.mutedForeground} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={String(option.value)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={[styles.option, isSelected && styles.optionSelected]}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option.label}</Text>
                    {isSelected ? <Check size={18} color={colors.accentForeground} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function SwitchField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.label, styles.switchLabel]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.muted, true: colors.primary }}
        thumbColor={colors.foreground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: colors.foreground, fontSize: 14, fontWeight: "500" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius - 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.foreground,
    backgroundColor: colors.background,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  error: { color: colors.destructive, fontSize: 13 },
  hint: { color: colors.mutedForeground, fontSize: 12, lineHeight: 17 },
  dropdown: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  dropdownText: { flex: 1, color: colors.foreground, fontSize: 16 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  sheet: {
    maxHeight: "70%",
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
  },
  sheetTitle: { color: colors.mutedForeground, fontSize: 13, paddingHorizontal: 16, paddingVertical: 8 },
  option: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  optionSelected: { backgroundColor: colors.accent },
  optionText: { color: colors.foreground, fontSize: 16, flex: 1 },
  optionTextSelected: { color: colors.accentForeground, fontWeight: "600" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  switchLabel: { flex: 1 },
});
