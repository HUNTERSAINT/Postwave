import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { mediaAssets } from "@/db/schema";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requireUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse, parseJson } from "@/lib/http";
import { deleteUploadedObject, verifyUploadedObject } from "@/lib/storage/s3";

const schema = z.object({ key: z.string().min(1).max(512) });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit(request, "media-complete-user", 30, 60, user.id);
    const input = await parseJson(request, schema);
    const { db } = getDatabase();
    const [existing] = await db
      .select({
        id: mediaAssets.id,
        objectKey: mediaAssets.objectKey,
        publicUrl: mediaAssets.publicUrl,
        contentType: mediaAssets.contentType,
        size: mediaAssets.size,
      })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.objectKey, input.key),
          eq(mediaAssets.userId, user.id),
        ),
      )
      .limit(1);
    if (existing) {
      return jsonResponse({
        media: {
          id: existing.id,
          key: existing.objectKey,
          publicUrl: existing.publicUrl,
          contentType: existing.contentType,
          size: existing.size,
        },
      });
    }

    try {
      const verified = await verifyUploadedObject(user.id, input.key);
      const [media] = await db
        .insert(mediaAssets)
        .values({
          id: randomUUID(),
          userId: user.id,
          objectKey: input.key,
          publicUrl: verified.publicUrl,
          contentType: verified.contentType,
          size: verified.size,
        })
        .returning({
          id: mediaAssets.id,
          objectKey: mediaAssets.objectKey,
          publicUrl: mediaAssets.publicUrl,
          contentType: mediaAssets.contentType,
          size: mediaAssets.size,
        });
      return jsonResponse({
        media: {
          id: media.id,
          key: media.objectKey,
          publicUrl: media.publicUrl,
          contentType: media.contentType,
          size: media.size,
        },
      });
    } catch (error) {
      await deleteUploadedObject(user.id, input.key).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
