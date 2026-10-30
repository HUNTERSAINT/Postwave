ALTER TABLE "trial_claims" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trial_claims" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "trial_claims" DROP CONSTRAINT "trial_claims_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "trial_claims" ADD CONSTRAINT "trial_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
