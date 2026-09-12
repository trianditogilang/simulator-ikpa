import type { DbClient } from "@simulator-ikpa/db";
import { auditLogs, userAccesses, users } from "@simulator-ikpa/db/schema";
import { and, count, eq, isNotNull } from "drizzle-orm";

export class LastAdminRevocationError extends Error {
	public readonly statusCode = 400;
	public readonly code = "LAST_ADMIN_PROTECTION";
	constructor(message = "Tidak dapat mencabut atau menonaktifkan Admin KPPN terakhir untuk scope KPPN ini.") {
		super(message);
		this.name = "LastAdminRevocationError";
	}
}

export class AccessConflictError extends Error {
	public readonly statusCode = 400;
	public readonly code = "ACCESS_TYPE_CONFLICT";
	constructor(message = "Satu pengguna tidak boleh memiliki jenis akses Admin KPPN dan Operator Satker secara bersamaan.") {
		super(message);
		this.name = "AccessConflictError";
	}
}

export class OperatorAlreadyExistsError extends Error {
	public readonly statusCode = 400;
	public readonly code = "OPERATOR_ALREADY_EXISTS";
	constructor(message = "Satker ini sudah memiliki operator aktif. Nonaktifkan operator lama terlebih dahulu.") {
		super(message);
		this.name = "OperatorAlreadyExistsError";
	}
}

export class SelfDeleteError extends Error {
	public readonly statusCode = 400;
	public readonly code = "SELF_DELETE_FORBIDDEN";
	constructor(message = "Tidak dapat menghapus akun sendiri.") {
		super(message);
		this.name = "SelfDeleteError";
	}
}

export class EmailLockedError extends Error {
	public readonly statusCode = 400;
	public readonly code = "EMAIL_LOCKED";
	constructor(message = "Email terkunci karena akun sudah terklaim Clerk. Hanya akun manual_* yang dapat diubah emailnya.") {
		super(message);
		this.name = "EmailLockedError";
	}
}

export interface GrantOperatorAccessInput {
	actorUserId: string;
	targetUserId: string;
	orgId: string;
	requestId?: string | null;
}

export interface GrantAdminAccessInput {
	actorUserId: string;
	targetUserId: string;
	kppnScopeId: string;
	requestId?: string | null;
}

export interface RevokeAccessInput {
	actorUserId: string;
	userAccessId: string;
	requestId?: string | null;
}

export interface ToggleAccessInput {
	actorUserId: string;
	userAccessId: string;
	active: boolean;
	requestId?: string | null;
}

export interface HardDeleteUserInput {
	actorUserId: string;
	targetUserId: string;
	requestId?: string | null;
}

export interface UpdateUserProfileInput {
	actorUserId: string;
	targetUserId: string;
	name?: string | null;
	email?: string | null;
	requestId?: string | null;
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

async function runWithFallback<T>(db: DbClient, exec: (tx: DbClient) => Promise<T>): Promise<T> {
	const maybeTx = db as unknown as { transaction?: (fn: (tx: DbClient) => Promise<T>) => Promise<T> };
	if (typeof maybeTx.transaction === "function") {
		try {
			return await maybeTx.transaction((tx) => exec(tx as DbClient));
		} catch (e) {
			const msg = String((e as Error)?.message ?? e);
			if (msg.includes("No transactions support") || msg.includes("transaction")) {
				return await exec(db);
			}
			throw e;
		}
	}
	return await exec(db);
}

async function findSmallestFreeSlot(db: DbClient, kppnScopeId: string): Promise<number> {
	const rows = await db
		.select({ adminSlot: userAccesses.adminSlot })
		.from(userAccesses)
		.where(and(eq(userAccesses.kppnScopeId, kppnScopeId), eq(userAccesses.accessType, "admin_kppn"), eq(userAccesses.active, true), isNotNull(userAccesses.adminSlot)));
	const used = new Set<number>();
	for (const r of rows) if (r.adminSlot !== null && r.adminSlot !== undefined) used.add(r.adminSlot as number);
	let slot = 1;
	while (used.has(slot)) slot++;
	return slot;
}

export async function grantOperatorAccess(db: DbClient, input: GrantOperatorAccessInput) {
	const [activeAdmin] = await db.select().from(userAccesses).where(and(eq(userAccesses.userId, input.targetUserId), eq(userAccesses.accessType, "admin_kppn"), eq(userAccesses.active, true))).limit(1);
	if (activeAdmin) throw new AccessConflictError();
	const [existingOperator] = await db.select().from(userAccesses).where(and(eq(userAccesses.orgId, input.orgId), eq(userAccesses.accessType, "operator_satker"), eq(userAccesses.active, true))).limit(1);
	if (existingOperator) throw new OperatorAlreadyExistsError();
	return await runWithFallback(db, async (tx) => {
		const [created] = await tx.insert(userAccesses).values({ userId: input.targetUserId, accessType: "operator_satker", orgId: input.orgId, active: true, createdBy: input.actorUserId }).returning();
		await tx.insert(auditLogs).values({ actorId: input.actorUserId, actorAccessType: "operator_satker", action: "grant_operator_access", entityType: "user_accesses", entityId: created.id, orgId: input.orgId, beforeJson: null, afterJson: created as unknown as Record<string, unknown>, requestId: input.requestId ?? null });
		return created;
	});
}

export async function grantAdminAccess(db: DbClient, input: GrantAdminAccessInput) {
	const [activeOperator] = await db.select().from(userAccesses).where(and(eq(userAccesses.userId, input.targetUserId), eq(userAccesses.accessType, "operator_satker"), eq(userAccesses.active, true))).limit(1);
	if (activeOperator) throw new AccessConflictError();
	return await runWithFallback(db, async (tx) => {
		const slot = await findSmallestFreeSlot(tx, input.kppnScopeId);
		const [created] = await tx.insert(userAccesses).values({ userId: input.targetUserId, accessType: "admin_kppn", kppnScopeId: input.kppnScopeId, adminSlot: slot, active: true, createdBy: input.actorUserId }).returning();
		await tx.insert(auditLogs).values({ actorId: input.actorUserId, actorAccessType: "admin_kppn", action: "grant_admin_access", entityType: "user_accesses", entityId: created.id, orgId: null, beforeJson: null, afterJson: created as unknown as Record<string, unknown>, requestId: input.requestId ?? null });
		return created;
	});
}

export async function revokeAccess(db: DbClient, input: RevokeAccessInput) {
	const [targetAccess] = await db.select().from(userAccesses).where(eq(userAccesses.id, input.userAccessId)).limit(1);
	if (!targetAccess) throw new Error("Data pemetaan akses tidak ditemukan.");
	if (targetAccess.accessType === "admin_kppn" && targetAccess.kppnScopeId && targetAccess.active) {
		const [activeAdminCountRes] = await db.select({ total: count() }).from(userAccesses).where(and(eq(userAccesses.accessType, "admin_kppn"), eq(userAccesses.kppnScopeId, targetAccess.kppnScopeId), eq(userAccesses.active, true)));
		if (Number(activeAdminCountRes?.total ?? 0) <= 1) throw new LastAdminRevocationError();
	}
	const [deleted] = await db.delete(userAccesses).where(eq(userAccesses.id, input.userAccessId)).returning();
	await db.insert(auditLogs).values({ actorId: input.actorUserId, actorAccessType: targetAccess.accessType, action: "revoke_access", entityType: "user_accesses", entityId: input.userAccessId, orgId: targetAccess.orgId ?? null, beforeJson: targetAccess as unknown as Record<string, unknown>, afterJson: null, requestId: input.requestId ?? null });
	return deleted;
}

export async function toggleAccessActive(db: DbClient, input: ToggleAccessInput) {
	const [targetAccess] = await db.select().from(userAccesses).where(eq(userAccesses.id, input.userAccessId)).limit(1);
	if (!targetAccess) throw new Error("Data pemetaan akses tidak ditemukan.");
	if (!input.active && targetAccess.accessType === "admin_kppn" && targetAccess.kppnScopeId && targetAccess.active) {
		const [activeAdminCountRes] = await db.select({ total: count() }).from(userAccesses).where(and(eq(userAccesses.accessType, "admin_kppn"), eq(userAccesses.kppnScopeId, targetAccess.kppnScopeId), eq(userAccesses.active, true)));
		if (Number(activeAdminCountRes?.total ?? 0) <= 1) throw new LastAdminRevocationError();
	}
	const [updated] = await db.update(userAccesses).set({ active: input.active }).where(eq(userAccesses.id, input.userAccessId)).returning();
	await db.insert(auditLogs).values({ actorId: input.actorUserId, actorAccessType: targetAccess.accessType, action: "toggle_access_active", entityType: "user_accesses", entityId: input.userAccessId, orgId: targetAccess.orgId ?? null, beforeJson: targetAccess as unknown as Record<string, unknown>, afterJson: updated as unknown as Record<string, unknown>, requestId: input.requestId ?? null });
	return updated;
}

export async function hardDeleteUser(db: DbClient, input: HardDeleteUserInput) {
	if (input.actorUserId === input.targetUserId) throw new SelfDeleteError();
	const [targetUser] = await db.select().from(users).where(eq(users.id, input.targetUserId)).limit(1);
	if (!targetUser) throw new Error("User tidak ditemukan.");
	const adminAccesses = await db.select({ kppnScopeId: userAccesses.kppnScopeId }).from(userAccesses).where(and(eq(userAccesses.userId, input.targetUserId), eq(userAccesses.accessType, "admin_kppn"), eq(userAccesses.active, true)));
	for (const a of adminAccesses) {
		if (!a.kppnScopeId) continue;
		const [cntRes] = await db.select({ total: count() }).from(userAccesses).where(and(eq(userAccesses.accessType, "admin_kppn"), eq(userAccesses.kppnScopeId, a.kppnScopeId), eq(userAccesses.active, true)));
		if (Number(cntRes?.total ?? 0) <= 1) throw new LastAdminRevocationError("Tidak dapat menghapus admin terakhir pada scope KPPN.");
	}
	const allAccesses = await db.select().from(userAccesses).where(eq(userAccesses.userId, input.targetUserId));
	return await runWithFallback(db, async (tx) => {
		await tx.insert(auditLogs).values({ actorId: input.actorUserId, actorAccessType: "admin_kppn", action: "delete_user", entityType: "users", entityId: input.targetUserId, orgId: null, beforeJson: { user: targetUser, accesses: allAccesses } as unknown as Record<string, unknown>, afterJson: null, requestId: input.requestId ?? null });
		const [deleted] = await tx.delete(users).where(eq(users.id, input.targetUserId)).returning();
		return deleted ?? targetUser;
	});
}

export async function updateUserProfile(db: DbClient, input: UpdateUserProfileInput) {
	const [targetUser] = await db.select().from(users).where(eq(users.id, input.targetUserId)).limit(1);
	if (!targetUser) throw new Error("User tidak ditemukan.");
	const updates: Record<string, unknown> = {};
	let emailChanged = false;
	let normalizedEmail: string | null = null;
	if (input.email !== undefined && input.email !== null) {
		normalizedEmail = normalizeEmail(input.email);
		if (normalizedEmail !== targetUser.email) {
			const isManual = targetUser.clerkUserId.startsWith("manual_");
			if (!isManual) throw new EmailLockedError();
			const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
			if (existing && existing.id !== targetUser.id) throw new Error("Email sudah digunakan pengguna lain.");
			updates.email = normalizedEmail;
			emailChanged = true;
		}
	}
	if (input.name !== undefined && input.name !== null) {
		const trimmed = input.name.trim();
		if (trimmed && trimmed !== targetUser.name) updates.name = trimmed;
	}
	if (Object.keys(updates).length === 0) return targetUser;
	(updates as Record<string, Date>).updatedAt = new Date();
	const [updated] = await db.update(users).set(updates as unknown as Parameters<typeof db.update>[0] extends never ? never : Record<string, unknown>).where(eq(users.id, input.targetUserId)).returning();
	await db.insert(auditLogs).values({ actorId: input.actorUserId, actorAccessType: "admin_kppn", action: "update_user_profile", entityType: "users", entityId: input.targetUserId, orgId: null, beforeJson: targetUser as unknown as Record<string, unknown>, afterJson: updated as unknown as Record<string, unknown>, requestId: input.requestId ?? null });
	if (emailChanged) {
		// normalize audit extra?
	}
	return updated;
}
