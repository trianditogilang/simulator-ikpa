import {
	createContractFn,
	createSpmLsFn,
	deleteContractFn,
	deleteSpmLsFn,
	listContractsAndSpmFn,
	updateContractFn,
} from "@/server/contracts-invoices";

export interface ContractRecord {
	id: string;
	contractNumber: string;
	accountCode: "51" | "52" | "53" | string;
	value: string;
	signedAt: string;
	paymentType: "sekaligus" | "termin" | string;
	sp2dAt?: string | null;
}

export interface SpmLsRecord {
	id: string;
	contractId: string;
	referenceNumber: string;
	bastBappDate: string;
	receivedAtKppn: string;
	isPegawai: boolean;
}

export interface ContractsInvoicesData {
	fiscalYearId: string;
	year: number;
	contracts: ContractRecord[];
	spmLsList: SpmLsRecord[];
}

export async function fetchContractsAndInvoices(
	orgId?: string,
): Promise<ContractsInvoicesData> {
	return listContractsAndSpmFn({ data: orgId ? { orgId } : undefined });
}

export async function addContract(input: {
	orgId?: string;
	contractNumber: string;
	accountCode: "51" | "52" | "53";
	value: string;
	signedAt: string;
	paymentType: "sekaligus" | "termin";
	sp2dAt?: string | null;
}) {
	return createContractFn({ data: input });
}

export async function editContract(input: {
	orgId?: string;
	contractId: string;
	contractNumber?: string;
	accountCode?: "51" | "52" | "53";
	value?: string;
	signedAt?: string;
	paymentType?: "sekaligus" | "termin";
	sp2dAt?: string | null;
}) {
	return updateContractFn({ data: input });
}

export async function removeContract(contractId: string, orgId?: string) {
	return deleteContractFn({ data: { contractId, orgId } });
}

export async function addSpmLs(input: {
	orgId?: string;
	contractId: string;
	referenceNumber: string;
	bastBappDate: string;
	receivedAtKppn: string;
	isPegawai?: boolean;
}) {
	return createSpmLsFn({ data: input });
}

export async function removeSpmLs(spmId: string, orgId?: string) {
	return deleteSpmLsFn({ data: { spmId, orgId } });
}
