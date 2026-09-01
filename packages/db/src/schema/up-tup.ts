import {
	boolean,
	date,
	index,
	numeric,
	pgTable,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { upTupTypeEnum } from "./enums";
import { fiscalYears } from "./fiscal-years";
import { users } from "./identity";

export const upTupTransactions = pgTable(
	"up_tup_transactions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		type: upTupTypeEnum("type").notNull(),
		amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
		sp2dAt: date("sp2d_at").notNull(),
		referenceSp2dAt: date("reference_sp2d_at"),
		settlementDate: date("settlement_date"),
		isSettled: boolean("is_settled").default(false).notNull(),
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
		index("up_tup_transactions_fiscal_year_id_idx").on(table.fiscalYearId),
		index("up_tup_transactions_type_idx").on(table.type),
		index("up_tup_transactions_sp2d_at_idx").on(table.sp2dAt),
		index("up_tup_transactions_settlement_date_idx").on(table.settlementDate),
		index("up_tup_transactions_deleted_at_idx").on(table.deletedAt),
	],
);
