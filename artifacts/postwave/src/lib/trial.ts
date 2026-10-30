import { createHmac } from "node:crypto";
import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { trialClaims, users } from "@/db/schema";
import type { getDatabase } from "@/lib/db";
import { HttpError } from "@/lib/http";

type Database = ReturnType<typeof getDatabase>["db"];

const DAY_MS = 24 * 60 * 60 * 1000;
// Mobile carriers in Nigeria share IPs widely, so the IP limit is generous.
const MAX_TRIALS_PER_IP_PER_DAY = 5;
const MAX_TRIALS_PER_DEVICE_PER_DAY = 3;

const DISPOSABLE_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmail.net",
  "tempmailo.com",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.net",
  "trashmail.com",
  "trashmail.net",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mailnesia.com",
  "mintemail.com",
  "mohmal.com",
  "emailondeck.com",
  "burnermail.io",
  "moakt.com",
  "mytemp.email",
  "spam4.me",
  "inboxkitten.com",
  "tmpmail.org",
  "tmpmail.net",
  "discard.email",
  "mailcatch.com",
  "33mail.com",
];

/** Trial length in days. Override with the TRIAL_DAYS environment variable. */
export function trialDays() {
  const configured = Number(process.env.TRIAL_DAYS);
  return Number.isInteger(configured) && configured > 0 && configured <= 90
    ? configured
    : 7;
}

function hmac(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new HttpError(
      503,
      "Authentication is not configured. Set AUTH_SECRET to a random value of at least 32 characters.",
    );
  }
  return createHmac("sha256", secret).update(value).digest("hex");
}

/**
 * Collapses common aliases (Gmail dots, +tags, googlemail.com) so one person
 * cannot claim several trials with the same inbox.
 */
export function normalizeEmailForTrial(email: string) {
  const [rawLocal = "", rawDomain = ""] = email.trim().toLowerCase().split("@");
  let local = rawLocal.split("+")[0] ?? "";
  let domain = rawDomain;
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

export function isDisposableEmail(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.some(
    (blocked) => domain === blocked || domain.endsWith(`.${blocked}`),
  );
}

export function requestFingerprint(request: Request) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const ip = request.headers.get("x-real-ip") ?? forwarded ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "";
  const language = request.headers.get("accept-language") ?? "";
  const deviceId = request.headers.get("x-device-id") ?? "";
  return {
    ipHash: hmac(`ip:${ip}`),
    deviceHash: hmac(`device:${userAgent}|${language}|${deviceId}`),
  };
}

/**
 * Records that a new account wants a trial. The unique email hash means the
 * same inbox (after alias normalization) can only ever claim once.
 */
export async function recordTrialClaim(
  db: Database,
  input: { userId: string; email: string; request: Request },
) {
  const fingerprint = requestFingerprint(input.request);
  await db
    .insert(trialClaims)
    .values({
      userId: input.userId,
      emailHash: hmac(`email:${normalizeEmailForTrial(input.email)}`),
      ipHash: fingerprint.ipHash,
      deviceHash: fingerprint.deviceHash,
    })
    .onConflictDoNothing({ target: trialClaims.emailHash });
}

/**
 * Called after the user verifies their email. Starts the Pro trial unless the
 * email, IP or device has already used up its trials.
 */
export async function startTrialIfEligible(
  db: Database,
  userId: string,
  now = new Date(),
) {
  const [user] = await db
    .select({
      id: users.id,
      planSource: users.planSource,
      trialStartedAt: users.trialStartedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.trialStartedAt || user.planSource !== "free") {
    return { started: false as const, reason: "not_eligible" as const };
  }

  const [claim] = await db
    .select()
    .from(trialClaims)
    .where(eq(trialClaims.userId, userId))
    .limit(1);
  if (!claim || claim.verifiedAt) {
    return { started: false as const, reason: "no_claim" as const };
  }

  const since = new Date(now.getTime() - DAY_MS);
  const [ipUsage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trialClaims)
    .where(
      and(
        eq(trialClaims.ipHash, claim.ipHash),
        isNotNull(trialClaims.verifiedAt),
        gte(trialClaims.verifiedAt, since),
      ),
    );
  const [deviceUsage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trialClaims)
    .where(
      and(
        eq(trialClaims.deviceHash, claim.deviceHash),
        isNotNull(trialClaims.verifiedAt),
        gte(trialClaims.verifiedAt, since),
      ),
    );
  const suspicious =
    (ipUsage?.count ?? 0) >= MAX_TRIALS_PER_IP_PER_DAY ||
    (deviceUsage?.count ?? 0) >= MAX_TRIALS_PER_DEVICE_PER_DAY;

  if (suspicious) {
    await db
      .update(trialClaims)
      .set({ suspicious: true, verifiedAt: now })
      .where(eq(trialClaims.id, claim.id));
    await db
      .update(users)
      .set({ trialSuspicious: true, updatedAt: now })
      .where(eq(users.id, userId));
    return { started: false as const, reason: "suspicious" as const };
  }

  const endsAt = new Date(now.getTime() + trialDays() * DAY_MS);
  const [started] = await db
    .update(users)
    .set({
      plan: "pro",
      planStatus: "trialing",
      planSource: "trial",
      trialStartedAt: now,
      trialEndsAt: endsAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(users.id, userId),
        isNull(users.trialStartedAt),
        eq(users.planSource, "free"),
      ),
    )
    .returning({ id: users.id });
  await db
    .update(trialClaims)
    .set({ verifiedAt: now })
    .where(eq(trialClaims.id, claim.id));

  return started
    ? { started: true as const, endsAt }
    : { started: false as const, reason: "not_eligible" as const };
}
