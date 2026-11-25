import {
	approveAccessRequestFn,
	assignUserAccessFn,
	hardDeleteUserFn,
	listAccessRequestsFn,
	listAdminUserAccessFn,
	rejectAccessRequestFn,
	removeUserAccessFn,
} from "@/server/admin-access";

export interface AdminUserAccessRecord {
	id: string;
	userId: string | null;
	name: string | null;
	email: string | null;
	accessType: "operator_satker" | "admin_kppn";
	accessStatus: "active" | "pending";
	orgId: string | null;
	scopeName: string;
	scopeCode: string;
	adminSlot: number | null;
	status: "active" | "inactive" | "pending";
	/** Invited/seeded account that has not set a password yet. */
	awaitingPassword: boolean;
	createdAt: string;
}

export interface AccessRequestRecord {
	id: string;
	email: string;
	kodeSatker: string;
	satkerName: string;
	createdAt: string;
	/** Name of the organization already registered under this code, if any. */
	existingOrgName: string | null;
	hasOperator: boolean;
	/** Pending requests for the same code, this one included (owner 2026-11-24). */
	duplicateCount: number;
}

export async function fetchAccessRequests(): Promise<{
	requests: AccessRequestRecord[];
}> {
	return listAccessRequestsFn();
}

export async function approveAccessRequest(requestId: string) {
	return approveAccessRequestFn({ data: { requestId } });
}

export async function rejectAccessRequest(requestId: string) {
	return rejectAccessRequestFn({ data: { requestId } });
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
	targetUserId?: string | null;
	targetAccessId?: string | null;
	emailConfirmed?: boolean;
}) {
	return assignUserAccessFn({
		data: {
			email: input.email,
			name: input.name,
			accessType: input.accessType,
			kodeSatker: input.kodeSatker ?? input.orgId ?? null,
			satkerName: input.satkerName ?? null,
			orgId: input.orgId ?? null,
			targetUserId: input.targetUserId ?? null,
			targetAccessId: input.targetAccessId ?? null,
			emailConfirmed: input.emailConfirmed ?? false,
		},
	});
}

export async function hardDeleteUser(userId: string) {
	return hardDeleteUserFn({ data: { userId } });
}

export async function removeAccess(accessId: string, userId: string | null) {
	if (userId) {
		return hardDeleteUserFn({ data: { userId } });
	}
	return removeUserAccessFn({ data: { accessId } as unknown as { accessId: string } });
}

export async function deactivateAccess(accessId: string, _active = false) {
	return removeUserAccessFn({ data: { accessId, userId: undefined } as unknown as { accessId: string } });
}

export async function removeAccessByUserId(userId: string) {
	return removeUserAccessFn({ data: { userId } as unknown as { userId: string } });
}
