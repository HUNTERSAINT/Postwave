import { requireUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse } from "@/lib/http";
import { getPlanSummary } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const { db } = getDatabase();
    const summary = await getPlanSummary(db, user.id);
    if (!summary) throw new HttpError(404, "Account not found.");
    return jsonResponse({ plan: summary });
  } catch (error) {
    return errorResponse(error);
  }
}
