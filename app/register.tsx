import { Link } from "expo-router";
import { UserPlus } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AuthShell from "@/components/auth-shell";
import Button from "@/components/button";
import { TextField } from "@/components/fields";
import { ErrorText } from "@/components/ui";
import { useI18n } from "@/i18n";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { messageFor } from "@/lib/errors";
import { colors } from "@/theme/colors";

export default function RegisterScreen() {
  const { t } = useI18n();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setFieldErrors({});
    try {
      await register(email, password, confirm);
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fieldErrors).length > 0) setFieldErrors(failure.fieldErrors);
      else setError(messageFor(failure, t));
    }
  }

  return (
    <AuthShell title={t("auth.register.title")} subtitle={t("auth.register.subtitle")}>
      <TextField
        label={t("auth.field.email")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        maxLength={320}
        error={fieldErrors.email}
      />
      <TextField
        label={t("auth.field.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        maxLength={128}
        hint={t("auth.field.passwordHint")}
        error={fieldErrors.password}
      />
      <TextField
        label={t("auth.field.confirmPassword")}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        maxLength={128}
        error={fieldErrors.confirmPassword}
      />
      <ErrorText>{error}</ErrorText>
      <Button label={t("auth.register.submit")} pendingLabel={t("auth.register.pending")} icon={UserPlus} onPress={submit} fullWidth />
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t("auth.register.haveAccount")} </Text>
        <Link href="/sign-in" style={styles.link}>
          {t("auth.register.signInLink")}
        </Link>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 4 },
  footerText: { color: colors.mutedForeground, fontSize: 14 },
  link: { color: colors.primary, fontSize: 14, fontWeight: "600" },
});
