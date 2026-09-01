export interface ContractInvoiceItem {
	id: string;
	contractNumber: string;
	vendorName: string;
	contractValue: number;
	bastDate: string;
	deadlineDate: string;
	workDaysLeft: number;
	status: "safe" | "warning" | "danger" | "completed";
	statusLabel: string;
	spmNumber?: string;
	spmDate?: string;
}

export const mockContractsInvoices: ContractInvoiceItem[] = [
	{
		id: "cnt-01",
		contractNumber: "KTR-2026/015/08-01",
		vendorName: "PT Sumber Sarana Teknologi",
		contractValue: 450000000,
		bastDate: "12 Agustus 2026",
		deadlineDate: "04 September 2026",
		workDaysLeft: 2,
		status: "warning",
		statusLabel: "H-2 Kerja",
	},
	{
		id: "cnt-02",
		contractNumber: "KTR-2026/015/08-02",
		vendorName: "CV Prima Konstruksi",
		contractValue: 280000000,
		bastDate: "02 Agustus 2026",
		deadlineDate: "25 Agustus 2026",
		workDaysLeft: 0,
		status: "danger",
		statusLabel: "Terlambat",
	},
	{
		id: "cnt-03",
		contractNumber: "KTR-2026/015/07-01",
		vendorName: "PT Media Kreasi Mandiri",
		contractValue: 120000000,
		bastDate: "10 Juli 2026",
		deadlineDate: "31 Juli 2026",
		workDaysLeft: 10,
		status: "completed",
		statusLabel: "Tepat Waktu",
		spmNumber: "SPM-LS/0045/2026",
		spmDate: "20 Juli 2026",
	},
];
