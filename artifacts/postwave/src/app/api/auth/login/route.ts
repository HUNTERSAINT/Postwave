import { eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "@/db/schema";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse, parseJson } from "@/lib/http";

const schema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "auth-login-ip", 12, 15 * 60);
    const input = await parseJson(request, schema);
    const email = input.email.toLowerCase();
    await enforceRateLimit(request, "auth-login-email", 8, 15 * 60, email);

    const { db } = getDatabase();
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        passwordHash: users.passwordHash,
        emailVerifiedAt: users.emailVerifiedAt,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!user || !valid) {
      throw new HttpError(401, "Email or password is incorrect.");
    }
    if (!user.emailVerifiedAt) {
      throw new HttpError(403, "Verify your email before signing in.");
    }

    await createSession(user.id);
    return jsonResponse({
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
