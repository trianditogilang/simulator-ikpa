import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	smallint,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { fiscalYears } from "./fiscal-years";
import { organizations, users } from "./identity";
import { ruleSets } from "./policy";

export const assessmentExclusionPolicies = pgTable(
	"assessment_exclusion_policies",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ruleSetId: uuid("rule_set_id").references(() => ruleSets.id, {
			onDelete: "cascade",
		}),
		name: text("name").notNull(),
		indicatorKey: text("indicator_key").default("output_achievement").notNull(),
		action: text("action").default("exclude_from_assessment").notNull(),
		category: text("category").default("ro_khusus").notNull(),
		matchType: text("match_type").default("exact").notNull(), // exact | list | prefix | regex
		roMatchValue: jsonb("ro_match_value").$type<string | string[]>().notNull(), // ['FAN.ZZ1'] etc
		scopeType: text("scope_type").default("national").notNull(), // national | kppn | organization
		scopeId: uuid("scope_id"),
		fiscalYearId: uuid("fiscal_year_id").references(() => fiscalYears.id, {
			onDelete: "cascade",
		}),
	year: integer("year").default(2026).notNull(),
		effectiveMonthStart: smallint("effective_month_start").default(1).notNull(),
		effectiveMonthEnd: smallint("effective_month_end").default(12).notNull(),
		basisReference: text("basis_reference").notNull(),
	displayReason: text("display_reason").notNull(),
		internalNote: text("internal_note"),
		allowOperatorProposal: boolean("allow_operator_proposal")
			.default(false)
			.notNull(),
		status: text("status").default("draft").notNull(), // draft | published | retired | expired
		version: integer("version").default(1).notNull(),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		publishedBy: uuid("published_by").references(() => users.id, {
			onDelete: "set null",
		}),
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
		index("assessment_exclusion_policies_indicator_key_idx").on(
			table.indicatorKey,
		),
		index("assessment_exclusion_policies_status_idx").on(table.status),
		index("assessment_exclusion_policies_year_idx").on(table.year),
		index("assessment_exclusion_policies_scope_type_idx").on(table.scopeType),
	],
);

export const assessmentExclusionProposals = pgTable(
	"assessment_exclusion_proposals",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.references(() => organizations.id, { onDelete: "cascade" })
			.notNull(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		indicatorKey: text("indicator_key").default("output_achievement").notNull(),
		roCode: text("ro_code").notNull(),
		month: smallint("month"),
		category: text("category").default("ro_khusus").notNull(),
		basisReference: text("basis_reference").notNull(),
	operatorNote: text("operator_note"),
		attachmentRef: text("attachment_ref"),
		status: text("status").default("draft").notNull(), // draft | submitted | approved | rejected | cancelled | expired
		reviewNote: text("review_note"),
		resolvedPolicyId: uuid("resolved_policy_id").references(
			() => assessmentExclusionPolicies.id,
			{ onDelete: "set null" },
		),
		submittedAt: timestamp("submitted_at", { withTimezone: true }),
		submittedBy: uuid("submitted_by").references(() => users.id, {
			onDelete: "set null",
		}),
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
		reviewedBy: uuid("reviewed_by").references(() => users.id, {
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
		index("assessment_exclusion_proposals_org_fy_idx").on(
			table.organizationId,
			table.fiscalYearId,
		),
		index("assessment_exclusion_proposals_status_idx").on(table.status),
		index("assessment_exclusion_proposals_ro_code_idx").on(table.roCode),
	],
);
