import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const ORB = 360;

/** Branded launch animation (~4.2s): glowing orb, logo, ripple waves, wordmark, tagline, then fade out. */
export function Launch({ onDone }: { onDone: () => void }) {
  const orb = useRef(new Animated.Value(0)).current;
  const logo = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const tag = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const rings = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(orb, { toValue: 1, duration: 1400, easing: ease, useNativeDriver: true }),
      Animated.timing(logo, { toValue: 1, duration: 1100, delay: 350, easing: Easing.out(Easing.back(1.7)), useNativeDriver: true }),
      ...rings.map((r, i) => Animated.timing(r, { toValue: 1, duration: 1500, delay: 1000 + i * 380, easing: Easing.out(Easing.quad), useNativeDriver: true })),
      Animated.timing(word, { toValue: 1, duration: 800, delay: 1900, easing: ease, useNativeDriver: true }),
      Animated.timing(tag, { toValue: 1, duration: 800, delay: 2500, easing: ease, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(3700),
        Animated.timing(out, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => { if (finished) onDone(); });
  }, [orb, logo, word, tag, out, rings, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: out, zIndex: 99 }]} pointerEvents="auto">
      <LinearGradient colors={["#0a6e86", "#0d9b98", "#14b8a6"]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.fill}>
        <View style={styles.center}>
          <Animated.View style={[styles.orb, { opacity: orb.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }), transform: [{ scale: orb.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.3] }) }] }]} />
          {rings.map((r, i) => (
            <Animated.View key={i} style={[styles.ring, { opacity: r.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.7, 0] }), transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.6] }) }] }]} />
          ))}
          <Animated.View style={{ opacity: logo, transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { rotate: logo.interpolate({ inputRange: [0, 1], outputRange: ["-12deg", "0deg"] }) }] }}>
            <Image source={require("../assets/icon.png")} style={styles.logo} />
          </Animated.View>
        </View>
        <Animated.Text style={[styles.word, { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>Postwave</Animated.Text>
        <Animated.Text style={[styles.tag, { opacity: tag, transform: [{ translateY: tag.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>One post. Every platform.</Animated.Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { width: 240, height: 240, alignItems: "center", justifyContent: "center" },
  orb: { position: "absolute", width: ORB, height: ORB, borderRadius: ORB / 2, backgroundColor: "#ffffff" },
  ring: { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 3, borderColor: "rgba(255,255,255,0.9)" },
  logo: { width: 132, height: 132, borderRadius: 32 },
  word: { color: "#fff", fontSize: 40, fontWeight: "800", letterSpacing: 0.5, marginTop: 28 },
  tag: { color: "rgba(255,255,255,0.88)", fontSize: 16, marginTop: 8 },
});
