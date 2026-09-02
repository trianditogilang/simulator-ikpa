import {
	createRevisionFn,
	deleteBudgetFn,
	deleteRevisionFn,
	listBudgetsAndRevisionsFn,
	upsertBudgetFn,
} from "@/server/budget-revisions";

export interface BudgetRecord {
	id: string;
	accountCode: "51" | "52" | "53" | "57" | string;
	amount: string;
	effectiveAt: string;
}

export interface DipaRevisionRecord {
	id: string;
	revisionDate: string;
	revisionCode: string;
	paguBefore: string;
	paguAfter: string;
	notes?: string | null;
}

export interface BudgetRevisionsData {
	fiscalYearId: string;
	year: number;
	budgets: BudgetRecord[];
	revisions: DipaRevisionRecord[];
}

export async function fetchBudgetAndRevisions(
	orgId?: string,
): Promise<BudgetRevisionsData> {
	return listBudgetsAndRevisionsFn({ data: orgId ? { orgId } : undefined });
}

export async function saveBudget(input: {
	orgId?: string;
	accountCode: "51" | "52" | "53" | "57";
	amount: string;
	effectiveAt: string;
}) {
	return upsertBudgetFn({ data: input });
}

export async function addRevision(input: {
	orgId?: string;
	revisionDate: string;
	revisionCode: string;
	paguBefore: string;
	paguAfter: string;
	notes?: string;
}) {
	return createRevisionFn({ data: input });
}

export async function removeRevision(revisionId: string, orgId?: string) {
	return deleteRevisionFn({ data: { revisionId, orgId } });
}

export async function removeBudget(budgetId: string, orgId?: string) {
	return deleteBudgetFn({ data: { budgetId, orgId } });
}
