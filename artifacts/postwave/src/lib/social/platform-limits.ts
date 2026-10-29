const CHARACTER_LIMITS: Record<string, number> = {
  instagram: 2_200,
  facebook: 63_206,
  threads: 500,
  linkedin: 3_000,
  twitter: 280,
  tiktok: 2_200,
  youtube: 5_000,
  pinterest: 500,
  reddit: 40_000,
  bluesky: 300,
  googlebusiness: 1_500,
  telegram: 4_096,
  discord: 2_000,
  slack: 40_000,
  whatsapp: 4_096,
};

export function platformCharacterLimit(platform: string) {
  return CHARACTER_LIMITS[platform];
}

export function countCharacters(value: string) {
  return Array.from(value).length;
}
