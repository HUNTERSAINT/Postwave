export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "threads"
  | "linkedin"
  | "twitter"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "reddit"
  | "bluesky"
  | "googlebusiness"
  | "telegram"
  | "discord"
  | "slack"
  | "whatsapp";

export type ProviderAccount = {
  id: string;
  platform: string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
  isActive: boolean;
  profileId?: string;
};

export type ProviderTarget = {
  accountId: string;
  platform: string;
};

export type ProviderMedia = {
  url: string;
  type: "image" | "video";
};

export type ProviderTargetResult = {
  accountId?: string;
  platform?: string;
  status?: string;
  errorMessage?: string;
  postUrl?: string;
};

export type ProviderPublishResult = {
  postId?: string;
  status?: string;
  targets: ProviderTargetResult[];
};

export interface SocialProvider {
  connectAccount(input: {
    profileId: string;
    platform: SocialPlatform;
    redirectUrl: string;
  }): Promise<{ authUrl: string }>;
  publish(input: {
    profileId: string;
    title?: string;
    content: string;
    accounts: ProviderTarget[];
    media: ProviderMedia[];
    idempotencyKey: string;
  }): Promise<ProviderPublishResult>;
  schedule(input: {
    profileId: string;
    title?: string;
    content: string;
    accounts: ProviderTarget[];
    media: ProviderMedia[];
    scheduledFor: string;
    idempotencyKey: string;
  }): Promise<ProviderPublishResult>;
  getStatus(postId: string): Promise<ProviderPublishResult>;
  disconnect(accountId: string): Promise<void>;
  listAccounts(profileId: string): Promise<ProviderAccount[]>;
}
