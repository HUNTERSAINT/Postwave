import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { authTokens, users } from "@/db/schema";
import { appUrl, escapeHtml, sendTransactionalEmail } from "@/lib/auth/email";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { createOpaqueToken } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse, parseJson } from "@/lib/http";

const schema = z.object({ email: z.string().trim().email().max(320) });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "auth-forgot-ip", 8, 60 * 60);
    const input = await parseJson(request, schema);
    const email = input.email.toLowerCase();
    await enforceRateLimit(request, "auth-forgot-email", 3, 60 * 60, email);
    const { db } = getDatabase();
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.emailVerifiedAt)))
      .limit(1);
    const [verifiedUser] = user
      ? []
      : await db
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

    if (verifiedUser) {
      const token = await createOpaqueToken();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await db
        .delete(authTokens)
        .where(
          and(
            eq(authTokens.userId, verifiedUser.id),
            eq(authTokens.type, "reset_password"),
            isNull(authTokens.consumedAt),
          ),
        );
      await db.insert(authTokens).values({
        tokenHash: token.tokenHash,
        userId: verifiedUser.id,
        type: "reset_password",
        expiresAt,
      });
      const url = appUrl(
        `/reset-password?token=${encodeURIComponent(token.rawToken)}`,
        request,
      );
      await sendTransactionalEmail({
        to: verifiedUser.email,
        subject: "Reset your Postwave password",
        text: `Choose a new password for Postwave: ${url}`,
        html: `<p>Choose a new password for Postwave.</p><p><a href="${escapeHtml(url)}">Reset password</a></p><p>This link expires in 30 minutes.</p>`,
      });
    }

    return jsonResponse({
      message: "If an account exists for that email, reset instructions are on their way.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
