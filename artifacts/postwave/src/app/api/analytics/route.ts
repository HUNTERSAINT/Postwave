import { and, eq, gte, sql } from "drizzle-orm";
import { postPlatforms, posts } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * First-party publishing analytics.
 *
 * These are Postwave's own publishing metrics, not social-network reach,
 * impressions or engagement. Those require provider/platform analytics APIs.
 */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const requestedDays = Number(url.searchParams.get("days") ?? "30");
    if (!Number.isInteger(requestedDays) || requestedDays < 7 || requestedDays > 90) {
      throw new HttpError(400, "Choose an analytics period between 7 and 90 days.");
    }

    const { db } = getDatabase();
    const since = new Date(Date.now() - requestedDays * 24 * 60 * 60 * 1000);

    const [summary] = await db
      .select({
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${posts.status} = 'published')::int`,
        partial: sql<number>`count(*) filter (where ${posts.status} = 'partial')::int`,
        failed: sql<number>`count(*) filter (where ${posts.status} = 'failed')::int`,
        scheduled: sql<number>`count(*) filter (where ${posts.status} = 'scheduled')::int`,
        drafts: sql<number>`count(*) filter (where ${posts.status} = 'draft')::int`,
        paused: sql<number>`count(*) filter (where ${posts.status} = 'paused')::int`,
      })
      .from(posts)
      .where(and(eq(posts.userId, user.id), gte(posts.createdAt, since)));

    const daily = await db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${posts.createdAt}), 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${posts.status} = 'published')::int`,
        failed: sql<number>`count(*) filter (where ${posts.status} = 'failed')::int`,
      })
      .from(posts)
      .where(and(eq(posts.userId, user.id), gte(posts.createdAt, since)))
      .groupBy(sql`date_trunc('day', ${posts.createdAt})`)
      .orderBy(sql`date_trunc('day', ${posts.createdAt})`);

    const platforms = await db
      .select({
        platform: postPlatforms.platform,
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${postPlatforms.status} = 'published')::int`,
        failed: sql<number>`count(*) filter (where ${postPlatforms.status} = 'failed')::int`,
        pending: sql<number>`count(*) filter (where ${postPlatforms.status} in ('queued', 'scheduled', 'publishing'))::int`,
      })
      .from(postPlatforms)
      .where(
        and(
          eq(postPlatforms.userId, user.id),
          gte(postPlatforms.updatedAt, since),
        ),
      )
      .groupBy(postPlatforms.platform)
      .orderBy(postPlatforms.platform);

    const targetTotals = platforms.reduce(
      (totals, platform) => ({
        total: totals.total + platform.total,
        published: totals.published + platform.published,
        failed: totals.failed + platform.failed,
        pending: totals.pending + platform.pending,
      }),
      { total: 0, published: 0, failed: 0, pending: 0 },
    );

    return jsonResponse({
      periodDays: requestedDays,
      since: since.toISOString(),
      generatedAt: new Date().toISOString(),
      source: "postwave-publishing-activity",
      note: "These are publishing workflow metrics. Reach, impressions, clicks and engagement are not included unless supplied by a connected platform analytics API.",
      posts: {
        total: summary?.total ?? 0,
        published: summary?.published ?? 0,
        partial: summary?.partial ?? 0,
        failed: summary?.failed ?? 0,
        scheduled: summary?.scheduled ?? 0,
        drafts: summary?.drafts ?? 0,
        paused: summary?.paused ?? 0,
        daily,
      },
      destinations: {
        ...targetTotals,
        byPlatform: platforms,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
