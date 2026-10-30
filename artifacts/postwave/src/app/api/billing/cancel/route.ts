import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse } from "@/lib/http";
import { users } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stops future automatic renewals but preserves access through the paid period. */
export async function POST() {
  try {
    const user = await requireUser();
    const { db } = getDatabase();
    const [account] = await db
      .select({
        paidPlan: users.paidPlan,
        billingNextChargeAt: users.billingNextChargeAt,
        planSource: users.planSource,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (!account || account.paidPlan === "free" || account.planSource !== "paid") {
      throw new HttpError(409, "There is no active paid subscription to cancel.");
    }
    await db
      .update(users)
      .set({
        paystackAuthorizationCode: null,
        paystackAuthorizationReusable: false,
        billingPaused: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    return jsonResponse({
      cancelled: true,
      accessUntil: account.billingNextChargeAt,
      message: "Automatic renewal is cancelled. Your paid access remains until the current billing period ends.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
