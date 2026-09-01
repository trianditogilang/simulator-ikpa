import {
	boolean,
	date,
	index,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { fiscalYears } from "./fiscal-years";
import { users } from "./identity";

export const spmQ4 = pgTable(
	"spm_q4",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		referenceNumber: text("reference_number").notNull(),
		issuedAt: date("issued_at").notNull(),
		isDispensasi: boolean("is_dispensasi").default(false).notNull(),
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
		index("spm_q4_fiscal_year_id_idx").on(table.fiscalYearId),
		index("spm_q4_reference_number_idx").on(table.referenceNumber),
		index("spm_q4_issued_at_idx").on(table.issuedAt),
		index("spm_q4_is_dispensasi_idx").on(table.isDispensasi),
		index("spm_q4_deleted_at_idx").on(table.deletedAt),
	],
);
