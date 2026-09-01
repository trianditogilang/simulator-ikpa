import {
	date,
	index,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { fiscalYears } from "./fiscal-years";
import { users } from "./identity";

export const budgets = pgTable(
	"budgets",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		accountCode: text("account_code").notNull(),
		amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
		effectiveAt: date("effective_at").notNull(),
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
		index("budgets_fiscal_year_id_idx").on(table.fiscalYearId),
		index("budgets_account_code_idx").on(table.accountCode),
		index("budgets_effective_at_idx").on(table.effectiveAt),
		index("budgets_deleted_at_idx").on(table.deletedAt),
	],
);

export const dipaRevisions = pgTable(
	"dipa_revisions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fiscalYearId: uuid("fiscal_year_id")
			.references(() => fiscalYears.id, { onDelete: "cascade" })
			.notNull(),
		revisionDate: date("revision_date").notNull(),
		revisionCode: text("revision_code").notNull(),
		paguBefore: numeric("pagu_before", { precision: 18, scale: 2 }).notNull(),
		paguAfter: numeric("pagu_after", { precision: 18, scale: 2 }).notNull(),
		notes: text("notes"),
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
		index("dipa_revisions_fiscal_year_id_idx").on(table.fiscalYearId),
		index("dipa_revisions_revision_date_idx").on(table.revisionDate),
		index("dipa_revisions_deleted_at_idx").on(table.deletedAt),
	],
);
