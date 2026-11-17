import { createHash } from "node:crypto";
import { createDbClient, type DbClient } from "@simulator-ikpa/db";
import {
	authAccounts,
	authRateLimits,
	authSessions,
	authTwoFactors,
	authVerifications,
	users,
} from "@simulator-ikpa/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq, sql } from "drizzle-orm";
import {
	OTP_VALID_MINUTES,
	type OtpPurpose,
	sendOtpEmail,
} from "./auth-emails.server";
import { MIN_PASSWORD_LENGTH } from "./auth-session";

const OTP_ALLOWED_ATTEMPTS = 5;
const OTP_EMAIL_MAX_SENDS = 5;
const OTP_EMAIL_WINDOW_MS = 15 * 60 * 1000;
const TRUST_DEVICE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// Only the flows the product uses stay reachable (ADR-008): email + password,
// email OTP, sign-out. Passwordless OTP sign-in, TOTP, backup codes, turning
// the second step off, and self-service email/profile changes are closed.
const disabledPaths = [
	"/account-info",
	"/callback/:id",
	"/change-email",
	"/change-password",
	"/delete-user",
	"/delete-user/callback",
	"/email-otp/change-email",
	"/email-otp/check-verification-otp",
	"/email-otp/request-email-change",
	"/forget-password/email-otp",
	"/get-access-token",
	"/link-social",
	"/list-accounts",
	"/list-sessions",
	"/refresh-token",
	"/request-password-reset",
	"/reset-password",
	"/reset-password/:token",
	"/revoke-other-sessions",
	"/revoke-session",
	"/revoke-sessions",
	"/send-verification-email",
	"/sign-in/email-otp",
	"/sign-in/social",
	"/two-factor/disable",
	"/two-factor/enable",
	"/two-factor/generate-backup-codes",
	"/two-factor/get-totp-uri",
	"/two-factor/verify-backup-code",
	"/two-factor/verify-totp",
	"/unlink-account",
	"/update-session",
	"/update-user",
	"/verify-email",
	"/verify-password",
];

/**
 * Resend limit per mailbox, independent of the caller's IP (many satker share
 * one office NAT, so per-IP limits alone are either too strict or too loose).
 */
async function consumeOtpEmailQuota(db: DbClient, email: string) {
	const now = Date.now();
	const cutoff = now - OTP_EMAIL_WINDOW_MS;
	const key = `otp-email:${createHash("sha256").update(email.toLowerCase()).digest("hex")}`;
	const result = await db.execute(sql`
		INSERT INTO auth_rate_limits (key, count, last_request)
		VALUES (${key}, 1, ${now})
		ON CONFLICT (key) DO UPDATE SET
			count = CASE WHEN auth_rate_limits.last_request < ${cutoff} THEN 1 ELSE auth_rate_limits.count + 1 END,
			last_request = CASE WHEN auth_rate_limits.last_request < ${cutoff} THEN ${now} ELSE auth_rate_limits.last_request END
		RETURNING count
	`);
	if (Number(result.rows[0]?.count ?? 0) > OTP_EMAIL_MAX_SENDS) {
		throw new APIError("TOO_MANY_REQUESTS", {
			code: "OTP_SEND_LIMIT",
			message: "Terlalu banyak permintaan kode. Coba lagi beberapa saat lagi.",
		});
	}
}

/**
 * Signs the user out everywhere and forgets every trusted device. Trusted
 * devices live in auth_verifications as `trust-device-*` rows whose value is
 * the user id; pending second-step challenges use the same value.
 */
export async function revokeSessionsAndTrustedDevices(
	db: DbClient,
	userId: string,
) {
	await db.delete(authSessions).where(eq(authSessions.userId, userId));
	await db.delete(authVerifications).where(eq(authVerifications.value, userId));
}

function createAuth(db: DbClient) {
	const sendOtp = async (email: string, otp: string, purpose: OtpPurpose) => {
		await consumeOtpEmailQuota(db, email);
		await sendOtpEmail(email, otp, purpose);
	};

	return betterAuth({
		baseURL: process.env.APP_URL || "http://localhost:3000",
		secret: process.env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, {
			provider: "pg",
			schema: {
				user: users,
				session: authSessions,
				account: authAccounts,
				verification: authVerifications,
				twoFactor: authTwoFactors,
				rateLimit: authRateLimits,
			},
		}),
		disabledPaths,
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			minPasswordLength: MIN_PASSWORD_LENGTH,
			revokeSessionsOnPasswordReset: true,
			onPasswordReset: async ({ user }) => {
				await revokeSessionsAndTrustedDevices(db, user.id);
			},
		},
		emailVerification: {
			sendOnSignUp: true,
			sendOnSignIn: true,
			autoSignInAfterVerification: true,
		},
		databaseHooks: {
			user: {
				create: {
					// The plugin default is false; the OTP step on unknown devices is
					// mandatory for every account.
					before: async (user) => ({
						data: { ...user, twoFactorEnabled: true },
					}),
				},
			},
		},
		rateLimit: {
			enabled: true,
			storage: "database",
			window: 60,
			max: 100,
			// ponytail: per-IP limits are sized for one office NAT shared by many
			// users; brute force is bounded by OTP attempts and the per-mailbox
			// quota above. Tighten here if abuse shows up in logs.
			customRules: {
				"/sign-in/email": { window: 60, max: 30 },
				"/sign-up/email": { window: 60, max: 10 },
				"/two-factor/*": { window: 60, max: 30 },
			},
		},
		advanced: {
			database: { generateId: "uuid" },
			ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
		},
		plugins: [
			emailOTP({
				otpLength: 6,
				expiresIn: OTP_VALID_MINUTES * 60,
				allowedAttempts: OTP_ALLOWED_ATTEMPTS,
				storeOTP: "hashed",
				overrideDefaultEmailVerification: true,
				rateLimit: { window: 60, max: 20 },
				sendVerificationOTP: async ({ email, otp, type }) => {
					if (type === "email-verification" || type === "forget-password") {
						await sendOtp(email, otp, type);
					}
				},
			}),
			twoFactor({
				totpOptions: { disable: true },
				trustDeviceMaxAge: TRUST_DEVICE_MAX_AGE_SECONDS,
				otpOptions: {
					digits: 6,
					period: OTP_VALID_MINUTES,
					allowedAttempts: OTP_ALLOWED_ATTEMPTS,
					storeOTP: "hashed",
					sendOTP: async ({ user, otp }) => {
						await sendOtp(user.email, otp, "new-device");
					},
				},
			}),
			tanstackStartCookies(), // must stay last
		],
	});
}

let instance: ReturnType<typeof createAuth> | null = null;

/** Lazily built so importing this module never needs a database connection. */
export function getAuth() {
	if (!instance) {
		const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
		if (!dbUrl) throw new Error("DATABASE_URL is required for authentication");
		instance = createAuth(createDbClient(dbUrl));
	}
	return instance;
}
