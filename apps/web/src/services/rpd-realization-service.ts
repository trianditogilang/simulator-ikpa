import {
	batchUpsertRpdRealizationFn,
	listRpdAndRealizationFn,
	upsertRealizationFn,
	upsertRpdFn,
} from "@/server/rpd-realization";

export interface RpdLineRecord {
	id: string;
	month: number;
	accountCode: "51" | "52" | "53" | "57" | string;
	amount: string;
}

export interface RealizationRecord {
	id: string;
	month: number;
	accountCode: "51" | "52" | "53" | "57" | string;
	amount: string;
}

export interface RpdRealizationData {
	fiscalYearId: string;
	year: number;
	rpdLines: RpdLineRecord[];
	realizations: RealizationRecord[];
}

export async function fetchRpdAndRealizations(
	orgId?: string,
): Promise<RpdRealizationData> {
	return listRpdAndRealizationFn({ data: orgId ? { orgId } : undefined });
}

export async function saveRpdLine(input: {
	orgId?: string;
	month: number;
	accountCode: "51" | "52" | "53" | "57";
	amount: string;
}) {
	return upsertRpdFn({ data: input });
}

export async function saveRealization(input: {
	orgId?: string;
	month: number;
	accountCode: "51" | "52" | "53" | "57";
	amount: string;
}) {
	return upsertRealizationFn({ data: input });
}

export async function batchSaveRpdRealization(input: {
	orgId?: string;
	target: "rpd" | "realization";
	rows: Array<{
		month: number;
		accountCode: "51" | "52" | "53" | "57";
		amount: string;
	}>;
}) {
	return batchUpsertRpdRealizationFn({ data: input });
}
