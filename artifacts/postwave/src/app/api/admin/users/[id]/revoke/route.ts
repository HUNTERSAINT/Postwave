import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse, parseJson, parseUuid } from "@/lib/http";
import { revokeGrant } from "@/lib/grants";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/notifications";

const schema = z.object({ note: z.string().trim().max(500).optional() });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit(request, "admin-revoke", 60, 60, admin.id);
    const userId = parseUuid((await context.params).id);
    const input = await parseJson(request, schema);
    const { db } = getDatabase();
    const user = await revokeGrant(db, {
      adminId: admin.id,
      userId,
      note: input.note || null,
    });
    try {
      await sendEmail(user, {
        subject: "Your complimentary Postwave plan has ended",
        paragraphs: [
          "Your complimentary plan access has ended. Anything above your current plan's limits is paused, not deleted. Upgrade any time to restore it.",
        ],
        action: { label: "See plans", path: "/billing" },
      });
    } catch (error) {
      logger.warn(
        { errorName: error instanceof Error ? error.name : "UnknownError" },
        "Revoke notification email could not be sent",
      );
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
