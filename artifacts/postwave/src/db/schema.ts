import {
  type AnyPgColumn,
  bigint,
  boolean,
  index,
  integer,
  numeric,
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
export const planTier = pgEnum("plan_tier", ["free", "pro", "business"]);
export const planStatus = pgEnum("plan_status", [
  "trialing",
  "active",
  "free",
  "past_due",
]);
export const planSource = pgEnum("plan_source", [
  "paid",
  "trial",
  "free",
  "admin_grant",
]);
export const planGrantStatus = pgEnum("plan_grant_status", [
  "active",
  "revoked",
  "expired",
]);
export const authTokenType = pgEnum("auth_token_type", [
  "verify_email",
  "reset_password",
]);
export const postStatus = pgEnum("post_status", [
  "queued",
  "scheduled",
  "draft",
  "paused",
  "publishing",
  "published",
  "partial",
  "failed",
]);
export const platformPostStatus = pgEnum("platform_post_status", [
  "queued",
  "scheduled",
  "draft",
  "paused",
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
    plan: planTier("plan").default("free").notNull(),
    planStatus: planStatus("plan_status").default("free").notNull(),
    planSource: planSource("plan_source").default("free").notNull(),
    paidPlan: planTier("paid_plan").default("free").notNull(),
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),
    trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    trialSuspicious: boolean("trial_suspicious").default(false).notNull(),
    grantedBy: uuid("granted_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    grantExpiresAt: timestamp("grant_expires_at", { withTimezone: true }),
    grantNote: text("grant_note"),
    grantBillingPaused: boolean("grant_billing_paused").default(false).notNull(),
    paystackCustomerCode: varchar("paystack_customer_code", { length: 128 }),
    paystackAuthorizationCode: text("paystack_authorization_code"),
    paystackAuthorizationEmail: varchar("paystack_authorization_email", {
      length: 320,
    }),
    paystackAuthorizationReusable: boolean(
      "paystack_authorization_reusable",
    )
      .default(false)
      .notNull(),
    billingCurrency: varchar("billing_currency", { length: 3 }),
    billingNextChargeAt: timestamp("billing_next_charge_at", {
      withTimezone: true,
    }),
    billingFailedAttempts: integer("billing_failed_attempts")
      .default(0)
      .notNull(),
    billingPaused: boolean("billing_paused").default(false).notNull(),
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
    planPaused: boolean("plan_paused").default(false).notNull(),
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
    title: varchar("title", { length: 150 }),
    content: text("content").notNull(),
    status: postStatus("status").default("queued").notNull(),
    zernioPostId: varchar("zernio_post_id", { length: 64 }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedReason: text("paused_reason"),
    timezone: varchar("timezone", { length: 64 })
      .default("Africa/Lagos")
      .notNull(),
    createdAt: createdAt(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
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

export const trialClaims = pgTable(
  "trial_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "set null" }),
    emailHash: varchar("email_hash", { length: 64 }).notNull(),
    ipHash: varchar("ip_hash", { length: 64 }).notNull(),
    deviceHash: varchar("device_hash", { length: 64 }).notNull(),
    suspicious: boolean("suspicious").default(false).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("trial_claims_email_hash_unique").on(table.emailHash),
    index("trial_claims_ip_created_idx").on(table.ipHash, table.createdAt),
    index("trial_claims_device_created_idx").on(
      table.deviceHash,
      table.createdAt,
    ),
    index("trial_claims_user_id_idx").on(table.userId),
  ],
);

export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    baseCurrency: varchar("base_currency", { length: 3 })
      .default("USD")
      .notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    rate: numeric("rate", { precision: 20, scale: 8 }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    source: varchar("source", { length: 32 }).default("api").notNull(),
  },
  (table) => [
    uniqueIndex("exchange_rates_base_currency_unique").on(
      table.baseCurrency,
      table.currency,
    ),
    index("exchange_rates_fetched_at_idx").on(table.fetchedAt),
  ],
);

export const billingQuotes = pgTable(
  "billing_quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: planTier("plan").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    rate: numeric("rate", { precision: 20, scale: 8 }).notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    index("billing_quotes_user_created_idx").on(table.userId, table.createdAt),
    index("billing_quotes_expires_idx").on(table.expiresAt),
  ],
);

export const billingTransactions = pgTable(
  "billing_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reference: varchar("reference", { length: 128 }).notNull(),
    plan: planTier("plan").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    rate: numeric("rate", { precision: 20, scale: 8 }).notNull(),
    status: varchar("status", { length: 24 }).default("pending").notNull(),
    failureMessage: text("failure_message"),
    createdAt: createdAt(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("billing_transactions_reference_unique").on(table.reference),
    index("billing_transactions_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const planGrants = pgTable(
  "plan_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    plan: planTier("plan").notNull(),
    status: planGrantStatus("status").default("active").notNull(),
    duration: varchar("duration", { length: 24 }).notNull(),
    note: text("note"),
    pauseBilling: boolean("pause_billing").default(false).notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("plan_grants_user_status_idx").on(table.userId, table.status),
    index("plan_grants_expiry_idx").on(table.expiresAt),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 64 }).notNull(),
    plan: planTier("plan"),
    duration: varchar("duration", { length: 24 }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_log_created_at_idx").on(table.createdAt),
    index("audit_log_user_id_idx").on(table.userId),
    index("audit_log_admin_id_idx").on(table.adminId),
  ],
);

export const notificationEvents = pgTable(
  "notification_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventKey: varchar("event_key", { length: 128 }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("notification_events_user_key_unique").on(
      table.userId,
      table.eventKey,
    ),
  ],
);
