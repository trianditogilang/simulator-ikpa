import {
	date,
	index,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { paymentTypeEnum } from "./enums";
import { fiscalYears } from "./fiscal-years";
import { users } from "./identity";

export const contracts = pgTable(
	"contracts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		contractNumber: text("contract_number").notNull(),
		accountCode: text("account_code").notNull(),
		value: numeric("value", { precision: 18, scale: 2 }).notNull(),
		signedAt: date("signed_at").notNull(),
		paymentType: paymentTypeEnum("payment_type").notNull(),
		sp2dAt: date("sp2d_at"),
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
		index("contracts_fiscal_year_id_idx").on(table.fiscalYearId),
		index("contracts_contract_number_idx").on(table.contractNumber),
		index("contracts_account_code_idx").on(table.accountCode),
		index("contracts_signed_at_idx").on(table.signedAt),
		index("contracts_deleted_at_idx").on(table.deletedAt),
	],
);
