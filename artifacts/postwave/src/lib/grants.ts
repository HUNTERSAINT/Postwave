import { and, eq, isNotNull, lte } from "drizzle-orm";
import { planGrants, users } from "@/db/schema";
import type { getDatabase } from "@/lib/db";
import { getPlanSummary } from "@/lib/plans";

type Database = ReturnType<typeof getDatabase>["db"];

/**
 * Ends every admin grant whose expiry has passed. The user falls back to their
 * paid plan, or to Free, and anything above the new limits is paused (never
 * deleted). Returns the users whose grants just ended.
 */
export async function expireDueGrants(db: Database, now = new Date()) {
  const due = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      grantExpiresAt: users.grantExpiresAt,
      grantBillingPaused: users.grantBillingPaused,
    })
    .from(users)
    .where(
      and(
        eq(users.planSource, "admin_grant"),
        isNotNull(users.grantExpiresAt),
        lte(users.grantExpiresAt, now),
      ),
    )
    .limit(200);

  for (const user of due) {
    await db
      .update(planGrants)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(planGrants.userId, user.id),
          eq(planGrants.status, "active"),
          isNotNull(planGrants.expiresAt),
          lte(planGrants.expiresAt, now),
        ),
      );
    if (user.grantBillingPaused) {
      await db
        .update(users)
        .set({ billingPaused: false, grantBillingPaused: false, updatedAt: now })
        .where(eq(users.id, user.id));
    }
    // Recomputes the effective plan and pauses extra accounts and posts.
    await getPlanSummary(db, user.id, now);
  }
  return due;
}
