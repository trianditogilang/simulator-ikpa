import type { DbClient } from "@simulator-ikpa/db";
import { auditLogs, userAccesses } from "@simulator-ikpa/db/schema";
import { and, count, eq } from "drizzle-orm";

export class LastAdminRevocationError extends Error {
	public readonly statusCode = 400;
	public readonly code = "LAST_ADMIN_PROTECTION";

	constructor(
		message = "Tidak dapat mencabut atau menonaktifkan Admin KPPN terakhir untuk scope KPPN ini.",
	) {
		super(message);
		this.name = "LastAdminRevocationError";
	}
}

export class AccessConflictError extends Error {
	public readonly statusCode = 400;
	public readonly code = "ACCESS_TYPE_CONFLICT";

	constructor(
		message = "Satu pengguna tidak boleh memiliki jenis akses Admin KPPN dan Operator Satker secara bersamaan.",
	) {
		super(message);
		this.name = "AccessConflictError";
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

/**
 * Grants Operator Satker access mapping to a target user.
 * Enforces single access type rule (rejects if user has active admin mappings).
 */
export async function grantOperatorAccess(
	db: DbClient,
	input: GrantOperatorAccessInput,
) {
	// Check if target user has active Admin access
	const [activeAdmin] = await db
		.select()
		.from(userAccesses)
		.where(
			and(
				eq(userAccesses.userId, input.targetUserId),
				eq(userAccesses.accessType, "admin_kppn"),
				eq(userAccesses.active, true),
			),
		)
		.limit(1);

	if (activeAdmin) {
		throw new AccessConflictError();
	}

	const [created] = await db
		.insert(userAccesses)
		.values({
			userId: input.targetUserId,
			accessType: "operator_satker",
			orgId: input.orgId,
			active: true,
			createdBy: input.actorUserId,
		})
		.returning();

	// Record audit log
	await db.insert(auditLogs).values({
		actorId: input.actorUserId,
		actorAccessType: "operator_satker",
		action: "grant_operator_access",
		entityType: "user_accesses",
		entityId: created.id,
		orgId: input.orgId,
		beforeJson: null,
		afterJson: created,
		requestId: input.requestId ?? null,
	});

	return created;
}

/**
 * Grants Admin KPPN access mapping to a target user.
 * Enforces single access type rule (rejects if user has active operator mappings).
 */
export async function grantAdminAccess(
	db: DbClient,
	input: GrantAdminAccessInput,
) {
	// Check if target user has active Operator access
	const [activeOperator] = await db
		.select()
		.from(userAccesses)
		.where(
			and(
				eq(userAccesses.userId, input.targetUserId),
				eq(userAccesses.accessType, "operator_satker"),
				eq(userAccesses.active, true),
			),
		)
		.limit(1);

	if (activeOperator) {
		throw new AccessConflictError();
	}

	const [created] = await db
		.insert(userAccesses)
		.values({
			userId: input.targetUserId,
			accessType: "admin_kppn",
			kppnScopeId: input.kppnScopeId,
			active: true,
			createdBy: input.actorUserId,
		})
		.returning();

	// Record audit log
	await db.insert(auditLogs).values({
		actorId: input.actorUserId,
		actorAccessType: "admin_kppn",
		action: "grant_admin_access",
		entityType: "user_accesses",
		entityId: created.id,
		orgId: null,
		beforeJson: null,
		afterJson: created,
		requestId: input.requestId ?? null,
	});

	return created;
}

/**
 * Revokes an access mapping with Last Admin Protection.
 */
export async function revokeAccess(db: DbClient, input: RevokeAccessInput) {
	const [targetAccess] = await db
		.select()
		.from(userAccesses)
		.where(eq(userAccesses.id, input.userAccessId))
		.limit(1);

	if (!targetAccess) {
		throw new Error("Data pemetaan akses tidak ditemukan.");
	}

	// Last Admin Protection Check
	if (
		targetAccess.accessType === "admin_kppn" &&
		targetAccess.kppnScopeId &&
		targetAccess.active
	) {
		const [activeAdminCountRes] = await db
			.select({ total: count() })
			.from(userAccesses)
			.where(
				and(
					eq(userAccesses.accessType, "admin_kppn"),
					eq(userAccesses.kppnScopeId, targetAccess.kppnScopeId),
					eq(userAccesses.active, true),
				),
			);

		if (Number(activeAdminCountRes?.total ?? 0) <= 1) {
			throw new LastAdminRevocationError();
		}
	}

	const [deleted] = await db
		.delete(userAccesses)
		.where(eq(userAccesses.id, input.userAccessId))
		.returning();

	// Record audit log
	await db.insert(auditLogs).values({
		actorId: input.actorUserId,
		actorAccessType: targetAccess.accessType,
		action: "revoke_access",
		entityType: "user_accesses",
		entityId: input.userAccessId,
		orgId: targetAccess.orgId ?? null,
		beforeJson: targetAccess,
		afterJson: null,
		requestId: input.requestId ?? null,
	});

	return deleted;
}

/**
 * Toggles an access mapping between active and inactive with Last Admin Protection.
 */
export async function toggleAccessActive(
	db: DbClient,
	input: ToggleAccessInput,
) {
	const [targetAccess] = await db
		.select()
		.from(userAccesses)
		.where(eq(userAccesses.id, input.userAccessId))
		.limit(1);

	if (!targetAccess) {
		throw new Error("Data pemetaan akses tidak ditemukan.");
	}

	// If deactivating an active Admin KPPN, assert last admin protection
	if (
		!input.active &&
		targetAccess.accessType === "admin_kppn" &&
		targetAccess.kppnScopeId &&
		targetAccess.active
	) {
		const [activeAdminCountRes] = await db
			.select({ total: count() })
			.from(userAccesses)
			.where(
				and(
					eq(userAccesses.accessType, "admin_kppn"),
					eq(userAccesses.kppnScopeId, targetAccess.kppnScopeId),
					eq(userAccesses.active, true),
				),
			);

		if (Number(activeAdminCountRes?.total ?? 0) <= 1) {
			throw new LastAdminRevocationError();
		}
	}

	const [updated] = await db
		.update(userAccesses)
		.set({
			active: input.active,
		})
		.where(eq(userAccesses.id, input.userAccessId))
		.returning();

	// Record audit log
	await db.insert(auditLogs).values({
		actorId: input.actorUserId,
		actorAccessType: targetAccess.accessType,
		action: "toggle_access_active",
		entityType: "user_accesses",
		entityId: input.userAccessId,
		orgId: targetAccess.orgId ?? null,
		beforeJson: targetAccess,
		afterJson: updated,
		requestId: input.requestId ?? null,
	});

	return updated;
}
