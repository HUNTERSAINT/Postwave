import { useCallback, useState } from "react";
import { Alert, AppState, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Screen, Card, H1, Muted, Button, Chip, ErrorText } from "../../components/ui";
import { api, type Account } from "../../lib/api";
import { connectable, nameOf } from "../../lib/theme";

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setAccounts((await api.get<{ accounts: Account[] }>("/api/accounts")).accounts); } catch { /* keep */ }
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void load(); });
    return () => sub.remove();
  }, [load]));
  const connect = async (platform: string) => {
    setBusy(platform); setError(null);
    try {
      const r = await api.post<{ authUrl: string }>("/api/accounts/connect", { platform });
      await WebBrowser.openBrowserAsync(r.authUrl);
      await load();
    } catch (e) { setError((e as Error).message); }
    setBusy(null);
  };
  const remove = (a: Account) =>
    Alert.alert("Disconnect?", `${nameOf(a.platform)} · ${a.displayName ?? a.username ?? ""}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: async () => { try { await api.del(`/api/accounts/${a.id}`); await load(); } catch (e) { setError((e as Error).message); } } },
    ]);
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <H1>Accounts</H1>
        <ErrorText>{error}</ErrorText>
        {accounts.length === 0 ? <Muted style={{ marginBottom: 12 }}>No accounts connected yet.</Muted> : accounts.map((a) => (
          <Card key={a.id}>
            <Text style={{ fontWeight: "800" }}>{nameOf(a.platform)}</Text>
            <Muted>{a.displayName ?? a.username ?? "Connected"}{a.isActive ? "" : " · needs reconnecting"}</Muted>
            <Button title="Disconnect" kind="ghost" onPress={() => remove(a)} />
          </Card>
        ))}
        <Text style={{ fontWeight: "800", marginVertical: 8 }}>Connect a platform</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {connectable.map((p) => <Chip key={p} label={busy === p ? "Opening…" : nameOf(p)} on={false} onPress={() => connect(p)} />)}
        </View>
        <Muted style={{ marginTop: 8 }}>A secure window opens so you can sign in to the platform. Come back here when you’re done.</Muted>
      </ScrollView>
    </Screen>
  );
}
