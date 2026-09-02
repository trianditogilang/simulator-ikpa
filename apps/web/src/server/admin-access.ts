import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { assertAdminKppnScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import {
	auditLogs,
	organizations,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		return null;
	}
	return createDbClient(dbUrl);
}

export const listAdminUserAccessFn = createServerFn({ method: "GET" })
	.validator(() => undefined)
	.handler(async () => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		assertAdminKppnScope(access);

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

		assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

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

		// Insert or update access
		const [newAccess] = await db
			.insert(userAccesses)
			.values({
				userId: user.id,
				accessType: data.accessType,
				orgId: data.orgId ? data.orgId : null,
				active: true,
			})
			.returning();

		return { success: true, accessId: newAccess.id };
	});

export const removeUserAccessFn = createServerFn({ method: "POST" })
	.validator((data: { accessId: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

		await db
			.update(userAccesses)
			.set({ active: false, updatedAt: new Date() })
			.where(eq(userAccesses.id, data.accessId));

		return { success: true };
	});

export const listAdminAuditLogsFn = createServerFn({ method: "GET" })
	.validator(() => undefined)
	.handler(async () => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		assertAdminKppnScope(access);

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
				createdAt: auditLogs.createdAt,
			})
			.from(auditLogs)
			.leftJoin(users, eq(auditLogs.actorId, users.id))
			.leftJoin(organizations, eq(auditLogs.orgId, organizations.id))
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
				createdAt: r.createdAt.toISOString(),
			})),
		};
	});
