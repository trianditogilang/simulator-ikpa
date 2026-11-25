import {
	bigint,
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity";

// Better Auth tables (ADR-008, MIG-03). Property names follow the Better Auth
// model fields so the Drizzle adapter needs no field mapping; `users` in
// identity.ts is the Better Auth user model.

const timestamps = {
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
};

export const authSessions = pgTable(
	"auth_sessions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		...timestamps,
	},
	(table) => [index("auth_sessions_user_id_idx").on(table.userId)],
);

export const authAccounts = pgTable(
	"auth_accounts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		// scrypt hash for the `credential` provider. Never selected by app code.
		password: text("password"),
		// OAuth columns are part of the Better Auth core model; unused here.
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		...timestamps,
	},
	(table) => [index("auth_accounts_user_id_idx").on(table.userId)],
);

// Holds hashed OTPs, pending two-factor challenges, and trusted-device records
// (`trust-device-*`, value = user id).
export const authVerifications = pgTable(
	"auth_verifications",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		...timestamps,
	},
	(table) => [index("auth_verifications_identifier_idx").on(table.identifier)],
);

// Required by the two-factor plugin. TOTP is disabled, so no rows are written;
// the email OTP second step only needs users.two_factor_enabled.
export const authTwoFactors = pgTable(
	"auth_two_factors",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		secret: text("secret").notNull(),
		backupCodes: text("backup_codes").notNull(),
		verified: boolean("verified").default(true),
		failedVerificationCount: integer("failed_verification_count").default(0),
		lockedUntil: timestamp("locked_until", { withTimezone: true }),
	},
	(table) => [index("auth_two_factors_user_id_idx").on(table.userId)],
);

export const authRateLimits = pgTable("auth_rate_limits", {
	id: uuid("id").primaryKey().defaultRandom(),
	key: text("key").notNull().unique(),
	count: integer("count").notNull(),
	lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
