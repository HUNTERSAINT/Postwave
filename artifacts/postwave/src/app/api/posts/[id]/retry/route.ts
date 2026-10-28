import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { postPlatforms, posts } from "@/db/schema";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requireUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse, parseJson } from "@/lib/http";
import { getPublishQueue } from "@/lib/queue/publish-queue";

const schema = z.object({ accountId: z.string().uuid() });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    await enforceRateLimit(request, "posts-retry-user", 10, 60, user.id);
    const { id: postId } = await context.params;
    const input = await parseJson(request, schema);
    const queue = getPublishQueue();
    const { db } = getDatabase();

    const [ownedPost] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.userId, user.id)))
      .limit(1);
    if (!ownedPost) throw new HttpError(404, "Post was not found.");

    const [failedTarget] = await db
      .select({ id: postPlatforms.id })
      .from(postPlatforms)
      .where(
        and(
          eq(postPlatforms.postId, postId),
          eq(postPlatforms.accountId, input.accountId),
          eq(postPlatforms.userId, user.id),
          eq(postPlatforms.status, "failed"),
        ),
      )
      .limit(1);
    if (!failedTarget) {
      throw new HttpError(404, "No failed destination was found for this post.");
    }

    const [queuedTarget] = await db
      .update(postPlatforms)
      .set({ status: "queued", errorMessage: null, updatedAt: new Date() })
      .where(
        and(
          eq(postPlatforms.id, failedTarget.id),
          eq(postPlatforms.userId, user.id),
          eq(postPlatforms.status, "failed"),
        ),
      )
      .returning({ id: postPlatforms.id });
    if (!queuedTarget) {
      throw new HttpError(409, "This destination is already being retried.");
    }
    await db
      .update(posts)
      .set({ status: "queued", updatedAt: new Date() })
      .where(and(eq(posts.id, postId), eq(posts.userId, user.id)));

    const idempotencyKey = `postwave-retry-${randomUUID()}`;
    try {
      await queue.add(
        "retry-post",
        {
          postId,
          userId: user.id,
          targetIds: [failedTarget.id],
          idempotencyKey,
        },
        { jobId: `retry-${failedTarget.id}-${randomUUID()}` },
      );
    } catch {
      await db
        .update(postPlatforms)
        .set({
          status: "failed",
          errorMessage: "The publishing queue is unavailable. Retry this post.",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(postPlatforms.id, failedTarget.id),
            eq(postPlatforms.userId, user.id),
          ),
        );
      throw new HttpError(503, "The publishing queue is unavailable. Please retry.");
    }

    return jsonResponse({ ok: true, status: "queued" }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}
