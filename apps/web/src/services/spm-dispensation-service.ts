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

export interface SpmDispensationData {
	fiscalYearId: string;
	year: number;
	spmQ4List: SpmQ4Record[];
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
