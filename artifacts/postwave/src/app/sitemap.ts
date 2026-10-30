import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.APP_URL || "https://postwave.app").replace(/\/$/, "");
  return [
    {
      url: baseUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...["pricing", "privacy", "terms", "data-deletion"].map((path) => ({
      url: `${baseUrl}/${path}`,
      changeFrequency: "monthly" as const,
      priority: path === "pricing" ? 0.8 : 0.4,
    })),
  ];
}
