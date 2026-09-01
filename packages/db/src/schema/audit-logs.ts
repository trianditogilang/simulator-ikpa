import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { accessTypeEnum } from "./enums";
import { organizations, users } from "./identity";
import { reminderPolicies } from "./policy";

export const auditLogs = pgTable(
	"audit_logs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orgId: uuid("org_id").references(() => organizations.id, {
			onDelete: "set null",
		}),
		actorId: uuid("actor_id").references(() => users.id, {
			onDelete: "set null",
		}),
		actorAccessType: accessTypeEnum("actor_access_type"),
		entityType: text("entity_type").notNull(),
		entityId: uuid("entity_id"),
		action: text("action").notNull(),
		beforeJson: jsonb("before_json"),
		afterJson: jsonb("after_json"),
		ruleSetVersion: text("rule_set_version"),
		policyId: uuid("policy_id").references(() => reminderPolicies.id, {
			onDelete: "set null",
		}),
		requestId: text("request_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("audit_logs_org_id_idx").on(table.orgId),
		index("audit_logs_actor_id_idx").on(table.actorId),
		index("audit_logs_entity_type_idx").on(table.entityType),
		index("audit_logs_entity_id_idx").on(table.entityId),
		index("audit_logs_action_idx").on(table.action),
		index("audit_logs_created_at_idx").on(table.createdAt),
	],
);
