import { asc, eq } from "drizzle-orm";
import { socialAccounts } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const { db } = getDatabase();
    const accounts = await db
      .select({
        id: socialAccounts.id,
        platform: socialAccounts.platform,
        username: socialAccounts.username,
        displayName: socialAccounts.displayName,
        profileUrl: socialAccounts.profileUrl,
        isActive: socialAccounts.isActive,
        connectedAt: socialAccounts.connectedAt,
      })
      .from(socialAccounts)
      .where(eq(socialAccounts.userId, user.id))
      .orderBy(asc(socialAccounts.platform), asc(socialAccounts.displayName));
    return jsonResponse({ accounts });
  } catch (error) {
    return errorResponse(error);
  }
}
