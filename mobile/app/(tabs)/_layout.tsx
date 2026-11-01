import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../../lib/theme";

const icon = (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: C.brand, tabBarInactiveTintColor: C.muted, tabBarStyle: { backgroundColor: "#fff", borderTopColor: C.line } }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="compose" options={{ title: "Create", tabBarIcon: icon("add-circle") }} />
      <Tabs.Screen name="history" options={{ title: "Posts", tabBarIcon: icon("list") }} />
      <Tabs.Screen name="analytics" options={{ title: "Analytics", tabBarIcon: icon("stats-chart") }} />
      <Tabs.Screen name="accounts" options={{ title: "Accounts", tabBarIcon: icon("people") }} />
    </Tabs>
  );
}
