import { createHash } from "node:crypto";
import { createDbClient, type DbClient } from "@simulator-ikpa/db";
import {
	accessRequests,
	auditLogs,
	authAccounts,
	authRateLimits,
	authSessions,
	authTwoFactors,
	authVerifications,
	organizations,
	scoreSnapshots,
	simulations,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { and, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import {
	OTP_VALID_MINUTES,
	type OtpPurpose,
	sendOtpEmail,
} from "./auth-emails.server";
import {
	hasLetterAndDigit,
	MIN_PASSWORD_LENGTH,
	KODE_SATKER_PATTERN,
	KODE_SATKER_RULE,
	maskEmailHint,
} from "./auth-session";

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

/**
 * Owner decision 2026-11-24: a satker code or name that already has a visible
 * Operator is refused on both doors (sign-up and the access-pending form),
 * naming the satker and the Operator's masked email. Same "visible Operator"
 * rule as findVisibleOperatorForOrganization. Since the same day a satker
 * someone else already requested (pending) is refused too; `exceptUserId`
 * lets a requester refile their own request. Returns null when the satker is
 * free.
 */
export async function findSatkerTakenMessage(
	db: DbClient,
	kodeInput: string,
	namaInput: string,
	exceptUserId?: string,
): Promise<{ code: "SATKER_ALREADY_HAS_OPERATOR" | "SATKER_REQUEST_PENDING"; message: string } | null> {
	const kode = kodeInput.trim().toUpperCase();
	const nama = namaInput.trim().toLowerCase();
	if (!kode && !nama) return null;
	const [taken] = await db
		.select({
			kode: organizations.kodeSatker,
			name: organizations.name,
			email: sql<string | null>`coalesce(${users.email}, ${userAccesses.invitedEmail})`,
		})
		.from(organizations)
		.innerJoin(userAccesses, eq(userAccesses.orgId, organizations.id))
		.leftJoin(users, eq(users.id, userAccesses.userId))
		.where(
			and(
				or(
					eq(organizations.kodeSatker, kode),
					sql`lower(trim(${organizations.name})) = ${nama}`,
				),
				eq(userAccesses.accessType, "operator_satker"),
				eq(userAccesses.active, true),
				or(
					and(eq(userAccesses.status, "active"), isNotNull(userAccesses.userId)),
					and(eq(userAccesses.status, "pending"), isNull(userAccesses.userId)),
				),
			),
		)
		.limit(1);
	if (taken?.email) {
		return {
			code: "SATKER_ALREADY_HAS_OPERATOR",
			message: `Satker ${taken.kode} – ${taken.name} sudah memiliki akun dengan email ${maskEmailHint(taken.email)}. Silakan Masuk menggunakan email tersebut. Jika Operator sudah berganti, hubungi Admin KPPN Malang.`,
		};
	}
	const [requested] = await db
		.select({ kode: accessRequests.kodeSatker, name: accessRequests.satkerName, email: users.email })
		.from(accessRequests)
		.innerJoin(users, eq(users.id, accessRequests.userId))
		.where(
			and(
				eq(accessRequests.status, "pending"),
				or(
					eq(accessRequests.kodeSatker, kode),
					sql`lower(trim(${accessRequests.satkerName})) = ${nama}`,
				),
				exceptUserId ? ne(accessRequests.userId, exceptUserId) : undefined,
			),
		)
		.limit(1);
	if (!requested) return null;
	return {
		code: "SATKER_REQUEST_PENDING",
		message: `Satker ${requested.kode} – ${requested.name} sudah diajukan dengan email ${maskEmailHint(requested.email)} dan sedang menunggu persetujuan Admin KPPN Malang. Jika pengajuan itu bukan milik Anda, hubungi Admin KPPN Malang.`,
	};
}

/**
 * Owner decision 2026-11-24: an account the Admin cannot see (no active
 * access, no pending request) gives its email back for a new sign-up. An
 * account with no history (no audit entry, simulation, or snapshot, e.g. a
 * sign-up whose OTP never arrived) is deleted. One with history keeps its row,
 * because deleting it would cascade that history; only the email, password,
 * sessions, and second step go.
 */
async function releaseOrphanEmail(db: DbClient, userId: string) {
	const hasHistory = async () => {
		const [audit] = await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.actorId, userId)).limit(1);
		if (audit) return true;
		const [simulation] = await db.select({ id: simulations.id }).from(simulations).where(eq(simulations.createdBy, userId)).limit(1);
		if (simulation) return true;
		const [snapshot] = await db.select({ id: scoreSnapshots.id }).from(scoreSnapshots).where(eq(scoreSnapshots.createdBy, userId)).limit(1);
		return Boolean(snapshot);
	};
	await revokeSessionsAndTrustedDevices(db, userId);
	if (!(await hasHistory())) {
		// Cascades its auth rows and any rejected request.
		await db.delete(users).where(eq(users.id, userId));
		return;
	}
	await db.delete(authAccounts).where(eq(authAccounts.userId, userId));
	await db.delete(authTwoFactors).where(eq(authTwoFactors.userId, userId));
	await db
		.update(users)
		.set({ email: `released-${userId}@released.invalid`, emailVerified: false, updatedAt: new Date() })
		.where(eq(users.id, userId));
}

/**
 * Sign-up stops before any account or code is made, in this order, when the
 * email has an active access or a pending invitation, the email has a pending
 * request, the satker already has an Operator or a pending request, or the
 * code is not 6 digits.
 * Any other existing account with that email is an orphan and is released
 * last, so a refused sign-up never releases anything.
 */
async function assertSignUpAvailable(
	db: DbClient,
	body: Record<string, unknown> | undefined,
) {
	const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
	const email = text(body?.email).toLowerCase();
	const [registered] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, email))
		.limit(1);
	const [access] = registered
		? await db
				.select({ id: userAccesses.id })
				.from(userAccesses)
				.where(
					and(
						eq(userAccesses.userId, registered.id),
						eq(userAccesses.active, true),
						eq(userAccesses.status, "active"),
					),
				)
				.limit(1)
		: [];
	const [pendingRequest] = registered
		? await db
				.select({ id: accessRequests.id })
				.from(accessRequests)
				.where(and(eq(accessRequests.userId, registered.id), eq(accessRequests.status, "pending")))
				.limit(1)
		: [];
	const [invited] = await db
		.select({ id: userAccesses.id })
		.from(userAccesses)
		.where(
			and(
				eq(userAccesses.invitedEmail, email),
				eq(userAccesses.status, "pending"),
				eq(userAccesses.active, true),
			),
		)
		.limit(1);
	if (access || invited) {
		throw new APIError("BAD_REQUEST", {
			code: "EMAIL_ALREADY_REGISTERED",
			message: "Email sudah terdaftar.",
		});
	}
	if (pendingRequest) {
		throw new APIError("BAD_REQUEST", {
			code: "EMAIL_REQUEST_PENDING",
			message: "Email ini sedang menunggu persetujuan Admin KPPN. Silakan Masuk untuk melihat status permintaan.",
		});
	}
	const taken = await findSatkerTakenMessage(db, text(body?.kodeSatker), text(body?.namaSatker));
	if (taken) {
		throw new APIError("BAD_REQUEST", taken);
	}
	// The forms check this too; this guards direct API calls (owner 2026-11-24).
	if (!KODE_SATKER_PATTERN.test(text(body?.kodeSatker))) {
		throw new APIError("BAD_REQUEST", { code: "KODE_SATKER_INVALID", message: KODE_SATKER_RULE });
	}
	if (registered) await releaseOrphanEmail(db, registered.id);
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
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				// Owner decision 2026-11-23: sign-in and password reset say plainly
				// when an email has no account (sign-up already reveals that), and
				// point invited/seeded accounts without a password to the reset.
				if (
					ctx.path === "/sign-in/email" ||
					ctx.path === "/email-otp/request-password-reset"
				) {
					const email = ctx.body?.email;
					if (typeof email !== "string") return;
					const found = await ctx.context.internalAdapter.findUserByEmail(
						email.trim().toLowerCase(),
						{ includeAccounts: true },
					);
					if (!found) {
						throw new APIError("BAD_REQUEST", {
							code: "EMAIL_NOT_REGISTERED",
							message: "Email belum terdaftar.",
						});
					}
					const hasPassword = found.accounts.some(
						(account) => account.providerId === "credential",
					);
					if (ctx.path === "/sign-in/email" && !hasPassword) {
						throw new APIError("BAD_REQUEST", {
							code: "PASSWORD_NOT_SET",
							message: "Akun belum memiliki kata sandi.",
						});
					}
					return;
				}

				// Every path that sets a new password; sign-in keeps accepting older ones.
				if (
					ctx.path !== "/sign-up/email" &&
					ctx.path !== "/email-otp/reset-password"
				) {
					return;
				}
				if (ctx.path === "/sign-up/email") {
					await assertSignUpAvailable(db, ctx.body);
				}
				const password = ctx.body?.password;
				if (typeof password === "string" && !hasLetterAndDigit(password)) {
					throw new APIError("BAD_REQUEST", {
						code: "PASSWORD_NEEDS_LETTER_AND_DIGIT",
						message: "Kata sandi harus berisi huruf dan angka.",
					});
				}
			}),
		},
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
