CREATE TYPE "public"."access_type" AS ENUM('operator_satker', 'admin_kppn');--> statement-breakpoint
CREATE TYPE "public"."day_type" AS ENUM('workday', 'calendar_day', 'event_based', 'schedule');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('scheduled', 'sent', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('uploaded', 'validating', 'validated', 'committing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('sekaligus', 'termin');--> statement-breakpoint
CREATE TYPE "public"."reminder_category" AS ENUM('mandatory', 'recommended', 'optional');--> statement-breakpoint
CREATE TYPE "public"."rule_set_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "public"."simulation_type" AS ENUM('actual', 'forecast', 'scenario');--> statement-breakpoint
CREATE TYPE "public"."up_tup_type" AS ENUM('UP', 'TUP', 'GUP', 'GUP_NIHIL', 'PTUP', 'SETORAN_TUP');--> statement-breakpoint
CREATE TABLE "kppn_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kppn_scopes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" text,
	"kppn_scope_id" uuid NOT NULL,
	"kode_satker" text NOT NULL,
	"name" text NOT NULL,
	"kppn_name" text NOT NULL,
	"is_blu" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_clerk_org_id_unique" UNIQUE("clerk_org_id"),
	CONSTRAINT "organizations_kode_satker_unique" UNIQUE("kode_satker")
);
--> statement-breakpoint
CREATE TABLE "user_accesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"access_type" "access_type" NOT NULL,
	"org_id" uuid,
	"kppn_scope_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "reminder_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"indicator_key" text NOT NULL,
	"category" "reminder_category" NOT NULL,
	"deadline_formula" jsonb NOT NULL,
	"day_type" "day_type" NOT NULL,
	"min_lead_days" integer NOT NULL,
	"max_lead_days" integer NOT NULL,
	"default_schedule_json" jsonb NOT NULL,
	"required_recipients_json" jsonb NOT NULL,
	"allow_disable" boolean DEFAULT true NOT NULL,
	"allow_recipient_override" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"version" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"status" "rule_set_status" DEFAULT 'draft' NOT NULL,
	"source_regulation" text NOT NULL,
	"change_notes" text,
	"config_json" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"published_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workdays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"date" date NOT NULL,
	"is_holiday" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"active_rule_set_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"account_code" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"effective_at" date NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dipa_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"revision_date" date NOT NULL,
	"revision_code" text NOT NULL,
	"pagu_before" numeric(18, 2) NOT NULL,
	"pagu_after" numeric(18, 2) NOT NULL,
	"notes" text,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "realizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"month" smallint NOT NULL,
	"account_code" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rpd_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"month" smallint NOT NULL,
	"account_code" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"contract_number" text NOT NULL,
	"account_code" text NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"signed_at" date NOT NULL,
	"payment_type" "payment_type" NOT NULL,
	"sp2d_at" date,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spm_ls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"reference_number" text NOT NULL,
	"bast_bapp_date" date NOT NULL,
	"received_at_kppn" date NOT NULL,
	"is_pegawai" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "up_tup_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"type" "up_tup_type" NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"sp2d_at" date NOT NULL,
	"reference_sp2d_at" date,
	"settlement_date" date,
	"is_settled" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kkp_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"month" smallint NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"usage_date" date,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "output_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"ro_code" text NOT NULL,
	"month" smallint NOT NULL,
	"rvro" numeric(18, 4) NOT NULL,
	"volume_dipa" numeric(18, 4) NOT NULL,
	"pcro" numeric(8, 4) NOT NULL,
	"tpcro" numeric(8, 4) NOT NULL,
	"reported_at" timestamp with time zone,
	"confirmed" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spm_q4" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"reference_number" text NOT NULL,
	"issued_at" date NOT NULL,
	"is_dispensasi" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"simulation_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"patch_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "simulation_type" NOT NULL,
	"target_score" numeric(8, 4),
	"parent_snapshot_id" uuid,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"simulation_id" uuid NOT NULL,
	"period_end" date NOT NULL,
	"total_score" numeric(8, 4),
	"breakdown_json" jsonb NOT NULL,
	"rule_set_version" text NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_reminder_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"reminder_policy_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"schedule_json" jsonb NOT NULL,
	"additional_recipients_json" jsonb NOT NULL,
	"custom_message" text,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"reminder_policy_id" uuid NOT NULL,
	"rule_set_version" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"status" "delivery_status" DEFAULT 'scheduled' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_deliveries_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"filename" text NOT NULL,
	"storage_key" text,
	"status" "import_status" DEFAULT 'uploaded' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"invalid_rows" integer DEFAULT 0 NOT NULL,
	"error_report_json" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"actor_id" uuid,
	"actor_access_type" "access_type",
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"rule_set_version" text,
	"policy_id" uuid,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_kppn_scope_id_kppn_scopes_id_fk" FOREIGN KEY ("kppn_scope_id") REFERENCES "public"."kppn_scopes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_accesses" ADD CONSTRAINT "user_accesses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_accesses" ADD CONSTRAINT "user_accesses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_accesses" ADD CONSTRAINT "user_accesses_kppn_scope_id_kppn_scopes_id_fk" FOREIGN KEY ("kppn_scope_id") REFERENCES "public"."kppn_scopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_accesses" ADD CONSTRAINT "user_accesses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_policies" ADD CONSTRAINT "reminder_policies_rule_set_id_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."rule_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workdays" ADD CONSTRAINT "workdays_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_active_rule_set_id_rule_sets_id_fk" FOREIGN KEY ("active_rule_set_id") REFERENCES "public"."rule_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dipa_revisions" ADD CONSTRAINT "dipa_revisions_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dipa_revisions" ADD CONSTRAINT "dipa_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realizations" ADD CONSTRAINT "realizations_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realizations" ADD CONSTRAINT "realizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpd_lines" ADD CONSTRAINT "rpd_lines_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpd_lines" ADD CONSTRAINT "rpd_lines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spm_ls" ADD CONSTRAINT "spm_ls_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spm_ls" ADD CONSTRAINT "spm_ls_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spm_ls" ADD CONSTRAINT "spm_ls_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "up_tup_transactions" ADD CONSTRAINT "up_tup_transactions_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "up_tup_transactions" ADD CONSTRAINT "up_tup_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kkp_usages" ADD CONSTRAINT "kkp_usages_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kkp_usages" ADD CONSTRAINT "kkp_usages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "output_reports" ADD CONSTRAINT "output_reports_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "output_reports" ADD CONSTRAINT "output_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spm_q4" ADD CONSTRAINT "spm_q4_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spm_q4" ADD CONSTRAINT "spm_q4_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_overrides" ADD CONSTRAINT "simulation_overrides_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_rule_set_id_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."rule_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_reminder_configs" ADD CONSTRAINT "org_reminder_configs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_reminder_configs" ADD CONSTRAINT "org_reminder_configs_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_reminder_configs" ADD CONSTRAINT "org_reminder_configs_reminder_policy_id_reminder_policies_id_fk" FOREIGN KEY ("reminder_policy_id") REFERENCES "public"."reminder_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_reminder_configs" ADD CONSTRAINT "org_reminder_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_reminder_policy_id_reminder_policies_id_fk" FOREIGN KEY ("reminder_policy_id") REFERENCES "public"."reminder_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_policy_id_reminder_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."reminder_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kppn_scopes_code_idx" ON "kppn_scopes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_kode_satker_idx" ON "organizations" USING btree ("kode_satker");--> statement-breakpoint
CREATE INDEX "organizations_kppn_scope_id_idx" ON "organizations" USING btree ("kppn_scope_id");--> statement-breakpoint
CREATE INDEX "user_accesses_user_id_idx" ON "user_accesses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_accesses_org_id_idx" ON "user_accesses" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "user_accesses_kppn_scope_id_idx" ON "user_accesses" USING btree ("kppn_scope_id");--> statement-breakpoint
CREATE INDEX "user_accesses_active_idx" ON "user_accesses" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_idx" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_policies_ruleset_event_idx" ON "reminder_policies" USING btree ("rule_set_id","event_type");--> statement-breakpoint
CREATE INDEX "reminder_policies_rule_set_id_idx" ON "reminder_policies" USING btree ("rule_set_id");--> statement-breakpoint
CREATE INDEX "reminder_policies_indicator_key_idx" ON "reminder_policies" USING btree ("indicator_key");--> statement-breakpoint
CREATE INDEX "reminder_policies_category_idx" ON "reminder_policies" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "rule_sets_year_version_idx" ON "rule_sets" USING btree ("year","version");--> statement-breakpoint
CREATE INDEX "rule_sets_effective_from_idx" ON "rule_sets" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "rule_sets_status_idx" ON "rule_sets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rule_sets_year_idx" ON "rule_sets" USING btree ("year");--> statement-breakpoint
CREATE UNIQUE INDEX "workdays_year_date_idx" ON "workdays" USING btree ("year","date");--> statement-breakpoint
CREATE INDEX "workdays_date_idx" ON "workdays" USING btree ("date");--> statement-breakpoint
CREATE INDEX "workdays_year_idx" ON "workdays" USING btree ("year");--> statement-breakpoint
CREATE INDEX "workdays_is_holiday_idx" ON "workdays" USING btree ("is_holiday");--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_years_org_year_idx" ON "fiscal_years" USING btree ("org_id","year");--> statement-breakpoint
CREATE INDEX "fiscal_years_org_id_idx" ON "fiscal_years" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "fiscal_years_year_idx" ON "fiscal_years" USING btree ("year");--> statement-breakpoint
CREATE INDEX "fiscal_years_active_rule_set_id_idx" ON "fiscal_years" USING btree ("active_rule_set_id");--> statement-breakpoint
CREATE INDEX "budgets_fiscal_year_id_idx" ON "budgets" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "budgets_account_code_idx" ON "budgets" USING btree ("account_code");--> statement-breakpoint
CREATE INDEX "budgets_effective_at_idx" ON "budgets" USING btree ("effective_at");--> statement-breakpoint
CREATE INDEX "budgets_deleted_at_idx" ON "budgets" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "dipa_revisions_fiscal_year_id_idx" ON "dipa_revisions" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "dipa_revisions_revision_date_idx" ON "dipa_revisions" USING btree ("revision_date");--> statement-breakpoint
CREATE INDEX "dipa_revisions_deleted_at_idx" ON "dipa_revisions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "realizations_fiscal_year_id_idx" ON "realizations" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "realizations_month_account_idx" ON "realizations" USING btree ("month","account_code");--> statement-breakpoint
CREATE INDEX "realizations_deleted_at_idx" ON "realizations" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "rpd_lines_fiscal_year_id_idx" ON "rpd_lines" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "rpd_lines_month_account_idx" ON "rpd_lines" USING btree ("month","account_code");--> statement-breakpoint
CREATE INDEX "rpd_lines_deleted_at_idx" ON "rpd_lines" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "contracts_fiscal_year_id_idx" ON "contracts" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "contracts_contract_number_idx" ON "contracts" USING btree ("contract_number");--> statement-breakpoint
CREATE INDEX "contracts_account_code_idx" ON "contracts" USING btree ("account_code");--> statement-breakpoint
CREATE INDEX "contracts_signed_at_idx" ON "contracts" USING btree ("signed_at");--> statement-breakpoint
CREATE INDEX "contracts_deleted_at_idx" ON "contracts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "spm_ls_fiscal_year_id_idx" ON "spm_ls" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "spm_ls_contract_id_idx" ON "spm_ls" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "spm_ls_bast_bapp_date_idx" ON "spm_ls" USING btree ("bast_bapp_date");--> statement-breakpoint
CREATE INDEX "spm_ls_received_at_kppn_idx" ON "spm_ls" USING btree ("received_at_kppn");--> statement-breakpoint
CREATE INDEX "spm_ls_is_pegawai_idx" ON "spm_ls" USING btree ("is_pegawai");--> statement-breakpoint
CREATE INDEX "spm_ls_deleted_at_idx" ON "spm_ls" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "up_tup_transactions_fiscal_year_id_idx" ON "up_tup_transactions" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "up_tup_transactions_type_idx" ON "up_tup_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "up_tup_transactions_sp2d_at_idx" ON "up_tup_transactions" USING btree ("sp2d_at");--> statement-breakpoint
CREATE INDEX "up_tup_transactions_settlement_date_idx" ON "up_tup_transactions" USING btree ("settlement_date");--> statement-breakpoint
CREATE INDEX "up_tup_transactions_deleted_at_idx" ON "up_tup_transactions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "kkp_usages_fiscal_year_id_idx" ON "kkp_usages" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "kkp_usages_month_idx" ON "kkp_usages" USING btree ("month");--> statement-breakpoint
CREATE INDEX "kkp_usages_deleted_at_idx" ON "kkp_usages" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "output_reports_fiscal_year_id_idx" ON "output_reports" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "output_reports_ro_code_month_idx" ON "output_reports" USING btree ("ro_code","month");--> statement-breakpoint
CREATE INDEX "output_reports_confirmed_idx" ON "output_reports" USING btree ("confirmed");--> statement-breakpoint
CREATE INDEX "output_reports_deleted_at_idx" ON "output_reports" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "spm_q4_fiscal_year_id_idx" ON "spm_q4" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "spm_q4_reference_number_idx" ON "spm_q4" USING btree ("reference_number");--> statement-breakpoint
CREATE INDEX "spm_q4_issued_at_idx" ON "spm_q4" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "spm_q4_is_dispensasi_idx" ON "spm_q4" USING btree ("is_dispensasi");--> statement-breakpoint
CREATE INDEX "spm_q4_deleted_at_idx" ON "spm_q4" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "simulation_overrides_simulation_id_idx" ON "simulation_overrides" USING btree ("simulation_id");--> statement-breakpoint
CREATE INDEX "simulation_overrides_entity_type_idx" ON "simulation_overrides" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "simulation_overrides_entity_id_idx" ON "simulation_overrides" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "simulations_fiscal_year_id_idx" ON "simulations" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "simulations_type_idx" ON "simulations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "simulations_parent_snapshot_id_idx" ON "simulations" USING btree ("parent_snapshot_id");--> statement-breakpoint
CREATE INDEX "simulations_deleted_at_idx" ON "simulations" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "score_snapshots_simulation_id_idx" ON "score_snapshots" USING btree ("simulation_id");--> statement-breakpoint
CREATE INDEX "score_snapshots_period_end_idx" ON "score_snapshots" USING btree ("period_end");--> statement-breakpoint
CREATE INDEX "score_snapshots_rule_set_id_idx" ON "score_snapshots" USING btree ("rule_set_id");--> statement-breakpoint
CREATE INDEX "score_snapshots_input_hash_idx" ON "score_snapshots" USING btree ("input_hash");--> statement-breakpoint
CREATE INDEX "score_snapshots_created_at_idx" ON "score_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "org_reminder_configs_org_fy_policy_idx" ON "org_reminder_configs" USING btree ("org_id","fiscal_year_id","reminder_policy_id");--> statement-breakpoint
CREATE INDEX "org_reminder_configs_org_id_idx" ON "org_reminder_configs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_reminder_configs_fiscal_year_id_idx" ON "org_reminder_configs" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "org_reminder_configs_reminder_policy_id_idx" ON "org_reminder_configs" USING btree ("reminder_policy_id");--> statement-breakpoint
CREATE INDEX "org_reminder_configs_enabled_idx" ON "org_reminder_configs" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_idempotency_key_idx" ON "notification_deliveries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notification_deliveries_org_id_idx" ON "notification_deliveries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_reminder_policy_id_idx" ON "notification_deliveries" USING btree ("reminder_policy_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_scheduled_for_idx" ON "notification_deliveries" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_jobs_org_id_idx" ON "import_jobs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "import_jobs_fiscal_year_id_idx" ON "import_jobs" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "import_jobs_domain_idx" ON "import_jobs" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "import_jobs_status_idx" ON "import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_jobs_created_at_idx" ON "import_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_org_id_idx" ON "audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");