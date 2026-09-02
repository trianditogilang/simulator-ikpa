import {
	createUpTupFn,
	deleteKkpFn,
	deleteUpTupFn,
	listUpTupAndKkpFn,
	upsertKkpFn,
} from "@/server/up-tup-kkp";

export interface UpTupRecord {
	id: string;
	type: "UP" | "TUP" | "GUP" | "GUP_NIHIL" | "PTUP" | "SETORAN_TUP" | string;
	amount: string;
	sp2dAt: string;
	referenceSp2dAt?: string | null;
	settlementDate?: string | null;
	isSettled: boolean;
}

export interface KkpRecord {
	id: string;
	month: number;
	amount: string;
	usageDate?: string | null;
}

export interface UpTupKkpData {
	fiscalYearId: string;
	year: number;
	upTupList: UpTupRecord[];
	kkpList: KkpRecord[];
}

export async function fetchUpTupAndKkp(orgId?: string): Promise<UpTupKkpData> {
	return listUpTupAndKkpFn({ data: orgId ? { orgId } : undefined });
}

export async function addUpTup(input: {
	orgId?: string;
	type: "UP" | "TUP" | "GUP" | "GUP_NIHIL" | "PTUP" | "SETORAN_TUP";
	amount: string;
	sp2dAt: string;
	referenceSp2dAt?: string | null;
	settlementDate?: string | null;
	isSettled?: boolean;
}) {
	return createUpTupFn({ data: input });
}

export async function removeUpTup(id: string, orgId?: string) {
	return deleteUpTupFn({ data: { id, orgId } });
}

export async function saveKkpUsage(input: {
	orgId?: string;
	month: number;
	amount: string;
	usageDate?: string | null;
}) {
	return upsertKkpFn({ data: input });
}

export async function removeKkpUsage(id: string, orgId?: string) {
	return deleteKkpFn({ data: { id, orgId } });
}
