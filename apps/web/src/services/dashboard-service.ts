import type {
	IndicatorScoreItem,
	NearestDeadlineItem,
	PriorityActionItem,
} from "@/mocks/operator-dashboard";
import { getOperatorDashboardFn } from "@/server/dashboard";

export interface DashboardResponseData {
	totalScore: number;
	targetScore: number;
	gapScore: number;
	dataStatus: "complete" | "incomplete" | "estimated";
	ruleSetVersion: string;
	lastUpdated: string;
	indicators: IndicatorScoreItem[];
	priorityActions: PriorityActionItem[];
	nearestDeadline: NearestDeadlineItem | null;
}

export async function fetchOperatorDashboard(
	orgId?: string,
	periodMonth?: number,
): Promise<DashboardResponseData> {
	return getOperatorDashboardFn({
		data: { orgId, periodMonth },
	}) as Promise<DashboardResponseData>;
}
