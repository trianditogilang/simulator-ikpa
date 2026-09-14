CREATE TYPE "public"."access_status" AS ENUM('pending', 'active');--> statement-breakpoint
ALTER TABLE "user_accesses" ADD COLUMN "status" "access_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_accesses" ADD COLUMN "invited_email" text;--> statement-breakpoint
ALTER TABLE "user_accesses" DROP CONSTRAINT "user_accesses_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "user_accesses" ADD CONSTRAINT "user_accesses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON delete cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_accesses_invited_email_idx" ON "user_accesses" USING btree ("invited_email");
