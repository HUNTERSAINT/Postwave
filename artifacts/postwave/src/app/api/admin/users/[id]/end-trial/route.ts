import { requireAdmin } from "@/lib/auth/admin";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse, parseUuid } from "@/lib/http";
import { endTrial } from "@/lib/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit(request, "admin-end-trial", 60, 60, admin.id);
    const userId = parseUuid((await context.params).id);
    const { db } = getDatabase();
    await endTrial(db, { adminId: admin.id, userId });
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
