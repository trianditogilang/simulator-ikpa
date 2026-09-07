import {
	confirmOutputReportFn,
	createFairnessProposalFn,
	deleteFairnessProposalFn,
	deleteOutputReportFn,
	listAllFairnessProposalsFn,
	listFairnessPoliciesFn,
	listFairnessProposalsFn,
	listOutputReportsFn,
	reviewFairnessProposalFn,
	upsertFairnessPolicyFn,
	upsertOutputReportFn,
} from "@/server/output-achievement";

export interface OutputEligibility {
	assessmentStatus: "included" | "excluded";
	exclusionPolicyId?: string;
	exclusionCategory?: string;
	exclusionReason?: string;
	policyReference?: string;
	effectiveRange?: { startMonth: number; endMonth: number };
	resolverVersion: string;
}

export interface OutputReportRecord {
	id: string;
	roCode: string;
	roName?: string | null;
	month: number;
	rvro: string;
	volumeDipa: string;
	pcro: string;
	tpcro: string;
	reportedAt?: Date | string | null;
	confirmed: boolean;
	confirmedAt?: Date | string | null;
	eligibility?: OutputEligibility;
	deadlineDate?: string;
}

export interface FairnessPolicy {
	id: string;
	name: string;
	indicatorKey: string;
	action: string;
	category: string;
	matchType: "exact" | "list" | "prefix" | "regex" | string;
	roMatchValue: string | string[];
	scopeType: string;
	scopeId?: string | null;
	fiscalYearId?: string | null;
	year: number;
	effectiveMonthStart: number;
	effectiveMonthEnd: number;
	basisReference: string;
	displayReason: string;
	internalNote?: string | null;
	allowOperatorProposal: boolean;
	status: string;
	publishedAt?: Date | string | null;
	createdAt: Date | string;
}

export interface FairnessProposal {
	id: string;
	organizationId: string;
	fiscalYearId: string;
	indicatorKey: string;
	roCode: string;
	month?: number | null;
	category: string;
	basisReference: string;
	operatorNote?: string | null;
	attachmentRef?: string | null;
	status: string;
	reviewNote?: string | null;
	resolvedPolicyId?: string | null;
	submittedAt?: Date | string | null;
	reviewedAt?: Date | string | null;
	createdAt: Date | string;
}

export interface OutputAchievementData {
	fiscalYearId: string;
	year: number;
	outputs: OutputReportRecord[];
	publishedPolicies?: FairnessPolicy[];
	holidays?: string[];
}

export async function fetchOutputReports(
	orgId?: string,
): Promise<OutputAchievementData> {
	return listOutputReportsFn({ data: orgId ? { orgId } : undefined }) as unknown as Promise<OutputAchievementData>;
}

export async function saveOutputReport(input: {
	orgId?: string;
	roCode: string;
	roName?: string | null;
	month: number;
	rvro: string;
	volumeDipa: string;
	pcro: string;
	tpcro: string;
	reportedAt?: string | null;
	confirmed?: boolean;
}) {
	return upsertOutputReportFn({ data: input });
}

export async function verifyOutputReport(outputId: string, orgId?: string) {
	return confirmOutputReportFn({ data: { outputId, orgId } });
}

export async function removeOutputReport(outputId: string, orgId?: string) {
	return deleteOutputReportFn({ data: { outputId, orgId } });
}

export async function submitFairnessProposal(input: {
	orgId?: string;
	roCode: string;
	month?: number | null;
	category?: string;
	basisReference: string;
	operatorNote?: string | null;
	attachmentRef?: string | null;
}) {
	return createFairnessProposalFn({ data: input });
}

export async function removeFairnessProposal(input: {
	orgId?: string;
	proposalId?: string;
	roCode?: string;
	month?: number | null;
}) {
	return deleteFairnessProposalFn({ data: input });
}

export async function fetchFairnessPolicies(year = 2026): Promise<FairnessPolicy[]> {
	return listFairnessPoliciesFn({ data: { year } }) as unknown as Promise<FairnessPolicy[]>;
}

export async function fetchFairnessProposals(orgId?: string): Promise<FairnessProposal[]> {
	return listFairnessProposalsFn({ data: orgId ? { orgId } : undefined }) as unknown as Promise<FairnessProposal[]>;
}

export async function saveFairnessPolicy(input: {
	id?: string;
	name: string;
	indicatorKey?: string;
	action?: string;
	category?: string;
	matchType: "exact" | "list" | "prefix" | "regex";
	roMatchValue: string | string[];
	scopeType?: "national" | "kppn" | "organization";
	scopeId?: string | null;
	year?: number;
	effectiveMonthStart?: number;
	effectiveMonthEnd?: number;
	basisReference: string;
	displayReason: string;
	internalNote?: string | null;
	allowOperatorProposal?: boolean;
	status?: "draft" | "published" | "retired" | "expired";
}) {
	return upsertFairnessPolicyFn({ data: input });
}

export async function reviewProposal(input: {
	proposalId: string;
	status: "approved" | "rejected";
	reviewNote?: string;
	resolvedPolicyId?: string;
}) {
	return reviewFairnessProposalFn({ data: input });
}

export async function fetchAllFairnessProposals(): Promise<FairnessProposal[]> {
	return listAllFairnessProposalsFn() as unknown as Promise<FairnessProposal[]>;
}


