export interface UpTupKkpItem {
	id: string;
	transactionType: "GUP" | "PTUP" | "SETORAN_TUP" | "KKP";
	referenceNumber: string;
	sp2dDate: string;
	amount: number;
	intervalDays: number;
	status: "safe" | "warning" | "danger";
	statusLabel: string;
}

export const mockUpTupKkpList: UpTupKkpItem[] = [
	{
		id: "up-01",
		transactionType: "GUP",
		referenceNumber: "SP2D-UP/0012/2026",
		sp2dDate: "16 Mar 2026",
		amount: 85000000,
		intervalDays: 24,
		status: "safe",
		statusLabel: "Tepat Waktu (< 30 Hari)",
	},
	{
		id: "up-02",
		transactionType: "KKP",
		referenceNumber: "TAG-KKP/0004/2026",
		sp2dDate: "20 Agu 2026",
		amount: 25000000,
		intervalDays: 12,
		status: "safe",
		statusLabel: "Lunas",
	},
];
