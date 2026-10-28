import { and, eq, inArray, sql } from "drizzle-orm";
import type { Job } from "bullmq";
import {
  mediaAssets,
  postMedia,
  postPlatforms,
  posts,
  socialAccounts,
  users,
} from "@/db/schema";
import { getDatabase } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { ensureZernioProfile, lateProvider } from "@/lib/social/late-provider";
import type { PublishJobData } from "@/lib/queue/publish-queue";

function normalizedStatus(status?: string) {
  const value = (status ?? "").toLowerCase();
  if (["published", "success", "completed"].includes(value)) return "published" as const;
  if (["failed", "error", "rejected"].includes(value)) return "failed" as const;
  return "publishing" as const;
}

export async function updatePostStatus(postId: string, userId: string) {
  const { db } = getDatabase();
  const targets = await db
    .select({ status: postPlatforms.status })
    .from(postPlatforms)
    .where(and(eq(postPlatforms.postId, postId), eq(postPlatforms.userId, userId)));
  const values = targets.map((target) => target.status);
  let status: "published" | "failed" | "partial" | "publishing";
  if (values.length && values.every((value) => value === "published")) {
    status = "published";
  } else if (values.length && values.every((value) => value === "failed")) {
    status = "failed";
  } else if (values.some((value) => value === "queued" || value === "publishing")) {
    status = "publishing";
  } else {
    status = "partial";
  }

  await db
    .update(posts)
    .set({
      status,
      ...(status === "published" ? { publishedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)));
}

async function failTargets(
  targetIds: string[],
  userId: string,
  message: string,
) {
  const { db } = getDatabase();
  if (!targetIds.length) return;
  await db
    .update(postPlatforms)
    .set({
      status: "failed",
      errorMessage: message,
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(postPlatforms.id, targetIds),
        eq(postPlatforms.userId, userId),
      ),
    );
}

export async function processPublishJob(
  data: PublishJobData,
  job?: Pick<Job<PublishJobData>, "id" | "attemptsMade" | "opts">,
) {
  const { db } = getDatabase();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      zernioProfileId: users.zernioProfileId,
    })
    .from(users)
    .where(eq(users.id, data.userId))
    .limit(1);
  const [post] = await db
    .select({ id: posts.id, content: posts.content })
    .from(posts)
    .where(and(eq(posts.id, data.postId), eq(posts.userId, data.userId)))
    .limit(1);

  if (!user || !post) return;

  const filters = [
    eq(postPlatforms.postId, post.id),
    eq(postPlatforms.userId, user.id),
    eq(postPlatforms.status, "queued"),
  ];
  if (data.targetIds?.length) {
    filters.push(inArray(postPlatforms.id, data.targetIds));
  }
  const targets = await db
    .select({
      id: postPlatforms.id,
      accountId: postPlatforms.accountId,
      providerAccountId: postPlatforms.zernioAccountId,
      platform: postPlatforms.platform,
    })
    .from(postPlatforms)
    .where(and(...filters));
  if (!targets.length) return;

  const targetIds = targets.map((target) => target.id);
  await db
    .update(posts)
    .set({ status: "publishing", updatedAt: new Date() })
    .where(and(eq(posts.id, post.id), eq(posts.userId, user.id)));
  await db
    .update(postPlatforms)
    .set({
      status: "publishing",
      errorMessage: null,
      attempts: sql`${postPlatforms.attempts} + 1`,
      updatedAt: new Date(),
    })
    .where(and(inArray(postPlatforms.id, targetIds), eq(postPlatforms.userId, user.id)));

  const media = await db
    .select({
      publicUrl: mediaAssets.publicUrl,
      contentType: mediaAssets.contentType,
    })
    .from(postMedia)
    .innerJoin(mediaAssets, eq(postMedia.mediaId, mediaAssets.id))
    .where(
      and(
        eq(postMedia.postId, post.id),
        eq(postMedia.userId, user.id),
        eq(mediaAssets.userId, user.id),
      ),
    );

  try {
    const profileId = await ensureZernioProfile(user);
    const result = await lateProvider.publish({
      profileId,
      content: post.content,
      accounts: targets.map((target) => ({
        accountId: target.providerAccountId,
        platform: target.platform,
      })),
      media: media.map((asset) => ({
        url: asset.publicUrl,
        type: asset.contentType.startsWith("video/") ? "video" : "image",
      })),
      idempotencyKey: data.idempotencyKey,
    });

    await db
      .update(posts)
      .set({
        ...(result.postId ? { zernioPostId: result.postId } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(posts.id, post.id), eq(posts.userId, user.id)));

    const unmatched = [...result.targets];
    const targetUpdates = targets.map((target) => {
      let matchIndex = unmatched.findIndex(
        (item) => item.accountId === target.providerAccountId,
      );
      if (matchIndex < 0) {
        const samePlatform = unmatched
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.platform === target.platform);
        const platformTargetCount = targets.filter(
          (item) => item.platform === target.platform,
        ).length;
        if (platformTargetCount === 1 && samePlatform.length === 1) {
          matchIndex = samePlatform[0].index;
        }
      }
      const match =
        matchIndex >= 0 ? unmatched.splice(matchIndex, 1)[0] : undefined;
      return { target, match };
    });

    for (const { target, match } of targetUpdates) {
      if (!match) {
        await db
          .update(postPlatforms)
          .set({
            status: result.postId ? "publishing" : "failed",
            errorMessage: result.postId
              ? null
              : "The provider did not return a delivery status.",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(postPlatforms.id, target.id),
              eq(postPlatforms.userId, user.id),
            ),
          );
        continue;
      }

      const status = normalizedStatus(match.status);
      await db
        .update(postPlatforms)
        .set({
          status,
          errorMessage: status === "failed" ? match.errorMessage ?? "The platform rejected this post." : null,
          platformPostUrl: match.postUrl ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(postPlatforms.id, target.id),
            eq(postPlatforms.userId, user.id),
          ),
        );
    }

    await updatePostStatus(post.id, user.id);
  } catch (error) {
    const maxAttempts = Number(job?.opts.attempts ?? 1);
    const isFinalAttempt = (job?.attemptsMade ?? maxAttempts - 1) + 1 >= maxAttempts;
    if (!isFinalAttempt && error instanceof HttpError && error.status >= 500) {
      await db
        .update(postPlatforms)
        .set({ status: "queued", errorMessage: null, updatedAt: new Date() })
        .where(and(inArray(postPlatforms.id, targetIds), eq(postPlatforms.userId, user.id)));
      await db
        .update(posts)
        .set({ status: "queued", updatedAt: new Date() })
        .where(and(eq(posts.id, post.id), eq(posts.userId, user.id)));
      throw error;
    }

    logger.warn(
      {
        postId: post.id,
        targetCount: targetIds.length,
        errorName: error instanceof Error ? error.name : "UnknownError",
      },
      "Post delivery failed",
    );
    await failTargets(
      targetIds,
      user.id,
      "Postwave could not deliver this post. Review the destination account and retry.",
    );
    await updatePostStatus(post.id, user.id);
  }
}
