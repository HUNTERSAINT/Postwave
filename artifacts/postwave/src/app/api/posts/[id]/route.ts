import { and, eq, inArray } from "drizzle-orm";
import {
  mediaAssets,
  postMedia,
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
        title: posts.title,
        content: posts.content,
        status: posts.status,
        createdAt: posts.createdAt,
        publishedAt: posts.publishedAt,
        scheduledAt: posts.scheduledAt,
        timezone: posts.timezone,
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
    const media = await db
      .select({
        id: mediaAssets.id,
        key: mediaAssets.objectKey,
        publicUrl: mediaAssets.publicUrl,
        contentType: mediaAssets.contentType,
        size: mediaAssets.size,
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
    return jsonResponse({ post: { ...post, platforms, media } });
  } catch (error) {
    return errorResponse(error);
  }
}
