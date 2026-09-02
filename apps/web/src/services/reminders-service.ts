import {
	listOperatorRemindersFn,
	resetOperatorReminderConfigFn,
	updateOperatorReminderConfigFn,
} from "@/server/reminders";

export interface ReminderPolicyItem {
	id: string;
	eventType: string;
	category: string;
	dayType: string;
	minLeadDays: number;
	maxLeadDays: number;
	allowDisable: boolean;
	allowRecipientOverride: boolean;
	isActive: boolean;
}

export interface ReminderConfigItem {
	id: string;
	reminderPolicyId: string;
	enabled: boolean;
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

export interface OperatorRemindersData {
	fiscalYearId: string;
	year: number;
	policies: ReminderPolicyItem[];
	configs: ReminderConfigItem[];
	previews: ReminderPreviewItem[];
}

export async function fetchOperatorReminders(
	orgId?: string,
): Promise<OperatorRemindersData> {
	return listOperatorRemindersFn({ data: orgId ? { orgId } : undefined });
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
