import { createServerFn } from "@tanstack/react-start";
import { desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
	assertAdminKppnScope,
	grantAdminAccess,
	grantOperatorAccess,
	toggleAccessActive,
} from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import {
	auditLogs,
	organizations,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
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

		const rows = await db
			.select({
				id: userAccesses.id,
				userId: userAccesses.userId,
				userName: users.name,
				userEmail: users.email,
				accessType: userAccesses.accessType,
				orgId: userAccesses.orgId,
				orgName: organizations.name,
				kodeSatker: organizations.kodeSatker,
				active: userAccesses.active,
				createdAt: userAccesses.createdAt,
			})
			.from(userAccesses)
			.innerJoin(users, eq(userAccesses.userId, users.id))
			.leftJoin(organizations, eq(userAccesses.orgId, organizations.id))
			.where(
				or(
					inArray(userAccesses.kppnScopeId, allowedKppnScopeIds),
					inArray(organizations.kppnScopeId, allowedKppnScopeIds),
				),
			)
			.orderBy(desc(userAccesses.createdAt));

		return {
			accesses: rows.map((r) => ({
				id: r.id,
				userId: r.userId,
				name: r.userName,
				email: r.userEmail,
				accessType: r.accessType,
				orgId: r.orgId,
				scopeName: r.orgName ?? "KPPN Wilayah",
				scopeCode: r.kodeSatker ?? "032",
				status: r.active ? ("active" as const) : ("inactive" as const),
				createdAt: r.createdAt.toISOString(),
			})),
		};
	});

export const assignUserAccessFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			email: string;
			name: string;
			accessType: "operator_satker" | "admin_kppn";
			orgId?: string | null;
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

		const operatorOrgId =
			data.accessType === "operator_satker" ? data.orgId : undefined;
		if (data.accessType === "operator_satker") {
			if (!operatorOrgId) {
				throw new Error("Satker naungan wajib dipilih untuk peran Operator Satker.");
			}
			const [targetOrganization] = await db
				.select({ kppnScopeId: organizations.kppnScopeId })
				.from(organizations)
				.where(eq(organizations.id, operatorOrgId))
				.limit(1);
			if (
				!targetOrganization ||
				!allowedKppnScopeIds.includes(targetOrganization.kppnScopeId)
			) {
				throw new Error("Satker berada di luar scope admin.");
			}
		}

		const actorUserId = access.status === "admin" ? access.userId : "admin";

		// Find or create user
		let [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, data.email.toLowerCase().trim()))
			.limit(1);

		if (!user) {
			[user] = await db
				.insert(users)
				.values({
					clerkUserId: `manual_${Date.now()}`,
					email: data.email.toLowerCase().trim(),
					name: data.name.trim(),
				})
				.returning();
		}

		if (data.accessType === "operator_satker") {
			if (!operatorOrgId) {
				throw new Error("Satker naungan wajib dipilih untuk peran Operator Satker.");
			}
			const created = await grantOperatorAccess(db, {
				actorUserId,
				targetUserId: user.id,
				orgId: operatorOrgId,
			});
			return { success: true, accessId: created.id };
		} else {
			const kppnScopeId = allowedKppnScopeIds[0];
			if (!kppnScopeId) {
				throw new Error("Scope KPPN tidak valid.");
			}
			const created = await grantAdminAccess(db, {
				actorUserId,
				targetUserId: user.id,
				kppnScopeId,
			});
			return { success: true, accessId: created.id };
		}
	});

export const removeUserAccessFn = createServerFn({ method: "POST" })
	.validator(
		(data: { accessId: string; active?: boolean }) =>
			data as { accessId: string; active?: boolean },
	)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		const { allowedKppnScopeIds } = assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

		const [targetAccess] = await db
			.select({
				accessScopeId: userAccesses.kppnScopeId,
				organizationScopeId: organizations.kppnScopeId,
			})
			.from(userAccesses)
			.leftJoin(organizations, eq(userAccesses.orgId, organizations.id))
			.where(eq(userAccesses.id, data.accessId))
			.limit(1);
		const targetScopeId =
			targetAccess?.organizationScopeId ?? targetAccess?.accessScopeId;
		if (!targetScopeId || !allowedKppnScopeIds.includes(targetScopeId)) {
			throw new Error("Pemetaan akses berada di luar scope admin.");
		}

		const actorUserId = access.status === "admin" ? access.userId : "admin";
		await toggleAccessActive(db, {
			actorUserId,
			userAccessId: data.accessId,
			active: data.active ?? false,
		});

		return { success: true };
	});

export const listAdminAuditLogsFn = createServerFn({ method: "GET" })
	.validator(() => undefined)
	.handler(async () => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		const { allowedKppnScopeIds } = assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return { logs: [] };
		}

		const rows = await db
			.select({
				id: auditLogs.id,
				action: auditLogs.action,
				entityType: auditLogs.entityType,
				entityId: auditLogs.entityId,
				actorId: auditLogs.actorId,
				actorName: users.name,
				actorEmail: users.email,
				actorAccessType: auditLogs.actorAccessType,
				orgName: organizations.name,
				kodeSatker: organizations.kodeSatker,
				requestId: auditLogs.requestId,
				ruleSetVersion: auditLogs.ruleSetVersion,
				beforeJson: auditLogs.beforeJson,
				afterJson: auditLogs.afterJson,
				createdAt: auditLogs.createdAt,
			})
			.from(auditLogs)
			.leftJoin(users, eq(auditLogs.actorId, users.id))
			.leftJoin(organizations, eq(auditLogs.orgId, organizations.id))
			.where(
				or(
					isNull(auditLogs.orgId),
					inArray(organizations.kppnScopeId, allowedKppnScopeIds),
				),
			)
			.orderBy(desc(auditLogs.createdAt))
			.limit(50);

		return {
			logs: rows.map((r) => ({
				id: r.id,
				action: r.action,
				entityType: r.entityType,
				entityId: r.entityId,
				actorName: r.actorName ?? "Sistem Otomatis",
				actorEmail: r.actorEmail ?? "system@kppn.kemenkeu.go.id",
				actorRole: r.actorAccessType ?? "admin_kppn",
				organizationName: r.orgName,
				kodeSatker: r.kodeSatker,
				requestId: r.requestId ?? "req-auto",
				ruleSetVersion: r.ruleSetVersion,
				beforeJson: (r.beforeJson as unknown as Record<
					string,
					string | number | boolean | null
				> | null) ?? null,
				afterJson: (r.afterJson as unknown as Record<
					string,
					string | number | boolean | null
				> | null) ?? null,
				createdAt: r.createdAt.toISOString(),
			})),
		};
	});
