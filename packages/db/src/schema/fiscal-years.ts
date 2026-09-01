import {
	index,
	integer,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./identity";
import { ruleSets } from "./policy";

export const fiscalYears = pgTable(
	"fiscal_years",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orgId: uuid("org_id")
			.references(() => organizations.id, { onDelete: "cascade" })
			.notNull(),
		year: integer("year").notNull(),
		activeRuleSetId: uuid("active_rule_set_id")
			.references(() => ruleSets.id, { onDelete: "restrict" })
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("fiscal_years_org_year_idx").on(table.orgId, table.year),
		index("fiscal_years_org_id_idx").on(table.orgId),
		index("fiscal_years_year_idx").on(table.year),
		index("fiscal_years_active_rule_set_id_idx").on(table.activeRuleSetId),
	],
);
