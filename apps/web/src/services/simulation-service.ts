import { listSnapshotsFn, runSimulationFn } from "@/server/simulation";

export interface IndicatorScoreBreakdown {
	code: string;
	name: string;
	score: string;
	weight: string;
	weightedScore: string;
	status?: "safe" | "warning" | "danger";
}

export interface SimulationOutput {
	totalScore: string;
	category?: string;
	indicators?: IndicatorScoreBreakdown[];
	deductions?: Array<{ name: string; deduction: string }>;
	recommendations?: Array<{
		id: string;
		title: string;
		impact: string;
		description: string;
	}>;
}

export interface ScoreSnapshotRecord {
	id: string;
	simulationId: string;
	simulationName: string;
	simulationType: string;
	periodEnd: string;
	totalScore: string | null;
	createdAt: string;
	breakdownJson?: unknown;
}

export async function executeSimulation(input: {
	orgId?: string;
	period?: { kind: "month" | "quarter" | "semester" | "year"; value: number };
	simulationType?: "actual" | "forecast" | "scenario";
	targetScore?: string;
	overrides?: Record<string, string>;
	simulationName?: string;
}) {
	return runSimulationFn({ data: input });
}

export async function fetchSnapshots(orgId?: string): Promise<{
	snapshots: ScoreSnapshotRecord[];
}> {
	return listSnapshotsFn({ data: orgId ? { orgId } : undefined });
}
