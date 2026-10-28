import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { rateLimitBuckets } from "@/db/schema";
import { getDatabase } from "@/lib/db";
import { HttpError } from "@/lib/http";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function requestAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("x-real-ip") ?? forwarded ?? "unknown";
}

export async function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
  identity?: string,
) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const bucketStart = new Date(Math.floor(now / windowMs) * windowMs);
  const retryAfter = Math.max(
    1,
    Math.ceil((bucketStart.getTime() + windowMs - now) / 1000),
  );
  const { db } = getDatabase();
  const [bucket] = await db
    .insert(rateLimitBuckets)
    .values({
      scope,
      identifierHash: digest(identity ?? requestAddress(request)),
      bucketStart,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [
        rateLimitBuckets.scope,
        rateLimitBuckets.identifierHash,
        rateLimitBuckets.bucketStart,
      ],
      set: { count: sql`${rateLimitBuckets.count} + 1` },
    })
    .returning({ count: rateLimitBuckets.count });

  if ((bucket?.count ?? 0) > limit) {
    throw new HttpError(429, "Too many requests. Wait a moment and try again.", {
      "Retry-After": String(retryAfter),
    });
  }
}
