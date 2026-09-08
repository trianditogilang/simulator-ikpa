import type {
	CompletenessItem,
	IndicatorScoreItem,
	NearestDeadlineItem,
	PriorityActionItem,
} from "@/mocks/operator-dashboard";
import { getOperatorDashboardFn } from "@/server/dashboard";

export interface DashboardResponseData {
	totalScore: number | null;
	targetScore: number;
	gapScore: number | null;
	deltaFromPreviousPeriod?: number | null;
	previousPeriodLabel?: string | null;
	dataStatus: "complete" | "incomplete" | "estimated";
	ruleSetVersion: string;
	lastUpdated: string;
	indicators: IndicatorScoreItem[];
	priorityActions: PriorityActionItem[];
	nearestDeadline: NearestDeadlineItem | null;
	otherDeadlinesCount: number;
	completeness: CompletenessItem[];
	firstIncompleteRoute?: string | null;
	scoreHistory: { month: string; score: number; target: number }[];
	activePeriodMonth: number;
	activeYear: number;
}

export async function fetchOperatorDashboard(
	orgId?: string,
	periodMonth?: number,
	fiscalYearId?: string,
	year?: number,
): Promise<DashboardResponseData> {
	return getOperatorDashboardFn({
		data: { orgId, periodMonth, fiscalYearId, year },
	}) as Promise<DashboardResponseData>;
}
