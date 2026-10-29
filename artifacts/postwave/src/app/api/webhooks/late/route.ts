import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  postPlatforms,
  posts,
  socialAccounts,
  users,
  webhookEvents,
} from "@/db/schema";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError, jsonResponse } from "@/lib/http";
import { updatePostStatus } from "@/lib/worker/publish-post";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function string(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function objectId(value: unknown) {
  if (typeof value === "string") return value;
  const record = object(value);
  return string(record._id) ?? string(record.id) ?? string(record.accountId);
}

function statusFor(value?: string) {
  const status = (value ?? "").toLowerCase();
  if (["published", "success", "completed"].includes(status)) return "published" as const;
  if (["failed", "error", "rejected"].includes(status)) return "failed" as const;
  if (["publishing", "processing"].includes(status)) return "publishing" as const;
  if (status === "scheduled") return "scheduled" as const;
  if (["queued", "pending"].includes(status)) return "queued" as const;
  return null;
}

function safeProviderMessage(value: unknown) {
  if (typeof value !== "string") return null;
  return value
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(
      /(access[_-]?token|refresh[_-]?token|api[_-]?key)(\s*[:=]\s*)\S+/gi,
      "$1$2[redacted]",
    )
    .slice(0, 2_000);
}

function validSignature(rawBody: string, signature: string, secret: string) {
  const normalized = signature.replace(/^sha256=/i, "");
  if (!/^[a-f0-9]{64}$/i.test(normalized)) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest();
  const received = Buffer.from(normalized, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const secret = process.env.LATE_WEBHOOK_SECRET;
    if (!secret) {
      throw new HttpError(503, "Social publishing webhooks are not configured.");
    }
    const signature =
      request.headers.get("x-zernio-signature") ??
      request.headers.get("x-late-signature");
    const rawBody = await request.text();
    if (!signature || !validSignature(rawBody, signature, secret)) {
      throw new HttpError(401, "Webhook signature is invalid.");
    }

    let payload: JsonObject;
    try {
      payload = object(JSON.parse(rawBody));
    } catch {
      throw new HttpError(400, "Webhook body must be valid JSON.");
    }
    const data = object(payload.data);
    const postPayload = object(payload.post ?? data.post);
    const accountPayload = object(payload.account ?? data.account);
    const eventType =
      string(payload.event) ??
      string(payload.eventType) ??
      string(payload.type) ??
      string(data.event) ??
      "unknown";
    const eventIdHeader =
      request.headers.get("x-zernio-event-id") ??
      request.headers.get("x-late-event-id");
    const eventId =
      eventIdHeader ??
      string(payload.eventId) ??
      createHash("sha256").update(rawBody).digest("hex");
    const persistedEventId =
      eventId.length <= 255
        ? eventId
        : createHash("sha256").update(eventId).digest("hex");

    const { db } = getDatabase();
    const [insertedEvent] = await db
      .insert(webhookEvents)
      .values({ eventId: persistedEventId, eventType })
      .onConflictDoNothing()
      .returning({ eventId: webhookEvents.eventId });
    if (!insertedEvent) return jsonResponse({ received: true, duplicate: true });

    const profileId =
      objectId(payload.profileId) ??
      objectId(data.profileId) ??
      objectId(postPayload.profileId);
    const providerAccountId =
      objectId(payload.accountId) ??
      objectId(data.accountId) ??
      objectId(accountPayload);
    const providerPostId =
      objectId(payload.postId) ??
      objectId(data.postId) ??
      objectId(postPayload);
    const providerStatus =
      string(payload.status) ??
      string(data.status) ??
      string(postPayload.status) ??
      string(accountPayload.status);
    const errorMessage = safeProviderMessage(
      payload.errorMessage ??
        payload.error ??
        data.errorMessage ??
        data.error ??
        postPayload.errorMessage ??
        postPayload.error,
    );
    const platformPostUrl =
      string(payload.platformPostUrl) ??
      string(data.platformPostUrl) ??
      string(postPayload.platformPostUrl) ??
      string(postPayload.postUrl);

    const [userByProfile] = profileId
      ? await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.zernioProfileId, profileId))
          .limit(1)
      : [];
    const [account] =
      providerAccountId && userByProfile
        ? await db
            .select({
              id: socialAccounts.id,
              userId: socialAccounts.userId,
            })
            .from(socialAccounts)
            .where(
              and(
                eq(socialAccounts.userId, userByProfile.id),
                eq(socialAccounts.zernioAccountId, providerAccountId),
              ),
            )
            .limit(1)
        : [];

    if (eventType.toLowerCase().includes("account")) {
      const isDisconnect =
        eventType.toLowerCase().includes("disconnect") ||
        eventType.toLowerCase().includes("removed") ||
        providerStatus === "disconnected";
      if (account && isDisconnect) {
        await db
          .update(socialAccounts)
          .set({ isActive: false, disconnectedAt: new Date() })
          .where(
            and(
              eq(socialAccounts.id, account.id),
              eq(socialAccounts.userId, account.userId),
            ),
          );
      }
      return jsonResponse({ received: true });
    }

    const normalizedStatus = statusFor(providerStatus);
    if (!normalizedStatus || !providerPostId) {
      return jsonResponse({ received: true });
    }

    const [post] = await db
      .select({ id: posts.id, userId: posts.userId })
      .from(posts)
      .where(eq(posts.zernioPostId, providerPostId))
      .limit(1);
    const owner = post
      ? { id: post.userId }
      : userByProfile
        ? { id: userByProfile.id }
        : null;
    if (!post || !owner) return jsonResponse({ received: true });

    const filters = [
      eq(postPlatforms.postId, post.id),
      eq(postPlatforms.userId, owner.id),
    ];
    if (providerAccountId) {
      filters.push(eq(postPlatforms.zernioAccountId, providerAccountId));
    }
    const [target] = await db
      .select({ id: postPlatforms.id })
      .from(postPlatforms)
      .where(and(...filters))
      .limit(1);
    if (!target) return jsonResponse({ received: true });

    await db
      .update(postPlatforms)
      .set({
        status: normalizedStatus,
        errorMessage: normalizedStatus === "failed" ? errorMessage : null,
        ...(platformPostUrl ? { platformPostUrl } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(postPlatforms.id, target.id),
          eq(postPlatforms.userId, owner.id),
        ),
      );
    await updatePostStatus(post.id, owner.id);
    return jsonResponse({ received: true });
  } catch (error) {
    return errorResponse(error);
  }
}
