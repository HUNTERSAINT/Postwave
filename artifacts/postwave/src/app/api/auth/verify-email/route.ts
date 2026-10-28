import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { authTokens, users } from "@/db/schema";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { hashAuthToken } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse, parseJson } from "@/lib/http";

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
      if (!token) return false;

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
      if (!consumed) return false;
      await tx
        .update(users)
        .set({ emailVerifiedAt: now })
        .where(eq(users.id, token.userId));
      return true;
    });

    if (!verified) {
      throw new HttpError(400, "This verification link is invalid or has expired.");
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
