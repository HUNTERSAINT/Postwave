import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { authTokens, users } from "@/db/schema";
import { createOpaqueToken } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { appUrl, escapeHtml, sendTransactionalEmail } from "@/lib/auth/email";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse, parseJson } from "@/lib/http";
import { hashPassword } from "@/lib/auth/password";

const schema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "auth-signup-ip", 5, 60 * 60);
    const input = await parseJson(request, schema);
    const email = input.email.toLowerCase();
    await enforceRateLimit(request, "auth-signup-email", 3, 60 * 60, email);

    const { db } = getDatabase();
    const [existing] = await db
      .select({
        id: users.id,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let userId = existing?.id;
    if (!existing) {
      const passwordHash = await hashPassword(input.password);
      const [created] = await db
        .insert(users)
        .values({ email, name: input.name, passwordHash })
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id });
      userId = created?.id;
      if (!userId) {
        const [raceWinner] = await db
          .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        userId = raceWinner?.id;
      }
    }

    if (userId && !existing?.emailVerifiedAt) {
      const token = await createOpaqueToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db
        .delete(authTokens)
        .where(
          and(
            eq(authTokens.userId, userId),
            eq(authTokens.type, "verify_email"),
            isNull(authTokens.consumedAt),
          ),
        );
      await db.insert(authTokens).values({
        tokenHash: token.tokenHash,
        userId,
        type: "verify_email",
        expiresAt,
      });
      const url = appUrl(
        `/verify-email?token=${encodeURIComponent(token.rawToken)}`,
        request,
      );
      await sendTransactionalEmail({
        to: email,
        subject: "Verify your Postwave email",
        text: `Confirm your email to activate Postwave: ${url}`,
        html: `<p>Confirm your email to activate Postwave.</p><p><a href="${escapeHtml(url)}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
      });
    }

    return jsonResponse({
      message: "If this email can be registered, a verification link is on its way.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
