import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { fiscalYears } from "./fiscal-years";
import { organizations, users } from "./identity";
import { reminderPolicies } from "./policy";

export const orgReminderConfigs = pgTable(
	"org_reminder_configs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orgId: uuid("org_id")
			.references(() => organizations.id, { onDelete: "cascade" })
			.notNull(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		reminderPolicyId: uuid("reminder_policy_id")
			.references(() => reminderPolicies.id, { onDelete: "cascade" })
			.notNull(),
		enabled: boolean("enabled").default(true).notNull(),
		scheduleJson: jsonb("schedule_json").notNull(),
		additionalRecipientsJson: jsonb("additional_recipients_json").notNull(),
		customMessage: text("custom_message"),
		timezone: text("timezone").default("Asia/Jakarta").notNull(),
		updatedBy: uuid("updated_by").references(() => users.id, {
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
		uniqueIndex("org_reminder_configs_org_fy_policy_idx").on(
			table.orgId,
			table.fiscalYearId,
			table.reminderPolicyId,
		),
		index("org_reminder_configs_org_id_idx").on(table.orgId),
		index("org_reminder_configs_fiscal_year_id_idx").on(table.fiscalYearId),
		index("org_reminder_configs_reminder_policy_id_idx").on(
			table.reminderPolicyId,
		),
		index("org_reminder_configs_enabled_idx").on(table.enabled),
	],
);
