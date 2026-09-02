import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { accessTypeEnum } from "./enums";

export const kppnScopes = pgTable(
	"kppn_scopes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		code: text("code").notNull().unique(),
		name: text("name").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [uniqueIndex("kppn_scopes_code_idx").on(table.code)],
);

export const organizations = pgTable(
	"organizations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		clerkOrgId: text("clerk_org_id").unique(),
		kppnScopeId: uuid("kppn_scope_id")
			.references(() => kppnScopes.id, { onDelete: "restrict" })
			.notNull(),
		kodeSatker: text("kode_satker").notNull().unique(),
		name: text("name").notNull(),
		kppnName: text("kppn_name").notNull(),
		isBlu: boolean("is_blu").default(false).notNull(),
		timezone: text("timezone").default("Asia/Jakarta").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("organizations_kode_satker_idx").on(table.kodeSatker),
		index("organizations_kppn_scope_id_idx").on(table.kppnScopeId),
	],
);

export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		clerkUserId: text("clerk_user_id").notNull().unique(),
		email: text("email").notNull().unique(),
		name: text("name").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("users_clerk_user_id_idx").on(table.clerkUserId),
		uniqueIndex("users_email_idx").on(table.email),
	],
);

export const userAccesses = pgTable(
	"user_accesses",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		accessType: accessTypeEnum("access_type").notNull(),
		orgId: uuid("org_id").references(() => organizations.id, {
			onDelete: "cascade",
		}),
		kppnScopeId: uuid("kppn_scope_id").references(() => kppnScopes.id, {
			onDelete: "cascade",
		}),
		active: boolean("active").default(true).notNull(),
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
		index("user_accesses_user_id_idx").on(table.userId),
		index("user_accesses_org_id_idx").on(table.orgId),
		index("user_accesses_kppn_scope_id_idx").on(table.kppnScopeId),
		index("user_accesses_active_idx").on(table.active),
	],
);
