import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { billingQuotes, billingTransactions, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getCurrencyRate, isCurrency, supportedCurrencies, toMinorUnits, USD_PLAN_PRICES } from "@/lib/currency";
import { convertUsdPrice } from "@/lib/currency";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse, parseJson } from "@/lib/http";
import { initializePaystackTransaction } from "@/lib/billing/paystack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  plan: z.enum(["pro", "business"]),
  currency: z.enum(supportedCurrencies).optional(),
});

const PAYSTACK_CURRENCIES = ["NGN", "USD", "GHS", "ZAR", "KES"] as const;

function callbackUrl(reference: string) {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new HttpError(503, "APP_URL is not configured.");
  let base: URL;
  try {
    base = new URL(appUrl);
  } catch {
    throw new HttpError(503, "APP_URL must be a valid absolute URL.");
  }
  if (process.env.NODE_ENV === "production" && base.protocol !== "https:") {
    throw new HttpError(503, "APP_URL must use HTTPS in production.");
  }
  return new URL(`/billing/callback?reference=${encodeURIComponent(reference)}`, base).toString();
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await parseJson(request, checkoutSchema);
    const { db } = getDatabase();
    const [account] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!account) throw new HttpError(404, "Account not found.");
    if (account.planSource === "admin_grant" && (!account.grantExpiresAt || account.grantExpiresAt > new Date())) {
      throw new HttpError(409, "Your account already has an active complimentary plan.");
    }

    const currency = body.currency ?? (isCurrency(account.currency) ? account.currency : "NGN");
    if (!(PAYSTACK_CURRENCIES as readonly string[]).includes(currency)) {
      throw new HttpError(400, "Paystack checkout supports NGN, USD, GHS, ZAR and KES. Change your billing currency to continue.");
    }

    const rate = await getCurrencyRate(db, currency);
    const amount = convertUsdPrice(USD_PLAN_PRICES[body.plan], currency, rate.rate);
    const amountMinor = toMinorUnits(amount);
    const minimums: Record<(typeof PAYSTACK_CURRENCIES)[number], number> = {
      NGN: 5000,
      USD: 200,
      GHS: 10,
      ZAR: 100,
      KES: 300,
    };
    if (amountMinor < minimums[currency as keyof typeof minimums]) {
      throw new HttpError(400, "The calculated payment is below Paystack's minimum for this currency.");
    }

    const reference = `pw_${randomBytes(18).toString("hex")}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    await db.insert(billingQuotes).values({
      userId: user.id,
      plan: body.plan,
      currency,
      rate: rate.rate.toFixed(8),
      amountMinor,
      expiresAt,
    });
    await db.insert(billingTransactions).values({
      userId: user.id,
      reference,
      plan: body.plan,
      currency,
      amountMinor,
      rate: rate.rate.toFixed(8),
      status: "pending",
    });

    try {
      const initialized = await initializePaystackTransaction({
        email: user.email,
        amount: amountMinor,
        currency,
        reference,
        callbackUrl: callbackUrl(reference),
        metadata: {
          userId: user.id,
          plan: body.plan,
          quoteExpiresAt: expiresAt.toISOString(),
          product: "Postwave",
        },
      });
      return jsonResponse({
        authorizationUrl: initialized.authorization_url,
        accessCode: initialized.access_code,
        reference: initialized.reference,
        amount,
        currency,
        rate: rate.rate,
        quoteExpiresAt: expiresAt,
      });
    } catch (error) {
      await db.update(billingTransactions).set({ status: "failed", failureMessage: "Paystack initialization failed." }).where(eq(billingTransactions.reference, reference));
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
