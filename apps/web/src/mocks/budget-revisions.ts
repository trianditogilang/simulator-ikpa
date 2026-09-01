export interface BudgetRevisionItem {
	id: string;
	dipaNumber: string;
	revisionSequence: number;
	semester: 1 | 2;
	revisionDate: string;
	pagu51: number;
	pagu52: number;
	pagu53: number;
	pagu57: number;
	totalPagu: number;
	isEligibleIkpa: boolean;
	notes: string;
}

export const mockBudgetRevisions: BudgetRevisionItem[] = [
	{
		id: "rev-01",
		dipaNumber: "DIPA-015.08.2.123456/2026",
		revisionSequence: 0,
		semester: 1,
		revisionDate: "02 Jan 2026",
		pagu51: 2500000000,
		pagu52: 1800000000,
		pagu53: 1200000000,
		pagu57: 0,
		totalPagu: 5500000000,
		isEligibleIkpa: true,
		notes: "DIPA Induk Awal Tahun",
	},
	{
		id: "rev-02",
		dipaNumber: "DIPA-015.08.2.123456/2026",
		revisionSequence: 1,
		semester: 1,
		revisionDate: "15 Apr 2026",
		pagu51: 2500000000,
		pagu52: 1950000000,
		pagu53: 1050000000,
		pagu57: 0,
		totalPagu: 5500000000,
		isEligibleIkpa: true,
		notes: "Pergeseran Anggaran Antar Jenis Belanja",
	},
];
