import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import {
  mediaAssets,
  postMedia,
  postPlatforms,
  posts,
  socialAccounts,
} from "@/db/schema";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requireUser } from "@/lib/auth/session";
import { assertPostAllowed } from "@/lib/plan-guards";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse, parseJson } from "@/lib/http";
import { getPublishQueue } from "@/lib/queue/publish-queue";
import { countCharacters, platformCharacterLimit } from "@/lib/social/platform-limits";

const schema = z.object({
  intent: z.enum(["draft", "schedule", "publish_now"]).default("publish_now"),
  draftId: z.string().uuid().optional(),
  title: z.string().max(150).optional(),
  content: z.string().max(5000).default(""),
  accountIds: z.array(z.string().uuid()).max(20).default([]),
  mediaAssetIds: z.array(z.string().uuid()).max(10).default([]),
  scheduledFor: z.string().optional(),
  timezone: z.string().min(1).max(64).optional(),
}).refine(
  (value) => new Set(value.accountIds).size === value.accountIds.length,
  { message: "Each destination can only be selected once." },
).refine(
  (value) => new Set(value.mediaAssetIds).size === value.mediaAssetIds.length,
  { message: "Each media file can only be attached once." },
).refine(
  (value) =>
    value.intent === "draft" || value.accountIds.length > 0,
  { message: "Choose at least one destination before publishing or scheduling." },
).refine(
  (value) => value.content.trim().length > 0 || value.mediaAssetIds.length > 0,
  { message: "Add text or media before saving this post." },
).refine(
  (value) => value.intent !== "schedule" || Boolean(value.scheduledFor),
  { message: "Choose a date and time for the scheduled post." },
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { db } = getDatabase();
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const filters = [eq(posts.userId, user.id)];
    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;
      if (
        !fromDate ||
        !toDate ||
        !Number.isFinite(fromDate.getTime()) ||
        !Number.isFinite(toDate.getTime()) ||
        toDate <= fromDate
      ) {
        throw new HttpError(400, "A valid start and end date are required.");
      }
      filters.push(gte(posts.scheduledAt, fromDate), lt(posts.scheduledAt, toDate));
    }
    const rows = await db
      .select({
        id: posts.id,
        content: posts.content,
        status: posts.status,
        createdAt: posts.createdAt,
        scheduledAt: posts.scheduledAt,
        timezone: posts.timezone,
      })
      .from(posts)
      .where(and(...filters))
      .orderBy(from && to ? desc(posts.scheduledAt) : desc(posts.createdAt))
      .limit(from && to ? 500 : 100);
    if (!rows.length) return jsonResponse({ posts: [] });

    const targets = await db
      .select({
        postId: postPlatforms.postId,
        accountId: postPlatforms.accountId,
        platform: postPlatforms.platform,
        status: postPlatforms.status,
        errorMessage: postPlatforms.errorMessage,
        platformPostUrl: postPlatforms.platformPostUrl,
      })
      .from(postPlatforms)
      .where(
        and(
          eq(postPlatforms.userId, user.id),
          inArray(postPlatforms.postId, rows.map((post) => post.id)),
        ),
      );
    const postIds = new Set(rows.map((post) => post.id));
    const grouped = new Map<string, typeof targets>();
    for (const target of targets) {
      if (!postIds.has(target.postId)) continue;
      grouped.set(target.postId, [...(grouped.get(target.postId) ?? []), target]);
    }

    return jsonResponse({
      posts: rows.map((post) => ({
        ...post,
        platforms: (grouped.get(post.id) ?? []).map((target) => ({
          accountId: target.accountId,
          platform: target.platform,
          status: target.status,
          errorMessage: target.errorMessage,
          platformPostUrl: target.platformPostUrl,
        })),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit(request, "posts-create-user", 10, 60, user.id);
    await enforceRateLimit(request, "posts-create-ip", 30, 60);
    const input = await parseJson(request, schema);
    const content = (input.content ?? "").trim();
    const title = (input.title ?? "").trim() || null;
    const accountIds = input.accountIds ?? [];
    const mediaAssetIds = input.mediaAssetIds ?? [];
    const timezone = input.timezone ?? user.timezone ?? "Africa/Lagos";
    let scheduledAt: Date | null = null;
    if (input.intent === "schedule") {
      if (!input.scheduledFor) {
        throw new HttpError(400, "Enter a valid scheduled date and time.");
      }
      const hasExplicitOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(input.scheduledFor);
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone });
        if (hasExplicitOffset) {
          scheduledAt = new Date(input.scheduledFor);
        } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.scheduledFor)) {
          scheduledAt = fromZonedTime(input.scheduledFor, timezone);
        } else {
          throw new HttpError(400, "Enter a valid scheduled date and time.");
        }
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(400, "Choose a valid timezone.");
      }
      if (!Number.isFinite(scheduledAt.getTime())) {
        throw new HttpError(400, "Enter a valid scheduled date and time.");
      }
      if (scheduledAt.getTime() < Date.now() + 60_000) {
        throw new HttpError(400, "Choose a scheduled time at least one minute from now.");
      }
      if (!hasExplicitOffset) {
        const localTime = new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).formatToParts(scheduledAt);
        const displayed = Object.fromEntries(localTime.map((part) => [part.type, part.value]));
        const [datePart, timePart] = input.scheduledFor.split("T");
        if (
          `${displayed.year}-${displayed.month}-${displayed.day}T${displayed.hour}:${displayed.minute}` !==
          `${datePart}T${timePart}`
        ) {
          throw new HttpError(400, "That time does not exist in the selected timezone.");
        }
      }
    }
    const { db } = getDatabase();
    await assertPostAllowed(user.id, input.intent ?? "publish_now");

    const accounts = await db
      .select({
        id: socialAccounts.id,
        providerAccountId: socialAccounts.zernioAccountId,
        platform: socialAccounts.platform,
        isActive: socialAccounts.isActive,
        planPaused: socialAccounts.planPaused,
      })
      .from(socialAccounts)
      .where(eq(socialAccounts.userId, user.id));
    if (
      input.intent !== "draft" &&
      accounts.some(
        (account) =>
          accountIds.includes(account.id) && account.isActive && account.planPaused,
      )
    ) {
      throw new HttpError(
        403,
        "One or more selected accounts are paused because they are over your plan's account limit. Upgrade or choose other accounts.",
      );
    }
    const accountMap = new Map(
      accounts
      .filter((account) => account.isActive)
        .map((account) => [account.id, account]),
    );
    const selectedAccounts = accountIds
      .map((id) => accountMap.get(id))
      .filter((account) => account !== undefined);
    if (selectedAccounts.length !== accountIds.length) {
      throw new HttpError(
        400,
        "One or more selected accounts are not active on your account.",
      );
    }
    if (input.intent !== "draft") {
      const characterCount = countCharacters(content);
      const tooLongFor = selectedAccounts.find((account) => {
        const limit = platformCharacterLimit(account.platform);
        return limit !== undefined && characterCount > limit;
      });
      if (tooLongFor) {
        throw new HttpError(
          400,
          `This post exceeds the ${tooLongFor.platform} character limit.`,
        );
      }
    }

    let media: { id: string; contentType: string }[] = [];
    if (mediaAssetIds.length) {
      media = await db
        .select({ id: mediaAssets.id, contentType: mediaAssets.contentType })
        .from(mediaAssets)
        .where(
          and(
            eq(mediaAssets.userId, user.id),
            inArray(mediaAssets.id, mediaAssetIds),
          ),
        );
      const mediaIds = new Set(media.map((asset) => asset.id));
      if (mediaAssetIds.some((id) => !mediaIds.has(id))) {
        throw new HttpError(400, "One or more media files are not available.");
      }
    }

    if (input.intent !== "draft") {
      const hasVideo = media.some((asset) => asset.contentType.startsWith("video/"));
      const platformsSelected = new Set<string>(selectedAccounts.map((account) => String(account.platform)));
      if (platformsSelected.has("youtube") && !hasVideo) {
        throw new HttpError(
          400,
          "YouTube posts need a video. Attach a video, or remove YouTube from this post.",
        );
      }
      if (platformsSelected.has("tiktok") && media.length === 0) {
        throw new HttpError(
          400,
          "TikTok posts need a video or photos. Attach media, or remove TikTok from this post.",
        );
      }
      const needsMedia = ["instagram", "pinterest"].filter(
        (platform) => platformsSelected.has(platform),
      );
      if (needsMedia.length > 0 && media.length === 0) {
        throw new HttpError(
          400,
          `${needsMedia.map((name) => name[0].toUpperCase() + name.slice(1)).join(" and ")} posts need an image or video. Attach media, or remove ${needsMedia.length > 1 ? "them" : "it"} from this post.`,
        );
      }
    }

    const postId = input.draftId ?? randomUUID();
    const idempotencyKey = `postwave-${randomUUID()}`;
    const status: "draft" | "scheduled" | "queued" =
      input.intent === "draft"
        ? "draft"
        : input.intent === "schedule"
          ? "scheduled"
          : "queued";
    const targetStatus: "draft" | "scheduled" | "queued" =
      input.intent === "draft"
        ? "draft"
        : input.intent === "schedule"
          ? "scheduled"
          : "queued";
    await db.transaction(async (tx) => {
      if (input.draftId) {
        const updated = await tx
          .update(posts)
          .set({
            title,
            content,
            status,
            scheduledAt,
            timezone,
            submittedAt: input.intent === "draft" ? null : new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(posts.id, postId),
              eq(posts.userId, user.id),
              eq(posts.status, "draft"),
            ),
          )
          .returning({ id: posts.id });
        if (!updated.length) {
          throw new HttpError(404, "That draft could not be found.");
        }
        await tx
          .delete(postPlatforms)
          .where(
            and(
              eq(postPlatforms.postId, postId),
              eq(postPlatforms.userId, user.id),
            ),
          );
        await tx
          .delete(postMedia)
          .where(and(eq(postMedia.postId, postId), eq(postMedia.userId, user.id)));
      } else {
        await tx.insert(posts).values({
          id: postId,
          userId: user.id,
          title,
          content,
          status,
          scheduledAt,
          timezone,
          submittedAt: input.intent === "draft" ? null : new Date(),
        });
      }
      if (selectedAccounts.length) {
        await tx.insert(postPlatforms).values(
          selectedAccounts.map((account) => ({
            postId,
            userId: user.id,
            accountId: account.id,
            zernioAccountId: account.providerAccountId,
            platform: account.platform,
            status: targetStatus,
          })),
        );
      }
      if (mediaAssetIds.length) {
        await tx.insert(postMedia).values(
          mediaAssetIds.map((mediaId) => ({
            postId,
            mediaId,
            userId: user.id,
          })),
        );
      }
    });

    if (input.intent === "publish_now") {
      try {
        await getPublishQueue().add(
          "publish-post",
          { postId, userId: user.id, idempotencyKey },
          { jobId: `post-${postId}` },
        );
      } catch {
        await db
          .update(posts)
          .set({ status: "failed", updatedAt: new Date() })
          .where(and(eq(posts.id, postId), eq(posts.userId, user.id)));
        await db
          .update(postPlatforms)
          .set({
            status: "failed",
            errorMessage: "The publishing queue is unavailable. Retry this post.",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(postPlatforms.postId, postId),
              eq(postPlatforms.userId, user.id),
            ),
          );
        throw new HttpError(503, "The publishing queue is unavailable. Please retry.");
      }
    }

    return jsonResponse(
      { postId, status },
      input.draftId ? 200 : 201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
