import { and, eq, lte } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { billingTransactions, users } from "@/db/schema";
import { chargePaystackAuthorization } from "@/lib/billing/paystack";
import { completeBillingTransaction } from "@/lib/billing/complete-transaction";
import { convertUsdPrice, getCurrencyRate, toMinorUnits, USD_PLAN_PRICES, type Currency } from "@/lib/currency";
import { getDatabase } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getPlanSummary } from "@/lib/plans";

const DAY_MS = 24 * 60 * 60 * 1000;

function describe(error: unknown) {
  return error instanceof Error ? error.name : "UnknownError";
}

async function failRenewal(userId: string, now: Date) {
  const { db } = getDatabase();
  const [user] = await db
    .select({ billingFailedAttempts: users.billingFailedAttempts })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return;
  const attempts = user.billingFailedAttempts + 1;
  const exhausted = attempts >= 3;
  await db
    .update(users)
    .set({
      billingFailedAttempts: attempts,
      billingNextChargeAt: exhausted ? null : new Date(now.getTime() + DAY_MS),
      billingPaused: false,
      ...(exhausted
        ? {
            plan: "free" as const,
            paidPlan: "free" as const,
            planStatus: "free" as const,
            planSource: "free" as const,
          }
        : { planStatus: "past_due" as const }),
      updatedAt: now,
    })
    .where(eq(users.id, userId));
  if (exhausted) await getPlanSummary(db, userId, now);
}

export async function processDueBilling(now = new Date()) {
  const { db } = getDatabase();

  // Recover a renewal lock left behind if a worker process stopped mid-charge.
  await db
    .update(users)
    .set({ billingPaused: false, updatedAt: now })
    .where(
      and(
        eq(users.planSource, "paid"),
        eq(users.billingPaused, true),
        lte(users.billingNextChargeAt, new Date(now.getTime() - 15 * 60 * 1000)),
      ),
    );

  const due = await db
    .select({
      id: users.id,
      paidPlan: users.paidPlan,
      billingCurrency: users.billingCurrency,
      billingFailedAttempts: users.billingFailedAttempts,
      paystackAuthorizationCode: users.paystackAuthorizationCode,
      paystackAuthorizationEmail: users.paystackAuthorizationEmail,
      paystackAuthorizationReusable: users.paystackAuthorizationReusable,
    })
    .from(users)
    .where(
      and(
        eq(users.planSource, "paid"),
        eq(users.billingPaused, false),
        lte(users.billingNextChargeAt, now),
      ),
    )
    .limit(100);

  for (const user of due) {
    // No reusable card means the paid period ends without an automatic charge.
    if (
      !user.paystackAuthorizationReusable ||
      !user.paystackAuthorizationCode ||
      !user.paystackAuthorizationEmail ||
      !user.billingCurrency ||
      user.paidPlan === "free"
    ) {
      await db
        .update(users)
        .set({
          plan: "free",
          paidPlan: "free",
          planStatus: "free",
          planSource: "free",
          billingNextChargeAt: null,
          billingPaused: false,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));
      await getPlanSummary(db, user.id, now);
      continue;
    }

    // Claim this renewal before calling Paystack to prevent concurrent workers
    // from charging the same account twice.
    const [claimed] = await db
      .update(users)
      .set({ billingPaused: true, updatedAt: now })
      .where(
        and(
          eq(users.id, user.id),
          eq(users.billingPaused, false),
          lte(users.billingNextChargeAt, now),
        ),
      )
      .returning({ id: users.id });
    if (!claimed) continue;

    try {
      const currency = user.billingCurrency as Currency;
      const rate = await getCurrencyRate(db, currency);
      const amount = convertUsdPrice(
        USD_PLAN_PRICES[user.paidPlan],
        currency,
        rate.rate,
      );
      const amountMinor = toMinorUnits(amount);
      const reference = `pw_renew_${randomBytes(16).toString("hex")}`;
      await db.insert(billingTransactions).values({
        userId: user.id,
        reference,
        plan: user.paidPlan,
        currency,
        amountMinor,
        rate: rate.rate.toFixed(8),
        status: "pending",
      });

      const payment = await chargePaystackAuthorization({
        email: user.paystackAuthorizationEmail,
        authorizationCode: user.paystackAuthorizationCode,
        amount: amountMinor,
        currency,
        reference,
      });

      if (payment.reference !== reference) {
        throw new Error("paystack_reference_mismatch");
      }
      const result = await completeBillingTransaction(db, payment);
      if (result.reason === "amount_or_currency_mismatch") {
        throw new Error("paystack_amount_mismatch");
      }
      if (payment.status !== "success") {
        // Keep the transaction pending so a later signed charge.success
        // webhook can still activate it if Paystack completes asynchronously.
        await failRenewal(user.id, now);
      }
    } catch (error) {
      logger.error(
        { userId: user.id, errorName: describe(error) },
        "Subscription renewal attempt failed",
      );
      await failRenewal(user.id, now);
    }
  }
}
