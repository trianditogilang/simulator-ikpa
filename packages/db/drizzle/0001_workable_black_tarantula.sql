CREATE TABLE "assessment_exclusion_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_set_id" uuid,
	"name" text NOT NULL,
	"indicator_key" text DEFAULT 'output_achievement' NOT NULL,
	"action" text DEFAULT 'exclude_from_assessment' NOT NULL,
	"category" text DEFAULT 'ro_khusus' NOT NULL,
	"match_type" text DEFAULT 'exact' NOT NULL,
	"ro_match_value" jsonb NOT NULL,
	"scope_type" text DEFAULT 'national' NOT NULL,
	"scope_id" uuid,
	"fiscal_year_id" uuid,
	"year" integer DEFAULT 2026 NOT NULL,
	"effective_month_start" smallint DEFAULT 1 NOT NULL,
	"effective_month_end" smallint DEFAULT 12 NOT NULL,
	"basis_reference" text NOT NULL,
	"display_reason" text NOT NULL,
	"internal_note" text,
	"allow_operator_proposal" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_exclusion_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"indicator_key" text DEFAULT 'output_achievement' NOT NULL,
	"ro_code" text NOT NULL,
	"month" smallint,
	"category" text DEFAULT 'ro_khusus' NOT NULL,
	"basis_reference" text NOT NULL,
	"operator_note" text,
	"attachment_ref" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"review_note" text,
	"resolved_policy_id" uuid,
	"submitted_at" timestamp with time zone,
	"submitted_by" uuid,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spm_ls" ALTER COLUMN "received_at_kppn" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "output_reports" ADD COLUMN "ro_name" text;--> statement-breakpoint
ALTER TABLE "output_reports" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "output_reports" ADD COLUMN "confirmed_by" uuid;--> statement-breakpoint
ALTER TABLE "assessment_exclusion_policies" ADD CONSTRAINT "assessment_exclusion_policies_rule_set_id_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."rule_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_exclusion_policies" ADD CONSTRAINT "assessment_exclusion_policies_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_exclusion_policies" ADD CONSTRAINT "assessment_exclusion_policies_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_exclusion_policies" ADD CONSTRAINT "assessment_exclusion_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_exclusion_proposals" ADD CONSTRAINT "assessment_exclusion_proposals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_exclusion_proposals" ADD CONSTRAINT "assessment_exclusion_proposals_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_exclusion_proposals" ADD CONSTRAINT "assessment_exclusion_proposals_resolved_policy_id_assessment_exclusion_policies_id_fk" FOREIGN KEY ("resolved_policy_id") REFERENCES "public"."assessment_exclusion_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_exclusion_proposals" ADD CONSTRAINT "assessment_exclusion_proposals_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_exclusion_proposals" ADD CONSTRAINT "assessment_exclusion_proposals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_exclusion_policies_indicator_key_idx" ON "assessment_exclusion_policies" USING btree ("indicator_key");--> statement-breakpoint
CREATE INDEX "assessment_exclusion_policies_status_idx" ON "assessment_exclusion_policies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assessment_exclusion_policies_year_idx" ON "assessment_exclusion_policies" USING btree ("year");--> statement-breakpoint
CREATE INDEX "assessment_exclusion_policies_scope_type_idx" ON "assessment_exclusion_policies" USING btree ("scope_type");--> statement-breakpoint
CREATE INDEX "assessment_exclusion_proposals_org_fy_idx" ON "assessment_exclusion_proposals" USING btree ("organization_id","fiscal_year_id");--> statement-breakpoint
CREATE INDEX "assessment_exclusion_proposals_status_idx" ON "assessment_exclusion_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assessment_exclusion_proposals_ro_code_idx" ON "assessment_exclusion_proposals" USING btree ("ro_code");--> statement-breakpoint
ALTER TABLE "output_reports" ADD CONSTRAINT "output_reports_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "spm_q4_fy_ref_unique_idx" ON "spm_q4" USING btree ("fiscal_year_id","reference_number") WHERE deleted_at IS NULL;