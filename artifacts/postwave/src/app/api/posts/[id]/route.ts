import { and, eq, inArray } from "drizzle-orm";
import {
  postPlatforms,
  posts,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const { db } = getDatabase();
    const [post] = await db
      .select({
        id: posts.id,
        content: posts.content,
        status: posts.status,
        createdAt: posts.createdAt,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(and(eq(posts.id, id), eq(posts.userId, user.id)))
      .limit(1);
    if (!post) throw new HttpError(404, "Post was not found.");

    const platforms = await db
      .select({
        accountId: postPlatforms.accountId,
        platform: postPlatforms.platform,
        status: postPlatforms.status,
        errorMessage: postPlatforms.errorMessage,
        platformPostUrl: postPlatforms.platformPostUrl,
      })
      .from(postPlatforms)
      .where(
        and(
          eq(postPlatforms.postId, post.id),
          eq(postPlatforms.userId, user.id),
        ),
      );
    return jsonResponse({ post: { ...post, platforms } });
  } catch (error) {
    return errorResponse(error);
  }
}
