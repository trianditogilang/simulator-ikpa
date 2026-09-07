import {
	createSpmDispensasiFn,
	deleteSpmDispensasiFn,
	listSpmDispensationsFn,
	updateSpmDispensasiFn,
} from "@/server/spm-dispensation";

export interface SpmQ4Record {
	id: string;
	referenceNumber: string;
	issuedAt: string;
	isDispensasi: boolean;
}

export interface SpmCalculationResult {
	ratio: string;
	category: number;
	deduction: string;
	formulaTrace: Array<{
		step: number;
		label: string;
		formula: string;
		inputs: Record<string, string>;
		result: string;
	}>;
	warnings: string[];
}

export interface SpmDispensationData {
	fiscalYearId: string;
	year: number;
	spmQ4List: SpmQ4Record[];
	calculation: SpmCalculationResult;
}

export async function fetchSpmDispensations(
	orgId?: string,
): Promise<SpmDispensationData> {
	return listSpmDispensationsFn({ data: orgId ? { orgId } : undefined });
}

export async function addSpmDispensasi(input: {
	orgId?: string;
	referenceNumber: string;
	issuedAt: string;
	isDispensasi?: boolean;
}) {
	return createSpmDispensasiFn({ data: input });
}

export async function editSpmDispensasi(input: {
	orgId?: string;
	spmId: string;
	referenceNumber?: string;
	issuedAt?: string;
	isDispensasi?: boolean;
}) {
	return updateSpmDispensasiFn({ data: input });
}

export async function removeSpmDispensasi(spmId: string, orgId?: string) {
	return deleteSpmDispensasiFn({ data: { spmId, orgId } });
}
