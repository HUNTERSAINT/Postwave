import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/** Branded launch animation, ~3.2s, then fades away. */
export function Launch({ onDone }: { onDone: () => void }) {
  const logo = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(logo, { toValue: 1, duration: 1100, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      Animated.timing(word, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(out, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(onDone);
  }, [logo, word, out, onDone]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: out, zIndex: 99 }]} pointerEvents="none">
      <LinearGradient colors={["#0d9b98", "#14b8a6", "#0a6e86"]} style={styles.fill}>
        <Animated.View style={{ transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }], opacity: logo }}>
          <Text style={styles.logo}>〰️</Text>
        </Animated.View>
        <Animated.Text style={[styles.word, { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>Postwave</Animated.Text>
        <Animated.Text style={[styles.tag, { opacity: word }]}>One post. Every platform.</Animated.Text>
      </LinearGradient>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { fontSize: 84, color: "#fff" },
  word: { color: "#fff", fontSize: 38, fontWeight: "800", marginTop: 12, letterSpacing: 0.5 },
  tag: { color: "rgba(255,255,255,.85)", fontSize: 15, marginTop: 6 },
});
