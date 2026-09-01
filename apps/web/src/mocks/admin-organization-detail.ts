export interface AdminOrgDetailIndicator {
	id: string;
	code: string;
	name: string;
	weight: number;
	rawScore: number;
	weightedScore: number;
	target: number;
	gap: number;
	status: "complete" | "warning" | "danger";
	statusLabel: string;
	isDeduction?: boolean;
	summary: string;
	warnings: string[];
}

export interface AdminOrgDetailData {
	id: string;
	code: string;
	name: string;
	isBlu: boolean;
	kppnCode: string;
	kppnName: string;
	address: string;
	email: string;
	phone: string;
	operators: { name: string; email: string; role: string; lastActive: string }[];
	fiscalYear: number;
	periodMonth: number;
	ruleSetVersion: string;
	lastUpdated: string;
	totalScore: number;
	targetScore: number;
	gapScore: number;
	riskLevel: "danger" | "warning" | "safe";
	riskSummary: string;
	indicators: AdminOrgDetailIndicator[];
	risksAndDeadlines: {
		id: string;
		title: string;
		event: string;
		deadline: string;
		workDaysLeft: number;
		severity: "danger" | "warning";
	}[];
	completeness: {
		domain: string;
		isComplete: boolean;
		label: string;
		details: string;
	}[];
	trend: { month: string; score: number; target: number }[];
	snapshots: {
		id: string;
		name: string;
		type: string;
		totalScore: number;
		createdAt: string;
		ruleSet: string;
	}[];
	reminders: {
		id: string;
		event: string;
		scheduledFor: string;
		status: "sent" | "scheduled" | "failed";
		recipient: string;
	}[];
	auditLogs: {
		id: string;
		timestamp: string;
		actor: string;
		action: string;
		summary: string;
	}[];
}

export const mockAdminOrgDetailPoltek: AdminOrgDetailData = {
	id: "org-01",
	code: "415234",
	name: "Politeknik Negeri Malang",
	isBlu: true,
	kppnCode: "032",
	kppnName: "KPPN Malang",
	address: "Jl. Soekarno Hatta No.9, Jatimulyo, Kec. Lowokwaru, Kota Malang",
	email: "keuangan@polinema.ac.id",
	phone: "(0341) 404424",
	operators: [
		{
			name: "Bambang Sudarsono",
			email: "bambang.keu@polinema.ac.id",
			role: "Operator SPM / Keuangan",
			lastActive: "31 Agu 2026, 14.50 WIB",
		},
		{
			name: "Dewi Lestari",
			email: "dewi.anggaran@polinema.ac.id",
			role: "Operator Pagu & DIPA",
			lastActive: "30 Agu 2026, 10.15 WIB",
		},
		{
			name: "Rian Prasetya",
			email: "rian.output@polinema.ac.id",
			role: "Operator Capaian Output",
			lastActive: "28 Agu 2026, 16.00 WIB",
		},
	],
	fiscalYear: 2026,
	periodMonth: 8,
	ruleSetVersion: "2026.1",
	lastUpdated: "31 Agu 2026, 15.00 WIB",
	totalScore: 88.4,
	targetScore: 95.0,
	gapScore: -6.6,
	riskLevel: "danger",
	riskSummary:
		"Skor di bawah target nasional karena kendala keterlambatan SPM-LS (BAST K-001) dan Deviasi Halaman III DIPA pada triwulan berjalan.",
	indicators: [
		{
			id: "ind-1",
			code: "revisi_dipa",
			name: "Revisi DIPA",
			weight: 10,
			rawScore: 100.0,
			weightedScore: 10.0,
			target: 100.0,
			gap: 0.0,
			status: "complete",
			statusLabel: "Sempurna",
			summary: "1 revisi telah disahkan pada Triwulan III (Batas: 1x/triwulan).",
			warnings: [],
		},
		{
			id: "ind-2",
			code: "deviasi_rpd",
			name: "Deviasi Halaman III DIPA",
			weight: 15,
			rawScore: 84.5,
			weightedScore: 12.68,
			target: 95.0,
			gap: -10.5,
			status: "danger",
			statusLabel: "Kritis",
			summary: "Rata-rata deviasi bulanan 8,4% melebihi batas toleransi 5,0%.",
			warnings: ["Penyerapan Belanja Barang (52) meleset Rp 420.000.000 dari RPD."],
		},
		{
			id: "ind-3",
			code: "budget_absorption",
			name: "Penyerapan Anggaran",
			weight: 20,
			rawScore: 92.5,
			weightedScore: 18.5,
			target: 95.0,
			gap: -2.5,
			status: "warning",
			statusLabel: "Waspada",
			summary: "Realisasi kumulatif belanja 71,2% terhadap target triwulan III 75,0%.",
			warnings: ["Belanja Modal akun 53 masih di angka 54%."],
		},
		{
			id: "ind-4",
			code: "contractual",
			name: "Belanja Kontraktual",
			weight: 10,
			rawScore: 95.0,
			weightedScore: 9.5,
			target: 95.0,
			gap: 0.0,
			status: "complete",
			statusLabel: "Baik",
			summary: "12 dari 12 kontrak telah didaftarkan tepat waktu (≤ 3 hari kerja).",
			warnings: [],
		},
		{
			id: "ind-5",
			code: "invoice_timeliness",
			name: "Penyelesaian Tagihan (SPM-LS)",
			weight: 10,
			rawScore: 78.2,
			weightedScore: 7.82,
			target: 95.0,
			gap: -16.8,
			status: "danger",
			statusLabel: "Kritis",
			summary: "3 dari 14 SPM-LS terlambat diterbitkan melewati batas H+17 hari kerja BAST.",
			warnings: ["BAST K-001 belum diajukan SPM pada H-2 batas waktu."],
		},
		{
			id: "ind-6",
			code: "up_tup",
			name: "Pengelolaan UP dan TUP",
			weight: 10,
			rawScore: 90.0,
			weightedScore: 9.0,
			target: 95.0,
			gap: -5.0,
			status: "warning",
			statusLabel: "Waspada",
			summary: "GUP revolving rata-rata 27 hari, KKP proporsi 8,2% dari target 10%.",
			warnings: [],
		},
		{
			id: "ind-7",
			code: "output_achievement",
			name: "Capaian Output",
			weight: 25,
			rawScore: 83.6,
			weightedScore: 20.9,
			target: 95.0,
			gap: -11.4,
			status: "danger",
			statusLabel: "Kritis",
			summary: "PCRO 78,5% dan keterisian data terkonfirmasi baru 70% dari target 100%.",
			warnings: ["2 Rincian Output belum diverifikasi oleh PPK."],
		},
		{
			id: "ind-8",
			code: "spm_dispensation",
			name: "Dispensasi SPM (Pengurang)",
			weight: 0,
			rawScore: 0.0,
			weightedScore: 0.0,
			target: 0.0,
			gap: 0.0,
			status: "complete",
			statusLabel: "Aman",
			isDeduction: true,
			summary: "0 SPM dispensasi diajukan pada Triwulan IV.",
			warnings: [],
		},
	],
	risksAndDeadlines: [
		{
			id: "rd-1",
			title: "Penyelesaian Tagihan BAST K-001 (Lab Komputer)",
			event: "Batas 17 Hari Kerja SPM-LS",
			deadline: "04 September 2026",
			workDaysLeft: 2,
			severity: "danger",
		},
		{
			id: "rd-2",
			title: "Konfirmasi Capaian Output 2 RO Utama",
			event: "Pelaporan Capaian Output Periode Agustus",
			deadline: "07 September 2026",
			workDaysLeft: 4,
			severity: "warning",
		},
		{
			id: "rd-3",
			title: "Revolving GUP Ke-4 Tahun 2026",
			event: "Batas Revolving 30 Hari",
			deadline: "12 September 2026",
			workDaysLeft: 8,
			severity: "warning",
		},
	],
	completeness: [
		{
			domain: "Pagu & Revisi DIPA",
			isComplete: true,
			label: "Lengkap",
			details: "DIPA Awal & Revisi Ke-1 telah tercatat sinkron.",
		},
		{
			domain: "RPD & Realisasi",
			isComplete: true,
			label: "Lengkap",
			details: "Data Hal III DIPA bulan 1 s.d. 8 telah terisi.",
		},
		{
			domain: "Kontrak & Tagihan",
			isComplete: true,
			label: "Lengkap",
			details: "12 Kontrak dan 14 BAST tercatat lengkap.",
		},
		{
			domain: "UP/TUP & KKP",
			isComplete: true,
			label: "Lengkap",
			details: "Histori SP2D UP/GUP dan KKP bulan Agustus tercatat.",
		},
		{
			domain: "Capaian Output",
			isComplete: false,
			label: "Belum Lengkap",
			details: "2 dari 18 RO belum divalidasi PPK.",
		},
		{
			domain: "Dispensasi SPM",
			isComplete: true,
			label: "Lengkap",
			details: "Nol dispensasi tercatat.",
		},
	],
	trend: [
		{ month: "Jan", score: 95.2, target: 95.0 },
		{ month: "Feb", score: 94.0, target: 95.0 },
		{ month: "Mar", score: 92.8, target: 95.0 },
		{ month: "Apr", score: 91.5, target: 95.0 },
		{ month: "Mei", score: 90.2, target: 95.0 },
		{ month: "Jun", score: 89.4, target: 95.0 },
		{ month: "Jul", score: 88.9, target: 95.0 },
		{ month: "Agu", score: 88.4, target: 95.0 },
	],
	snapshots: [
		{
			id: "snap-01",
			name: "Evaluasi Aktual Akhir Agustus 2026",
			type: "Actual",
			totalScore: 88.4,
			createdAt: "31 Agu 2026, 15.00 WIB",
			ruleSet: "2026.1",
		},
		{
			id: "snap-02",
			name: "Proyeksi Semester II Jika BAST Tuntas",
			type: "Forecast",
			totalScore: 92.1,
			createdAt: "28 Agu 2026, 11.20 WIB",
			ruleSet: "2026.1",
		},
	],
	reminders: [
		{
			id: "rem-01",
			event: "Batas SPM-LS BAST K-001 (H-2)",
			scheduledFor: "02 Sep 2026, 09.00 WIB",
			status: "scheduled",
			recipient: "bambang.keu@polinema.ac.id",
		},
		{
			id: "rem-02",
			event: "Pelaporan Capaian Output Agustus (H-5)",
			scheduledFor: "30 Agu 2026, 09.00 WIB",
			status: "sent",
			recipient: "rian.output@polinema.ac.id",
		},
	],
	auditLogs: [
		{
			id: "aud-01",
			timestamp: "31 Agu 2026, 14.50 WIB",
			actor: "Bambang Sudarsono (Operator)",
			action: "update",
			summary: "Memperbarui data realisasi BAST K-001",
		},
		{
			id: "aud-02",
			timestamp: "28 Agu 2026, 16.10 WIB",
			actor: "Rian Prasetya (Operator)",
			action: "import",
			summary: "Import data Capaian Output 16 RO dari Excel",
		},
		{
			id: "aud-03",
			timestamp: "15 Agu 2026, 10.30 WIB",
			actor: "Dewi Lestari (Operator)",
			action: "create",
			summary: "Merekam Pengesahan Revisi DIPA Ke-1",
		},
	],
};

export function getMockAdminOrganizationDetail(orgId: string): AdminOrgDetailData {
	// For demo/prototype purposes, return Poltek data or customized name
	if (orgId === "org-02") {
		return {
			...mockAdminOrgDetailPoltek,
			id: "org-02",
			code: "527812",
			name: "Balai Besar Taman Nasional Bromo Tengger Semeru",
			isBlu: false,
			totalScore: 89.1,
			gapScore: -5.9,
			riskSummary: "Deviasi Hal III DIPA Triwulan III sebesar 8,4% melebihi ambang 5%.",
		};
	}

	return mockAdminOrgDetailPoltek;
}
