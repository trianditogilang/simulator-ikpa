import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { importStatusEnum } from "./enums";
import { fiscalYears } from "./fiscal-years";
import { organizations, users } from "./identity";

export const importJobs = pgTable(
	"import_jobs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orgId: uuid("org_id")
			.references(() => organizations.id, { onDelete: "cascade" })
			.notNull(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		domain: text("domain").notNull(),
		filename: text("filename").notNull(),
		storageKey: text("storage_key"),
		status: importStatusEnum("status").default("uploaded").notNull(),
		totalRows: integer("total_rows").default(0).notNull(),
		validRows: integer("valid_rows").default(0).notNull(),
		invalidRows: integer("invalid_rows").default(0).notNull(),
		errorReportJson: jsonb("error_report_json"),
		createdBy: uuid("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("import_jobs_org_id_idx").on(table.orgId),
		index("import_jobs_fiscal_year_id_idx").on(table.fiscalYearId),
		index("import_jobs_domain_idx").on(table.domain),
		index("import_jobs_status_idx").on(table.status),
		index("import_jobs_created_at_idx").on(table.createdAt),
	],
);
