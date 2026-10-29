ALTER TYPE "public"."platform_post_status" ADD VALUE 'scheduled' BEFORE 'publishing';--> statement-breakpoint
ALTER TYPE "public"."platform_post_status" ADD VALUE 'draft' BEFORE 'publishing';--> statement-breakpoint
ALTER TYPE "public"."post_status" ADD VALUE 'scheduled' BEFORE 'publishing';--> statement-breakpoint
ALTER TYPE "public"."post_status" ADD VALUE 'draft' BEFORE 'publishing';--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "timezone" varchar(64) DEFAULT 'Africa/Lagos' NOT NULL;--> statement-breakpoint
CREATE INDEX "posts_user_scheduled_idx" ON "posts" USING btree ("user_id","scheduled_at");