import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const authTokenType = pgEnum("auth_token_type", [
  "verify_email",
  "reset_password",
]);
export const postStatus = pgEnum("post_status", [
  "queued",
  "scheduled",
  "draft",
  "publishing",
  "published",
  "partial",
  "failed",
]);
export const platformPostStatus = pgEnum("platform_post_status", [
  "queued",
  "scheduled",
  "draft",
  "publishing",
  "published",
  "failed",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").default("user").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    zernioProfileId: varchar("zernio_profile_id", { length: 64 }),
    timezone: varchar("timezone", { length: 64 })
      .default("Africa/Lagos")
      .notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("auth_sessions_user_id_idx").on(table.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: authTokenType("type").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    index("auth_tokens_user_type_idx").on(table.userId, table.type),
  ],
);

export const oauthStates = pgTable(
  "oauth_states",
  {
    stateHash: varchar("state_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerProfileId: varchar("provider_profile_id", { length: 64 }).notNull(),
    platform: varchar("platform", { length: 32 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index("oauth_states_user_id_idx").on(table.userId)],
);

export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    zernioAccountId: varchar("zernio_account_id", { length: 64 }).notNull(),
    platform: varchar("platform", { length: 32 }).notNull(),
    username: varchar("username", { length: 255 }),
    displayName: varchar("display_name", { length: 255 }),
    profileUrl: text("profile_url"),
    isActive: boolean("is_active").default(true).notNull(),
    connectedAt: timestamp("connected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("social_accounts_user_provider_unique").on(
      table.userId,
      table.zernioAccountId,
    ),
    index("social_accounts_user_active_idx").on(table.userId, table.isActive),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull().unique(),
    publicUrl: text("public_url").notNull(),
    contentType: varchar("content_type", { length: 128 }).notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("media_assets_user_id_idx").on(table.userId)],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    status: postStatus("status").default("queued").notNull(),
    zernioPostId: varchar("zernio_post_id", { length: 64 }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    timezone: varchar("timezone", { length: 64 })
      .default("Africa/Lagos")
      .notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("posts_user_created_idx").on(table.userId, table.createdAt),
    index("posts_user_scheduled_idx").on(table.userId, table.scheduledAt),
    uniqueIndex("posts_zernio_post_id_unique").on(table.zernioPostId),
  ],
);

export const postPlatforms = pgTable(
  "post_platforms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "restrict" }),
    zernioAccountId: varchar("zernio_account_id", { length: 64 }).notNull(),
    platform: varchar("platform", { length: 32 }).notNull(),
    status: platformPostStatus("status").default("queued").notNull(),
    errorMessage: text("error_message"),
    platformPostUrl: text("platform_post_url"),
    attempts: integer("attempts").default(0).notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("post_platforms_post_account_unique").on(
      table.postId,
      table.accountId,
    ),
    index("post_platforms_user_post_idx").on(table.userId, table.postId),
  ],
);

export const postMedia = pgTable(
  "post_media",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.mediaId] }),
    index("post_media_user_post_idx").on(table.userId, table.postId),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    eventId: varchar("event_id", { length: 255 }).primaryKey(),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    receivedAt: createdAt(),
  },
  (table) => [index("webhook_events_received_at_idx").on(table.receivedAt)],
);

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    scope: varchar("scope", { length: 64 }).notNull(),
    identifierHash: varchar("identifier_hash", { length: 64 }).notNull(),
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    count: integer("count").default(0).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.scope, table.identifierHash, table.bucketStart],
    }),
  ],
);
