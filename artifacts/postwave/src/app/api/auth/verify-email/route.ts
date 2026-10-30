import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { authTokens, users } from "@/db/schema";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { hashAuthToken } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse, parseJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { startTrialIfEligible } from "@/lib/trial";

const schema = z.object({ token: z.string().min(20).max(256) });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "auth-verify-ip", 10, 15 * 60);
    const input = await parseJson(request, schema);
    const { db } = getDatabase();
    const now = new Date();

    const verified = await db.transaction(async (tx) => {
      const [token] = await tx
        .select({ userId: authTokens.userId })
        .from(authTokens)
        .where(
          and(
            eq(authTokens.tokenHash, hashAuthToken(input.token)),
            eq(authTokens.type, "verify_email"),
            isNull(authTokens.consumedAt),
            gt(authTokens.expiresAt, now),
          ),
        )
        .limit(1);
      if (!token) return null;

      const [consumed] = await tx
        .update(authTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(authTokens.tokenHash, hashAuthToken(input.token)),
            isNull(authTokens.consumedAt),
          ),
        )
        .returning({ userId: authTokens.userId });
      if (!consumed) return null;
      await tx
        .update(users)
        .set({ emailVerifiedAt: now })
        .where(eq(users.id, token.userId));
      return token.userId;
    });

    if (!verified) {
      throw new HttpError(400, "This verification link is invalid or has expired.");
    }

    // A failed trial start must never block email verification.
    let trialStarted = false;
    try {
      const trial = await startTrialIfEligible(db, verified, now);
      trialStarted = trial.started;
    } catch (error) {
      logger.error(
        { errorName: error instanceof Error ? error.name : "UnknownError" },
        "Trial could not be started after email verification",
      );
    }
    return jsonResponse({ ok: true, trialStarted });
  } catch (error) {
    return errorResponse(error);
  }
}
