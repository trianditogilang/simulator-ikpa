import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, isNull, isNotNull, ne, or, sql } from "drizzle-orm";
import {
	assertAdminKppnScope,
	createPendingAccess,
	ForbiddenError,
	grantAdminAccess,
	grantOperatorAccess,
	hardDeleteUser,
} from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import {
	kppnScopes,
	organizations,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { revokeSessionsAndTrustedDevices } from "./auth.server";
import { sendInvitationEmail } from "./auth-emails.server";
import { getServerAuthSession } from "./auth-session.server";
import { failIfProduction } from "./runtime-guards";

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		failIfProduction(true, "Production database is not configured for admin access.");
		return null;
	}
	return createDbClient(dbUrl);
}

type AdminDb = ReturnType<typeof createDbClient>;

async function findOtherVisibleOperator(
	db: AdminDb,
	orgId: string,
	targetAccessId?: string | null,
	targetUserId?: string | null,
) {
	const conditions = [
		eq(userAccesses.orgId, orgId),
		eq(userAccesses.accessType, "operator_satker"),
		eq(userAccesses.active, true),
	];
	const visibleStatus = or(
		and(eq(userAccesses.status, "active"), isNotNull(userAccesses.userId)),
		and(eq(userAccesses.status, "pending"), isNull(userAccesses.userId)),
	);
	if (visibleStatus) conditions.push(visibleStatus);
	if (targetAccessId) {
		conditions.push(ne(userAccesses.id, targetAccessId));
	} else if (targetUserId) {
		// Keep pending rows (their user_id is NULL) in the duplicate check.
		const otherUser = or(
			isNull(userAccesses.userId),
			ne(userAccesses.userId, targetUserId),
		);
		if (otherUser) conditions.push(otherUser);
	}
	const [otherOperator] = await db
		.select({ id: userAccesses.id })
		.from(userAccesses)
		.where(and(...conditions))
		.limit(1);
	return otherOperator;
}

/**
 * Remove an organization that no longer has an access mapping, but never
 * cascade-delete operational data that still belongs to it.
 */
async function cleanupOrphanOrganization(
	db: AdminDb,
	orgId: string | null | undefined,
) {
	if (!orgId) return;

	try {
		await db.delete(organizations).where(
			and(
				eq(organizations.id, orgId),
				sql`not exists (
					select 1 from user_accesses where org_id = ${orgId}
				)`,
				sql`not exists (
					select 1 from fiscal_years where org_id = ${orgId}
					union all select 1 from import_jobs where org_id = ${orgId}
					union all select 1 from assessment_exclusion_proposals where organization_id = ${orgId}
					union all select 1 from output_target_plans where organization_id = ${orgId}
					union all select 1 from ro_budget_realizations where organization_id = ${orgId}
					union all select 1 from output_reports where organization_id = ${orgId}
					union all select 1 from org_reminder_configs where org_id = ${orgId}
					union all select 1 from notification_deliveries where org_id = ${orgId}
				)`,
			),
		);
	} catch (error) {
		// Cleanup must not turn a completed access change into a false failure.
		console.warn("Orphan organization cleanup skipped:", error);
	}
}

async function hardDeleteUserAndCleanup(
	db: AdminDb,
	input: { actorUserId: string; targetUserId: string },
) {
	const rows = await db
		.select({ orgId: userAccesses.orgId })
		.from(userAccesses)
		.where(eq(userAccesses.userId, input.targetUserId));
	await hardDeleteUser(db, input);
	for (const orgId of new Set(rows.map((row) => row.orgId).filter(Boolean))) {
		await cleanupOrphanOrganization(db, orgId);
	}
}

async function assertTargetUserInAdminScope(
	db: AdminDb,
	targetUserId: string,
	allowedKppnScopeIds: string[],
) {
	const rows = await db
		.select({
			kppnScopeId: userAccesses.kppnScopeId,
			orgScopeId: organizations.kppnScopeId,
		})
		.from(userAccesses)
		.leftJoin(organizations, eq(userAccesses.orgId, organizations.id))
		.where(eq(userAccesses.userId, targetUserId));

	if (!rows.length) throw new Error("Data pemetaan akses tidak ditemukan.");
	if (
		rows.some((row) => {
			const scopeId = row.orgScopeId ?? row.kppnScopeId;
			return !scopeId || !allowedKppnScopeIds.includes(scopeId);
		})
	) {
		throw new Error("Pemetaan akses berada di luar scope admin.");
	}
}

export const listAdminUserAccessFn = createServerFn({ method: "GET" })
	.validator(() => undefined)
	.handler(async () => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		const { allowedKppnScopeIds } = assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return { accesses: [] };
		}

		// Active accesses (linked to user)
		const activeRows = await db
			.select({
				id: userAccesses.id,
				userId: userAccesses.userId,
				userName: users.name,
				userEmail: users.email,
				accessType: userAccesses.accessType,
				status: userAccesses.status,
				orgId: userAccesses.orgId,
				orgName: organizations.name,
				kodeSatker: organizations.kodeSatker,
				adminSlot: userAccesses.adminSlot,
				active: userAccesses.active,
				createdAt: userAccesses.createdAt,
			})
			.from(userAccesses)
			.innerJoin(users, eq(userAccesses.userId, users.id))
			.leftJoin(organizations, eq(userAccesses.orgId, organizations.id))
			.where(
				and(
					eq(userAccesses.active, true),
					eq(userAccesses.status, "active"),
					or(
						inArray(userAccesses.kppnScopeId, allowedKppnScopeIds),
						inArray(organizations.kppnScopeId, allowedKppnScopeIds),
					),
				),
			)
			.orderBy(desc(userAccesses.createdAt));

		// Pending invitations (no user linked yet)
		const pendingRows = await db
			.select({
				id: userAccesses.id,
				userId: userAccesses.userId,
				invitedEmail: userAccesses.invitedEmail,
				accessType: userAccesses.accessType,
				status: userAccesses.status,
				orgId: userAccesses.orgId,
				orgName: organizations.name,
				kodeSatker: organizations.kodeSatker,
				adminSlot: userAccesses.adminSlot,
				active: userAccesses.active,
				createdAt: userAccesses.createdAt,
				userName: users.name,
			})
			.from(userAccesses)
			.leftJoin(organizations, eq(userAccesses.orgId, organizations.id))
			.leftJoin(users, eq(userAccesses.invitedEmail, users.email))
			.where(
				and(
					eq(userAccesses.active, true),
					eq(userAccesses.status, "pending"),
					isNull(userAccesses.userId),
					or(
						inArray(userAccesses.kppnScopeId, allowedKppnScopeIds),
						inArray(organizations.kppnScopeId, allowedKppnScopeIds),
					),
				),
			)
			.orderBy(desc(userAccesses.createdAt));

		const accesses = [
			...activeRows.map((r) => ({
				id: r.id,
				userId: r.userId,
				name: r.userName,
				email: r.userEmail,
				accessType: r.accessType,
				accessStatus: r.status,
				orgId: r.orgId,
				scopeName: r.orgName ?? "KPPN Malang",
				scopeCode: r.kodeSatker ?? "032",
				adminSlot: r.adminSlot ?? null,
				status: r.active ? ("active" as const) : ("inactive" as const),
				createdAt: r.createdAt.toISOString(),
			})),
			...pendingRows.map((r) => ({
				id: r.id,
				userId: null,
				name: r.userName ?? (r.adminSlot ? `Admin ${r.adminSlot}` : null),
				email: r.invitedEmail,
				accessType: r.accessType,
				accessStatus: "pending" as const,
				orgId: r.orgId,
				scopeName: r.orgName ?? "KPPN Malang",
				scopeCode: r.kodeSatker ?? "032",
				adminSlot: r.adminSlot ?? null,
				status: "pending" as const,
				createdAt: r.createdAt.toISOString(),
			})),
		];

		const seen = new Set<string>();
		const uniqueAccesses = accesses.filter((row) => {
			const userIdentity = row.email?.trim().toLowerCase() || row.userId || row.id;
			const identity = `${userIdentity}:${row.accessType}:${row.orgId ?? row.scopeCode}`;
			if (seen.has(identity)) return false;
			seen.add(identity);
			return true;
		});

		return { accesses: uniqueAccesses };
	});

export const getCurrentAdminProfileFn = createServerFn({ method: "GET" })
	.validator(() => undefined)
	.handler(async () => {
		const auth = await getServerAuthSession();
		if (!auth.userId) return null;
		const db = getDatabase();
		if (!db) return null;
		const [user] = await db
			.select({ name: users.name, email: users.email })
			.from(users)
			.where(eq(users.id, auth.userId))
			.limit(1);
		return user ?? null;
	});

export const assignUserAccessFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			email: string;
			name: string;
			accessType: "operator_satker" | "admin_kppn";
			kodeSatker?: string | null;
			satkerName?: string | null;
			orgId?: string | null;
			targetUserId?: string | null;
			targetAccessId?: string | null;
			emailConfirmed?: boolean;
		}) => data,
	)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		const { allowedKppnScopeIds } = assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

		const actorUserId = access.status === "admin" ? access.userId : "admin";
		if (data.targetAccessId && !data.targetUserId) {
			throw new Error("Target pemetaan akses harus memiliki user.");
		}

		let targetAccessForEdit: typeof userAccesses.$inferSelect | null = null;
		if (data.targetUserId) {
			const targetAccessWhere = data.targetAccessId
				? and(
					eq(userAccesses.id, data.targetAccessId),
					eq(userAccesses.userId, data.targetUserId),
				)
				: eq(userAccesses.userId, data.targetUserId);
			const [targetAccess] = await db
				.select()
				.from(userAccesses)
				.where(
					and(
						targetAccessWhere,
						eq(userAccesses.active, true),
						eq(userAccesses.status, "active"),
					),
				)
				.limit(1);
			if (data.targetAccessId && !targetAccess) {
				throw new Error("Data pemetaan akses tidak ditemukan.");
			}
			targetAccessForEdit = targetAccess ?? null;

			const [conflictingAccess] = await db
				.select({ id: userAccesses.id })
				.from(userAccesses)
				.where(
					and(
						eq(userAccesses.userId, data.targetUserId),
						eq(userAccesses.active, true),
						eq(userAccesses.status, "active"),
						ne(userAccesses.accessType, data.accessType),
					),
				)
				.limit(1);
			if (conflictingAccess) {
				throw Object.assign(
					new Error("Jenis akses pengguna tidak dapat diubah setelah terdaftar."),
					{ statusCode: 409, code: "ACCESS_TYPE_CONFLICT" },
				);
			}
		}

		let operatorOrgId: string | null = null;
		if (data.accessType === "operator_satker") {
			const rawKode = (data.kodeSatker ?? data.orgId ?? "").trim();
			const rawName = (data.satkerName ?? "").trim();
			if (!rawKode) {
				throw Object.assign(new Error("Kode satker wajib diisi untuk peran Operator Satker."), { statusCode: 400, code: "KODE_SATKER_REQUIRED" });
			}
			if (!rawName) {
				throw Object.assign(new Error("Nama satker wajib diisi untuk kode satker baru."), { statusCode: 400, code: "SATKER_NAME_REQUIRED" });
			}
			const normalizedKode = rawKode.toUpperCase();
			const normalizedName = rawName;

			if (data.targetUserId) {
				const [currentAccess] = targetAccessForEdit?.accessType === "operator_satker"
					? [targetAccessForEdit]
					: await db
						.select({ id: userAccesses.id, orgId: userAccesses.orgId })
						.from(userAccesses)
						.where(
							and(
								eq(userAccesses.userId, data.targetUserId),
								eq(userAccesses.accessType, "operator_satker"),
								eq(userAccesses.active, true),
								eq(userAccesses.status, "active"),
							),
						)
						.limit(1);
				if (currentAccess?.orgId) {
					const [currentOrg] = await db
						.select({ id: organizations.id, kodeSatker: organizations.kodeSatker, name: organizations.name, kppnScopeId: organizations.kppnScopeId })
					.from(organizations)
					.where(eq(organizations.id, currentAccess.orgId))
						.limit(1);
					if (currentOrg) {
						if (!allowedKppnScopeIds.includes(currentOrg.kppnScopeId)) {
							throw new ForbiddenError("Satker berada di luar wewenang admin.");
						}
						if (
							await findOtherVisibleOperator(
								db,
								currentOrg.id,
								data.targetAccessId,
								data.targetUserId,
							)
						) {
							throw Object.assign(new Error("Satker sudah memiliki operator aktif."), { statusCode: 409, code: "SATKER_OPERATOR_EXISTS" });
						}
						const kodeChanged = normalizedKode !== currentOrg.kodeSatker;
						const nameChanged = normalizedName.trim() !== currentOrg.name.trim();
						if (!kodeChanged && nameChanged) {
							await db.update(organizations).set({ name: normalizedName, updatedAt: new Date() }).where(eq(organizations.id, currentOrg.id));
							operatorOrgId = currentOrg.id;
						} else if (kodeChanged) {
							const [targetOrg] = await db
								.select({ id: organizations.id, name: organizations.name, kppnScopeId: organizations.kppnScopeId })
								.from(organizations)
								.where(eq(organizations.kodeSatker, normalizedKode))
								.limit(1);
							if (!targetOrg) {
								await db.update(organizations).set({ kodeSatker: normalizedKode, name: normalizedName, updatedAt: new Date() }).where(eq(organizations.id, currentOrg.id));
								operatorOrgId = currentOrg.id;
							} else if (targetOrg.name.trim().toLowerCase() === normalizedName.toLowerCase()) {
								if (!allowedKppnScopeIds.includes(targetOrg.kppnScopeId)) {
									throw new ForbiddenError("Satker berada di luar wewenang admin.");
								}
								if (await findOtherVisibleOperator(db, targetOrg.id, data.targetAccessId, data.targetUserId)) {
									throw Object.assign(new Error("Satker sudah memiliki operator aktif."), { statusCode: 409, code: "SATKER_OPERATOR_EXISTS" });
								}
								operatorOrgId = targetOrg.id;
							} else {
								if (!allowedKppnScopeIds.includes(targetOrg.kppnScopeId)) {
									throw new ForbiddenError("Satker berada di luar wewenang admin.");
								}
								if (await findOtherVisibleOperator(db, targetOrg.id, data.targetAccessId, data.targetUserId)) {
									throw Object.assign(new Error("Kode satker sudah terdaftar dengan nama berbeda."), { statusCode: 409, code: "ORGANIZATION_NAME_MISMATCH" });
								}
								// The row is an orphan/inactive organization, so it can be
								// reused without retaining the deleted user's satker name.
								await db
									.update(organizations)
									.set({ name: normalizedName, updatedAt: new Date() })
									.where(eq(organizations.id, targetOrg.id));
								operatorOrgId = targetOrg.id;
							}
						} else {
							operatorOrgId = currentOrg.id;
						}
					}
				}
			}

			if (!operatorOrgId) {
				const [targetOrganization] = await db
					.select({ id: organizations.id, kppnScopeId: organizations.kppnScopeId, name: organizations.name, kodeSatker: organizations.kodeSatker })
					.from(organizations)
					.where(eq(organizations.kodeSatker, normalizedKode))
					.limit(1);
				if (targetOrganization) {
					if (!allowedKppnScopeIds.includes(targetOrganization.kppnScopeId)) {
						throw new ForbiddenError("Satker berada di luar wewenang admin.");
					}
					if (targetOrganization.name.trim().toLowerCase() !== normalizedName.toLowerCase()) {
						if (await findOtherVisibleOperator(db, targetOrganization.id)) {
							throw Object.assign(new Error("Kode satker sudah terdaftar dengan nama berbeda."), { statusCode: 409, code: "ORGANIZATION_NAME_MISMATCH" });
						}
						await db
							.update(organizations)
							.set({ name: normalizedName, updatedAt: new Date() })
							.where(eq(organizations.id, targetOrganization.id));
					}
					operatorOrgId = targetOrganization.id;
				} else {
					const kppnScopeId = allowedKppnScopeIds[0];
					if (!kppnScopeId) throw new Error("Scope KPPN tidak valid.");
					const [kppnScope] = await db.select({ name: kppnScopes.name }).from(kppnScopes).where(eq(kppnScopes.id, kppnScopeId)).limit(1);
					const [createdOrg] = await db
						.insert(organizations)
						.values({
							kodeSatker: normalizedKode,
							name: normalizedName,
							kppnScopeId,
							kppnName: kppnScope?.name ?? "KPPN Malang",
							isBlu: false,
							timezone: "Asia/Jakarta",
						})
						.returning({ id: organizations.id });
					operatorOrgId = createdOrg.id;
				}
			}
		}

		let user: typeof users.$inferSelect | null = null;
		if (data.targetUserId) {
			const [byId] = await db.select().from(users).where(eq(users.id, data.targetUserId)).limit(1);
			if (!byId) throw new Error("User target tidak ditemukan.");
			const newEmail = data.email.toLowerCase().trim();
			const newName = data.name.trim() || byId.name;
			const needEmail = newEmail !== byId.email;
			const needName = newName !== byId.name;
			if (needEmail && !data.emailConfirmed) {
				throw Object.assign(new Error("Konfirmasi perubahan email diperlukan."), { statusCode: 400, code: "EMAIL_CONFIRM_REQUIRED" });
			}
			if (needEmail) {
				const [exists] = await db.select().from(users).where(eq(users.email, newEmail)).limit(1);
				if (exists && exists.id !== byId.id) throw Object.assign(new Error("Email sudah digunakan."), { statusCode: 409, code: "EMAIL_ALREADY_EXISTS" });
				const [pendingEmail] = await db
					.select({ id: userAccesses.id })
					.from(userAccesses)
					.where(
						and(
							eq(userAccesses.invitedEmail, newEmail),
							eq(userAccesses.status, "pending"),
						),
					)
					.limit(1);
				if (pendingEmail) throw Object.assign(new Error("Email sudah digunakan."), { statusCode: 409, code: "EMAIL_ALREADY_EXISTS" });
			}
			if (needEmail || needName) {
				const [updated] = await db
					.update(users)
					.set({ email: newEmail, name: newName, updatedAt: new Date() })
					.where(eq(users.id, byId.id))
					.returning();
				if (updated) {
					user = updated;
				} else user = byId;
				// A changed sign-in email ends every session and forgets trusted
				// devices, so the next sign-in proves the new mailbox by OTP.
				if (needEmail) await revokeSessionsAndTrustedDevices(db, byId.id);
			} else user = byId;
		} else {
			// New user: check if already exists by email
			const [byEmail] = await db
				.select()
				.from(users)
				.where(eq(users.email, data.email.toLowerCase().trim()))
				.limit(1);
			if (byEmail) {
				user = byEmail;
				if (user.name.trim() !== data.name.trim() && data.name.trim()) {
					const [updated] = await db.update(users).set({ name: data.name.trim(), updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
					if (updated) {
						user = updated;
					}
				}
			}
			// If user doesn't exist yet, create pending access + send the invitation email
			if (!user) {
				const normalizedEmail = data.email.toLowerCase().trim();

				// Determine org/scope for pending access
				let pendingOrgId: string | null = null;
				let pendingKppnScopeId: string | null = null;
				if (data.accessType === "operator_satker") {
					pendingOrgId = operatorOrgId;
				} else {
					pendingKppnScopeId = allowedKppnScopeIds[0] ?? null;
				}

				const pendingAccess = await createPendingAccess(db, {
					actorUserId,
					email: normalizedEmail,
					accessType: data.accessType,
					orgId: pendingOrgId,
					kppnScopeId: pendingKppnScopeId,
				});

				// The pending access is the invitation; the email only tells the
				// invitee to register. Access is claimed once their email is verified.
				try {
					await sendInvitationEmail(normalizedEmail, data.accessType);
				} catch {
					throw Object.assign(new Error("Email undangan gagal dikirim."), {
						statusCode: 502,
						code: "INVITATION_EMAIL_FAILED",
					});
				}

				return { success: true, accessId: pendingAccess.id, pending: true };
			}
		}
		if (!user) throw new Error("Gagal memproses user.");

		if (data.accessType === "operator_satker") {
			if (!operatorOrgId) throw new Error("Satker naungan wajib dipilih untuk peran Operator Satker.");
			if (targetAccessForEdit?.accessType === "operator_satker") {
				if (await findOtherVisibleOperator(db, operatorOrgId, data.targetAccessId, data.targetUserId)) {
					throw Object.assign(new Error("Satker sudah memiliki operator aktif."), { statusCode: 409, code: "SATKER_OPERATOR_EXISTS" });
				}
				if (targetAccessForEdit.orgId !== operatorOrgId) {
					await db
						.update(userAccesses)
						.set({ orgId: operatorOrgId, updatedAt: new Date() })
						.where(eq(userAccesses.id, targetAccessForEdit.id));
					await cleanupOrphanOrganization(db, targetAccessForEdit.orgId);
				}
				return { success: true, accessId: targetAccessForEdit.id };
			}
			const [existingMapping] = await db.select({ id: userAccesses.id }).from(userAccesses).where(and(eq(userAccesses.userId, user.id), eq(userAccesses.orgId, operatorOrgId), eq(userAccesses.accessType, "operator_satker"), eq(userAccesses.status, "active"), eq(userAccesses.active, true))).limit(1);
			if (existingMapping) {
				return { success: true, accessId: existingMapping.id };
			}
			const created = await grantOperatorAccess(db, {
				actorUserId,
				targetUserId: user.id,
				orgId: operatorOrgId,
			});
			return { success: true, accessId: created.id };
		} else {
			if (targetAccessForEdit?.accessType === "admin_kppn") {
				if (
					!targetAccessForEdit.kppnScopeId ||
					!allowedKppnScopeIds.includes(targetAccessForEdit.kppnScopeId)
				) {
					throw new Error("Pemetaan akses berada di luar scope admin.");
				}
				return { success: true, accessId: targetAccessForEdit.id };
			}
			const kppnScopeId = allowedKppnScopeIds[0];
			if (!kppnScopeId) throw new Error("Scope KPPN tidak valid.");
			const [existingMapping] = await db.select({ id: userAccesses.id }).from(userAccesses).where(and(eq(userAccesses.userId, user.id), eq(userAccesses.kppnScopeId, kppnScopeId), eq(userAccesses.accessType, "admin_kppn"), eq(userAccesses.status, "active"), eq(userAccesses.active, true))).limit(1);
			if (existingMapping) {
				return { success: true, accessId: existingMapping.id };
			}
			const created = await grantAdminAccess(db, {
				actorUserId,
				targetUserId: user.id,
				kppnScopeId,
			});
			return { success: true, accessId: created.id };
		}
	});

export const hardDeleteUserFn = createServerFn({ method: "POST" })
	.validator((data: { userId: string }) => data as { userId: string })
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		const { allowedKppnScopeIds } = assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) return { success: true };

		const actorUserId = access.status === "admin" ? access.userId : "admin";
		await assertTargetUserInAdminScope(db, data.userId, allowedKppnScopeIds);
		await hardDeleteUserAndCleanup(db, { actorUserId, targetUserId: data.userId });
		return { success: true };
	});

export const removeUserAccessFn = createServerFn({ method: "POST" })
	.validator((data: { accessId?: string; userId?: string }) => data as { accessId?: string; userId?: string })
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		const { allowedKppnScopeIds } = assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) return { success: true };

		const actorUserId = access.status === "admin" ? access.userId : "admin";
		if (data.userId) {
			await assertTargetUserInAdminScope(db, data.userId, allowedKppnScopeIds);
			await hardDeleteUserAndCleanup(db, { actorUserId, targetUserId: data.userId });
			return { success: true };
		}
		if (data.accessId) {
			const [targetAccess] = await db
				.select({ userId: userAccesses.userId, orgId: userAccesses.orgId, kppnScopeId: userAccesses.kppnScopeId, orgScopeId: organizations.kppnScopeId })
				.from(userAccesses)
				.leftJoin(organizations, eq(userAccesses.orgId, organizations.id))
				.where(eq(userAccesses.id, data.accessId))
				.limit(1);
			if (!targetAccess) throw new Error("Data pemetaan akses tidak ditemukan.");
			const targetScopeId = targetAccess.orgScopeId ?? targetAccess.kppnScopeId;
			if (!targetScopeId || !allowedKppnScopeIds.includes(targetScopeId)) throw new Error("Pemetaan akses berada di luar scope admin.");

			// If access has a user, hard delete the user (cascades to access)
			if (targetAccess.userId) {
				await hardDeleteUserAndCleanup(db, { actorUserId, targetUserId: targetAccess.userId });
			} else {
				// Pending access with no user: delete the access record directly
				await db.delete(userAccesses).where(eq(userAccesses.id, data.accessId));
				await cleanupOrphanOrganization(db, targetAccess.orgId);
			}
			return { success: true };
		}
		throw new Error("Parameter hapus tidak valid.");
	});
