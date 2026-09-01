import {
	date,
	index,
	numeric,
	pgTable,
	smallint,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { fiscalYears } from "./fiscal-years";
import { users } from "./identity";

export const kkpUsages = pgTable(
	"kkp_usages",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		month: smallint("month").notNull(),
		amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
		usageDate: date("usage_date"),
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
		index("kkp_usages_fiscal_year_id_idx").on(table.fiscalYearId),
		index("kkp_usages_month_idx").on(table.month),
		index("kkp_usages_deleted_at_idx").on(table.deletedAt),
	],
);
