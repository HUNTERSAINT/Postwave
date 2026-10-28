import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { authSessions, users } from "@/db/schema";
import { getDatabase } from "@/lib/db";
import { HttpError } from "@/lib/http";

const SESSION_COOKIE = "postwave_session";
const SESSION_DAYS = 30;

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new HttpError(
      503,
      "Authentication is not configured. Set AUTH_SECRET to a random value of at least 32 characters.",
    );
  }
  return secret;
}

export function hashAuthToken(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("hex");
}

export async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashAuthToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const { db } = getDatabase();

  await db.insert(authSessions).values({ tokenHash, userId, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    const { db } = getDatabase();
    await db.delete(authSessions).where(eq(authSessions.tokenHash, hashAuthToken(rawToken)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const rawToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const { db } = getDatabase();
  const [result] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
      zernioProfileId: users.zernioProfileId,
      timezone: users.timezone,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(
      and(
        eq(authSessions.tokenHash, hashAuthToken(rawToken)),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return result ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  if (!user.emailVerifiedAt) {
    throw new HttpError(403, "Verify your email before using Postwave.");
  }
  return user;
}

export async function createOpaqueToken() {
  const rawToken = randomBytes(32).toString("base64url");
  return { rawToken, tokenHash: hashAuthToken(rawToken) };
}
