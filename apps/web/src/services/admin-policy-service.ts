import {
	createRuleSetDraftFn,
	listAdminReminderPoliciesFn,
	listAdminRuleSetsFn,
	publishRuleSetFn,
	retireRuleSetFn,
} from "@/server/admin-policy";

export interface AdminRuleSetRecord {
	id: string;
	year: number;
	version: string;
	status: string;
	sourceRegulation: string;
	changeNotes?: string | null;
	effectiveFrom: string;
	publishedAt?: string | null;
	retiredAt?: string | null;
	createdAt: string;
}

export async function fetchAdminRuleSets(
	year?: number,
): Promise<{ ruleSets: AdminRuleSetRecord[] }> {
	return listAdminRuleSetsFn({ data: year ? { year } : undefined });
}

export async function createRuleSet(input: {
	year: number;
	version: string;
	sourceRegulation: string;
	changeNotes: string;
	configJson: unknown;
}) {
	return createRuleSetDraftFn({ data: input });
}

export async function publishRuleSet(ruleSetId: string) {
	return publishRuleSetFn({ data: { ruleSetId } });
}

export async function retireRuleSet(ruleSetId: string) {
	return retireRuleSetFn({ data: { ruleSetId } });
}

export async function fetchAdminReminderPolicies() {
	return listAdminReminderPoliciesFn();
}
