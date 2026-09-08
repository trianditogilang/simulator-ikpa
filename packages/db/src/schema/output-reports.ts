import {
	boolean,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { fiscalYears } from "./fiscal-years";
import { organizations, users } from "./identity";

export type MonthlyTargetRecord = {
	month: number;
	targetRvro: number;
	targetPcro: number;
	targetRvroCumulative?: number;
	targetPcroCumulative?: number;
	cumulativeTargetRvro?: number;
	cumulativeTargetPcro?: number;
	rpdCumulative?: number;
};

export type OutputValidationResultRecord = {
	code: string;
	severity: string;
	status: "passed" | "failed" | "not_evaluable" | "resolved" | string;
	title: string;
	message: string;
	affectedFields: string[];
	requiresOperatorNote: boolean;
	requiresEvidence: boolean;
	requiresPPKReview: boolean;
	requiresKPPNFollowUp: boolean;
	policyVersion: string;
	resolvedAt?: string;
	resolvedBy?: string;
	resolutionNote?: string;
};

export const outputTargetPlans = pgTable(
	"output_target_plans",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		organizationId: uuid("organization_id")
			.references(() => organizations.id, { onDelete: "cascade" }),
		roCode: text("ro_code").notNull(),
		roName: text("ro_name"),
		unit: text("unit").default("Layanan").notNull(),
		unitAllowsDecimal: boolean("unit_allows_decimal").default(false).notNull(),
		maxDecimalPlaces: integer("max_decimal_places").default(0).notNull(),
		isPriorityNational: boolean("is_priority_national").default(false).notNull(),
		volumeDipa: numeric("volume_dipa", { precision: 18, scale: 4 }).notNull(),
		budgetAmountRo: numeric("budget_amount_ro", { precision: 18, scale: 2 }),
		measurementMethod: text("measurement_method"),
		version: integer("version").default(1).notNull(),
		status: text("status").default("draft").notNull(), // 'draft' | 'submitted' | 'active' | 'superseded'
		effectiveMonthStart: smallint("effective_month_start").default(1).notNull(),
		effectiveMonthEnd: smallint("effective_month_end").default(12).notNull(),
		monthlyTargetsJson: jsonb("monthly_targets_json").$type<MonthlyTargetRecord[]>().notNull(),
		changeReason: text("change_reason"),
		submittedAt: timestamp("submitted_at", { withTimezone: true }),
		submittedBy: uuid("submitted_by").references(() => users.id, {
			onDelete: "set null",
		}),
		activatedAt: timestamp("activated_at", { withTimezone: true }),
		createdBy: uuid("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("output_target_plans_fy_ro_idx").on(table.fiscalYearId, table.roCode),
		index("output_target_plans_status_idx").on(table.status),
		index("output_target_plans_deleted_at_idx").on(table.deletedAt),
	],
);

export const targetUpdateWindows = pgTable(
	"target_update_windows",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		quarter: smallint("quarter").notNull(), // 1..4
		opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
		closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
		dayType: text("day_type").default("workday").notNull(),
		sourceReference: text("source_reference"),
		status: text("status").default("scheduled").notNull(), // 'scheduled' | 'open' | 'closed'
		createdBy: uuid("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("target_update_windows_fy_quarter_idx").on(
			table.fiscalYearId,
			table.quarter,
		),
		index("target_update_windows_status_idx").on(table.status),
	],
);

export const roBudgetRealizations = pgTable(
	"ro_budget_realizations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		organizationId: uuid("organization_id")
			.references(() => organizations.id, { onDelete: "cascade" }),
		roCode: text("ro_code").notNull(),
		month: smallint("month").notNull(),
		budgetAmountRo: numeric("budget_amount_ro", { precision: 18, scale: 2 }).notNull(),
		realizedAmountMonthly: numeric("realized_amount_monthly", { precision: 18, scale: 2 }).notNull(),
		realizedAmountCumulative: numeric("realized_amount_cumulative", { precision: 18, scale: 2 }).notNull(),
		ppaMonthly: numeric("ppa_monthly", { precision: 8, scale: 4 }).notNull(),
		ppaCumulative: numeric("ppa_cumulative", { precision: 8, scale: 4 }).notNull(),
		sourceType: text("source_type").default("manual").notNull(), // 'manual' | 'import_sakti' | 'import_omspan' | 'account_allocation'
		sourceReference: text("source_reference"),
		verificationStatus: text("verification_status").default("verified").notNull(), // 'unverified' | 'verified' | 'estimated'
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("ro_budget_realizations_fy_ro_month_idx").on(
			table.fiscalYearId,
			table.roCode,
			table.month,
		),
		index("ro_budget_realizations_ro_month_idx").on(table.roCode, table.month),
	],
);

export const outputReports = pgTable(
	"output_reports",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		organizationId: uuid("organization_id")
			.references(() => organizations.id, { onDelete: "cascade" }),
		roCode: text("ro_code").notNull(),
		roName: text("ro_name"),
		month: smallint("month").notNull(),
		rvro: numeric("rvro", { precision: 18, scale: 4 }).notNull(),
		volumeDipa: numeric("volume_dipa", { precision: 18, scale: 4 }).notNull(),
		pcro: numeric("pcro", { precision: 8, scale: 4 }).notNull(),
		tpcro: numeric("tpcro", { precision: 8, scale: 4 }).notNull(),
		rvroIncremental: numeric("rvro_incremental", { precision: 18, scale: 4 }),
		pcroIncremental: numeric("pcro_incremental", { precision: 8, scale: 4 }),
		evidenceDocumentUrl: text("evidence_document_url"),
		achievementReference: text("achievement_reference"),
		operatorNote: text("operator_note"),
		ppkValidationNote: text("ppk_validation_note"),
		reportedAt: timestamp("reported_at", { withTimezone: true }),
		status: text("status").default("draft").notNull(), // 'draft' | 'validation_failed' | 'validation_confirmation_required' | 'ready_to_submit' | 'submitted' | 'confirmed' | 'returned_for_correction'
		validationResultsJson: jsonb("validation_results_json").$type<OutputValidationResultRecord[]>(),
		confirmed: boolean("confirmed").default(false).notNull(),
		confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
		confirmedBy: uuid("confirmed_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdBy: uuid("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("output_reports_fiscal_year_id_idx").on(table.fiscalYearId),
		index("output_reports_ro_code_month_idx").on(table.roCode, table.month),
		index("output_reports_status_idx").on(table.status),
		index("output_reports_confirmed_idx").on(table.confirmed),
		index("output_reports_deleted_at_idx").on(table.deletedAt),
	],
);

