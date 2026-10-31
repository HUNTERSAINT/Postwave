import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { socialAccounts, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/http";
import { hasActivePaidSubscription } from "@/lib/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const { db } = getDatabase();
    const pattern = `%${escapeLike(query)}%`;
    const rows = await db
      .select()
      .from(users)
      .where(
        query
          ? or(ilike(users.email, pattern), ilike(users.name, pattern))
          : undefined,
      )
      .orderBy(desc(users.createdAt))
      .limit(25);

    const accountRows = rows.length
      ? await db
          .select({
            userId: socialAccounts.userId,
            platform: socialAccounts.platform,
            username: socialAccounts.username,
            displayName: socialAccounts.displayName,
          })
          .from(socialAccounts)
          .where(
            and(
              eq(socialAccounts.isActive, true),
              inArray(socialAccounts.userId, rows.map((user) => user.id)),
            ),
          )
      : [];

    return jsonResponse({
      users: rows.map((user) => ({
        accounts: accountRows
          .filter((account) => account.userId === user.id)
          .map((account) => ({
            platform: account.platform,
            name: account.username || account.displayName || "",
          })),
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerifiedAt !== null,
        plan: user.plan,
        planStatus: user.planStatus,
        planSource: user.planSource,
        paidPlan: user.paidPlan,
        hasPaidSubscription: hasActivePaidSubscription(user),
        trialEndsAt: user.trialEndsAt,
        trialSuspicious: user.trialSuspicious,
        grantExpiresAt: user.grantExpiresAt,
        grantNote: user.grantNote,
        grantBillingPaused: user.grantBillingPaused,
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
