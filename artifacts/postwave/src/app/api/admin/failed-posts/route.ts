import { desc, eq } from "drizzle-orm";
import { postPlatforms, posts, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const { db } = getDatabase();
    const rows = await db
      .select({
        id: postPlatforms.id,
        platform: postPlatforms.platform,
        errorMessage: postPlatforms.errorMessage,
        attempts: postPlatforms.attempts,
        updatedAt: postPlatforms.updatedAt,
        postId: posts.id,
        content: posts.content,
        userEmail: users.email,
      })
      .from(postPlatforms)
      .innerJoin(posts, eq(postPlatforms.postId, posts.id))
      .innerJoin(users, eq(postPlatforms.userId, users.id))
      .where(eq(postPlatforms.status, "failed"))
      .orderBy(desc(postPlatforms.updatedAt))
      .limit(50);
    return jsonResponse({
      failures: rows.map((row) => ({
        ...row,
        content: row.content.slice(0, 140),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
