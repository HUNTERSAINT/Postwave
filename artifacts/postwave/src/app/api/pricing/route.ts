import { enforceRateLimit } from "@/lib/auth/rate-limit";
import {
  convertUsdPrice,
  getCurrencyRate,
  isCurrency,
  supportedCurrencies,
  USD_PLAN_PRICES,
} from "@/lib/currency";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse } from "@/lib/http";
import { PLAN_LIMITS } from "@/lib/plans";
import { trialDays } from "@/lib/trial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public pricing for the landing page. Same conversion as checkout. */
export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "pricing-ip", 60, 60);
    const requested = new URL(request.url).searchParams.get("currency") ?? "NGN";
    if (!isCurrency(requested)) {
      throw new HttpError(400, "That currency is not supported.");
    }
    const { db } = getDatabase();
    const rate = await getCurrencyRate(db, requested);
    return jsonResponse({
      currency: requested,
      rate: rate.rate,
      rateFetchedAt: rate.fetchedAt,
      prices: {
        free: convertUsdPrice(USD_PLAN_PRICES.free, requested, rate.rate),
        pro: convertUsdPrice(USD_PLAN_PRICES.pro, requested, rate.rate),
        business: convertUsdPrice(USD_PLAN_PRICES.business, requested, rate.rate),
      },
      usdPrices: USD_PLAN_PRICES,
      limits: PLAN_LIMITS,
      trialDays: trialDays(),
      supportedCurrencies,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
