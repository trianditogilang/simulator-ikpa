import {
	confirmOutputReportFn,
	deleteOutputReportFn,
	listOutputReportsFn,
	upsertOutputReportFn,
} from "@/server/output-achievement";

export interface OutputReportRecord {
	id: string;
	roCode: string;
	month: number;
	rvro: string;
	volumeDipa: string;
	pcro: string;
	tpcro: string;
	reportedAt?: Date | string | null;
	confirmed: boolean;
}

export interface OutputAchievementData {
	fiscalYearId: string;
	year: number;
	outputs: OutputReportRecord[];
}

export async function fetchOutputReports(
	orgId?: string,
): Promise<OutputAchievementData> {
	return listOutputReportsFn({ data: orgId ? { orgId } : undefined });
}

export async function saveOutputReport(input: {
	orgId?: string;
	roCode: string;
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
