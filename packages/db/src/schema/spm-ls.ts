import {
	boolean,
	date,
	index,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { contracts } from "./contracts";
import { fiscalYears } from "./fiscal-years";
import { users } from "./identity";

export const spmLs = pgTable(
	"spm_ls",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		contractId: uuid("contract_id")
			.references(() => contracts.id, { onDelete: "cascade" })
			.notNull(),
		referenceNumber: text("reference_number").notNull(),
		bastBappDate: date("bast_bapp_date").notNull(),
		receivedAtKppn: date("received_at_kppn").notNull(),
		isPegawai: boolean("is_pegawai").default(false).notNull(),
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
		index("spm_ls_fiscal_year_id_idx").on(table.fiscalYearId),
		index("spm_ls_contract_id_idx").on(table.contractId),
		index("spm_ls_bast_bapp_date_idx").on(table.bastBappDate),
		index("spm_ls_received_at_kppn_idx").on(table.receivedAtKppn),
		index("spm_ls_is_pegawai_idx").on(table.isPegawai),
		index("spm_ls_deleted_at_idx").on(table.deletedAt),
	],
);
