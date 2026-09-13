-- Hard-delete relations that are owned by a user. Attribution fields on
-- shared operational records intentionally remain ON DELETE SET NULL.
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_actor_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" DROP CONSTRAINT IF EXISTS "simulations_created_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" DROP CONSTRAINT IF EXISTS "score_snapshots_created_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Rule sets are shared policy records; creator is attribution metadata only.
-- Make that metadata nullable so deleting its creator cannot block account removal.
ALTER TABLE "rule_sets" DROP CONSTRAINT IF EXISTS "rule_sets_created_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "rule_sets" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
