import { and, eq } from "drizzle-orm";
import { socialAccounts } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse } from "@/lib/http";
import { lateProvider } from "@/lib/social/late-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const { db } = getDatabase();
    const [account] = await db
      .select({
        id: socialAccounts.id,
        zernioAccountId: socialAccounts.zernioAccountId,
        isActive: socialAccounts.isActive,
      })
      .from(socialAccounts)
      .where(and(eq(socialAccounts.id, id), eq(socialAccounts.userId, user.id)))
      .limit(1);
    if (!account) throw new HttpError(404, "Connected account was not found.");
    if (account.isActive) {
      await lateProvider.disconnect(account.zernioAccountId);
      await db
        .update(socialAccounts)
        .set({ isActive: false, disconnectedAt: new Date() })
        .where(and(eq(socialAccounts.id, account.id), eq(socialAccounts.userId, user.id)));
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
