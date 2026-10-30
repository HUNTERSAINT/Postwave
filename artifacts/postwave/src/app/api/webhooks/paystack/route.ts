import { verifyPaystackSignature, verifyPaystackTransaction } from "@/lib/billing/paystack";
import { completeBillingTransaction } from "@/lib/billing/complete-transaction";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("x-paystack-signature");
    const rawBody = await request.text();
    if (!signature || !verifyPaystackSignature(rawBody, signature)) {
      throw new HttpError(401, "Webhook signature is invalid.");
    }

    let payload: { event?: unknown; data?: { reference?: unknown } };
    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      throw new HttpError(400, "Webhook body must be valid JSON.");
    }
    if (payload.event !== "charge.success") {
      return jsonResponse({ received: true, ignored: true });
    }
    const reference = payload.data?.reference;
    if (typeof reference !== "string" || !reference) {
      throw new HttpError(400, "Webhook payment reference is missing.");
    }

    // Re-fetch the transaction from Paystack instead of trusting webhook fields.
    const payment = await verifyPaystackTransaction(reference);
    if (payment.reference !== reference || payment.status !== "success") {
      throw new HttpError(400, "Paystack transaction could not be verified.");
    }
    const { db } = getDatabase();
    const result = await completeBillingTransaction(db, payment);
    if (result.reason === "amount_or_currency_mismatch") {
      throw new HttpError(400, "Payment does not match the saved checkout quote.");
    }
    return jsonResponse({ received: true, result });
  } catch (error) {
    return errorResponse(error);
  }
}
