import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen, Card, H1, Muted, Stat, Chip, ErrorText } from "../../components/ui";
import { api, type Analytics } from "../../lib/api";
import { C, nameOf } from "../../lib/theme";

export default function AnalyticsScreen() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (d: number) => {
    setError(null);
    try { setData((await api.get<{ analytics: Analytics }>(`/api/analytics?days=${d}`)).analytics); } catch (e) { setError((e as Error).message); }
  }, []);
  useFocusEffect(useCallback(() => { void load(days); }, [load, days]));
  const t = data?.totals;
  const max = Math.max(1, ...(data?.platforms.map((p) => p.views + p.engagement) ?? [1]));
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <H1>Analytics</H1>
        <View style={{ flexDirection: "row" }}>
          {[7, 30, 90].map((d) => <Chip key={d} label={`${d} days`} on={days === d} onPress={() => setDays(d)} />)}
        </View>
        <ErrorText>{error}</ErrorText>
        {data && !data.providerAvailable ? <Muted style={{ marginBottom: 8 }}>Live metrics from your platforms aren’t available on this plan yet, so counts may be zero.</Muted> : null}
        {t ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <Stat label="Posts published" value={t.published} />
            <Stat label="Views" value={t.views} />
            <Stat label="Likes" value={t.likes} />
            <Stat label="Comments" value={t.comments} />
            <Stat label="Shares" value={t.shares} />
            <Stat label="Engagement rate" value={`${(t.engagementRate * (t.engagementRate <= 1 ? 100 : 1)).toFixed(1)}%`} />
          </View>
        ) : null}
        {data?.platforms.length ? (
          <Card>
            <Text style={{ fontWeight: "800", marginBottom: 10 }}>By platform</Text>
            {data.platforms.map((p) => (
              <View key={p.platform} style={{ marginBottom: 10 }}>
                <Text>{nameOf(p.platform)} · {p.published} posts · {p.views.toLocaleString()} views</Text>
                <View style={{ height: 8, backgroundColor: C.line, borderRadius: 4, marginTop: 4 }}>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: C.brand, width: `${Math.max(4, ((p.views + p.engagement) / max) * 100)}%` }} />
                </View>
              </View>
            ))}
          </Card>
        ) : null}
        {data?.topPosts.length ? (
          <Card>
            <Text style={{ fontWeight: "800", marginBottom: 10 }}>Top posts</Text>
            {data.topPosts.map((p) => (
              <View key={p.id} style={{ marginBottom: 12 }}>
                <Text numberOfLines={2}>{p.content || "(media post)"}</Text>
                <Muted>{p.views.toLocaleString()} views · {p.likes} likes · {p.comments} comments</Muted>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
