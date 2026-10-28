import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { authSessions, authTokens, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { hashAuthToken } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse, parseJson } from "@/lib/http";

const schema = z.object({
  token: z.string().min(20).max(256),
  password: z.string().min(8).max(128),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "auth-reset-ip", 8, 15 * 60);
    const input = await parseJson(request, schema);
    const passwordHash = await hashPassword(input.password);
    const tokenHash = hashAuthToken(input.token);
    const { db } = getDatabase();
    const now = new Date();

    const userId = await db.transaction(async (tx) => {
      const [token] = await tx
        .select({ userId: authTokens.userId })
        .from(authTokens)
        .where(
          and(
            eq(authTokens.tokenHash, tokenHash),
            eq(authTokens.type, "reset_password"),
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
            eq(authTokens.tokenHash, tokenHash),
            isNull(authTokens.consumedAt),
          ),
        )
        .returning({ userId: authTokens.userId });
      if (!consumed) return null;

      await tx
        .update(users)
        .set({ passwordHash, updatedAt: now })
        .where(eq(users.id, token.userId));
      await tx.delete(authSessions).where(eq(authSessions.userId, token.userId));
      return token.userId;
    });

    if (!userId) {
      throw new HttpError(400, "This password reset link is invalid or has expired.");
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
