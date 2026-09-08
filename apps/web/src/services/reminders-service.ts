import {
	listOperatorRemindersFn,
	resetOperatorReminderConfigFn,
	updateOperatorReminderConfigFn,
} from "@/server/reminders";
import type {
	ActiveReminderEvent,
	ReminderDeliveryLogItem,
	ReminderRecipientItem,
} from "@/server/reminders/active-events.queries";

export type {
	ActiveReminderEvent,
	ReminderDeliveryLogItem,
	ReminderRecipientItem,
};

export interface ReminderPolicyItem {
	id: string;
	eventType: string;
	indicatorKey?: string;
	indicatorLabel?: string;
	category: "mandatory" | "recommended" | "optional" | string;
	dayType: "workday" | "calendar_day" | "schedule" | string;
	minLeadDays: number;
	maxLeadDays: number;
	defaultLeadDays?: number[];
	requiredRecipients?: string[];
	allowDisable: boolean;
	allowRecipientOverride: boolean;
	isActive: boolean;
	description?: string;
}

export interface ReminderConfigItem {
	id: string;
	reminderPolicyId: string;
	enabled: boolean;
	scheduleLeadDays?: number[];
	additionalRecipients?: string[];
	customMessage?: string | null;
	timezone: string;
}

export interface ReminderPreviewItem {
	policyId: string;
	deadline: string;
	dayType: string;
	scheduled: Array<{
		leadDays: number;
		scheduledDate: string;
		deadline: string;
	}>;
}

export interface OperatorRemindersSummaryStats {
	totalActiveEvents: number;
	urgentEventsCount: number;
	warningEventsCount: number;
	safeEventsCount: number;
	completedEventsCount: number;
	totalPoliciesCount: number;
	mandatoryPoliciesCount: number;
	activePoliciesCount: number;
	scheduledDeliveriesCount: number;
	sentDeliveriesCount: number;
	failedDeliveriesCount: number;
}

export interface OperatorRemindersData {
	fiscalYearId: string;
	year: number;
	organizationName?: string;
	satkerCode?: string;
	events: ActiveReminderEvent[];
	policies: ReminderPolicyItem[];
	configs: ReminderConfigItem[];
	previews: ReminderPreviewItem[];
	recipients: ReminderRecipientItem[];
	deliveries: ReminderDeliveryLogItem[];
	stats: OperatorRemindersSummaryStats;
	providerStatus: {
		isProductionReady: boolean;
		mode: "sandbox_pending" | "production";
		message: string;
	};
}

export async function fetchOperatorReminders(
	orgId?: string,
): Promise<OperatorRemindersData> {
	return listOperatorRemindersFn({
		data: orgId ? { orgId } : undefined,
	}) as unknown as Promise<OperatorRemindersData>;
}

export async function saveReminderConfig(input: {
	orgId?: string;
	reminderPolicyId: string;
	enabled: boolean;
	leadDays?: number[];
	additionalRecipients?: string[];
	customMessage?: string | null;
}) {
	return updateOperatorReminderConfigFn({ data: input });
}

export async function resetReminderConfig(configId: string, orgId?: string) {
	return resetOperatorReminderConfigFn({ data: { configId, orgId } });
}
