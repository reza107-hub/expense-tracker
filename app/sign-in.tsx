import { Link } from "expo-router";
import { LogIn } from "lucide-react-native";
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

export default function SignInScreen() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError(t("auth.signIn.email.required"));
      return;
    }
    try {
      await signIn(email, password);
      // The route guard moves to the home screen once the session is saved.
    } catch (failure) {
      setError(failure instanceof ApiError ? messageFor(failure, t) : t("error.generic"));
    }
  }

  return (
    <AuthShell title={t("auth.signIn.title")} subtitle={t("auth.signIn.subtitle")}>
      <TextField
        label={t("auth.field.email")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        maxLength={320}
      />
      <TextField
        label={t("auth.field.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        maxLength={128}
      />
      <ErrorText>{error}</ErrorText>
      <Button label={t("auth.signIn.submit")} pendingLabel={t("auth.signIn.pending")} icon={LogIn} onPress={submit} fullWidth />
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t("auth.signIn.newHere")} </Text>
        <Link href="/register" style={styles.link}>
          {t("auth.signIn.createAccountLink")}
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
