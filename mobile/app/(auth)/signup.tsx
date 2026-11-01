import { useState } from "react";
import { ScrollView } from "react-native";
import { Link } from "expo-router";
import { Screen, Card, H1, Muted, Field, Button, ErrorText } from "../../components/ui";
import { api } from "../../lib/api";
import { C } from "../../lib/theme";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await api.post("/api/auth/signup", { name: name.trim(), email: email.trim(), password, acceptTerms: true });
      setSent(true);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 40 }} keyboardShouldPersistTaps="handled">
        <Card>
          <H1>Create account</H1>
          {sent ? (
            <>
              <Muted>Check your email and tap the verification link. Then come back here and sign in.</Muted>
              <Link href="/login" style={{ color: C.brandDark, fontWeight: "700", marginTop: 16 }}>Go to sign in</Link>
            </>
          ) : (
            <>
              <ErrorText>{error}</ErrorText>
              <Field label="Name" value={name} onChangeText={setName} />
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <Field label="Password (8+ characters)" value={password} onChangeText={setPassword} secureTextEntry />
              <Muted style={{ marginBottom: 8, fontSize: 12 }}>By creating an account you agree to the Terms and Privacy Policy at postwave’s website.</Muted>
              <Button title="Create account" onPress={submit} busy={busy} disabled={!name || !email || password.length < 8} />
            </>
          )}
        </Card>
        {!sent && <Link href="/login" style={{ color: C.brandDark, textAlign: "center", fontWeight: "700" }}>Already have an account? Sign in</Link>}
      </ScrollView>
    </Screen>
  );
}
