ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "posts" SET "submitted_at" = "created_at" WHERE "submitted_at" IS NULL AND "status" <> 'draft';
