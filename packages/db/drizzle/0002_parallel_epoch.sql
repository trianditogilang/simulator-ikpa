CREATE TABLE "output_target_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"organization_id" uuid,
	"ro_code" text NOT NULL,
	"ro_name" text,
	"unit" text DEFAULT 'Layanan' NOT NULL,
	"unit_allows_decimal" boolean DEFAULT false NOT NULL,
	"max_decimal_places" integer DEFAULT 0 NOT NULL,
	"is_priority_national" boolean DEFAULT false NOT NULL,
	"volume_dipa" numeric(18, 4) NOT NULL,
	"budget_amount_ro" numeric(18, 2),
	"measurement_method" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"effective_month_start" smallint DEFAULT 1 NOT NULL,
	"effective_month_end" smallint DEFAULT 12 NOT NULL,
	"monthly_targets_json" jsonb NOT NULL,
	"change_reason" text,
	"submitted_at" timestamp with time zone,
	"submitted_by" uuid,
	"activated_at" timestamp with time zone,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ro_budget_realizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"organization_id" uuid,
	"ro_code" text NOT NULL,
	"month" smallint NOT NULL,
	"budget_amount_ro" numeric(18, 2) NOT NULL,
	"realized_amount_monthly" numeric(18, 2) NOT NULL,
	"realized_amount_cumulative" numeric(18, 2) NOT NULL,
	"ppa_monthly" numeric(8, 4) NOT NULL,
	"ppa_cumulative" numeric(8, 4) NOT NULL,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"verification_status" text DEFAULT 'verified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target_update_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"quarter" smallint NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"day_type" text DEFAULT 'workday' NOT NULL,
	"source_reference" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "output_reports" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "output_reports" ADD COLUMN "rvro_incremental" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "output_reports" ADD COLUMN "pcro_incremental" numeric(8, 4);--> statement-breakpoint
ALTER TABLE "output_reports" ADD COLUMN "evidence_document_url" text;--> statement-breakpoint
ALTER TABLE "output_reports" ADD COLUMN "achievement_reference" text;--> statement-breakpoint
ALTER TABLE "output_reports" ADD COLUMN "operator_note" text;--> statement-breakpoint
ALTER TABLE "output_reports" ADD COLUMN "ppk_validation_note" text;--> statement-breakpoint
ALTER TABLE "output_reports" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "output_reports" ADD COLUMN "validation_results_json" jsonb;--> statement-breakpoint
ALTER TABLE "output_target_plans" ADD CONSTRAINT "output_target_plans_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "output_target_plans" ADD CONSTRAINT "output_target_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "output_target_plans" ADD CONSTRAINT "output_target_plans_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "output_target_plans" ADD CONSTRAINT "output_target_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ro_budget_realizations" ADD CONSTRAINT "ro_budget_realizations_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ro_budget_realizations" ADD CONSTRAINT "ro_budget_realizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_update_windows" ADD CONSTRAINT "target_update_windows_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_update_windows" ADD CONSTRAINT "target_update_windows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "output_target_plans_fy_ro_idx" ON "output_target_plans" USING btree ("fiscal_year_id","ro_code");--> statement-breakpoint
CREATE INDEX "output_target_plans_status_idx" ON "output_target_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "output_target_plans_deleted_at_idx" ON "output_target_plans" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ro_budget_realizations_fy_ro_month_idx" ON "ro_budget_realizations" USING btree ("fiscal_year_id","ro_code","month");--> statement-breakpoint
CREATE INDEX "ro_budget_realizations_ro_month_idx" ON "ro_budget_realizations" USING btree ("ro_code","month");--> statement-breakpoint
CREATE UNIQUE INDEX "target_update_windows_fy_quarter_idx" ON "target_update_windows" USING btree ("fiscal_year_id","quarter");--> statement-breakpoint
CREATE INDEX "target_update_windows_status_idx" ON "target_update_windows" USING btree ("status");--> statement-breakpoint
ALTER TABLE "output_reports" ADD CONSTRAINT "output_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "output_reports_status_idx" ON "output_reports" USING btree ("status");