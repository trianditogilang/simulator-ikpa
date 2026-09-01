import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { dayTypeEnum, reminderCategoryEnum, ruleSetStatusEnum } from "./enums";
import { users } from "./identity";

export const ruleSets = pgTable(
	"rule_sets",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		year: integer("year").notNull(),
		version: text("version").notNull(),
		effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
		status: ruleSetStatusEnum("status").default("draft").notNull(),
		sourceRegulation: text("source_regulation").notNull(),
		changeNotes: text("change_notes"),
		configJson: jsonb("config_json").notNull(),
		createdBy: uuid("created_by")
			.references(() => users.id, { onDelete: "restrict" })
			.notNull(),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		retiredAt: timestamp("retired_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("rule_sets_year_version_idx").on(table.year, table.version),
		index("rule_sets_effective_from_idx").on(table.effectiveFrom),
		index("rule_sets_status_idx").on(table.status),
		index("rule_sets_year_idx").on(table.year),
	],
);

export const reminderPolicies = pgTable(
	"reminder_policies",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ruleSetId: uuid("rule_set_id")
			.references(() => ruleSets.id, { onDelete: "cascade" })
			.notNull(),
		eventType: text("event_type").notNull(),
		indicatorKey: text("indicator_key").notNull(),
		category: reminderCategoryEnum("category").notNull(),
		deadlineFormula: jsonb("deadline_formula").notNull(),
		dayType: dayTypeEnum("day_type").notNull(),
		minLeadDays: integer("min_lead_days").notNull(),
		maxLeadDays: integer("max_lead_days").notNull(),
		defaultScheduleJson: jsonb("default_schedule_json").notNull(),
		requiredRecipientsJson: jsonb("required_recipients_json").notNull(),
		allowDisable: boolean("allow_disable").default(true).notNull(),
		allowRecipientOverride: boolean("allow_recipient_override")
			.default(true)
			.notNull(),
		isActive: boolean("is_active").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("reminder_policies_ruleset_event_idx").on(
			table.ruleSetId,
			table.eventType,
		),
		index("reminder_policies_rule_set_id_idx").on(table.ruleSetId),
		index("reminder_policies_indicator_key_idx").on(table.indicatorKey),
		index("reminder_policies_category_idx").on(table.category),
	],
);
