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
	submitOutputReportFn,
	submitTargetPlanFn,
	upsertFairnessPolicyFn,
	upsertOutputReportFn,
	upsertRoBudgetRealizationFn,
	upsertTargetPlanFn,
	upsertTargetUpdateWindowFn,
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

export interface ValidationResultItem {
	ruleCode: string;
	ruleName: string;
	category: string;
	status: "valid" | "blocking" | "confirmation_required" | "correctable" | "not_evaluable";
	message: string;
	details?: Record<string, unknown>;
}

export interface AnomalyResultItem {
	hasAnomaly: boolean;
	gap: number;
	threshold: number;
	pcro: number;
	ppa: number;
	isPriorityNational: boolean;
	message: string;
	recommendation: string;
}

export interface MonthlyTargetItem {
	month: number;
	targetRvro: number;
	targetPcro: number;
	cumulativeTargetRvro: number;
	cumulativeTargetPcro: number;
}

export interface OutputTargetPlanRecord {
	id: string;
	orgId: string;
	fiscalYearId: string;
	roCode: string;
	roName?: string | null;
	volumeDipa: string;
	unit?: string | null;
	isIntegerUnit?: boolean;
	isPriorityNational?: boolean;
	version: number;
	quarter?: number | null;
	status: "draft" | "submitted" | "active" | "superseded";
	monthlyTargets: MonthlyTargetItem[];
	submittedAt?: Date | string | null;
	createdAt?: Date | string;
	updatedAt?: Date | string;
}

export interface TargetUpdateWindowRecord {
	id: string;
	year: number;
	quarter: number;
	opensAt: Date | string;
	closesAt: Date | string;
	status: "scheduled" | "open" | "closed";
	notes?: string | null;
}

export interface RoBudgetRealizationRecord {
	id: string;
	orgId: string;
	fiscalYearId: string;
	roCode: string;
	roName?: string | null;
	month: number;
	budgetAllocation: string;
	realizationAmount: string;
	ppaPercentage: string;
	cumulativeRealization: string;
	cumulativePpaPercentage: string;
	sourceType?: "manual" | "om_span" | "sakti_csv" | string;
	verified?: boolean;
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
	rvroIncremental?: string | null;
	pcroIncremental?: string | null;
	reportedAt?: Date | string | null;
	confirmed: boolean;
	confirmedAt?: Date | string | null;
	status?: "draft" | "submitted" | "confirmed" | "rejected";
	eligibility?: OutputEligibility;
	deadlineDate?: string;
	validationResultsJson?: unknown;
	validationResults?: ValidationResultItem[];
	anomalyResult?: AnomalyResultItem;
	ppaMonthly?: number;
	ppaCumulative?: number;
	evidenceDocumentUrl?: string | null;
	achievementReference?: string | null;
	operatorNote?: string | null;
	ppkValidationNote?: string | null;
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
	targetPlans?: OutputTargetPlanRecord[];
	targetWindows?: TargetUpdateWindowRecord[];
	budgetRealizations?: RoBudgetRealizationRecord[];
	publishedPolicies?: FairnessPolicy[];
	holidays?: string[];
}

export async function fetchOutputReports(
	orgId?: string,
): Promise<OutputAchievementData> {
	return listOutputReportsFn({ data: orgId ? { orgId } : undefined }) as unknown as Promise<OutputAchievementData>;
}

export async function saveOutputReport(input: {
	id?: string;
	orgId?: string;
	roCode: string;
	roName?: string | null;
	month: number;
	rvro: string;
	volumeDipa: string;
	pcro: string;
	tpcro: string;
	rvroIncremental?: string | null;
	pcroIncremental?: string | null;
	reportedAt?: string | null;
	confirmed?: boolean;
	status?: "draft" | "submitted" | "confirmed" | "rejected";
	evidenceDocumentUrl?: string | null;
	achievementReference?: string | null;
	operatorNote?: string | null;
	ppkValidationNote?: string | null;
}) {
	return upsertOutputReportFn({ data: input });
}

export async function submitOutputReportRecord(outputId: string, orgId?: string) {
	return submitOutputReportFn({ data: { outputId, orgId } });
}

export async function verifyOutputReport(outputId: string, orgId?: string) {
	return confirmOutputReportFn({ data: { outputId, orgId } });
}

export async function removeOutputReport(outputId: string, orgId?: string) {
	return deleteOutputReportFn({ data: { outputId, orgId } });
}

export async function saveTargetPlan(input: {
	id?: string;
	orgId?: string;
	roCode: string;
	roName?: string | null;
	volumeDipa: string;
	unit?: string;
	isIntegerUnit?: boolean;
	isPriorityNational?: boolean;
	version?: number;
	quarter?: number;
	monthlyTargets: MonthlyTargetItem[];
}) {
	return upsertTargetPlanFn({ data: input });
}

export async function submitTargetPlanRecord(targetPlanId: string, orgId?: string) {
	return submitTargetPlanFn({ data: { targetPlanId, orgId } });
}

export async function saveTargetUpdateWindow(input: {
	id?: string;
	year: number;
	quarter: number;
	opensAt: string;
	closesAt: string;
	status?: "scheduled" | "open" | "closed";
	notes?: string | null;
}) {
	return upsertTargetUpdateWindowFn({ data: input });
}

export async function saveRoBudgetRealization(input: {
	id?: string;
	orgId?: string;
	roCode: string;
	roName?: string | null;
	month: number;
	budgetAllocation: string;
	realizationAmount: string;
	sourceType?: "manual" | "om_span" | "sakti_csv" | string;
	verified?: boolean;
}) {
	return upsertRoBudgetRealizationFn({ data: input });
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


