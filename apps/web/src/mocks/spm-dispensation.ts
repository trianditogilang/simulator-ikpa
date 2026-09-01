export interface SpmDispensationItem {
	id: string;
	spmNumber: string;
	spmDate: string;
	quarter: 4;
	amount: number;
	dispensationReason: string;
	isDispensation: boolean;
}

export const mockSpmDispensations: SpmDispensationItem[] = [
	{
		id: "spm-01",
		spmNumber: "SPM-LS/0089/2026",
		spmDate: "22 Des 2026",
		quarter: 4,
		amount: 350000000,
		dispensationReason: "Keterlambatan Pendaftaran Kontrak Akhir Tahun",
		isDispensation: true,
	},
	{
		id: "spm-02",
		spmNumber: "SPM-UP/0090/2026",
		spmDate: "24 Des 2026",
		quarter: 4,
		amount: 45000000,
		dispensationReason: "Revolving Tambahan Akhir Tahun",
		isDispensation: false,
	},
];
