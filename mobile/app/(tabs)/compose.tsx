import { useCallback, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Screen, Card, H1, Muted, Field, Button, Chip, ErrorText } from "../../components/ui";
import { api, type Account, type Media } from "../../lib/api";
import { nameOf } from "../../lib/theme";

type Intent = "publish_now" | "schedule" | "draft";
type Picked = Media & { uri: string };

export default function Compose() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<Picked[]>([]);
  const [intent, setIntent] = useState<Intent>("publish_now");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    api.get<{ accounts: Account[] }>("/api/accounts").then((r) => setAccounts(r.accounts.filter((a) => a.isActive && a.platform !== "whatsapp"))).catch(() => undefined);
  }, []));

  const pick = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.9 });
    if (res.canceled) return;
    setBusy("Uploading…");
    try {
      const uploaded: Picked[] = [];
      for (const asset of res.assets) {
        const type = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
        const blob = await (await fetch(asset.uri)).blob();
        const r = await api.upload<{ media: Media }>("/api/media/upload", blob, type);
        uploaded.push({ ...r.media, uri: asset.uri });
      }
      setMedia((m) => [...m, ...uploaded]);
    } catch (e) { setError((e as Error).message); }
    setBusy(null);
  };

  const ai = async (mode: "write" | "shorter" | "longer" | "hashtags") => {
    setError(null);
    const idea = (content || title).trim();
    if (idea.length < 3) { setError("Type a few words about your post first."); return; }
    setBusy("Thinking…");
    try {
      const platforms = accounts.filter((a) => selected.includes(a.id)).map((a) => a.platform);
      const r = await api.post<{ caption?: string; hashtags?: string[] }>("/api/ai/caption", { mode, idea, current: content || undefined, platforms, tone: "friendly" });
      if (r.caption) setContent(r.caption);
      if (r.hashtags) setContent((c) => `${c}\n\n${r.hashtags!.join(" ")}`.trim());
    } catch (e) { setError((e as Error).message); }
    setBusy(null);
  };

  const submit = async () => {
    setError(null); setNotice(null); setBusy("Saving…");
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let scheduledFor: string | undefined;
      if (intent === "schedule") {
        const m = when.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/);
        if (!m) throw new Error("Enter the time like 2026-11-05 14:30");
        scheduledFor = `${m[1]}T${m[2]}`;
      }
      await api.post("/api/posts", { intent, title: title.trim() || undefined, content, accountIds: selected, mediaAssetIds: media.map((m) => m.id), scheduledFor, timezone: tz });
      setNotice(intent === "publish_now" ? "Publishing started. Check the Posts tab." : intent === "schedule" ? "Scheduled!" : "Draft saved.");
      setTitle(""); setContent(""); setMedia([]); setSelected([]); setWhen("");
      setTimeout(() => router.push("/history"), 700);
    } catch (e) { setError((e as Error).message); }
    setBusy(null);
  };

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <H1>Create post</H1>
        <ErrorText>{error}</ErrorText>
        {notice ? <Text style={{ color: "#1d9a5b", marginBottom: 10 }}>{notice}</Text> : null}
        <Card>
          <Text style={{ fontWeight: "800", marginBottom: 8 }}>Post to</Text>
          {accounts.length === 0 ? <Muted>Connect an account in the Accounts tab first.</Muted> : (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {accounts.map((a) => <Chip key={a.id} label={`${nameOf(a.platform)}${a.displayName ? ` · ${a.displayName}` : ""}`} on={selected.includes(a.id)} onPress={() => toggle(a.id)} />)}
            </View>
          )}
        </Card>
        <Card>
          <Field label="Title (TikTok photos, YouTube, Pinterest)" value={title} onChangeText={setTitle} maxLength={90} />
          <Field label="Caption" value={content} onChangeText={setContent} multiline maxLength={5000} />
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <Chip label="✨ Write for me" on={false} onPress={() => ai("write")} />
            <Chip label="Shorter" on={false} onPress={() => ai("shorter")} />
            <Chip label="Longer" on={false} onPress={() => ai("longer")} />
            <Chip label="# Hashtags" on={false} onPress={() => ai("hashtags")} />
          </View>
        </Card>
        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
            {media.map((m) => <Image key={m.id} source={{ uri: m.uri }} style={{ width: 72, height: 72, borderRadius: 10, marginRight: 8, marginBottom: 8 }} />)}
          </View>
          <Button title="Add photos or videos" kind="ghost" onPress={pick} disabled={!!busy} />
        </Card>
        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <Chip label="Publish now" on={intent === "publish_now"} onPress={() => setIntent("publish_now")} />
            <Chip label="Schedule" on={intent === "schedule"} onPress={() => setIntent("schedule")} />
            <Chip label="Save draft" on={intent === "draft"} onPress={() => setIntent("draft")} />
          </View>
          {intent === "schedule" ? <Field label="When (your local time)" placeholder="2026-11-05 14:30" value={when} onChangeText={setWhen} /> : null}
          <Button title={intent === "publish_now" ? "Publish" : intent === "schedule" ? "Schedule" : "Save draft"} onPress={submit} busy={!!busy} />
          {busy ? <Muted style={{ textAlign: "center", marginTop: 6 }}>{busy}</Muted> : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}
