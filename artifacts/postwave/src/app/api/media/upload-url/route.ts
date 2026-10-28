import { z } from "zod";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requireUser } from "@/lib/auth/session";
import { errorResponse, jsonResponse, parseJson } from "@/lib/http";
import { createUploadUrl } from "@/lib/storage/s3";

const schema = z.object({
  name: z.string().trim().min(1).max(255),
  contentType: z.string().trim().max(128),
  size: z.number().int().positive(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit(request, "media-upload-user", 30, 60, user.id);
    const input = await parseJson(request, schema);
    const result = await createUploadUrl(
      user.id,
      input.contentType,
      input.size,
    );
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
