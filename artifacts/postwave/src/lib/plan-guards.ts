import { and, eq, sql } from "drizzle-orm";
import { socialAccounts } from "@/db/schema";
import { getDatabase } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { getPlanSummary } from "@/lib/plans";

type PostIntent = "draft" | "schedule" | "publish_now";

/**
 * Throws a 403 with an upgrade message when the user's effective plan does not
 * allow this kind of post. Drafts are always allowed.
 */
export async function assertPostAllowed(userId: string, intent: PostIntent) {
  if (intent === "draft") return null;
  const { db } = getDatabase();
  const summary = await getPlanSummary(db, userId);
  if (!summary) throw new HttpError(401, "Sign in to continue.");

  if (intent === "schedule" && !summary.limits.scheduling) {
    throw new HttpError(
      403,
      "Scheduling is available on Pro and Business plans. Upgrade to schedule posts.",
    );
  }
  const monthlyLimit = summary.limits.postsPerMonth;
  if (monthlyLimit !== null && summary.usage.postsThisMonth >= monthlyLimit) {
    throw new HttpError(
      403,
      `You have used all ${monthlyLimit} posts included in the Free plan this month. Upgrade to keep posting.`,
    );
  }
  return summary;
}

/**
 * Throws a 403 when the user already has as many connected accounts as their
 * plan includes.
 */
export async function assertCanConnectAccount(userId: string) {
  const { db } = getDatabase();
  const summary = await getPlanSummary(db, userId);
  if (!summary) throw new HttpError(401, "Sign in to continue.");

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(socialAccounts)
    .where(
      and(eq(socialAccounts.userId, userId), eq(socialAccounts.isActive, true)),
    );
  const connected = row?.count ?? 0;
  if (connected >= summary.limits.accounts) {
    throw new HttpError(
      403,
      `Your ${summary.plan} plan includes ${summary.limits.accounts} connected accounts. Disconnect one or upgrade to add more.`,
    );
  }
  return summary;
}
