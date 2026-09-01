import {
	boolean,
	index,
	numeric,
	pgTable,
	smallint,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { fiscalYears } from "./fiscal-years";
import { users } from "./identity";

export const outputReports = pgTable(
	"output_reports",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		roCode: text("ro_code").notNull(),
		month: smallint("month").notNull(),
		rvro: numeric("rvro", { precision: 18, scale: 4 }).notNull(),
		volumeDipa: numeric("volume_dipa", { precision: 18, scale: 4 }).notNull(),
		pcro: numeric("pcro", { precision: 8, scale: 4 }).notNull(),
		tpcro: numeric("tpcro", { precision: 8, scale: 4 }).notNull(),
		reportedAt: timestamp("reported_at", { withTimezone: true }),
		confirmed: boolean("confirmed").default(false).notNull(),
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
		index("output_reports_confirmed_idx").on(table.confirmed),
		index("output_reports_deleted_at_idx").on(table.deletedAt),
	],
);
