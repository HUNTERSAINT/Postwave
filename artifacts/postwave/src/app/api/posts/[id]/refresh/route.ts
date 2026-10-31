import { and, eq, inArray } from "drizzle-orm";
import { postPlatforms, posts } from "@/db/schema";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requireUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse } from "@/lib/http";
import { lateProvider } from "@/lib/social/late-provider";
import { normalizedStatus, updatePostStatus } from "@/lib/worker/publish-post";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Re-checks a post that looks stuck with the publishing provider and updates its status. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    await enforceRateLimit(request, "posts-refresh-user", 20, 60, user.id);
    const { id } = await context.params;
    const { db } = getDatabase();
    const [post] = await db
      .select({
        id: posts.id,
        status: posts.status,
        providerPostId: posts.zernioPostId,
        submittedAt: posts.submittedAt,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(and(eq(posts.id, id), eq(posts.userId, user.id)))
      .limit(1);
    if (!post) throw new HttpError(404, "Post was not found.");
    if (!["publishing", "queued", "scheduled", "partial"].includes(post.status)) {
      return jsonResponse({ status: post.status, message: "This post is already final." });
    }

    const targets = await db
      .select({
        id: postPlatforms.id,
        platform: postPlatforms.platform,
        providerAccountId: postPlatforms.zernioAccountId,
        status: postPlatforms.status,
      })
      .from(postPlatforms)
      .where(and(eq(postPlatforms.postId, post.id), eq(postPlatforms.userId, user.id)));
    const open = targets.filter((target) => !["published", "failed"].includes(target.status));

    if (!post.providerPostId) {
      const since = (post.submittedAt ?? post.createdAt).getTime();
      if (Date.now() - since < 10 * 60 * 1000) {
        return jsonResponse({ status: post.status, message: "This post is still being sent. Check again in a few minutes." });
      }
      if (open.length) {
        await db
          .update(postPlatforms)
          .set({
            status: "failed",
            errorMessage: "This post never reached the publishing provider. You can retry it.",
            updatedAt: new Date(),
          })
          .where(and(inArray(postPlatforms.id, open.map((target) => target.id)), eq(postPlatforms.userId, user.id)));
      }
      await updatePostStatus(post.id, user.id);
      return jsonResponse({ status: "failed", message: "This post never reached the provider. Use Retry to send it again." });
    }

    const result = await lateProvider.getStatus(post.providerPostId);
    const unmatched = [...result.targets];
    for (const target of open) {
      let index = unmatched.findIndex((item) => item.accountId === target.providerAccountId);
      if (index < 0) {
        const samePlatform = unmatched
          .map((item, i) => ({ item, i }))
          .filter(({ item }) => item.platform === target.platform);
        const sameCount = open.filter((item) => item.platform === target.platform).length;
        if (sameCount === 1 && samePlatform.length === 1) index = samePlatform[0].i;
      }
      const match = index >= 0 ? unmatched.splice(index, 1)[0] : undefined;
      if (!match) continue;
      const status = normalizedStatus(match.status);
      await db
        .update(postPlatforms)
        .set({
          status,
          errorMessage: status === "failed" ? match.errorMessage ?? "The platform rejected this post." : null,
          platformPostUrl: match.postUrl ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(postPlatforms.id, target.id), eq(postPlatforms.userId, user.id)));
    }
    await updatePostStatus(post.id, user.id);
    const [after] = await db
      .select({ status: posts.status })
      .from(posts)
      .where(and(eq(posts.id, post.id), eq(posts.userId, user.id)))
      .limit(1);
    return jsonResponse({
      status: after?.status ?? post.status,
      message:
        after?.status === "publishing"
          ? "Still publishing. The platform hasn't confirmed yet."
          : "Status updated.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
