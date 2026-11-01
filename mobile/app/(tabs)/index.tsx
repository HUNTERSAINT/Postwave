import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Screen, Card, H1, Muted, Stat, Button, Badge } from "../../components/ui";
import { api, API_URL, type Post, type Plan } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { nameOf } from "../../lib/theme";

export default function Home() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      const [p, pl] = await Promise.all([api.get<{ posts: Post[] }>("/api/posts"), api.get<{ plan: Plan }>("/api/plan")]);
      setPosts(p.posts); setPlan(pl.plan);
    } catch { /* shown empty */ }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const count = (st: string) => posts.filter((p) => p.status === st).length;
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <H1>Hi {user?.name?.split(" ")[0] ?? "there"} 👋</H1>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <Stat label="Published" value={count("published")} />
          <Stat label="Scheduled" value={count("scheduled")} />
          <Stat label="Drafts" value={count("draft")} />
          <Stat label="Plan" value={String(plan?.plan ?? "—").replace(/^./, (c) => c.toUpperCase())} />
        </View>
        <Button title="Create a post" onPress={() => router.push("/compose")} />
        <View style={{ height: 16 }} />
        <Card>
          <Text style={{ fontWeight: "800", marginBottom: 8 }}>Recent posts</Text>
          {posts.length === 0 ? <Muted>No posts yet. Tap “Create a post”.</Muted> : posts.slice(0, 5).map((p) => (
            <View key={p.id} style={{ marginBottom: 10 }}>
              <Text numberOfLines={2}>{p.title || p.content || "(media post)"}</Text>
              <Muted>{p.platforms.map((t) => nameOf(t.platform)).join(", ")} · <Badge status={p.status} /></Muted>
            </View>
          ))}
        </Card>
        <Button title="Manage plan & billing" kind="ghost" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/billing`)} />
        <Button title="Sign out" kind="ghost" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}
