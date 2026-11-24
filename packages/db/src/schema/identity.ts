import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import {
	accessRequestStatusEnum,
	accessStatusEnum,
	accessTypeEnum,
} from "./enums";

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
		email: text("email").notNull().unique(),
		name: text("name").notNull(),
		// Better Auth user model fields (ADR-008, MIG-03).
		emailVerified: boolean("email_verified").default(false).notNull(),
		image: text("image"),
		// Email OTP on unknown devices is mandatory for every account.
		twoFactorEnabled: boolean("two_factor_enabled").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const userAccesses = pgTable(
	"user_accesses",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id").references(() => users.id, {
			onDelete: "cascade",
		}),
		accessType: accessTypeEnum("access_type").notNull(),
		status: accessStatusEnum("status").default("active").notNull(),
		invitedEmail: text("invited_email"),
		orgId: uuid("org_id").references(() => organizations.id, {
			onDelete: "cascade",
		}),
		kppnScopeId: uuid("kppn_scope_id").references(() => kppnScopes.id, {
			onDelete: "cascade",
		}),
		active: boolean("active").default(true).notNull(),
		adminSlot: integer("admin_slot"),
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
		index("user_accesses_invited_email_idx").on(table.invitedEmail),
		uniqueIndex("user_accesses_admin_slot_unique")
			.on(table.kppnScopeId, table.adminSlot)
			.where(
				sql`${table.accessType} = 'admin_kppn' AND ${table.active} = true AND ${table.adminSlot} IS NOT NULL`,
			),
		uniqueIndex("user_accesses_operator_org_unique")
			.on(table.orgId)
			.where(
				sql`${table.accessType} = 'operator_satker' AND ${table.active} = true AND ${table.orgId} IS NOT NULL`,
			),
	],
);

/**
 * Self-service Operator Satker request (one per user). It grants nothing and
 * never touches `organizations` until an Admin KPPN approves it; approval
 * deletes the row and the onboarding audit entry keeps the trail.
 */
export const accessRequests = pgTable(
	"access_requests",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull()
			.unique(),
		kodeSatker: text("kode_satker").notNull(),
		satkerName: text("satker_name").notNull(),
		status: accessRequestStatusEnum("status").default("pending").notNull(),
		decidedBy: uuid("decided_by").references(() => users.id, {
			onDelete: "set null",
		}),
		decidedAt: timestamp("decided_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [index("access_requests_status_idx").on(table.status)],
);
