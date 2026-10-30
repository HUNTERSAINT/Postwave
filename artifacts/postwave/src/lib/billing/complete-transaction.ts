import { and, eq } from "drizzle-orm";
import { billingTransactions, users } from "@/db/schema";
import type { getDatabase } from "@/lib/db";
import type { PaystackTransaction } from "@/lib/billing/paystack";

type Database = ReturnType<typeof getDatabase>["db"];

export function addBillingPeriod(from = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + 30);
  return next;
}

/**
 * Activates a subscription only after Paystack has confirmed the exact
 * reference, amount and currency. The pending -> success transition makes
 * verification and webhook delivery safe to run concurrently.
 */
export async function completeBillingTransaction(
  db: Database,
  payment: PaystackTransaction,
) {
  if (payment.status !== "success") return { activated: false, reason: "not_successful" };

  return db.transaction(async (tx) => {
    const [pending] = await tx
      .select()
      .from(billingTransactions)
      .where(eq(billingTransactions.reference, payment.reference))
      .limit(1);

    if (!pending) return { activated: false, reason: "unknown_reference" };
    if (
      pending.amountMinor !== payment.amount ||
      pending.currency !== payment.currency
    ) {
      return { activated: false, reason: "amount_or_currency_mismatch" };
    }
    if (pending.status === "success") {
      return { activated: false, reason: "already_processed" };
    }
    if (pending.status !== "pending") {
      return { activated: false, reason: "transaction_not_pending" };
    }

    const [claimed] = await tx
      .update(billingTransactions)
      .set({ status: "success", paidAt: payment.paid_at ? new Date(payment.paid_at) : new Date() })
      .where(
        and(
          eq(billingTransactions.reference, payment.reference),
          eq(billingTransactions.status, "pending"),
        ),
      )
      .returning({ userId: billingTransactions.userId });

    if (!claimed) return { activated: false, reason: "already_processed" };

    const now = new Date();
    const nextChargeAt = addBillingPeriod(now);
    await tx
      .update(users)
      .set({
        plan: pending.plan,
        paidPlan: pending.plan,
        planStatus: "active",
        planSource: "paid",
        billingCurrency: pending.currency,
        billingNextChargeAt: nextChargeAt,
        billingFailedAttempts: 0,
        billingPaused: false,
        ...(payment.authorization?.authorization_code
          ? { paystackAuthorizationCode: payment.authorization.authorization_code }
          : {}),
        ...(payment.authorization?.reusable !== undefined
          ? { paystackAuthorizationReusable: payment.authorization.reusable }
          : {}),
        ...(payment.customer?.customer_code
          ? { paystackCustomerCode: payment.customer.customer_code }
          : {}),
        ...(payment.customer?.email
          ? { paystackAuthorizationEmail: payment.customer.email }
          : {}),
        updatedAt: now,
      })
      .where(eq(users.id, pending.userId));

    return { activated: true, reason: "activated", nextChargeAt };
  });
}
