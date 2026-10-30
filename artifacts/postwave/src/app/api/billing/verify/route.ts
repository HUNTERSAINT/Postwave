import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { billingTransactions } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse, parseJson } from "@/lib/http";
import { verifyPaystackTransaction } from "@/lib/billing/paystack";
import { completeBillingTransaction } from "@/lib/billing/complete-transaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifySchema = z.object({
  reference: z.string().min(8).max(128).regex(/^[a-zA-Z0-9._=-]+$/),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { reference } = await parseJson(request, verifySchema);
    const { db } = getDatabase();
    const [local] = await db
      .select({ reference: billingTransactions.reference, status: billingTransactions.status })
      .from(billingTransactions)
      .where(and(eq(billingTransactions.reference, reference), eq(billingTransactions.userId, user.id)))
      .limit(1);
    if (!local) throw new HttpError(404, "Payment reference was not found.");
    if (local.status === "success") return jsonResponse({ paid: true, alreadyProcessed: true });

    const payment = await verifyPaystackTransaction(reference);
    if (payment.reference !== reference) throw new HttpError(400, "Paystack returned a different payment reference.");
    const result = await completeBillingTransaction(db, payment);
    if (result.reason === "amount_or_currency_mismatch") {
      throw new HttpError(400, "The payment amount or currency does not match the saved checkout quote.");
    }
    if (payment.status !== "success") {
      return jsonResponse({ paid: false, paymentStatus: payment.status, message: "Payment has not been confirmed yet." }, 202);
    }
    return jsonResponse({ paid: Boolean(result.activated || result.reason === "already_processed"), result });
  } catch (error) {
    return errorResponse(error);
  }
}
