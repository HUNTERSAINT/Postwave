"use client";

import { useEffect, useState } from "react";

function isInstalledApp() {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      document.referrer.startsWith("android-app://")
    );
  } catch {
    return false;
  }
}

/** Short branded animation shown once each time the installed app is opened. */
export function LaunchSplash() {
  const [phase, setPhase] = useState<"off" | "in" | "out">("off");

  useEffect(() => {
    if (!isInstalledApp()) return;
    try {
      if (sessionStorage.getItem("pw-splash") === "1") return;
      sessionStorage.setItem("pw-splash", "1");
    } catch {
      /* storage unavailable: still show once per page load */
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase("in");
    const fade = window.setTimeout(() => setPhase("out"), reduced ? 500 : 1900);
    const done = window.setTimeout(() => setPhase("off"), reduced ? 800 : 2400);
    return () => { window.clearTimeout(fade); window.clearTimeout(done); };
  }, []);

  if (phase === "off") return null;
  return (
    <div className={`pw-splash ${phase === "out" ? "is-out" : ""}`} aria-hidden="true">
      <div className="pw-splash-orb" />
      <svg className="pw-splash-logo" viewBox="0 0 40 40" fill="none">
        <defs>
          <linearGradient id="pw-splash-grad" x1="0" y1="0" x2="40" y2="40">
            <stop stopColor="#2dd4bf" />
            <stop offset="1" stopColor="#0284c7" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="12" fill="url(#pw-splash-grad)" />
        <path className="pw-splash-wave pw-splash-wave-1" d="M6 17C10.3 17 10.3 23 14.6 23C18.9 23 18.9 17 23.2 17C27.5 17 27.5 23 34 23" stroke="#f5ffff" strokeWidth="3" strokeLinecap="round" />
        <path className="pw-splash-wave pw-splash-wave-2" d="M7 26C11 26 11 30 15 30C19 30 19 26 23 26C27 26 27 30 33 30" stroke="#9ce1d8" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <div className="pw-splash-word font-display">postwave</div>
      <div className="pw-splash-tag">One post. Every platform.</div>
    </div>
  );
}
