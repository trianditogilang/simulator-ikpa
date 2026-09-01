export interface ImportJobItem {
	id: string;
	fileName: string;
	domain: string;
	uploadedAt: string;
	totalRows: number;
	validRows: number;
	errorRows: number;
	status: "preview" | "processing" | "completed" | "failed";
}

export const mockImportJobs: ImportJobItem[] = [
	{
		id: "job-01",
		fileName: "pagu-revisi-dipa-2026.xlsx",
		domain: "Pagu & Revisi DIPA",
		uploadedAt: "31 Agu 2026, 14.30 WIB",
		totalRows: 120,
		validRows: 115,
		errorRows: 5,
		status: "preview",
	},
];
