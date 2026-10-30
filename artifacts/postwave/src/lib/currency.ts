import { and, desc, eq } from "drizzle-orm";
import { exchangeRates } from "@/db/schema";
import type { getDatabase } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { logger } from "@/lib/logger";

export const supportedCurrencies = [
  "NGN",
  "USD",
  "GBP",
  "EUR",
  "GHS",
  "KES",
  "ZAR",
] as const;

export type Currency = (typeof supportedCurrencies)[number];
type Database = ReturnType<typeof getDatabase>["db"];

export const USD_PLAN_PRICES = {
  free: 0,
  pro: 10,
  business: 25,
} as const;

export function isCurrency(value: unknown): value is Currency {
  return (
    typeof value === "string" &&
    supportedCurrencies.includes(value as Currency)
  );
}

export function convertUsdPrice(usd: number, currency: Currency, rate: number) {
  if (usd === 0) return 0;
  const buffered = usd * rate * 1.04;
  return currency === "NGN"
    ? Math.round(buffered / 100) * 100
    : Math.round(buffered * 2) / 2;
}

export function toMinorUnits(amount: number) {
  return Math.round(amount * 100);
}

export async function refreshExchangeRates(
  db: Database,
  options: { force?: boolean } = {},
) {
  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const [latestManual] = await db
    .select({ fetchedAt: exchangeRates.fetchedAt })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.baseCurrency, "USD"),
        eq(exchangeRates.source, "manual"),
      ),
    )
    .orderBy(desc(exchangeRates.fetchedAt))
    .limit(1);
  if (
    !options.force &&
    latestManual?.fetchedAt &&
    latestManual.fetchedAt >= dayStart
  ) {
    return { updated: false, reason: "manual_override_today" };
  }

  const [latest] = await db
    .select({ fetchedAt: exchangeRates.fetchedAt })
    .from(exchangeRates)
    .where(eq(exchangeRates.baseCurrency, "USD"))
    .orderBy(desc(exchangeRates.fetchedAt))
    .limit(1);
  if (
    !options.force &&
    latest?.fetchedAt &&
    latest.fetchedAt >= dayStart
  ) {
    return { updated: false, reason: "already_fetched_today" };
  }

  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  const source = apiKey ? "exchangerate-api" : "open-er-api";
  const url = apiKey
    ? `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/USD`
    : "https://open.er-api.com/v6/latest/USD";

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("rate_provider_http_error");
    const payload = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
      conversion_rates?: Record<string, number>;
    };
    const rates = payload.conversion_rates ?? payload.rates;
    if (payload.result !== "success" || !rates) {
      throw new Error("rate_provider_invalid_response");
    }

    const rows = supportedCurrencies.map((currency) => {
      const rate = currency === "USD" ? 1 : rates[currency];
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error("rate_provider_missing_currency");
      }
      return {
        baseCurrency: "USD",
        currency,
        rate: rate.toFixed(8),
        fetchedAt: now,
        source,
      };
    });
    for (const row of rows) {
      await db
        .insert(exchangeRates)
        .values(row)
        .onConflictDoUpdate({
          target: [exchangeRates.baseCurrency, exchangeRates.currency],
          set: {
            rate: row.rate,
            fetchedAt: row.fetchedAt,
            source: row.source,
          },
        });
    }
    return { updated: true, fetchedAt: now };
  } catch (error) {
    logger.warn(
      {
        errorName: error instanceof Error ? error.name : "UnknownError",
        source,
      },
      "Exchange rate update failed; keeping the last saved rates",
    );
    return { updated: false, reason: "provider_error" };
  }
}

export async function getCurrencyRate(db: Database, currency: Currency) {
  if (currency === "USD") {
    return { currency, rate: 1, fetchedAt: new Date(), source: "base" };
  }
  const whereCurrency = and(
    eq(exchangeRates.baseCurrency, "USD"),
    eq(exchangeRates.currency, currency),
  );
  const [saved] = await db
    .select({
      rate: exchangeRates.rate,
      fetchedAt: exchangeRates.fetchedAt,
      source: exchangeRates.source,
    })
    .from(exchangeRates)
    .where(whereCurrency)
    .limit(1);
  if (!saved) {
    await refreshExchangeRates(db);
    const [retried] = await db
      .select({
        rate: exchangeRates.rate,
        fetchedAt: exchangeRates.fetchedAt,
        source: exchangeRates.source,
      })
      .from(exchangeRates)
      .where(whereCurrency)
      .limit(1);
    if (!retried) {
      throw new HttpError(503, "Exchange rates are temporarily unavailable.");
    }
    return {
      currency,
      rate: Number(retried.rate),
      fetchedAt: retried.fetchedAt,
      source: retried.source,
    };
  }
  return {
    currency,
    rate: Number(saved.rate),
    fetchedAt: saved.fetchedAt,
    source: saved.source,
  };
}

export async function setManualExchangeRate(
  db: Database,
  currency: Currency,
  rate: number,
) {
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1_000_000) {
    throw new HttpError(400, "Enter a valid exchange rate.");
  }
  const now = new Date();
  await db
    .insert(exchangeRates)
    .values({
      baseCurrency: "USD",
      currency,
      rate: rate.toFixed(8),
      fetchedAt: now,
      source: "manual",
    })
    .onConflictDoUpdate({
      target: [exchangeRates.baseCurrency, exchangeRates.currency],
      set: { rate: rate.toFixed(8), fetchedAt: now, source: "manual" },
    });
  return { currency, rate, fetchedAt: now, source: "manual" };
}
