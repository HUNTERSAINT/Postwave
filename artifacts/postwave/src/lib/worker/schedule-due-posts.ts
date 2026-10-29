import { and, eq, lte } from "drizzle-orm";
import { postPlatforms, posts } from "@/db/schema";
import { getDatabase } from "@/lib/db";
import { getPublishQueue } from "@/lib/queue/publish-queue";
import { logger } from "@/lib/logger";

export async function enqueueDueScheduledPosts() {
  const { db } = getDatabase();
  const duePosts = await db
    .select({
      id: posts.id,
      userId: posts.userId,
      scheduledAt: posts.scheduledAt,
    })
    .from(posts)
    .where(
      and(
        eq(posts.status, "scheduled"),
        lte(posts.scheduledAt, new Date()),
      ),
    )
    .limit(100);

  if (!duePosts.length) return;
  const queue = getPublishQueue();
  for (const post of duePosts) {
    if (!post.scheduledAt) continue;
    const jobId = `post-${post.id}-${post.scheduledAt.getTime()}`;
    try {
      await queue.add(
        "publish-post",
        {
          postId: post.id,
          userId: post.userId,
          idempotencyKey: `postwave-scheduled-${post.id}-${post.scheduledAt.getTime()}`,
        },
        { jobId },
      );
      await db
        .update(posts)
        .set({ status: "queued", updatedAt: new Date() })
        .where(
          and(
            eq(posts.id, post.id),
            eq(posts.userId, post.userId),
            eq(posts.status, "scheduled"),
          ),
        );
      await db
        .update(postPlatforms)
        .set({ status: "queued", updatedAt: new Date() })
        .where(
          and(
            eq(postPlatforms.postId, post.id),
            eq(postPlatforms.userId, post.userId),
            eq(postPlatforms.status, "scheduled"),
          ),
        );
    } catch (error) {
      logger.warn(
        {
          postId: post.id,
          errorName:
            error instanceof Error
              ? error.name
              : "UnknownError",
        },
        "Scheduled post could not be added to the publishing queue",
      );
    }
  }
}
