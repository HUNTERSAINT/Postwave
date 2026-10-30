import { and, eq, gt, isNotNull, lt, lte } from "drizzle-orm";
import { billingQuotes, users } from "@/db/schema";
import { refreshExchangeRates } from "@/lib/currency";
import { processDueBilling } from "@/lib/worker/billing-jobs";
import { getDatabase } from "@/lib/db";
import { expireDueGrants } from "@/lib/grants";
import { logger } from "@/lib/logger";
import { sendEmailOnce } from "@/lib/notifications";
import { getPlanSummary } from "@/lib/plans";

const DAY_MS = 24 * 60 * 60 * 1000;

function describe(error: unknown) {
  return error instanceof Error ? error.name : "UnknownError";
}

async function safely(job: string, run: () => Promise<void>) {
  try {
    await run();
  } catch (error) {
    logger.error({ job, errorName: describe(error) }, "Lifecycle job failed");
  }
}

/** Refreshes the daily USD exchange rates. Keeps the last rates on failure. */
async function refreshRates() {
  const { db } = getDatabase();
  const result = await refreshExchangeRates(db);
  if ("updated" in result && result.updated) {
    logger.info("Exchange rates refreshed");
  }
}

/**
 * Trial emails and expiry:
 * - welcome email once the trial is running
 * - "2 days left" reminder
 * - when the trial ends: downgrade to Free, pause extras, send the ended email
 */
async function processTrials(now: Date) {
  const { db } = getDatabase();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      planSource: users.planSource,
      trialEndsAt: users.trialEndsAt,
    })
    .from(users)
    .where(
      and(
        isNotNull(users.trialStartedAt),
        isNotNull(users.trialEndsAt),
        isNotNull(users.emailVerifiedAt),
        gt(users.trialEndsAt, new Date(now.getTime() - 3 * DAY_MS)),
      ),
    )
    .limit(500);

  for (const user of rows) {
    if (!user.trialEndsAt) continue;
    try {
      const msLeft = user.trialEndsAt.getTime() - now.getTime();
      if (msLeft > 0) {
        // Someone who already subscribed or was granted a plan needs no reminders.
        if (user.planSource !== "trial") continue;
        await sendEmailOnce(db, user, "trial-welcome", {
          subject: "Your Postwave Pro trial has started",
          paragraphs: [
            "Welcome to Postwave. You have full Pro access during your trial: connect up to 5 accounts, schedule posts and publish everywhere from one place.",
          ],
          action: { label: "Start posting", path: "/compose" },
        });
        if (msLeft <= 2 * DAY_MS) {
          await sendEmailOnce(db, user, "trial-ending", {
            subject: "Your Postwave trial ends in 2 days",
            paragraphs: [
              "Your Pro trial is almost over. Upgrade now to keep scheduling and your extra connected accounts. If you do nothing, your account moves to the Free plan and nothing is deleted.",
            ],
            action: { label: "See plans", path: "/pricing" },
          });
        }
        continue;
      }

      if (user.planSource === "trial") {
        // Applies the downgrade: Free plan limits, extras paused, nothing deleted.
        await getPlanSummary(db, user.id, now);
      }
      const [fresh] = await db
        .select({ planSource: users.planSource })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      if (fresh?.planSource === "free") {
        await sendEmailOnce(db, user, "trial-ended", {
          subject: "Your Postwave trial has ended",
          paragraphs: [
            "Your Pro trial has ended and your account is now on the Free plan. Your posts and connected accounts are safe. Anything above the Free limits is paused until you upgrade.",
          ],
          action: { label: "Upgrade to Pro", path: "/pricing" },
        });
      }
    } catch (error) {
      logger.error(
        { userId: user.id, errorName: describe(error) },
        "Trial lifecycle step failed for a user",
      );
    }
  }
}

/** Ends expired admin grants and emails users before and after expiry. */
async function processGrants(now: Date) {
  const { db } = getDatabase();

  const soon = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      plan: users.plan,
      grantExpiresAt: users.grantExpiresAt,
    })
    .from(users)
    .where(
      and(
        eq(users.planSource, "admin_grant"),
        isNotNull(users.grantExpiresAt),
        gt(users.grantExpiresAt, now),
        lte(users.grantExpiresAt, new Date(now.getTime() + 3 * DAY_MS)),
      ),
    )
    .limit(200);
  for (const user of soon) {
    if (!user.grantExpiresAt) continue;
    try {
      await sendEmailOnce(
        db,
        user,
        `grant-expiring-${user.grantExpiresAt.getTime()}`,
        {
          subject: "Your Postwave plan access ends soon",
          paragraphs: [
            `Your complimentary ${user.plan} plan ends on ${user.grantExpiresAt.toUTCString()}. Upgrade to keep it, or your account moves to the Free plan (nothing is deleted).`,
          ],
          action: { label: "See plans", path: "/pricing" },
        },
      );
    } catch (error) {
      logger.error(
        { userId: user.id, errorName: describe(error) },
        "Grant reminder failed for a user",
      );
    }
  }

  const ended = await expireDueGrants(db, now);
  for (const user of ended) {
    if (!user.grantExpiresAt) continue;
    try {
      await sendEmailOnce(
        db,
        user,
        `grant-ended-${user.grantExpiresAt.getTime()}`,
        {
          subject: "Your complimentary Postwave plan has ended",
          paragraphs: [
            "Your complimentary plan access has ended. Your account is now on its regular plan. Anything above its limits is paused, not deleted. Upgrade any time to restore it.",
          ],
          action: { label: "See plans", path: "/pricing" },
        },
      );
    } catch (error) {
      logger.error(
        { userId: user.id, errorName: describe(error) },
        "Grant ended email failed for a user",
      );
    }
  }
}

/** Removes checkout price quotes that expired more than a week ago. */
async function cleanUp(now: Date) {
  const { db } = getDatabase();
  await db
    .delete(billingQuotes)
    .where(lt(billingQuotes.expiresAt, new Date(now.getTime() - 7 * DAY_MS)));
}

/**
 * Runs the periodic account jobs. Safe to run often: every step is
 * idempotent, so the worker calls this on a short interval.
 */
export async function runLifecycleJobs(now = new Date()) {
  await safely("exchange-rates", refreshRates);
  await safely("trials", () => processTrials(now));
  await safely("grants", () => processGrants(now));
  await safely("cleanup", () => cleanUp(now));
  await safely("subscription-renewals", () => processDueBilling(now));
}
