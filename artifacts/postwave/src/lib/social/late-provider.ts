import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { getDatabase } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { logger } from "@/lib/logger";
import type {
  ProviderAccount,
  ProviderMedia,
  ProviderPublishResult,
  ProviderTarget,
  ProviderTargetResult,
  SocialPlatform,
  SocialProvider,
} from "@/lib/social/social-provider";

const API_BASE = "https://zernio.com/api/v1";

type JsonObject = Record<string, unknown>;
type ProviderUser = {
  id: string;
  email: string;
  name: string;
  zernioProfileId?: string | null;
};

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function unwrap(value: unknown): JsonObject {
  const root = asObject(value);
  return asObject(root.data ?? value);
}

function providerError(status: number) {
  if (status === 401 || status === 403) {
    return new HttpError(502, "The social publishing provider rejected the request.");
  }
  if (status === 402) {
    return new HttpError(
      503,
      "Connecting this platform isn't available right now. Please contact support and we'll enable it.",
    );
  }
  if (status === 429 || status >= 500) {
    return new HttpError(503, "The social publishing provider is temporarily unavailable.");
  }
  return new HttpError(502, "The social publishing provider could not complete the request.");
}

class ZernioClient {
  private apiKey() {
    const key = process.env.LATE_API_KEY;
    if (!key) {
      throw new HttpError(503, "Social account connections require LATE_API_KEY.");
    }
    return key;
  }

  async request<T>(
    method: string,
    path: string,
    options: { body?: unknown; idempotencyKey?: string } = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey()}`,
          ...(options.body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
          ...(options.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : {}),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new HttpError(503, "The social publishing provider is temporarily unavailable.");
    }

    if (!response.ok) {
      let providerBody = "";
      try {
        providerBody = (await response.text()).slice(0, 400);
      } catch {
        providerBody = "";
      }
      logger.warn(
        {
          providerStatus: response.status,
          providerOperation: method,
          providerPath: path.split("?")[0],
          providerBody,
        },
        "Zernio API request was rejected",
      );
      throw providerError(response.status);
    }

    if (response.status === 204) return {} as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new HttpError(502, "The social publishing provider returned an invalid response.");
    }
  }
}

const client = new ZernioClient();

function profileFromResponse(value: unknown) {
  const root = unwrap(value);
  const profile = asObject(root.profile ?? root);
  const id =
    asString(profile._id) ??
    asString(profile.id) ??
    asString(profile.profileId);
  return id ? { id } : null;
}

export async function ensureZernioProfile(user: ProviderUser) {
  if (user.zernioProfileId) return user.zernioProfileId;

  const existingResponse = await client.request<unknown>(
    "GET",
    `/profiles?externalId=${encodeURIComponent(user.id)}`,
  );
  const existingRoot = unwrap(existingResponse);
  const profiles = Array.isArray(existingRoot.profiles)
    ? existingRoot.profiles
    : Array.isArray(existingRoot.items)
      ? existingRoot.items
      : [];
  const match = profiles
    .map((profile) => profileFromResponse(profile))
    .find((profile) => profile !== null);

  let profileId = match?.id;
  if (!profileId) {
    try {
      const created = await client.request<unknown>("POST", "/profiles", {
        body: { name: user.name, externalId: user.id },
        idempotencyKey: `postwave-profile-${user.id}`,
      });
      profileId = profileFromResponse(created)?.id;
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 502) throw error;
      // A simultaneous profile-creation request may have won the race.
      const retry = await client.request<unknown>(
        "GET",
        `/profiles?externalId=${encodeURIComponent(user.id)}`,
      );
      const retryRoot = unwrap(retry);
      const retryProfiles = Array.isArray(retryRoot.profiles)
        ? retryRoot.profiles
        : [];
      profileId = retryProfiles
        .map((profile) => profileFromResponse(profile))
        .find((profile) => profile !== null)?.id;
      if (!profileId) throw error;
    }
  }

  if (!profileId) {
    throw new HttpError(502, "The social publishing profile could not be created.");
  }

  const { db } = getDatabase();
  await db.update(users).set({ zernioProfileId: profileId }).where(eq(users.id, user.id));
  return profileId;
}

function mapTargetResult(value: unknown): ProviderTargetResult {
  const target = asObject(value);
  const account = asObject(target.accountId ?? target.account);
  return {
    accountId:
      asString(target.accountId) ??
      asString(account._id) ??
      asString(account.id),
    platform:
      asString(target.platform) ?? asString(account.platform),
    status: asString(target.status),
    errorMessage:
      asString(target.errorMessage) ??
      asString(target.error) ??
      asString(target.message),
    postUrl:
      asString(target.postUrl) ??
      asString(target.platformPostUrl) ??
      asString(target.url),
  };
}

function mapPublishResult(value: unknown): ProviderPublishResult {
  const root = unwrap(value);
  const post = asObject(root.post ?? root);
  const targetsValue = post.platforms ?? post.results ?? root.platforms;
  return {
    postId:
      asString(post._id) ??
      asString(post.id) ??
      asString(post.postId),
    status: asString(post.status) ?? asString(root.status),
    targets: Array.isArray(targetsValue)
      ? targetsValue.map(mapTargetResult)
      : [],
  };
}

// A separate title is used by platforms that have both a title and a description.
// YouTube and Pinterest: title goes in platformSpecificData.title, caption stays the description.
// TikTok photo posts: title is the (90 char) headline, caption becomes the description.
function buildPlatforms(accounts: ProviderTarget[], title: string | undefined, _content: string) {
  const cleanTitle = title?.trim();
  return accounts.map((account) => {
    const entry: Record<string, unknown> = {
      platform: account.platform,
      accountId: account.accountId,
    };
    if (cleanTitle) {
      if (account.platform === "youtube" || account.platform === "pinterest") {
        entry.platformSpecificData = { title: cleanTitle.slice(0, account.platform === "youtube" ? 100 : 100) };
      } else if (account.platform === "tiktok") {
        entry.customContent = cleanTitle.slice(0, 90);
      }
    }
    return entry;
  });
}

function tiktokTitleSettings(accounts: ProviderTarget[], title: string | undefined, content: string) {
  if (!title?.trim() || !accounts.some((account) => account.platform === "tiktok")) return {};
  return { tiktokSettings: { description: content.slice(0, 4000) } };
}

export class LateProvider implements SocialProvider {
  async connectAccount(input: {
    profileId: string;
    platform: SocialPlatform;
    redirectUrl: string;
  }) {
    const url = new URL(`${API_BASE}/connect/${encodeURIComponent(input.platform)}`);
    url.searchParams.set("profileId", input.profileId);
    url.searchParams.set("redirect_url", input.redirectUrl);
    const response = await client.request<unknown>(
      "GET",
      `${url.pathname.replace("/api/v1", "")}${url.search}`,
    );
    const root = unwrap(response);
    const authUrl = asString(root.authUrl) ?? asString(root.url);
    if (!authUrl) {
      throw new HttpError(502, "The provider did not return an authorization link.");
    }
    const parsedAuthUrl = new URL(authUrl);
    if (parsedAuthUrl.protocol !== "https:") {
      throw new HttpError(502, "The provider returned an invalid authorization link.");
    }
    return { authUrl: parsedAuthUrl.toString() };
  }

  async listAccounts(profileId: string) {
    const response = await client.request<unknown>(
      "GET",
      `/accounts?profileId=${encodeURIComponent(profileId)}`,
    );
    const root = unwrap(response);
    const values = Array.isArray(root.accounts)
      ? root.accounts
      : Array.isArray(root.items)
        ? root.items
        : [];
    return values
      .map((value): ProviderAccount | null => {
        const account = asObject(value);
        const id =
          asString(account._id) ??
          asString(account.id) ??
          asString(account.accountId);
        const platform = asString(account.platform);
        if (!id || !platform) return null;
        const profile = asObject(account.profileId ?? account.profile);
        return {
          id,
          platform,
          username:
            asString(account.username) ??
            asString(account.handle),
          displayName:
            asString(account.displayName) ??
            asString(account.accountName) ??
            asString(account.name),
          profileUrl:
            asString(account.profileUrl) ??
            asString(account.url),
          isActive: account.isActive !== false && account.status !== "disconnected",
          profileId:
            asString(account.profileId) ??
            asString(profile._id) ??
            asString(profile.id),
        };
      })
      .filter((account): account is ProviderAccount => account !== null);
  }

  async publish(input: {
    profileId: string;
    title?: string;
    content: string;
    accounts: ProviderTarget[];
    media: ProviderMedia[];
    idempotencyKey: string;
  }) {
    const result = await client.request<unknown>("POST", "/posts", {
      body: {
        profileId: input.profileId,
        content: input.content,
        mediaItems: input.media,
        platforms: buildPlatforms(input.accounts, input.title, input.content),
        ...tiktokTitleSettings(input.accounts, input.title, input.content),
        publishNow: true,
      },
      idempotencyKey: input.idempotencyKey,
    });
    return mapPublishResult(result);
  }

  async schedule(input: {
    profileId: string;
    title?: string;
    content: string;
    accounts: ProviderTarget[];
    media: ProviderMedia[];
    scheduledFor: string;
    idempotencyKey: string;
  }) {
    const result = await client.request<unknown>("POST", "/posts", {
      body: {
        profileId: input.profileId,
        content: input.content,
        mediaItems: input.media,
        platforms: buildPlatforms(input.accounts, input.title, input.content),
        ...tiktokTitleSettings(input.accounts, input.title, input.content),
        scheduledFor: input.scheduledFor,
      },
      idempotencyKey: input.idempotencyKey,
    });
    return mapPublishResult(result);
  }

  async getStatus(postId: string) {
    return mapPublishResult(
      await client.request<unknown>(
        "GET",
        `/posts/${encodeURIComponent(postId)}`,
      ),
    );
  }

  async disconnect(accountId: string) {
    await client.request(
      "DELETE",
      `/accounts/${encodeURIComponent(accountId)}`,
    );
  }
}

export const lateProvider = new LateProvider();

/** Raw post analytics for one profile (paged). Returns the provider's post items. */
export async function fetchZernioAnalytics(input: {
  profileId: string;
  fromDate: string;
  toDate: string;
  maxPosts?: number;
}) {
  const pageSize = 50;
  const maxPosts = input.maxPosts ?? 200;
  const items: JsonObject[] = [];
  for (let page = 1; items.length < maxPosts && page <= 6; page += 1) {
    const query = new URLSearchParams({
      profileId: input.profileId,
      source: "late",
      fromDate: input.fromDate,
      toDate: input.toDate,
      limit: String(pageSize),
      page: String(page),
    });
    const raw = await client.request<unknown>("GET", `/analytics?${query.toString()}`);
    const root = unwrap(raw);
    const posts = Array.isArray(root.posts) ? root.posts : [];
    for (const post of posts) items.push(asObject(post));
    const pagination = asObject(root.pagination);
    const pages = Number(pagination.pages ?? pagination.totalPages ?? 0);
    if (posts.length < pageSize || (pages && page >= pages)) break;
  }
  return items;
}
