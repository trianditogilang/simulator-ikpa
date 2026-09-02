import {
	getAdminDashboardSummaryFn,
	listAdminOrganizationsFn,
} from "@/server/admin-monitoring";

export interface AdminSatkerSummary {
	id: string;
	code: string;
	name: string;
	score: number;
	status: "safe" | "warning" | "danger";
	mainRisk: string;
	lastUpdated: string;
	isBlu: boolean;
}

export interface AdminDashboardData {
	totalSatkers: number;
	averageScore: number;
	riskySatkersCount: number;
	warningSatkersCount: number;
	safeSatkersCount: number;
	deliveryFailedCount: number;
	satkerSummaries: AdminSatkerSummary[];
}

export interface AdminOrgRecord {
	id: string;
	kodeSatker: string;
	name: string;
	kppnName: string;
	isBlu: boolean;
	timezone: string;
	createdAt: string;
}

export async function fetchAdminDashboard(
	kppnScopeId?: string,
): Promise<AdminDashboardData> {
	return getAdminDashboardSummaryFn({
		data: kppnScopeId ? { kppnScopeId } : undefined,
	}) as Promise<AdminDashboardData>;
}

export async function fetchAdminOrganizations(
	kppnScopeId?: string,
): Promise<{ organizations: AdminOrgRecord[] }> {
	return listAdminOrganizationsFn({
		data: kppnScopeId ? { kppnScopeId } : undefined,
	});
}
