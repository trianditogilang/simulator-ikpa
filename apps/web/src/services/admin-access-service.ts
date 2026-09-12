import {
	assignUserAccessFn,
	hardDeleteUserFn,
	listAdminAuditLogsFn,
	listAdminUserAccessFn,
	removeUserAccessFn,
} from "@/server/admin-access";

export interface AdminUserAccessRecord {
	id: string;
	userId: string;
	name: string;
	email: string;
	accessType: "operator_satker" | "admin_kppn";
	orgId: string | null;
	scopeName: string;
	scopeCode: string;
	adminSlot: number | null;
	status: "active" | "inactive";
	createdAt: string;
}

export interface AdminAuditLogRecord {
	id: string;
	action: string;
	entityType: string;
	entityId?: string | null;
	actorName: string;
	actorEmail: string;
	actorRole: string;
	organizationName?: string | null;
	kodeSatker?: string | null;
	requestId: string;
	ruleSetVersion?: string | null;
	beforeJson?: Record<string, string | number | boolean | null> | null;
	afterJson?: Record<string, string | number | boolean | null> | null;
	createdAt: string;
}

export async function fetchAdminUserAccesses(): Promise<{
	accesses: AdminUserAccessRecord[];
}> {
	return listAdminUserAccessFn();
}

export async function assignAccess(input: {
	email: string;
	name: string;
	accessType: "operator_satker" | "admin_kppn";
	kodeSatker?: string | null;
	satkerName?: string | null;
	orgId?: string | null;
}) {
	return assignUserAccessFn({
		data: {
			email: input.email,
			name: input.name,
			accessType: input.accessType,
			kodeSatker: input.kodeSatker ?? input.orgId ?? null,
			satkerName: input.satkerName ?? null,
			orgId: input.orgId ?? null,
		},
	});
}

export async function hardDeleteUser(userId: string) {
	return hardDeleteUserFn({ data: { userId } });
}

export async function deactivateAccess(accessId: string, _active = false) {
	return removeUserAccessFn({ data: { accessId, userId: undefined } as unknown as { accessId: string } });
}

export async function removeAccessByUserId(userId: string) {
	return removeUserAccessFn({ data: { userId } as unknown as { userId: string } });
}

export async function fetchAdminAuditLogs(): Promise<{
	logs: AdminAuditLogRecord[];
}> {
	return listAdminAuditLogsFn();
}
