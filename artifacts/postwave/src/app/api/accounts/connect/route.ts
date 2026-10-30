import { eq } from "drizzle-orm";
import { z } from "zod";
import { oauthStates } from "@/db/schema";
import { createOpaqueToken, requireUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { appUrl } from "@/lib/auth/email";
import { assertCanConnectAccount } from "@/lib/plan-guards";
import { getDatabase } from "@/lib/db";
import { errorResponse, jsonResponse, parseJson } from "@/lib/http";
import { ensureZernioProfile, lateProvider } from "@/lib/social/late-provider";
import type { SocialPlatform } from "@/lib/social/social-provider";

const supportedPlatforms = [
  "instagram",
  "facebook",
  "threads",
  "linkedin",
  "twitter",
  "tiktok",
  "youtube",
  "pinterest",
  "reddit",
  "bluesky",
  "googlebusiness",
  "telegram",
  "discord",
  "slack",
  "whatsapp",
] as const;

const schema = z.object({ platform: z.enum(supportedPlatforms) });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit(request, "accounts-connect-user", 10, 60 * 60, user.id);
    const input = await parseJson(request, schema);
    await assertCanConnectAccount(user.id);
    const profileId = await ensureZernioProfile(user);
    const state = await createOpaqueToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const { db } = getDatabase();
    await db.insert(oauthStates).values({
      stateHash: state.tokenHash,
      userId: user.id,
      providerProfileId: profileId,
      platform: input.platform,
      expiresAt,
    });

    const redirect = new URL(
      appUrl("/api/accounts/callback", request),
    );
    redirect.searchParams.set("state", state.rawToken);
    try {
      const result = await lateProvider.connectAccount({
        profileId,
        platform: input.platform as SocialPlatform,
        redirectUrl: redirect.toString(),
      });
      return jsonResponse({ authUrl: result.authUrl });
    } catch (error) {
      await db
        .delete(oauthStates)
        .where(eq(oauthStates.stateHash, state.tokenHash));
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
