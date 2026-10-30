CREATE TYPE "public"."plan_grant_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."plan_source" AS ENUM('paid', 'trial', 'free', 'admin_grant');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('trialing', 'active', 'free', 'past_due');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('free', 'pro', 'business');--> statement-breakpoint
ALTER TYPE "public"."platform_post_status" ADD VALUE 'paused' BEFORE 'publishing';--> statement-breakpoint
ALTER TYPE "public"."post_status" ADD VALUE 'paused' BEFORE 'publishing';--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"plan" "plan_tier",
	"duration" varchar(24),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" "plan_tier" NOT NULL,
	"currency" varchar(3) NOT NULL,
	"rate" numeric(20, 8) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reference" varchar(128) NOT NULL,
	"plan" "plan_tier" NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"rate" numeric(20, 8) NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"rate" numeric(20, 8) NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(32) DEFAULT 'api' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_key" varchar(128) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"granted_by" uuid NOT NULL,
	"plan" "plan_tier" NOT NULL,
	"status" "plan_grant_status" DEFAULT 'active' NOT NULL,
	"duration" varchar(24) NOT NULL,
	"note" text,
	"pause_billing" boolean DEFAULT false NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trial_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_hash" varchar(64) NOT NULL,
	"ip_hash" varchar(64) NOT NULL,
	"device_hash" varchar(64) NOT NULL,
	"suspicious" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "paused_reason" text;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD COLUMN "plan_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" "plan_tier" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_status" "plan_status" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_source" "plan_source" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "paid_plan" "plan_tier" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "currency" varchar(3) DEFAULT 'NGN' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_suspicious" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "granted_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "granted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "grant_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "grant_note" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "grant_billing_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "paystack_customer_code" varchar(128);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "paystack_authorization_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "paystack_authorization_email" varchar(320);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "paystack_authorization_reusable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_currency" varchar(3);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_next_charge_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_quotes" ADD CONSTRAINT "billing_quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_grants" ADD CONSTRAINT "plan_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_grants" ADD CONSTRAINT "plan_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_claims" ADD CONSTRAINT "trial_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_user_id_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_admin_id_idx" ON "audit_log" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "billing_quotes_user_created_idx" ON "billing_quotes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "billing_quotes_expires_idx" ON "billing_quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_transactions_reference_unique" ON "billing_transactions" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "billing_transactions_user_created_idx" ON "billing_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_base_currency_unique" ON "exchange_rates" USING btree ("base_currency","currency");--> statement-breakpoint
CREATE INDEX "exchange_rates_fetched_at_idx" ON "exchange_rates" USING btree ("fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_events_user_key_unique" ON "notification_events" USING btree ("user_id","event_key");--> statement-breakpoint
CREATE INDEX "plan_grants_user_status_idx" ON "plan_grants" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "plan_grants_expiry_idx" ON "plan_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trial_claims_email_hash_unique" ON "trial_claims" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "trial_claims_ip_created_idx" ON "trial_claims" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "trial_claims_device_created_idx" ON "trial_claims" USING btree ("device_hash","created_at");--> statement-breakpoint
CREATE INDEX "trial_claims_user_id_idx" ON "trial_claims" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;