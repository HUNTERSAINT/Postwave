import { z } from "zod";
import { auditLog } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { setManualExchangeRate, supportedCurrencies } from "@/lib/currency";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse, parseJson } from "@/lib/http";

const schema = z.object({
  currency: z.enum(supportedCurrencies),
  rate: z.number().positive().max(1_000_000),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Emergency override: sets the USD rate for a currency until the next daily refresh. */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit(request, "admin-rate", 20, 60, admin.id);
    const input = await parseJson(request, schema);
    const { db } = getDatabase();
    const saved = await setManualExchangeRate(db, input.currency, input.rate);
    await db.insert(auditLog).values({
      adminId: admin.id,
      userId: admin.id,
      action: "set_exchange_rate",
      plan: null,
      duration: null,
      note: `1 USD = ${input.rate} ${input.currency}`,
    });
    return jsonResponse({ ok: true, rate: saved });
  } catch (error) {
    return errorResponse(error);
  }
}
