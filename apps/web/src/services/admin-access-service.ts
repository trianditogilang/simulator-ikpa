import {
	assignUserAccessFn,
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
	orgId?: string | null;
}) {
	return assignUserAccessFn({ data: input });
}

export async function deactivateAccess(accessId: string) {
	return removeUserAccessFn({ data: { accessId } });
}

export async function fetchAdminAuditLogs(): Promise<{
	logs: AdminAuditLogRecord[];
}> {
	return listAdminAuditLogsFn();
}
