export const C = {
  bg: "#effaf8", card: "#ffffff", ink: "#0f2a2a", muted: "#5f7b7a", line: "#d5ebe8",
  brand: "#0d9b98", brandDark: "#087a78", danger: "#d64545", ok: "#1d9a5b", warn: "#c98a12",
};
export const platformNames: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", threads: "Threads", linkedin: "LinkedIn", twitter: "X",
  tiktok: "TikTok", youtube: "YouTube", pinterest: "Pinterest", reddit: "Reddit", bluesky: "Bluesky",
  googlebusiness: "Google Business", telegram: "Telegram", discord: "Discord", slack: "Slack", whatsapp: "WhatsApp",
};
export const connectable = ["instagram", "facebook", "threads", "linkedin", "twitter", "tiktok", "youtube", "pinterest", "reddit", "bluesky", "googlebusiness"];
export const nameOf = (p: string) => platformNames[p] ?? p;
