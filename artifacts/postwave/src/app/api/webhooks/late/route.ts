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

    // Zernio sends per-platform results inside post.platforms[]; older shapes
    // put a single status at the top level. Handle both.
    const platformEntries = Array.isArray(postPayload.platforms)
      ? (postPayload.platforms as unknown[]).map(object)
      : [];
    const eventStatus =
      eventType.toLowerCase().endsWith("published") && !eventType.toLowerCase().includes("platform")
        ? "published"
        : eventType.toLowerCase().endsWith("failed") && !eventType.toLowerCase().includes("platform")
          ? "failed"
          : undefined;

    if (!providerPostId) return jsonResponse({ received: true });

    const [post] = await db
      .select({ id: posts.id, userId: posts.userId })
      .from(posts)
      .where(eq(posts.zernioPostId, providerPostId))
      .limit(1);
    if (!post) {
      // The webhook can arrive before the worker has saved the provider post id.
      // Forget this event and ask Zernio to deliver it again.
      await db
        .delete(webhookEvents)
        .where(eq(webhookEvents.eventId, persistedEventId));
      throw new HttpError(503, "Post not recorded yet. Please retry.");
    }

    const targets = await db
      .select({
        id: postPlatforms.id,
        platform: postPlatforms.platform,
        zernioAccountId: postPlatforms.zernioAccountId,
      })
      .from(postPlatforms)
      .where(
        and(
          eq(postPlatforms.postId, post.id),
          eq(postPlatforms.userId, post.userId),
        ),
      );

    type Update = {
      status: NonNullable<ReturnType<typeof statusFor>>;
      error: string | null;
      url?: string;
    };
    const updates = new Map<string, Update>();
    const unmatchedTargets = [...targets];
    for (const entry of platformEntries) {
      const status = statusFor(string(entry.status));
      if (!status) continue;
      const entryAccountId = objectId(entry.accountId);
      const entryPlatform = string(entry.platform);
      let target = unmatchedTargets.find(
        (item) => entryAccountId && item.zernioAccountId === entryAccountId,
      );
      if (!target && entryPlatform) {
        const samePlatform = unmatchedTargets.filter(
          (item) => String(item.platform) === entryPlatform,
        );
        if (samePlatform.length === 1) target = samePlatform[0];
      }
      if (!target) continue;
      unmatchedTargets.splice(unmatchedTargets.indexOf(target), 1);
      updates.set(target.id, {
        status,
        error:
          status === "failed"
            ? safeProviderMessage(entry.error ?? entry.errorMessage) ??
              "The platform rejected this post."
            : null,
        url: string(entry.publishedUrl) ?? string(entry.platformPostUrl),
      });
    }

    if (updates.size === 0) {
      // No per-platform detail: apply the event-level status to every target.
      const fallback = statusFor(providerStatus) ?? eventStatus;
      if (!fallback) return jsonResponse({ received: true });
      for (const target of targets) {
        if (providerAccountId && target.zernioAccountId !== providerAccountId) continue;
        updates.set(target.id, {
          status: fallback,
          error: fallback === "failed" ? errorMessage : null,
          url: platformPostUrl,
        });
      }
    }

    for (const [targetId, update] of updates) {
      await db
        .update(postPlatforms)
        .set({
          status: update.status,
          errorMessage: update.error,
          ...(update.url ? { platformPostUrl: update.url } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(postPlatforms.id, targetId),
            eq(postPlatforms.userId, post.userId),
          ),
        );
    }
    await updatePostStatus(post.id, post.userId);
    return jsonResponse({ received: true });
  } catch (error) {
    return errorResponse(error);
  }
}
