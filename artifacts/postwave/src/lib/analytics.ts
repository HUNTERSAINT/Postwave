import { and, eq, gte, inArray } from "drizzle-orm";
import { postPlatforms, posts } from "@/db/schema";
import type { getDatabase } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { fetchZernioAnalytics } from "@/lib/social/late-provider";

type Database = ReturnType<typeof getDatabase>["db"];
type Obj = Record<string, unknown>;

export type Metrics = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  clicks: number;
};

export type AnalyticsSummary = {
  days: number;
  generatedAt: string;
  providerAvailable: boolean;
  totals: Metrics & { published: number; engagement: number; engagementRate: number; withData: number };
  platforms: (Metrics & { platform: string; published: number; engagement: number; engagementRate: number })[];
  timeline: { date: string; published: number; views: number; engagement: number }[];
  topPosts: {
    id: string;
    content: string;
    publishedAt: string | null;
    platforms: string[];
    thumbnailUrl: string | null;
    url: string | null;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    engagement: number;
  }[];
};

const emptyMetrics = (): Metrics => ({ views: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, clicks: 0 });
const obj = (value: unknown): Obj =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const str = (value: unknown) => (typeof value === "string" && value ? value : null);

function metricsFrom(value: unknown): Metrics {
  const a = obj(value);
  return {
    views: num(a.views) || num(a.impressions),
    likes: num(a.likes),
    comments: num(a.comments),
    shares: num(a.shares) + num(a.reposts),
    saves: num(a.saves),
    reach: num(a.reach),
    clicks: num(a.clicks),
  };
}
const engagementOf = (m: Metrics) => m.likes + m.comments + m.shares + m.saves;
function add(into: Metrics, from: Metrics) {
  into.views += from.views;
  into.likes += from.likes;
  into.comments += from.comments;
  into.shares += from.shares;
  into.saves += from.saves;
  into.reach += from.reach;
  into.clicks += from.clicks;
}
const rate = (engagement: number, views: number) =>
  views > 0 ? Math.round((engagement / views) * 10000) / 100 : 0;
const dayKey = (date: Date) => date.toISOString().slice(0, 10);

const cache = new Map<string, { at: number; value: AnalyticsSummary }>();

export async function getAnalyticsSummary(
  db: Database,
  user: { id: string; zernioProfileId?: string | null },
  days: number,
  force = false,
): Promise<AnalyticsSummary> {
  const key = `${user.id}:${days}`;
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;

  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000);
  const rows = await db
    .select({
      id: posts.id,
      content: posts.content,
      title: posts.title,
      publishedAt: posts.publishedAt,
      submittedAt: posts.submittedAt,
      createdAt: posts.createdAt,
      providerPostId: posts.zernioPostId,
    })
    .from(posts)
    .where(
      and(
        eq(posts.userId, user.id),
        inArray(posts.status, ["published", "partial"]),
        gte(posts.createdAt, new Date(since.getTime() - 7 * 86_400_000)),
      ),
    );
  const inRange = rows.filter((row) => {
    const when = row.publishedAt ?? row.submittedAt ?? row.createdAt;
    return when >= since;
  });
  const ids = inRange.map((row) => row.id);
  const targets = ids.length
    ? await db
        .select({
          postId: postPlatforms.postId,
          platform: postPlatforms.platform,
          status: postPlatforms.status,
          url: postPlatforms.platformPostUrl,
        })
        .from(postPlatforms)
        .where(and(eq(postPlatforms.userId, user.id), inArray(postPlatforms.postId, ids)))
    : [];

  const publishedTargets = targets.filter((target) => target.status === "published");
  const byPostPlatforms = new Map<string, string[]>();
  const byPostUrl = new Map<string, string>();
  for (const target of publishedTargets) {
    byPostPlatforms.set(target.postId, [...(byPostPlatforms.get(target.postId) ?? []), target.platform]);
    if (target.url && !byPostUrl.has(target.postId)) byPostUrl.set(target.postId, target.url);
  }

  const platformStats = new Map<string, Metrics & { published: number }>();
  for (const target of publishedTargets) {
    const entry = platformStats.get(target.platform) ?? { ...emptyMetrics(), published: 0 };
    entry.published += 1;
    platformStats.set(target.platform, entry);
  }

  // Provider metrics. Only posts that belong to this user (matched by our stored provider id) are used.
  let providerAvailable = true;
  const own = new Map(inRange.filter((row) => row.providerPostId).map((row) => [row.providerPostId as string, row]));
  const totals = emptyMetrics();
  const perPost = new Map<string, Metrics>();
  const timelineMap = new Map<string, { published: number; views: number; engagement: number }>();
  let withData = 0;

  for (const row of inRange) {
    const when = row.publishedAt ?? row.submittedAt ?? row.createdAt;
    const bucket = timelineMap.get(dayKey(when)) ?? { published: 0, views: 0, engagement: 0 };
    bucket.published += 1;
    timelineMap.set(dayKey(when), bucket);
  }

  if (user.zernioProfileId && own.size) {
    try {
      const items = await fetchZernioAnalytics({
        profileId: user.zernioProfileId,
        fromDate: dayKey(new Date(since.getTime() - 86_400_000)),
        toDate: dayKey(new Date(now.getTime() + 86_400_000)),
      });
      for (const item of items) {
        const providerId = str(item.latePostId) ?? str(item.postId) ?? str(item._id) ?? str(item.id);
        const row = providerId ? own.get(providerId) : undefined;
        if (!row) continue;
        const platformEntries = Array.isArray(item.platformAnalytics) ? item.platformAnalytics : [];
        const combined = emptyMetrics();
        if (platformEntries.length) {
          for (const raw of platformEntries) {
            const entry = obj(raw);
            if (entry.status && entry.status !== "published") continue;
            const metrics = metricsFrom(entry.analytics);
            add(combined, metrics);
            const platform = str(entry.platform);
            if (platform) {
              const stat = platformStats.get(platform) ?? { ...emptyMetrics(), published: 0 };
              add(stat, metrics);
              platformStats.set(platform, stat);
            }
          }
        } else {
          add(combined, metricsFrom(item.analytics));
        }
        if (engagementOf(combined) + combined.views > 0) withData += 1;
        perPost.set(row.id, combined);
        add(totals, combined);
        const when = row.publishedAt ?? row.submittedAt ?? row.createdAt;
        const bucket = timelineMap.get(dayKey(when));
        if (bucket) {
          bucket.views += combined.views;
          bucket.engagement += engagementOf(combined);
        }
      }
    } catch (error) {
      providerAvailable = false;
      logger.warn(
        { errorName: error instanceof Error ? error.name : "UnknownError", status: error instanceof HttpError ? error.status : undefined },
        "Analytics provider request failed",
      );
    }
  }

  const timeline: AnalyticsSummary["timeline"] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = dayKey(new Date(now.getTime() - i * 86_400_000));
    const bucket = timelineMap.get(date);
    timeline.push({ date, published: bucket?.published ?? 0, views: bucket?.views ?? 0, engagement: bucket?.engagement ?? 0 });
  }

  const topPosts = inRange
    .map((row) => {
      const metrics = perPost.get(row.id) ?? emptyMetrics();
      return {
        id: row.id,
        content: (row.title ? `${row.title} — ${row.content}` : row.content).slice(0, 220),
        publishedAt: (row.publishedAt ?? row.submittedAt ?? row.createdAt).toISOString(),
        platforms: Array.from(new Set(byPostPlatforms.get(row.id) ?? [])),
        thumbnailUrl: null,
        url: byPostUrl.get(row.id) ?? null,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        saves: metrics.saves,
        engagement: engagementOf(metrics),
      };
    })
    .sort((a, b) => b.engagement - a.engagement || b.views - a.views)
    .slice(0, 8);

  const engagement = engagementOf(totals);
  const value: AnalyticsSummary = {
    days,
    generatedAt: now.toISOString(),
    providerAvailable,
    totals: { ...totals, published: inRange.length, engagement, engagementRate: rate(engagement, totals.views), withData },
    platforms: Array.from(platformStats.entries())
      .map(([platform, stat]) => {
        const eng = engagementOf(stat);
        return { platform, ...stat, engagement: eng, engagementRate: rate(eng, stat.views) };
      })
      .sort((a, b) => b.engagement - a.engagement || b.views - a.views || b.published - a.published),
    timeline,
    topPosts,
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}
