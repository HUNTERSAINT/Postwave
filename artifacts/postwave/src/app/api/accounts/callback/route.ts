import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { oauthStates, socialAccounts } from "@/db/schema";
import { hashAuthToken } from "@/lib/auth/session";
import { appUrl } from "@/lib/auth/email";
import { getDatabase } from "@/lib/db";
import { errorResponse, HttpError } from "@/lib/http";
import { lateProvider } from "@/lib/social/late-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(request: Request, connected: boolean) {
  const url = new URL(
    appUrl(connected ? "/accounts?connected=1" : "/accounts?connection=failed", request),
  );
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  try {
    const callback = new URL(request.url);
    const rawState = callback.searchParams.get("state");
    const accountId = callback.searchParams.get("accountId");
    const rawProfileId = callback.searchParams.get("profileId");
    const providerConnected = callback.searchParams.get("connected");
    if (!rawState || !accountId || providerConnected === "false") {
      return redirect(request, false);
    }

    const stateHash = hashAuthToken(rawState);
    const { db } = getDatabase();
    const now = new Date();
    const state = await db.transaction(async (tx) => {
      const [candidate] = await tx
        .select({
          userId: oauthStates.userId,
          providerProfileId: oauthStates.providerProfileId,
          platform: oauthStates.platform,
        })
        .from(oauthStates)
        .where(
          and(
            eq(oauthStates.stateHash, stateHash),
            isNull(oauthStates.consumedAt),
            gt(oauthStates.expiresAt, now),
          ),
        )
        .limit(1);
      if (!candidate) return null;
      const [consumed] = await tx
        .update(oauthStates)
        .set({ consumedAt: now })
        .where(
          and(
            eq(oauthStates.stateHash, stateHash),
            isNull(oauthStates.consumedAt),
          ),
        )
        .returning({ userId: oauthStates.userId });
      return consumed ? candidate : null;
    });

    if (!state) return redirect(request, false);
    if (rawProfileId && rawProfileId !== state.providerProfileId) {
      throw new HttpError(400, "The connected profile did not match this account.");
    }

    const connectedAccount = (await lateProvider.listAccounts(state.providerProfileId))
      .find((account) => account.id === accountId);
    if (
      !connectedAccount ||
      (connectedAccount.profileId &&
        connectedAccount.profileId !== state.providerProfileId)
    ) {
      throw new HttpError(400, "The provider did not confirm this account connection.");
    }

    await db
      .insert(socialAccounts)
      .values({
        userId: state.userId,
        zernioAccountId: connectedAccount.id,
        platform: connectedAccount.platform,
        username: connectedAccount.username ?? null,
        displayName: connectedAccount.displayName ?? null,
        profileUrl: connectedAccount.profileUrl ?? null,
        isActive: connectedAccount.isActive,
        connectedAt: now,
        disconnectedAt: connectedAccount.isActive ? null : now,
      })
      .onConflictDoUpdate({
        target: [socialAccounts.userId, socialAccounts.zernioAccountId],
        set: {
          platform: connectedAccount.platform,
          username: connectedAccount.username ?? null,
          displayName: connectedAccount.displayName ?? null,
          profileUrl: connectedAccount.profileUrl ?? null,
          isActive: connectedAccount.isActive,
          connectedAt: now,
          disconnectedAt: connectedAccount.isActive ? null : now,
          updatedAt: now,
        },
      });

    return redirect(request, true);
  } catch (error) {
    const response = errorResponse(error);
    const message =
      response.status >= 500 ? "connection=unavailable" : "connection=failed";
    const url = new URL(appUrl(`/accounts?${message}`, request));
    return NextResponse.redirect(url);
  }
}
