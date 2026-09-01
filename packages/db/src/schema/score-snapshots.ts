import {
	date,
	index,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity";
import { ruleSets } from "./policy";
import { simulations } from "./simulations";

export const scoreSnapshots = pgTable(
	"score_snapshots",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		simulationId: uuid("simulation_id")
			.references(() => simulations.id, { onDelete: "cascade" })
			.notNull(),
		periodEnd: date("period_end").notNull(),
		totalScore: numeric("total_score", { precision: 8, scale: 4 }),
		breakdownJson: jsonb("breakdown_json").notNull(),
		ruleSetVersion: text("rule_set_version").notNull(),
		ruleSetId: uuid("rule_set_id")
			.references(() => ruleSets.id, { onDelete: "restrict" })
			.notNull(),
		inputHash: text("input_hash").notNull(),
		createdBy: uuid("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("score_snapshots_simulation_id_idx").on(table.simulationId),
		index("score_snapshots_period_end_idx").on(table.periodEnd),
		index("score_snapshots_rule_set_id_idx").on(table.ruleSetId),
		index("score_snapshots_input_hash_idx").on(table.inputHash),
		index("score_snapshots_created_at_idx").on(table.createdAt),
	],
);
