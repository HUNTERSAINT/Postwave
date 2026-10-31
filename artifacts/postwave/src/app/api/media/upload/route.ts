import { randomUUID } from "node:crypto";
import { mediaAssets } from "@/db/schema";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requireUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse } from "@/lib/http";
import {
  deleteUploadedObject,
  putObjectFromServer,
  validateUploadMetadata,
  verifyUploadedObject,
} from "@/lib/storage/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Receives the raw file as the request body and stores it. Uploading through
 * the server avoids browser-to-bucket CORS problems with S3-compatible stores.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit(request, "media-upload-user", 30, 60, user.id);
    const contentType = (request.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const declared = Number(request.headers.get("content-length") ?? "0");
    validateUploadMetadata(contentType, declared);

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength === 0) throw new HttpError(400, "The file is empty.");
    const key = await putObjectFromServer(user.id, contentType, bytes);

    try {
      const verified = await verifyUploadedObject(user.id, key);
      const { db } = getDatabase();
      const [media] = await db
        .insert(mediaAssets)
        .values({
          id: randomUUID(),
          userId: user.id,
          objectKey: key,
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
      await deleteUploadedObject(user.id, key).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
