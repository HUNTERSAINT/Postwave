import { useCallback, useState } from "react";
import { Alert, FlatList, Linking, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen, Card, H1, Muted, Badge, Button, Chip } from "../../components/ui";
import { api, type Post } from "../../lib/api";
import { nameOf } from "../../lib/theme";

const filters = ["all", "published", "scheduled", "draft", "failed"] as const;

export default function History() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setPosts((await api.get<{ posts: Post[] }>("/api/posts")).posts); } catch { /* keep */ }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const check = async (id: string) => {
    setBusyId(id);
    try { await api.post(`/api/posts/${id}/refresh`); await load(); } catch (e) { Alert.alert("Could not check", (e as Error).message); }
    setBusyId(null);
  };
  const shown = posts.filter((p) => filter === "all" || p.status === filter);
  return (
    <Screen>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <H1>Posts</H1>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {filters.map((f) => <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} on={filter === f} onPress={() => setFilter(f)} />)}
        </View>
      </View>
      <FlatList
        data={shown}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16 }}
        onRefresh={load}
        refreshing={false}
        ListEmptyComponent={<Muted>Nothing here yet.</Muted>}
        renderItem={({ item: p }) => (
          <Card>
            <Badge status={p.status} />
            {p.title ? <Text style={{ fontWeight: "800", marginTop: 4 }}>{p.title}</Text> : null}
            <Text style={{ marginTop: 4 }} numberOfLines={4}>{p.content || "(media post)"}</Text>
            <Muted style={{ marginTop: 6 }}>{new Date(p.scheduledAt ?? p.publishedAt ?? p.createdAt).toLocaleString()}</Muted>
            {p.platforms.map((t) => (
              <View key={t.accountId} style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 13 }}>{nameOf(t.platform)} — <Badge status={t.status} /></Text>
                {t.errorMessage ? <Text style={{ color: "#d64545", fontSize: 12 }}>{t.errorMessage}</Text> : null}
                {t.platformPostUrl ? <Text style={{ color: "#087a78", fontSize: 12 }} onPress={() => Linking.openURL(t.platformPostUrl!)}>View post</Text> : null}
              </View>
            ))}
            {["publishing", "queued", "processing", "scheduled"].includes(p.status) ? (
              <Button title="Check status" kind="ghost" busy={busyId === p.id} onPress={() => check(p.id)} />
            ) : null}
          </Card>
        )}
      />
    </Screen>
  );
}
