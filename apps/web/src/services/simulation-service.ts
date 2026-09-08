import {
	type ActualSnapshotItem,
	type HistoryPageData,
	type SavedScenarioItem,
	deleteScenarioFn,
	duplicateScenarioFn,
	listSnapshotsFn,
	runSimulationFn,
} from "@/server/simulation";

export type { ActualSnapshotItem, HistoryPageData, SavedScenarioItem };

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
	parentSnapshotId?: string;
	overrides?: Record<string, string>;
	assumptions?: {
		upTup?: {
			nilaiUP: string;
			nilaiRencanaGUP: string;
			tanggalGUPSebelumnya: string;
			tanggalRencanaGUP: string;
			tupTepat?: number;
			tupTerlambat?: number;
			ptupTepat?: number;
			gupNihilCount?: number;
			setoranTepat?: number;
			kkpNominal?: string;
			kkpTanggal?: string;
		} | null;
		dispensasi?: { dispensationCount: number; totalSpmQ4: number } | null;
	};
	simulationName?: string;
}) {
	return runSimulationFn({ data: input });
}

export async function fetchHistoryData(
	orgId?: string,
	year?: number,
): Promise<HistoryPageData> {
	return listSnapshotsFn({ data: { orgId, year } }) as Promise<HistoryPageData>;
}

export async function fetchSnapshots(orgId?: string): Promise<{
	snapshots: ScoreSnapshotRecord[];
}> {
	const data = (await listSnapshotsFn({
		data: orgId ? { orgId } : undefined,
	})) as HistoryPageData;
	return { snapshots: (data.snapshots as ScoreSnapshotRecord[]) || [] };
}

export async function deleteScenario(
	scenarioId: string,
	orgId?: string,
): Promise<{ success: boolean }> {
	return deleteScenarioFn({ data: { scenarioId, orgId } });
}

export async function duplicateScenario(
	scenarioId: string,
	newName?: string,
	orgId?: string,
): Promise<{ success: boolean; newSimulationId?: string }> {
	return duplicateScenarioFn({ data: { scenarioId, newName, orgId } });
}
