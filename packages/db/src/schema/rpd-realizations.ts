import {
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

export const rpdLines = pgTable(
	"rpd_lines",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		month: smallint("month").notNull(),
		accountCode: text("account_code").notNull(),
		amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
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
		index("rpd_lines_fiscal_year_id_idx").on(table.fiscalYearId),
		index("rpd_lines_month_account_idx").on(table.month, table.accountCode),
		index("rpd_lines_deleted_at_idx").on(table.deletedAt),
	],
);

export const realizations = pgTable(
	"realizations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		month: smallint("month").notNull(),
		accountCode: text("account_code").notNull(),
		amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
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
		index("realizations_fiscal_year_id_idx").on(table.fiscalYearId),
		index("realizations_month_account_idx").on(table.month, table.accountCode),
		index("realizations_deleted_at_idx").on(table.deletedAt),
	],
);
