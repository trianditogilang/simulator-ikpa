import {
	index,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { simulationTypeEnum } from "./enums";
import { fiscalYears } from "./fiscal-years";
import { users } from "./identity";

export const simulations = pgTable(
	"simulations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		name: text("name").notNull(),
		type: simulationTypeEnum("type").notNull(),
		targetScore: numeric("target_score", { precision: 8, scale: 4 }),
		parentSnapshotId: uuid("parent_snapshot_id"),
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
		index("simulations_fiscal_year_id_idx").on(table.fiscalYearId),
		index("simulations_type_idx").on(table.type),
		index("simulations_parent_snapshot_id_idx").on(table.parentSnapshotId),
		index("simulations_deleted_at_idx").on(table.deletedAt),
	],
);

export const simulationOverrides = pgTable(
	"simulation_overrides",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		simulationId: uuid("simulation_id")
			.references(() => simulations.id, { onDelete: "cascade" })
			.notNull(),
		entityType: text("entity_type").notNull(),
		entityId: uuid("entity_id"),
		patchJson: jsonb("patch_json").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("simulation_overrides_simulation_id_idx").on(table.simulationId),
		index("simulation_overrides_entity_type_idx").on(table.entityType),
		index("simulation_overrides_entity_id_idx").on(table.entityId),
	],
);
