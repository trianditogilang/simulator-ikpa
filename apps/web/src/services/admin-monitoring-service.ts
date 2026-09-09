import {
	getAdminDashboardSummaryFn,
	getAdminOrganizationDetailFn,
	listAdminOrganizationsFn,
	listAdminOrgSnapshotsFn,
} from "@/server/admin-monitoring";
import {
	listAdminDeliveriesFn,
	retryAdminDeliveryFn,
} from "@/server/admin-deliveries";
import { listAdminReminderPoliciesFn } from "@/server/admin-policy";

export interface AdminSatkerSummary {
	id: string;
	code: string;
	name: string;
	score: number;
	gap: number;
	status: "safe" | "warning" | "danger";
	dataKind: "aktual" | "proyeksi" | "kosong";
	indicators: Record<string, number>;
	mainRisk: string;
	lastUpdated: string;
	isBlu: boolean;
}

export interface AdminIndicatorAverage {
	key: string;
	avgScore: number | null;
	satkerCount: number;
}

export interface AdminDashboardData {
	totalSatkers: number;
	averageScore: number;
	riskySatkersCount: number;
	warningSatkersCount: number;
	safeSatkersCount: number;
	deliveryFailedCount: number;
	satkerSummaries: AdminSatkerSummary[];
	indicatorAverages: AdminIndicatorAverage[];
}

export interface AdminReminderPolicyItem {
	id: string;
	eventType: string;
	title?: string;
	indicatorKey?: string;
	indicatorLabel?: string;
	category: string;
	dayType: string;
	minLeadDays: number;
	maxLeadDays: number;
	defaultLeadDays?: number[];
	requiredRecipients?: string[];
	allowDisable: boolean;
	allowRecipientOverride: boolean;
	isActive: boolean;
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

export async function fetchAdminReminderPolicies(): Promise<{
	policies: AdminReminderPolicyItem[];
}> {
	return listAdminReminderPoliciesFn();
}

export interface AdminOrgIndicatorRow {
	key: string;
	rawScore: number | null;
	contrib: number | null;
}

export interface AdminOrgSnapshotItem {
	id: string;
	totalScore: string | null;
	ruleSetVersion: string;
	periodEnd: string;
	simName: string;
	simType: string;
	targetScore: string | null;
	createdAt: string;
}

export interface AdminOrgDetail {
	id: string;
	kodeSatker: string;
	name: string;
	kppnName: string;
	kppnScopeId: string;
	isBlu: boolean;
	fiscalYears: Array<{ id: string; year: number }>;
	completeness: string;
	latestSnapshot: {
		id: string;
		totalScore: string | null;
		ruleSetVersion: string;
		periodEnd: string;
		simName: string;
		simType: string;
		targetScore: string | null;
		createdAt: string;
		indicators: AdminOrgIndicatorRow[];
	} | null;
}

export async function fetchAdminOrganizationDetail(
	orgId: string,
): Promise<{ organization: AdminOrgDetail | null }> {
	return getAdminOrganizationDetailFn({ data: { orgId } });
}

export async function fetchAdminOrgSnapshots(
	orgId: string,
	page = 1,
	pageSize = 10,
): Promise<{
	items: AdminOrgSnapshotItem[];
	totalItems: number;
	page: number;
	pageSize: number;
	totalPages: number;
}> {
	return listAdminOrgSnapshotsFn({ data: { orgId, page, pageSize } });
}

export interface AdminDeliveryItem {
	id: string;
	satkerName: string;
	satkerCode: string;
	eventType: string;
	eventTitle: string;
	indicatorLabel: string;
	category: string;
	ruleSetVersion: string;
	entityType: string;
	scheduledFor: string;
	sentAt: string | null;
	status: string;
	attemptCount: number;
	errorMessage: string | null;
	recipientEmail?: string;
}

export async function fetchAdminDeliveries(input?: {
	status?: string;
	page?: number;
	pageSize?: number;
}): Promise<{
	items: AdminDeliveryItem[];
	totalItems: number;
	page: number;
	pageSize: number;
	totalPages: number;
	stats: { total: number; sent: number; scheduled: number; failed: number };
}> {
	return listAdminDeliveriesFn({ data: input });
}

export async function retryAdminDelivery(deliveryId: string): Promise<{
	id: string;
	status: string;
	attemptCount: number;
}> {
	return retryAdminDeliveryFn({ data: { deliveryId } });
}
