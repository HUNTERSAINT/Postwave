import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requireUser } from "@/lib/auth/session";
import { getAnalyticsSummary } from "@/lib/analytics";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit(request, "analytics-user", 20, 60, user.id);
    const url = new URL(request.url);
    const requested = Number(url.searchParams.get("days") ?? 30);
    const days = [7, 30, 90].includes(requested) ? requested : 30;
    const { db } = getDatabase();
    const summary = await getAnalyticsSummary(db, user, days, url.searchParams.get("refresh") === "1");
    return jsonResponse({ analytics: summary });
  } catch (error) {
    return errorResponse(error);
  }
}
