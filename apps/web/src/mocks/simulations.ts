export interface SimulationHistoryItem {
	id: string;
	name: string;
	type: "actual" | "forecast" | "scenario";
	periodLabel: string;
	totalScore: number;
	ruleSetVersion: string;
	createdAt: string;
}

export const mockSimulations: SimulationHistoryItem[] = [
	{
		id: "sim-01",
		name: "Data Riil OMSPAN Agustus",
		type: "actual",
		periodLabel: "Agustus 2026",
		totalScore: 94.2,
		ruleSetVersion: "2026.1",
		createdAt: "31 Agu 2026, 15.00 WIB",
	},
	{
		id: "sim-02",
		name: "Skenario Percepatan SPM BAST K-001",
		type: "scenario",
		periodLabel: "Agustus 2026",
		totalScore: 95.75,
		ruleSetVersion: "2026.1",
		createdAt: "31 Agu 2026, 15.30 WIB",
	},
	{
		id: "sim-03",
		name: "Proyeksi Akhir Triwulan III",
		type: "forecast",
		periodLabel: "September 2026",
		totalScore: 96.1,
		ruleSetVersion: "2026.1",
		createdAt: "31 Agu 2026, 16.00 WIB",
	},
];
