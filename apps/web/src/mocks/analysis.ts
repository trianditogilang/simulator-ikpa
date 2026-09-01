export interface AnalysisItem {
	id: string;
	priority: 1 | 2 | 3;
	indicatorName: string;
	title: string;
	issue: string;
	potentialImpactPoints: number;
	deadlineLabel: string;
	route: string;
	status: "open" | "reviewed";
}

export const mockAnalysisList: AnalysisItem[] = [
	{
		id: "ana-01",
		priority: 1,
		indicatorName: "Penyelesaian Tagihan (SPM-LS)",
		title: "1 Tagihan Mendekati Batas 17 Hari Kerja",
		issue:
			"Tagihan BAST Kontrak K-001 (Rp 450 Juta) akan mencapai batas waktu dalam 2 hari kerja.",
		potentialImpactPoints: 0.89,
		deadlineLabel: "04 Sep 2026",
		route: "/operator/data/contracts-invoices",
		status: "open",
	},
	{
		id: "ana-02",
		priority: 2,
		indicatorName: "Penyerapan Anggaran",
		title: "Deviasi Realisasi Belanja Barang Akun 52",
		issue:
			"Realisasi SP2D akun 52 Triwulan III baru mencapai 83,33% dari target RPD 90%.",
		potentialImpactPoints: 0.65,
		deadlineLabel: "Akhir Triwulan III",
		route: "/operator/data/rpd-realization",
		status: "open",
	},
	{
		id: "ana-03",
		priority: 3,
		indicatorName: "Capaian Output",
		title: "2 Laporan RO Belum Dikonfirmasi",
		issue:
			"Laporan progres fisik 2 RO belum terkonfirmasi oleh PPK sehingga nilai belum eligible.",
		potentialImpactPoints: 0.5,
		deadlineLabel: "07 Sep 2026",
		route: "/operator/data/output-achievement",
		status: "open",
	},
];
