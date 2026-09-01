export interface PolicyHistoryVersionItem {
	id: string;
	version: string;
	status: "published" | "draft" | "retired";
	effectiveFrom: string;
	effectiveTo?: string;
	sourceRegulation: string;
	publishActor: string;
	publishTimestamp: string;
	changeSummary: string;
	snapshotUsageCount: number;
	deliveryProcessedCount: number;
	impactSummary: string;
	parameterDiffs: {
		parameterName: string;
		oldValue: string;
		newValue: string;
		impact: string;
	}[];
}

export const mockPolicyHistory: PolicyHistoryVersionItem[] = [
	{
		id: "hist-01",
		version: "2026.2",
		status: "draft",
		effectiveFrom: "01 September 2026",
		sourceRegulation: "Addendum Juknis IKPA Semester II / 2026",
		publishActor: "Admin KPPN Malang",
		publishTimestamp: "Menunggu Publikasi",
		changeSummary:
			"Penyesuaian toleransi deviasi RPD menjadi 3% dan relaksasi pengingat capaian output pada hari kerja ke-5.",
		snapshotUsageCount: 0,
		deliveryProcessedCount: 0,
		impactSummary: "Akan mengevaluasi ulang 120 jadwal notifikasi reminder yang belum dikirim.",
		parameterDiffs: [
			{
				parameterName: "Toleransi Deviasi Hal III DIPA",
				oldValue: "5,0% (Normal)",
				newValue: "3,0% (Diperketat)",
				impact: "Satker dengan deviasi > 3% akan menerima peringatan lebih dini.",
			},
			{
				parameterName: "Batas Laporan Output",
				oldValue: "Tanggal 5 kalender",
				newValue: "Hari kerja ke-5",
				impact: "Menghindari batas waktu jatuh pada hari libur/weekend.",
			},
		],
	},
	{
		id: "hist-02",
		version: "2026.1",
		status: "published",
		effectiveFrom: "01 Januari 2026",
		sourceRegulation: "PER-5/PB/2024 tentang Juknis IKPA",
		publishActor: "Admin Pembina DJPb Kemenkeu",
		publishTimestamp: "01 Jan 2026, 08.00 WIB",
		changeSummary: "Pemberlakuan formula standar 8 indikator IKPA tahun anggaran 2026.",
		snapshotUsageCount: 48,
		deliveryProcessedCount: 312,
		impactSummary: "Digunakan oleh seluruh simulasi dan laporan aktual semester I & II.",
		parameterDiffs: [
			{
				parameterName: "Bobot Capaian Output",
				oldValue: "17,5% (2025)",
				newValue: "25,0% (2026)",
				impact: "Peningkatan bobot prioritas pelaporan output pada satker.",
			},
			{
				parameterName: "Bobot Revisi DIPA",
				oldValue: "10,0%",
				newValue: "10,0%",
				impact: "Tetap 1 kali per triwulan.",
			},
		],
	},
	{
		id: "hist-03",
		version: "2025.1",
		status: "retired",
		effectiveFrom: "01 Januari 2025",
		effectiveTo: "31 Desember 2025",
		sourceRegulation: "PER-5/PB/2022 tentang IKPA",
		publishActor: "Admin Pembina DJPb Kemenkeu",
		publishTimestamp: "01 Jan 2025, 08.00 WIB",
		changeSummary: "Arsip konfigurasi penilaian IKPA tahun 2025.",
		snapshotUsageCount: 520,
		deliveryProcessedCount: 1450,
		impactSummary: "Arsip read-only untuk kebutuhan audit komparasi tahun sebelumnya.",
		parameterDiffs: [],
	},
];

export function getMockPolicyHistory(): PolicyHistoryVersionItem[] {
	return mockPolicyHistory;
}
