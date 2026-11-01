import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth";
import { Launch } from "../components/launch";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Gate() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => undefined);
    const inAuth = segments[0] === "(auth)";
    if (!user && !inAuth) router.replace("/login");
    else if (user && inAuth) router.replace("/");
  }, [user, ready, segments, router]);
  return <Slot />;
}

export default function Root() {
  const [launching, setLaunching] = useState(true);
  const done = useCallback(() => setLaunching(false), []);
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1 }}>
          <StatusBar style="dark" />
          <Gate />
          {launching ? <Launch onDone={done} /> : null}
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
