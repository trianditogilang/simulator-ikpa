export interface SatkerSettingsData {
	satkerCode: string;
	satkerName: string;
	kppnName: string;
	kppnCode: string;
	isBlu: boolean;
	targetIkpa: number;
	timezone: string;
	activeRuleSet: string;
	operators: { name: string; email: string; role: string }[];
}

export const mockSatkerSettings: SatkerSettingsData = {
	satkerCode: "123456",
	satkerName: "Kantor Pelayanan Perbendaharaan Satker Contoh",
	kppnName: "KPPN Malang",
	kppnCode: "032",
	isBlu: false,
	targetIkpa: 95.0,
	timezone: "Asia/Jakarta (WIB)",
	activeRuleSet: "2026.1 (PER-5/PB/2024)",
	operators: [
		{
			name: "Operator Satker Utama",
			email: "operator.satker@kemenkeu.go.id",
			role: "Operator Satker",
		},
		{
			name: "Pejabat Pembuat Komitmen",
			email: "ppk.satker@kemenkeu.go.id",
			role: "Viewer / Validator",
		},
	],
};
