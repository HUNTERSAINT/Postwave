import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../lib/theme";

export const Screen = ({ children }: { children: ReactNode }) => (
  <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>{children}</SafeAreaView>
);
export const Card = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => <View style={[s.card, style]}>{children}</View>;
export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1}>{children}</Text>;
export const Muted = ({ children, style }: { children: ReactNode; style?: object }) => <Text style={[s.muted, style]}>{children}</Text>;

export function Button({ title, onPress, busy, kind = "primary", disabled }: { title: string; onPress: () => void; busy?: boolean; kind?: "primary" | "ghost" | "danger"; disabled?: boolean }) {
  const bg = kind === "primary" ? C.brand : kind === "danger" ? C.danger : "transparent";
  const color = kind === "ghost" ? C.brandDark : "#fff";
  return (
    <Pressable onPress={onPress} disabled={busy || disabled} style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: pressed || busy || disabled ? 0.6 : 1, borderWidth: kind === "ghost" ? 1 : 0, borderColor: C.line }]}>
      {busy ? <ActivityIndicator color={color} /> : <Text style={[s.btnText, { color }]}>{title}</Text>}
    </Pressable>
  );
}
export const Field = (p: TextInputProps & { label: string }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={s.label}>{p.label}</Text>
    <TextInput placeholderTextColor="#9ab" {...p} style={[s.input, p.multiline && { minHeight: 110, textAlignVertical: "top" }]} />
  </View>
);
export const Chip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[s.chip, on && { backgroundColor: C.brand, borderColor: C.brand }]}>
    <Text style={{ color: on ? "#fff" : C.ink, fontWeight: "600", fontSize: 13 }}>{label}</Text>
  </Pressable>
);
export const ErrorText = ({ children }: { children?: string | null }) => (children ? <Text style={{ color: C.danger, marginBottom: 10 }}>{children}</Text> : null);
export const statusColor = (st: string) => (st === "published" ? C.ok : st === "failed" ? C.danger : st === "draft" ? C.muted : C.warn);
export const Badge = ({ status }: { status: string }) => (
  <Text style={{ color: statusColor(status), fontWeight: "700", fontSize: 12, textTransform: "capitalize" }}>{status}</Text>
);
export const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <View style={s.stat}><Text style={s.statV}>{typeof value === "number" ? value.toLocaleString() : value}</Text><Text style={s.statL}>{label}</Text></View>
);

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  h1: { fontSize: 26, fontWeight: "800", color: C.ink, marginBottom: 12 },
  muted: { color: C.muted, fontSize: 14 },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  btnText: { fontWeight: "700", fontSize: 16 },
  label: { color: C.muted, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, fontSize: 16, color: C.ink },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: "#fff", marginRight: 8, marginBottom: 8 },
  stat: { flex: 1, minWidth: "45%", backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14 },
  statV: { fontSize: 24, fontWeight: "800", color: C.ink },
  statL: { color: C.muted, fontSize: 13, marginTop: 2 },
});
