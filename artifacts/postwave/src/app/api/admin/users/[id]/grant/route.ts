import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse, parseJson, parseUuid } from "@/lib/http";
import { grantDurationKeys, grantPlan } from "@/lib/grants";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/notifications";

const schema = z.object({
  plan: z.enum(["free", "pro", "business"]),
  duration: z.enum(grantDurationKeys),
  note: z.string().trim().max(500).optional(),
  pauseBilling: z.boolean().default(true),
  confirmPaidOverride: z.boolean().default(false),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit(request, "admin-grant", 60, 60, admin.id);
    const userId = parseUuid((await context.params).id);
    const input = await parseJson(request, schema);
    const { db } = getDatabase();

    const result = await grantPlan(db, {
      adminId: admin.id,
      userId,
      plan: input.plan,
      duration: input.duration,
      note: input.note || null,
      pauseBilling: input.pauseBilling ?? true,
      confirmPaidOverride: input.confirmPaidOverride ?? false,
    });

    if (result.needsConfirmation) {
      return jsonResponse(
        {
          requiresConfirmation: true,
          paidPlan: result.paidPlan,
          message: `This user has an active paid ${result.paidPlan} subscription. Choose whether to pause their billing during the grant (the renewal date moves back by the grant's length) or keep it as is (a renewal that falls due during the grant is charged when the grant ends), then confirm.`,
        },
        409,
      );
    }

    try {
      await sendEmail(result, {
        subject: `You now have complimentary ${input.plan} access on Postwave`,
        paragraphs: [
          result.expiresAt
            ? `Postwave has given you the ${input.plan} plan until ${result.expiresAt.toUTCString()}.`
            : `Postwave has given you the ${input.plan} plan with no end date.`,
        ],
        action: { label: "Open Postwave", path: "/dashboard" },
      });
    } catch (error) {
      logger.warn(
        { errorName: error instanceof Error ? error.name : "UnknownError" },
        "Grant notification email could not be sent",
      );
    }
    return jsonResponse({ ok: true, expiresAt: result.expiresAt });
  } catch (error) {
    return errorResponse(error);
  }
}
