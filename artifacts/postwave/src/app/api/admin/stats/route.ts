import { and, eq, gte, sql } from "drizzle-orm";
import {
  billingTransactions,
  exchangeRates,
  postPlatforms,
  users,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noGrant = sql`not exists (select 1 from plan_grants where plan_grants.user_id = ${users.id})`;

export async function GET() {
  try {
    await requireAdmin();
    const { db } = getDatabase();
    const now = new Date();

    const [totals] = await db
      .select({
        total: sql<number>`count(*)::int`,
        verified: sql<number>`count(*) filter (where ${users.emailVerifiedAt} is not null)::int`,
        trialing: sql<number>`count(*) filter (where ${users.planSource} = 'trial' and ${users.trialEndsAt} > now())::int`,
        paid: sql<number>`count(*) filter (where ${users.planSource} = 'paid')::int`,
        granted: sql<number>`count(*) filter (where ${users.planSource} = 'admin_grant')::int`,
        free: sql<number>`count(*) filter (where ${users.planSource} = 'free')::int`,
        suspiciousTrials: sql<number>`count(*) filter (where ${users.trialSuspicious})::int`,
      })
      .from(users);

    // Users who were ever given a plan by an admin are left out of conversion.
    const [conversion] = await db
      .select({
        trialsStarted: sql<number>`count(*)::int`,
        converted: sql<number>`count(*) filter (where exists (select 1 from billing_transactions where billing_transactions.user_id = ${users.id} and billing_transactions.status = 'success'))::int`,
      })
      .from(users)
      .where(and(sql`${users.trialStartedAt} is not null`, noGrant));

    const revenue = await db
      .select({
        currency: billingTransactions.currency,
        amountMinor: sql<string>`sum(${billingTransactions.amountMinor})::text`,
        payments: sql<number>`count(*)::int`,
      })
      .from(billingTransactions)
      .where(eq(billingTransactions.status, "success"))
      .groupBy(billingTransactions.currency);

    const [failed] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postPlatforms)
      .where(
        and(
          eq(postPlatforms.status, "failed"),
          gte(postPlatforms.updatedAt, new Date(now.getTime() - 7 * 86_400_000)),
        ),
      );

    const rates = await db
      .select({
        currency: exchangeRates.currency,
        rate: exchangeRates.rate,
        source: exchangeRates.source,
        fetchedAt: exchangeRates.fetchedAt,
      })
      .from(exchangeRates)
      .where(eq(exchangeRates.baseCurrency, "USD"));

    const trialsStarted = conversion?.trialsStarted ?? 0;
    const converted = conversion?.converted ?? 0;
    return jsonResponse({
      users: totals,
      conversion: {
        trialsStarted,
        converted,
        rate: trialsStarted ? Math.round((converted / trialsStarted) * 1000) / 10 : 0,
      },
      revenue: revenue.map((row) => ({
        currency: row.currency,
        amountMinor: Number(row.amountMinor),
        payments: row.payments,
      })),
      failedPostsLast7Days: failed?.count ?? 0,
      exchangeRates: rates.map((row) => ({
        currency: row.currency,
        rate: Number(row.rate),
        source: row.source,
        fetchedAt: row.fetchedAt,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
