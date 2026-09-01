export interface OutputAchievementItem {
	id: string;
	roCode: string;
	roName: string;
	month: number;
	pcroPercent: number;
	tpcroPercent: number;
	rvroValue: number;
	isConfirmed: boolean;
	status: "confirmed" | "pending";
}

export const mockOutputAchievements: OutputAchievementItem[] = [
	{
		id: "out-01",
		roCode: "015.08.WA.5231.EBA.001",
		roName: "Layanan Perkantoran dan Operasional",
		month: 8,
		pcroPercent: 100,
		tpcroPercent: 100,
		rvroValue: 12,
		isConfirmed: true,
		status: "confirmed",
	},
	{
		id: "out-02",
		roCode: "015.08.WA.5231.EBA.002",
		roName: "Penyusunan Laporan Keuangan Satker",
		month: 8,
		pcroPercent: 50,
		tpcroPercent: 50,
		rvroValue: 1,
		isConfirmed: false,
		status: "pending",
	},
];
