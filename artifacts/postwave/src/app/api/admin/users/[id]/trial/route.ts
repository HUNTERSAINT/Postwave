import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse, parseJson, parseUuid } from "@/lib/http";
import { extendTrial } from "@/lib/grants";

const schema = z.object({ days: z.number().int().min(1).max(90) });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit(request, "admin-trial", 60, 60, admin.id);
    const userId = parseUuid((await context.params).id);
    const input = await parseJson(request, schema);
    const { db } = getDatabase();
    const result = await extendTrial(db, {
      adminId: admin.id,
      userId,
      days: input.days,
    });
    return jsonResponse({ ok: true, trialEndsAt: result.endsAt });
  } catch (error) {
    return errorResponse(error);
  }
}
