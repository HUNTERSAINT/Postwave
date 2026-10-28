import { desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
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
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse, parseJson } from "@/lib/http";
import { getPublishQueue } from "@/lib/queue/publish-queue";

const schema = z.object({
  content: z.string().trim().min(1).max(5000),
  accountIds: z.array(z.string().uuid()).min(1).max(20),
  mediaAssetIds: z.array(z.string().uuid()).max(10).default([]),
}).refine(
  (value) => new Set(value.accountIds).size === value.accountIds.length,
  { message: "Each destination can only be selected once." },
).refine(
  (value) => new Set(value.mediaAssetIds).size === value.mediaAssetIds.length,
  { message: "Each media file can only be attached once." },
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const { db } = getDatabase();
    const rows = await db
      .select({
        id: posts.id,
        content: posts.content,
        status: posts.status,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(eq(posts.userId, user.id))
      .orderBy(desc(posts.createdAt))
      .limit(100);
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
        eq(postPlatforms.userId, user.id),
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
    const queue = getPublishQueue();
    const { db } = getDatabase();

    const accounts = await db
      .select({
        id: socialAccounts.id,
        providerAccountId: socialAccounts.zernioAccountId,
        platform: socialAccounts.platform,
      })
      .from(socialAccounts)
      .where(eq(socialAccounts.userId, user.id));
    const accountMap = new Map(
      accounts
        .filter((account) => account.isActive !== false)
        .map((account) => [account.id, account]),
    );
    const selectedAccounts = input.accountIds
      .map((id) => accountMap.get(id))
      .filter((account) => account !== undefined);
    if (selectedAccounts.length !== input.accountIds.length) {
      throw new HttpError(
        400,
        "One or more selected accounts are not active on your account.",
      );
    }

    let media: { id: string }[] = [];
    if (input.mediaAssetIds.length) {
      media = await db
        .select({ id: mediaAssets.id })
        .from(mediaAssets)
        .where(
          eq(mediaAssets.userId, user.id),
        );
      const mediaIds = new Set(media.map((asset) => asset.id));
      if (input.mediaAssetIds.some((id) => !mediaIds.has(id))) {
        throw new HttpError(400, "One or more media files are not available.");
      }
    }

    const postId = randomUUID();
    const idempotencyKey = `postwave-${randomUUID()}`;
    await db.transaction(async (tx) => {
      await tx.insert(posts).values({
        id: postId,
        userId: user.id,
        content: input.content,
        status: "queued",
      });
      await tx.insert(postPlatforms).values(
        selectedAccounts.map((account) => ({
          postId,
          userId: user.id,
          accountId: account.id,
          zernioAccountId: account.providerAccountId,
          platform: account.platform,
          status: "queued" as const,
        })),
      );
      if (input.mediaAssetIds.length) {
        await tx.insert(postMedia).values(
          input.mediaAssetIds.map((mediaId) => ({
            postId,
            mediaId,
            userId: user.id,
          })),
        );
      }
    });

    try {
      await queue.add(
        "publish-post",
        { postId, userId: user.id, idempotencyKey },
        { jobId: `post-${postId}` },
      );
    } catch {
      await db
        .update(posts)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(posts.id, postId));
      await db
        .update(postPlatforms)
        .set({
          status: "failed",
          errorMessage: "The publishing queue is unavailable. Retry this post.",
          updatedAt: new Date(),
        })
        .where(eq(postPlatforms.postId, postId));
      throw new HttpError(503, "The publishing queue is unavailable. Please retry.");
    }

    return jsonResponse({ postId, status: "queued" }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
