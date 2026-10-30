import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import {
  convertUsdPrice,
  getCurrencyRate,
  isCurrency,
  supportedCurrencies,
  USD_PLAN_PRICES,
} from "@/lib/currency";
import { errorResponse, HttpError, jsonResponse, parseJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateCurrencySchema = z.object({
  currency: z.enum(supportedCurrencies),
});

async function getCurrencyPayload(db: ReturnType<typeof getDatabase>["db"], currency: (typeof supportedCurrencies)[number]) {
  const rate = await getCurrencyRate(db, currency);
  return {
    currency,
    rate: rate.rate,
    rateFetchedAt: rate.fetchedAt,
    rateSource: rate.source,
    prices: {
      free: convertUsdPrice(USD_PLAN_PRICES.free, currency, rate.rate),
      pro: convertUsdPrice(USD_PLAN_PRICES.pro, currency, rate.rate),
      business: convertUsdPrice(USD_PLAN_PRICES.business, currency, rate.rate),
    },
    basePrices: USD_PLAN_PRICES,
    supportedCurrencies,
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    const { db } = getDatabase();
    const [account] = await db
      .select({ currency: users.currency })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (!account || !isCurrency(account.currency)) {
      throw new HttpError(404, "Account currency could not be found.");
    }
    return jsonResponse(await getCurrencyPayload(db, account.currency));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await parseJson(request, updateCurrencySchema);
    const { db } = getDatabase();
    await db.update(users).set({ currency: body.currency }).where(eq(users.id, user.id));
    return jsonResponse(await getCurrencyPayload(db, body.currency));
  } catch (error) {
    return errorResponse(error);
  }
}
