import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { deliveryStatusEnum } from "./enums";
import { organizations } from "./identity";
import { reminderPolicies } from "./policy";

export const notificationDeliveries = pgTable(
	"notification_deliveries",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orgId: uuid("org_id")
			.references(() => organizations.id, { onDelete: "cascade" })
			.notNull(),
		reminderPolicyId: uuid("reminder_policy_id")
			.references(() => reminderPolicies.id, { onDelete: "cascade" })
			.notNull(),
		ruleSetVersion: text("rule_set_version").notNull(),
		entityType: text("entity_type").notNull(),
		entityId: uuid("entity_id"),
		scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
		sentAt: timestamp("sent_at", { withTimezone: true }),
		status: deliveryStatusEnum("status").default("scheduled").notNull(),
		attemptCount: integer("attempt_count").default(0).notNull(),
		idempotencyKey: text("idempotency_key").notNull().unique(),
		payloadJson: jsonb("payload_json").notNull(),
		errorMessage: text("error_message"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("notification_deliveries_idempotency_key_idx").on(
			table.idempotencyKey,
		),
		index("notification_deliveries_org_id_idx").on(table.orgId),
		index("notification_deliveries_reminder_policy_id_idx").on(
			table.reminderPolicyId,
		),
		index("notification_deliveries_scheduled_for_idx").on(table.scheduledFor),
		index("notification_deliveries_status_idx").on(table.status),
	],
);
