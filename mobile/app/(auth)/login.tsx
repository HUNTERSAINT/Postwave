import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { FadeIn } from "../../components/fade-in";
import { Screen, Card, H1, Muted, Field, Button, ErrorText } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { API_URL } from "../../lib/api";
import { C } from "../../lib/theme";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try { await signIn(email.trim(), password); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };
  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 48 }} keyboardShouldPersistTaps="handled">
          <FadeIn>
            <Text style={{ fontSize: 34, fontWeight: "800", color: C.brandDark }}>Postwave</Text>
            <Muted style={{ marginBottom: 24 }}>One post. Every platform.</Muted>
          </FadeIn>
          <FadeIn delay={180}>
          <Card>
            <H1>Sign in</H1>
            <ErrorText>{error}</ErrorText>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
            <Button title="Sign in" onPress={submit} busy={busy} disabled={!email || !password} />
            <View style={{ height: 8 }} />
            <Button title="Forgot password?" kind="ghost" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/forgot-password`)} />
          </Card>
          </FadeIn>
          <FadeIn delay={360}>
            <Link href="/signup" style={{ color: C.brandDark, textAlign: "center", fontWeight: "700", marginTop: 8 }}>New here? Create an account</Link>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
