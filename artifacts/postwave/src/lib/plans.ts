import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  postPlatforms,
  posts,
  socialAccounts,
  users,
  planTier,
} from "@/db/schema";
import type { getDatabase } from "@/lib/db";

export type PlanName = (typeof planTier.enumValues)[number];
type Database = ReturnType<typeof getDatabase>["db"];
type PlanUser = typeof users.$inferSelect;

export const PLAN_LIMITS: Record<
  PlanName,
  { accounts: number; postsPerMonth: number | null; scheduling: boolean }
> = {
  free: { accounts: 1, postsPerMonth: 10, scheduling: false },
  pro: { accounts: 3, postsPerMonth: null, scheduling: true },
  business: { accounts: 8, postsPerMonth: null, scheduling: true },
};

export function resolveEffectivePlan(user: PlanUser, now = new Date()) {
  const grantActive =
    user.planSource === "admin_grant" &&
    Boolean(user.grantedAt) &&
    (!user.grantExpiresAt || user.grantExpiresAt > now);
  if (grantActive) {
    return {
      plan: user.plan,
      status: "active" as const,
      source: "admin_grant" as const,
      grantActive: true,
    };
  }

  if (
    user.planSource === "trial" &&
    user.trialEndsAt &&
    user.trialEndsAt > now
  ) {
    return {
      plan: "pro" as const,
      status: "trialing" as const,
      source: "trial" as const,
      grantActive: false,
    };
  }

  if (
    user.paidPlan !== "free" &&
    user.billingNextChargeAt &&
    user.billingFailedAttempts < 3
  ) {
    return {
      plan: user.paidPlan,
      status: user.billingFailedAttempts > 0 ? ("past_due" as const) : ("active" as const),
      source: "paid" as const,
      grantActive: false,
    };
  }

  return {
    plan: "free" as const,
    status: "free" as const,
    source: "free" as const,
    grantActive: false,
  };
}

export async function applyPlanEntitlements(
  db: Database,
  userId: string,
  plan: PlanName,
  now = new Date(),
) {
  const limits = PLAN_LIMITS[plan];
  const accounts = await db
    .select({ id: socialAccounts.id, planPaused: socialAccounts.planPaused })
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.userId, userId),
        eq(socialAccounts.isActive, true),
      ),
    )
    .orderBy(asc(socialAccounts.connectedAt));
  const overLimitIds = accounts
    .slice(limits.accounts)
    .map((account) => account.id);
  await db
    .update(socialAccounts)
    .set({ planPaused: false, updatedAt: now })
    .where(
      and(
        eq(socialAccounts.userId, userId),
        eq(socialAccounts.isActive, true),
        eq(socialAccounts.planPaused, true),
      ),
    );
  if (overLimitIds.length) {
    await db
      .update(socialAccounts)
      .set({ planPaused: true, updatedAt: now })
      .where(inArray(socialAccounts.id, overLimitIds));
  }

  if (limits.scheduling) {
    const resumable = await db
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.userId, userId),
          eq(posts.status, "paused"),
          inArray(posts.pausedReason, ["plan_downgrade", "trial_ended"]),
        ),
      );
    const resumableIds = resumable.map((post) => post.id);
    if (resumableIds.length) {
      await db
        .update(posts)
        .set({
          status: "scheduled",
          pausedAt: null,
          pausedReason: null,
          updatedAt: now,
        })
        .where(inArray(posts.id, resumableIds));
      await db
        .update(postPlatforms)
        .set({ status: "scheduled", errorMessage: null, updatedAt: now })
        .where(
          and(
            eq(postPlatforms.userId, userId),
            inArray(postPlatforms.postId, resumableIds),
            eq(postPlatforms.status, "paused"),
          ),
        );
    }
    return;
  }

  const scheduled = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.userId, userId), eq(posts.status, "scheduled")));
  const scheduledIds = scheduled.map((post) => post.id);
  if (!scheduledIds.length) return;

  await db
    .update(posts)
    .set({
      status: "paused",
      pausedAt: now,
      pausedReason: "plan_downgrade",
      updatedAt: now,
    })
    .where(inArray(posts.id, scheduledIds));
  await db
    .update(postPlatforms)
    .set({
      status: "paused",
      errorMessage: "Paused because your plan does not include scheduling.",
      updatedAt: now,
    })
    .where(
      and(
        eq(postPlatforms.userId, userId),
        inArray(postPlatforms.postId, scheduledIds),
        eq(postPlatforms.status, "scheduled"),
      ),
    );
}

export async function getPlanSummary(
  db: Database,
  userId: string,
  now = new Date(),
) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const effective = resolveEffectivePlan(user, now);
  if (
    user.plan !== effective.plan ||
    user.planStatus !== effective.status ||
    user.planSource !== effective.source
  ) {
    await db
      .update(users)
      .set({
        plan: effective.plan,
        planStatus: effective.status,
        planSource: effective.source,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
  }
  await applyPlanEntitlements(db, userId, effective.plan, now);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [postCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(
      and(
        eq(posts.userId, userId),
        gte(posts.submittedAt, monthStart),
      ),
    );
  const [accountCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      paused: sql<number>`count(*) filter (where ${socialAccounts.planPaused})::int`,
    })
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.userId, userId),
        eq(socialAccounts.isActive, true),
      ),
    );
  const [pausedPosts] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(
      and(
        eq(posts.userId, userId),
        eq(posts.status, "paused"),
      ),
    );
  const limits = PLAN_LIMITS[effective.plan];

  return {
    plan: effective.plan,
    planStatus: effective.status,
    planSource: effective.source,
    limits,
    usage: {
      postsThisMonth: postCount?.count ?? 0,
      connectedAccounts: accountCounts?.total ?? 0,
      pausedAccounts: accountCounts?.paused ?? 0,
      pausedPosts: pausedPosts?.count ?? 0,
    },
    trialStartedAt: user.trialStartedAt,
    trialEndsAt: user.trialEndsAt,
    trialDaysRemaining:
      effective.source === "trial" && user.trialEndsAt
        ? Math.max(
            0,
            Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / 86_400_000),
          )
        : 0,
    grantExpiresAt:
      effective.source === "admin_grant" ? user.grantExpiresAt : null,
    grantNote: effective.source === "admin_grant" ? user.grantNote : null,
    currency: user.currency,
    timezone: user.timezone,
    billingCurrency: user.billingCurrency,
    billingNextChargeAt: user.billingNextChargeAt,
    billingPaused: user.billingPaused,
  };
}
