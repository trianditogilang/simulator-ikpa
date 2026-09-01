export interface RpdRealizationItem {
	id: string;
	month: number;
	monthName: string;
	account: "51" | "52" | "53" | "57";
	accountName: string;
	rpdAmount: number;
	realizationAmount: number;
	deviationPercent: number;
	absorptionPercent: number;
	status: "safe" | "warning" | "danger";
}

export const mockRpdRealizations: RpdRealizationItem[] = [
	{
		id: "rpd-01",
		month: 8,
		monthName: "Agustus",
		account: "51",
		accountName: "Belanja Pegawai",
		rpdAmount: 200000000,
		realizationAmount: 198000000,
		deviationPercent: 1.0,
		absorptionPercent: 99.0,
		status: "safe",
	},
	{
		id: "rpd-02",
		month: 8,
		monthName: "Agustus",
		account: "52",
		accountName: "Belanja Barang",
		rpdAmount: 150000000,
		realizationAmount: 125000000,
		deviationPercent: 16.67,
		absorptionPercent: 83.33,
		status: "warning",
	},
	{
		id: "rpd-03",
		month: 8,
		monthName: "Agustus",
		account: "53",
		accountName: "Belanja Modal",
		rpdAmount: 100000000,
		realizationAmount: 95000000,
		deviationPercent: 5.0,
		absorptionPercent: 95.0,
		status: "safe",
	},
];
