import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import {
  auditLog,
  notificationEvents,
  planGrants,
  users,
} from "@/db/schema";
import type { getDatabase } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { getPlanSummary, type PlanName } from "@/lib/plans";

type Database = ReturnType<typeof getDatabase>["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;
type UserRow = typeof users.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;

export const grantDurationKeys = ["7d", "30d", "90d", "1y", "none"] as const;
export type GrantDuration = (typeof grantDurationKeys)[number];

const GRANT_DURATION_MS: Record<GrantDuration, number | null> = {
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
  "90d": 90 * DAY_MS,
  "1y": 365 * DAY_MS,
  none: null,
};

/** A paid plan with a renewal date is an active subscription. */
export function hasActivePaidSubscription(user: UserRow) {
  return (
    user.paidPlan !== "free" &&
    user.billingNextChargeAt !== null &&
    user.billingFailedAttempts < 3
  );
}

function isGrantActive(user: UserRow, now: Date) {
  return (
    user.planSource === "admin_grant" &&
    user.grantedAt !== null &&
    (user.grantExpiresAt === null || user.grantExpiresAt > now)
  );
}

/**
 * Closes the user's current grant. If billing was paused for the grant, the
 * next renewal moves back by the time the grant actually ran, so the user is
 * never charged for the complimentary period.
 */
async function endGrant(
  executor: Executor,
  user: UserRow,
  status: "expired" | "revoked",
  now: Date,
) {
  const update: Partial<typeof users.$inferInsert> = {
    grantBillingPaused: false,
    updatedAt: now,
  };
  if (user.grantBillingPaused && user.billingNextChargeAt && user.grantedAt) {
    const endedAt = user.grantExpiresAt
      ? new Date(Math.min(now.getTime(), user.grantExpiresAt.getTime()))
      : now;
    const ranFor = Math.max(0, endedAt.getTime() - user.grantedAt.getTime());
    update.billingNextChargeAt = new Date(
      user.billingNextChargeAt.getTime() + ranFor,
    );
  }
  if (status === "revoked") update.grantExpiresAt = now;

  await executor
    .update(planGrants)
    .set({
      status,
      updatedAt: now,
      ...(status === "revoked" ? { revokedAt: now } : {}),
    })
    .where(and(eq(planGrants.userId, user.id), eq(planGrants.status, "active")));
  await executor.update(users).set(update).where(eq(users.id, user.id));
}

/**
 * Ends every admin grant whose expiry has passed. The user falls back to their
 * paid plan, or to Free, and anything above the new limits is paused (never
 * deleted). Returns the users whose grants just ended.
 */
export async function expireDueGrants(db: Database, now = new Date()) {
  const due = await db
    .select()
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
    await endGrant(db, user, "expired", now);
    // Recomputes the effective plan and pauses extra accounts and posts.
    await getPlanSummary(db, user.id, now);
  }
  return due.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    grantExpiresAt: user.grantExpiresAt,
  }));
}

export type GrantInput = {
  adminId: string;
  userId: string;
  plan: PlanName;
  duration: GrantDuration;
  note?: string | null;
  /** Only meaningful when the user has an active paid subscription. */
  pauseBilling: boolean;
  /** The admin has seen the paid-subscription warning and wants to go ahead. */
  confirmPaidOverride: boolean;
};

export async function grantPlan(db: Database, input: GrantInput) {
  const now = new Date();
  const durationMs = GRANT_DURATION_MS[input.duration];
  const expiresAt =
    durationMs === null ? null : new Date(now.getTime() + durationMs);

  const outcome = await db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.userId))
      .for("update")
      .limit(1);
    if (!user) throw new HttpError(404, "User not found.");

    const paid = hasActivePaidSubscription(user);
    if (paid && !input.confirmPaidOverride) {
      return { needsConfirmation: true as const, paidPlan: user.paidPlan };
    }

    const replacing = isGrantActive(user, now);
    let current = user;
    if (replacing) {
      await endGrant(tx, user, "revoked", now);
      const [fresh] = await tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      if (fresh) current = fresh;
    }

    const pauseBilling = hasActivePaidSubscription(current) && input.pauseBilling;
    await tx.insert(planGrants).values({
      userId: input.userId,
      grantedBy: input.adminId,
      plan: input.plan,
      duration: input.duration,
      note: input.note ?? null,
      pauseBilling,
      grantedAt: now,
      expiresAt,
    });
    await tx
      .update(users)
      .set({
        plan: input.plan,
        planStatus: "active",
        planSource: "admin_grant",
        grantedBy: input.adminId,
        grantedAt: now,
        grantExpiresAt: expiresAt,
        grantNote: input.note ?? null,
        grantBillingPaused: pauseBilling,
        updatedAt: now,
      })
      .where(eq(users.id, input.userId));
    await tx.insert(auditLog).values({
      adminId: input.adminId,
      userId: input.userId,
      action: replacing ? "change_grant" : "grant",
      plan: input.plan,
      duration: input.duration,
      note: input.note ?? null,
    });
    return {
      needsConfirmation: false as const,
      email: user.email,
      name: user.name,
      expiresAt,
    };
  });

  if (outcome.needsConfirmation) return outcome;
  // Resumes anything that was paused by the previous plan.
  await getPlanSummary(db, input.userId, now);
  return outcome;
}

export async function revokeGrant(
  db: Database,
  input: { adminId: string; userId: string; note?: string | null },
) {
  const now = new Date();
  const outcome = await db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.userId))
      .for("update")
      .limit(1);
    if (!user) throw new HttpError(404, "User not found.");
    if (!isGrantActive(user, now)) {
      throw new HttpError(409, "This user has no active complimentary plan.");
    }
    await endGrant(tx, user, "revoked", now);
    await tx.insert(auditLog).values({
      adminId: input.adminId,
      userId: input.userId,
      action: "revoke_grant",
      plan: user.plan,
      duration: null,
      note: input.note ?? null,
    });
    return { email: user.email, name: user.name };
  });

  // Falls back to the paid plan or Free and pauses anything over the limits.
  await getPlanSummary(db, input.userId, now);
  return outcome;
}

export async function extendTrial(
  db: Database,
  input: { adminId: string; userId: string; days: number },
) {
  const now = new Date();
  const outcome = await db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.userId))
      .for("update")
      .limit(1);
    if (!user) throw new HttpError(404, "User not found.");
    if (user.planSource !== "free" && user.planSource !== "trial") {
      throw new HttpError(
        409,
        "This user already has a paid or complimentary plan. Grant a plan instead.",
      );
    }

    const base =
      user.trialEndsAt && user.trialEndsAt > now ? user.trialEndsAt : now;
    const endsAt = new Date(base.getTime() + input.days * DAY_MS);
    await tx
      .update(users)
      .set({
        plan: "pro",
        planStatus: "trialing",
        planSource: "trial",
        trialStartedAt: user.trialStartedAt ?? now,
        trialEndsAt: endsAt,
        updatedAt: now,
      })
      .where(eq(users.id, input.userId));
    // Let the "2 days left" and "trial ended" emails fire again.
    await tx
      .delete(notificationEvents)
      .where(
        and(
          eq(notificationEvents.userId, input.userId),
          inArray(notificationEvents.eventKey, ["trial-ending", "trial-ended"]),
        ),
      );
    await tx.insert(auditLog).values({
      adminId: input.adminId,
      userId: input.userId,
      action: "extend_trial",
      plan: "pro",
      duration: `${input.days}d`,
      note: null,
    });
    return { endsAt };
  });

  await getPlanSummary(db, input.userId, now);
  return outcome;
}

/** Ends a running trial immediately; the user falls back to Free. */
export async function endTrial(
  db: Database,
  input: { adminId: string; userId: string },
) {
  const now = new Date();
  const outcome = await db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.userId))
      .for("update")
      .limit(1);
    if (!user) throw new HttpError(404, "User not found.");
    if (user.planSource !== "trial") {
      throw new HttpError(409, "This user is not on a trial.");
    }
    await tx
      .update(users)
      .set({ trialEndsAt: now, updatedAt: now })
      .where(eq(users.id, input.userId));
    await tx.insert(auditLog).values({
      adminId: input.adminId,
      userId: input.userId,
      action: "end_trial",
      plan: "pro",
      duration: null,
      note: null,
    });
    return { email: user.email, name: user.name };
  });
  await getPlanSummary(db, input.userId, now);
  return outcome;
}
